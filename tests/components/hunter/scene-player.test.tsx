import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScenePlayer } from '@/components/safety-quest/hunter/routes/scene-player'
import { getScenarioCurriculum } from '@/lib/hunter/routes/curriculum'

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
afterEach(() => { vi.restoreAllMocks() })

describe('route learning player', () => {
  it('keeps weather scenarios locked until every normal scene is cleared', () => {
    render(<ScenePlayer splatUrl="/private/scene.spz" schoolYear={9} scenario="rain" normalCleared={false} onComplete={vi.fn()} />)
    expect(screen.getByText('いつもの道をクリアすると遊べます')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('requires prediction, reason and action, records mistakes, and allows retrying failed saves', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    const note = { id: '11111111-1111-4111-8111-111111111111', photoIndex: 0, point: { x: 0.5, y: 0.5 },
      category: 'traffic' as const, source: 'observed' as const, scenario: 'normal' as const,
      title: 'かべの向こう', evidence: '高いかべがある', detail: '自転車が出てくるかもしれない' }
    render(<ScenePlayer splatUrl="/private/scene.spz" schoolYear={9} onComplete={save} noteContext={{ courseId: 'course', sceneId: 'scene', notes: [note] }} />)
    const lessons = getScenarioCurriculum('normal', 9)
    for (const [index, lesson] of lessons.entries()) {
      fireEvent.click(screen.getByRole('button', { name: '気をつけるところを考えた' }))
      for (const [questionIndex, kind] of (['prediction', 'reason', 'action'] as const).entries()) {
        const question = lesson.questions[kind]
        if (index === 0 && questionIndex === 0) {
          const wrong = question.choices.find(choice => choice.id !== question.correctId)!
          fireEvent.click(screen.getByRole('radio', { name: wrong.text }))
          fireEvent.click(screen.getByRole('button', { name: '答えを確かめる' }))
          expect(screen.getByText('もう一度、場面を考えてみよう。')).toBeInTheDocument()
          expect(save).not.toHaveBeenCalled()
        }
        fireEvent.click(screen.getByRole('radio', { name: question.choices.find(choice => choice.id === question.correctId)!.text }))
        fireEvent.click(screen.getByRole('button', { name: '答えを確かめる' }))
        if (questionIndex < 2) fireEvent.click(screen.getByRole('button', { name: '次へ', exact: true }))
      }
      if (index < lessons.length - 1) fireEvent.click(screen.getByRole('button', { name: '次の危険へ' }))
    }
    expect(screen.getByRole('button', { name: 'クリアの記録を保存する' })).toBeDisabled()
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'この危険のメモを確認した' }))
    fireEvent.click(screen.getByRole('button', { name: 'クリアの記録を保存する' }))
    await screen.findByText('学習記録を保存できませんでした。通信を確認して、もう一度保存してください。')
    expect(screen.queryByRole('button', { name: '記録を保存しました' })).not.toBeInTheDocument()
    expect(save.mock.calls[0][0].mistakes).toEqual([expect.objectContaining({ hazardId: lessons[0].id })])
    expect(save.mock.calls[0][0].answers).toHaveLength(lessons.length)
    expect(save.mock.calls[0][0].reviewedNoteIds).toEqual([note.id])
    fireEvent.click(screen.getByRole('button', { name: 'クリアの記録を保存する' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '記録を保存しました' })).toBeDisabled())
  }, 20_000)
})
