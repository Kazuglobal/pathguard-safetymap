// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { routeErrorMessage } from '@/lib/route-api'

describe('通学路の保存の誤りは日本語で返す(英語の内部メッセージを画面に出さない)', () => {
  it.each([
    ['Missing required route fields', '通学路の名前・出発地・到着地を入れてください'],
    ['Invalid route coordinates', '出発地・到着地の場所を選び直してください'],
    // 呼び名から子どもを登録するときの誤り
    ['Too many children', 'お子さまは10人まで登録できます。設定でお子さまを整理してから、もう一度保存してください'],
    ['Invalid child nickname', '呼び名は1〜20文字で入力してください'],
    ['something internal', '入力を確かめてください'],
  ])('%s → %s', (message, expected) => {
    expect(routeErrorMessage(new RangeError(message))).toBe(expected)
  })

  it('読み取れない本文', () => {
    expect(routeErrorMessage(new SyntaxError('Unexpected token'))).toBe('送った内容を読み取れませんでした。もう一度お試しください')
  })
})
