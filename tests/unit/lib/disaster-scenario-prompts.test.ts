import { describe, expect, it } from 'vitest'

import {
  ACCIDENT_SITUATION_PROMPT,
  defaultSituations,
  getPromptById,
  promptCategories,
} from '@/lib/disaster-scenario-prompts'

describe('disaster-scenario child prompts', () => {
  it('do not mention kodomo 110 houses in child image prompts', () => {
    const childCategory = promptCategories.find((category) => category.id === 'children')

    expect(childCategory).toBeDefined()
    expect(childCategory?.prompts.length).toBeGreaterThan(0)

    for (const prompt of childCategory?.prompts ?? []) {
      expect(prompt.prompt).not.toContain('子ども110番')
      expect(prompt.prompt).not.toContain('こども110番')
      expect(prompt.prompt).not.toContain('110番の家')
    }
  })
})

describe('accident-data situation', () => {
  it('is available as an explicit situation', () => {
    expect(defaultSituations).toContainEqual({
      id: 'accident',
      name: 'じこデータ',
      description: '実際の事故データにもとづく注意マップ',
    })
  })

  it('keeps the generated image factual, non-graphic, and privacy preserving', () => {
    expect(ACCIDENT_SITUATION_PROMPT).toContain('事故件数・時間帯・事故類型・天候だけ')
    expect(ACCIDENT_SITUATION_PROMPT).toContain('数値や事実を追加・変更しない')
    expect(ACCIDENT_SITUATION_PROMPT).toContain('負傷者')
    expect(ACCIDENT_SITUATION_PROMPT).toContain('損壊車両')
    expect(ACCIDENT_SITUATION_PROMPT).toContain('顔・車のナンバープレート')
  })
})

describe('managed prompt hazard metadata', () => {
  it('gates only the managed prompt that positively depicts road inundation', () => {
    expect(getPromptById('parent-1')?.requiresFloodGate).toBe(true)
    expect(getPromptById('parent-2')?.requiresFloodGate).not.toBe(true)
  })
})
