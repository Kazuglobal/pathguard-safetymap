import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SceneNotesEditor, SceneNotesLearning } from '@/components/safety-quest/hunter/routes/scene-notes'
import type { SceneNote } from '@/lib/hunter/routes/notes'

const note: SceneNote = { id: '11111111-1111-4111-8111-111111111111', source: 'observed',
  category: 'traffic', scenario: 'normal', photoIndex: 0, point: { x: 0.2, y: 0.8 },
  title: '曲がり角', evidence: '高いかべが写っている', detail: 'かべの向こうから自転車が来るかもしれない' }

describe('photo note editor', () => {
  it('adds an observed feature only with evidence, keeps the draft after a failed save, and allows retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('オフラインです')).mockResolvedValueOnce(undefined)
    render(<SceneNotesEditor courseId="course" sceneId="scene" photoCount={2} notes={[]} onSave={save} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /危険のメモを追加/ }))
    fireEvent.change(screen.getByRole('combobox', { name: '情報の区別' }), { target: { value: 'observed' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'メモの名前' }), { target: { value: note.title } })
    fireEvent.change(screen.getByRole('textbox', { name: 'どんな危険を考える？' }), { target: { value: note.detail } })
    expect(screen.getByRole('button', { name: 'コースに保存する' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'メモを一覧に反映' }))
    expect(screen.getByRole('alert')).toHaveTextContent('写真で確認できた特徴を記入してください。')
    fireEvent.change(screen.getByRole('textbox', { name: /写真で確認できた特徴/ }), { target: { value: note.evidence } })
    fireEvent.change(screen.getByRole('slider', { name: /左右位置/ }), { target: { value: 20 } })
    fireEvent.change(screen.getByRole('combobox', { name: '写真', exact: true }), { target: { value: 1 } })
    fireEvent.click(screen.getByRole('button', { name: 'メモを一覧に反映' }))
    fireEvent.click(screen.getByRole('button', { name: 'コースに保存する' }))
    await screen.findByText('オフラインです')
    expect(save.mock.calls[0][0]).toEqual([expect.objectContaining({ title: note.title, evidence: note.evidence, source: 'observed', photoIndex: 1, point: { x: 0.2, y: 0.5 } })])
    fireEvent.click(screen.getByRole('button', { name: 'コースに保存する' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0])
  })

  it('preserves the note ID when correcting the source and permits removal before saving', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<SceneNotesEditor courseId="course" sceneId="scene" photoCount={1} notes={[note]} onSave={save} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '曲がり角を編集' }))
    fireEvent.change(screen.getByRole('combobox', { name: '情報の区別' }), { target: { value: 'imagined' } })
    fireEvent.change(screen.getByRole('textbox', { name: /写真で確認できた特徴/ }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'メモを一覧に反映' }))
    fireEvent.click(screen.getByRole('button', { name: 'コースに保存する' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith([{ ...note, source: 'imagined', evidence: '' }]))
    await waitFor(() => expect(screen.getByRole('button', { name: '曲がり角を削除' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '曲がり角を削除' }))
    fireEvent.click(screen.getByRole('button', { name: 'コースに保存する' }))
    await waitFor(() => expect(save).toHaveBeenLastCalledWith([]))
  })
})

describe('photo note learning', () => {
  it('opens notes through photo markers, shows provenance, and confirms each note without counting a different scenario', () => {
    const imagined: SceneNote = { ...note, id: '22222222-2222-4222-8222-222222222222', source: 'imagined', title: '自転車が来たら' }
    const rainy: SceneNote = { ...note, id: '33333333-3333-4333-8333-333333333333', scenario: 'rain', title: '雨の水たまり' }
    function Learning() {
      const [ids, setIds] = useState<string[]>([])
      return <SceneNotesLearning courseId="course" sceneId="scene" notes={[note, imagined, rainy]} scenario="normal" schoolYear={9} reviewedIds={ids} onReview={id => setIds(current => [...current, id])} />
    }
    render(<Learning />)
    expect(screen.getByText('写真で確認した特徴')).toBeInTheDocument()
    expect(screen.queryByText('雨の水たまり')).not.toBeInTheDocument()
    fireEvent.load(screen.getByRole('img'))
    fireEvent.click(screen.getByRole('button', { name: 'この危険のメモを確認した' }))
    expect(screen.getByText('1 / 2 確認')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '自転車が来たらの目印' }))
    expect(screen.getByText('学習のための想定')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'この危険のメモを確認した' }))
    expect(screen.getByText('2 / 2 確認')).toBeInTheDocument()
  })
})
