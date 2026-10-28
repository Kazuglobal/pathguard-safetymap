import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteBuilder } from '@/components/safety-quest/hunter/routes/route-builder'
import { readPhotoGps } from '@/lib/hunter/routes/photo-order'
vi.mock('@/lib/hunter/routes/photo-order', async original => ({ ...await original<typeof import('@/lib/hunter/routes/photo-order')>(), readPhotoGps: vi.fn().mockResolvedValue(null) }))
vi.mock('@/components/safety-quest/hunter/routes/course-library', () => ({ CourseLibrary: () => null, routeRequest: vi.fn() }))
vi.mock('@/components/safety-quest/hunter/routes/route-notebook', () => ({ RouteNotebook: ({ onCreate }: { onCreate: () => void }) => <button onClick={onCreate}>写真からコースをつくる</button> }))
vi.mock('@/components/safety-quest/hunter/routes/school-panel', () => ({ SchoolPanel: () => null }))

vi.mock('@/components/safety-quest/hunter/mask-confirm', () => ({ MaskConfirm: ({ onConfirm, file }: { onConfirm: (url: string) => void; file: File }) => <><span>{file.name}</span><button onClick={() => onConfirm('data:image/webp;base64,YQ==')}>確認完了</button></> }))
beforeEach(() => {
  vi.mocked(readPhotoGps).mockReset().mockResolvedValue(null)
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})
describe('RouteBuilder', () => {
  it('requires masking and excludes the home photo from preview', async () => {
    render(<RouteBuilder />)
    fireEvent.click(screen.getByText('写真からコースをつくる'))
    fireEvent.change(screen.getByLabelText('通学路の写真を追加'), { target: { files: [1, 2, 3].map(i => new File(['x'], `${i}.jpg`, { type: 'image/jpeg' })) } })
    await waitFor(() => expect(screen.queryByText('写真の位置情報を確認中…')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /使う写真を確認/ })).toBeDisabled()
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    for (const [index, name] of [[1, '交差点'], [2, '学校']] as const) {
      fireEvent.change(screen.getAllByPlaceholderText('例：学校前の交差点')[index], { target: { value: name } })
      fireEvent.click(screen.getAllByRole('button', { name: 'ぼかしを確認' })[index])
      fireEvent.click(screen.getByText('確認完了'))
    }
    fireEvent.click(screen.getByRole('button', { name: /使う写真を確認/ }))
    expect(screen.getByRole('region', { name: 'コースの確認' }).querySelectorAll('img')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'この写真でコースを保存する' })).toBeDisabled()
    fireEvent.click(screen.getAllByRole('button', { name: 'ぼかしを確認' })[1])
    expect(screen.getByText('masked.webp')).toBeInTheDocument()
  })
  it('rejects unsupported files', () => {
    render(<RouteBuilder />)
    fireEvent.click(screen.getByText('写真からコースをつくる'))
    fireEvent.change(screen.getByLabelText('通学路の写真を追加'), { target: { files: [new File(['x'], 'x.svg', { type: 'image/svg+xml' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG・PNG・WebP')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
  it('preserves corrected order when more photos are appended', async () => {
    vi.mocked(readPhotoGps).mockResolvedValueOnce({ latitude: 35, longitude: 139 }).mockResolvedValueOnce({ latitude: 35, longitude: 139.01 }).mockResolvedValueOnce({ latitude: 35, longitude: 139.02 })
    render(<RouteBuilder />)
    fireEvent.click(screen.getByText('写真からコースをつくる'))
    const upload = () => screen.getByLabelText('通学路の写真を追加')
    fireEvent.change(upload(), { target: { files: [1, 2, 3].map(i => new File(['x'], `${i}.jpg`, { type: 'image/jpeg' })) } })
    await waitFor(() => expect(upload()).not.toBeDisabled())
    screen.getAllByPlaceholderText('例：学校前の交差点').forEach((input, i) => fireEvent.change(input, { target: { value: ['学校', '交差点', '水路'][i] } }))
    fireEvent.click(screen.getByRole('button', { name: '写真3を前へ' }))
    fireEvent.change(upload(), { target: { files: [new File(['x'], 'last.png', { type: 'image/png' })] } })
    await waitFor(() => expect(upload()).not.toBeDisabled())
    expect(screen.getAllByPlaceholderText('例：学校前の交差点').map(input => (input as HTMLInputElement).value)).toEqual(['学校', '水路', '交差点', ''])
  })
})
