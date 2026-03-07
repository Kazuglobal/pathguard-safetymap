import { describe, expect, it } from 'vitest'

import { promptCategories } from '@/lib/disaster-scenario-prompts'

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
