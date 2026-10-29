// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { LP_FAQ, LP_FEATURE_TOUR, LP_FEATURES, LP_HOW, LP_TRUST } from '@/lib/lp-content'
import { PRODUCT_FACTS, PRODUCT_FEATURES } from '@/lib/product-facts'

/**
 * 紹介HP・ログイン・登録で約束していること(lib/product-facts.ts)が、アプリの実装と食い違っていないか
 * (UIUX改装 受け入れ条件「LPの記載(登録条件・審査・機能数・料金)が実画面と矛盾しないこと」)。
 */
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('紹介HPの機能の一覧', () => {
  it('どの機能も、アプリにその画面がある', () => {
    for (const feature of PRODUCT_FEATURES) {
      const page = path.join(process.cwd(), 'app', ...feature.route.split('/').filter(Boolean), 'page.tsx')
      expect(fs.existsSync(page), `${feature.title} → ${feature.route}`).toBe(true)
    }
  })

  it('機能の数は動画ツアーの場面の数(9)と同じで、紹介HPはこの一覧をそのまま出す', () => {
    const tourScenes = (read('tools/feature-video/src/FeatureTour.tsx').match(/^\s+index: \d+,/gm) ?? []).length
    expect(tourScenes).toBe(9)
    expect(PRODUCT_FEATURES).toHaveLength(tourScenes)
    expect(LP_FEATURES).toBe(PRODUCT_FEATURES)
    expect(LP_FEATURE_TOUR.caption).toContain(`${tourScenes}つの機能`)
  })
})

describe('登録で聞くこと', () => {
  it('登録の画面の入力欄は、約束どおりメールアドレスとパスワードだけ(お名前は聞かない)', () => {
    const form = read('components/auth/register-form.tsx')
    const labels = [...form.matchAll(/<Label htmlFor="(\w+)">([^<]+)/g)].map((match) => match[2].trim())
    expect(labels).toEqual([...PRODUCT_FACTS.registration.fields])
    expect(form).toContain('supabase.auth.signUp({ email: normalizedEmail, password })')
    expect(PRODUCT_FACTS.registration.summary).toContain('お名前は不要')
  })

  it('紹介HPの「はじめかた」とよくある質問も、同じ登録の条件を書く', () => {
    expect(LP_HOW.steps[0].description).toContain('メールアドレスとパスワードだけ')
    expect(LP_FAQ.some((item) => item.a.includes(PRODUCT_FACTS.registration.summary))).toBe(true)
  })
})

describe('審査・料金・写真の説明', () => {
  it('審査の説明は紹介HP・よくある質問・プライバシーポリシーで同じ', () => {
    expect(LP_TRUST.items[0].description).toContain(PRODUCT_FACTS.moderation.adult)
    expect(LP_FAQ.some((item) => item.a.includes(PRODUCT_FACTS.moderation.adult))).toBe(true)
    expect(read('app/privacy/page.tsx')).toContain('{PRODUCT_FACTS.moderation.adult}')
  })

  it('有料の機能は無いので「すべての機能が無料」とだけ書く(「基本機能は」と書かない)', () => {
    expect(PRODUCT_FACTS.pricing).toBe('すべての機能が無料です。')
    const lp = read('lib/lp-content.ts') + read('lib/product-facts.ts')
    expect(lp).not.toContain('基本機能')
  })

  it('子ども向けの審査の説明は、ひらがなの言い方で、いまの審査(AI が確かめる)に合わせる', () => {
    expect(PRODUCT_FACTS.moderation.kidsBeforeSend).toContain('AIが たしかめて')
    const form = read('components/danger-report/danger-report-form.tsx')
    expect(form).toContain('{PRODUCT_FACTS.moderation.kidsBeforeSend}')
    expect(form).toContain('{PRODUCT_FACTS.moderation.kidsAfterSend}')
    expect(form).not.toContain('おとなの かくにんの あとに')
  })
})
