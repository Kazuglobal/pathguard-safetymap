// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AR_SPEED_SUPPRESS_THRESHOLD_KMH } from '@/lib/ar-safety'
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
    expect(LP_HOW.steps[0].description).toContain(PRODUCT_FACTS.registration.short)
    expect(LP_FAQ.some((item) => item.a.includes(PRODUCT_FACTS.registration.summary))).toBe(true)
  })
})

describe('審査・料金・写真の説明', () => {
  it('審査の説明は紹介HP・よくある質問・プライバシーポリシーで同じ', () => {
    expect(LP_TRUST.items[0].description).toContain(PRODUCT_FACTS.moderation.adult)
    expect(LP_FAQ.some((item) => item.a.includes(PRODUCT_FACTS.moderation.adult))).toBe(true)
    expect(read('app/privacy/page.tsx')).toContain('{PRODUCT_FACTS.moderation.adult}')
  })

  it('機能の説明の審査の書き方も、同じ文', () => {
    const report = PRODUCT_FEATURES.find((feature) => feature.key === 'report')
    expect(report?.description).toContain(PRODUCT_FACTS.moderation.adult)
  })

  it('写真: 自動でぼかすのは顔だけ。ナンバーや表札は指で隠すと書き、ホームとはじめてガイドも同じ文から読む', () => {
    for (const text of [PRODUCT_FACTS.photo.adult, PRODUCT_FACTS.photo.parent]) {
      expect(text).toMatch(/顔[^。]*自動/)
      expect(text).toMatch(/(ナンバー|表札)[^。]*指/)
    }
    // 短い言い方は、何を自動でぼかすかを言い切らない
    expect(PRODUCT_FACTS.photo.short).not.toMatch(/ナンバー|顔/)
    expect(read('components/landing/LandingHero.tsx')).toContain('{PRODUCT_FACTS.photo.short}')
    expect(read('components/onboarding/app-onboarding.tsx')).toContain('${PRODUCT_FACTS.moderation.adult}${PRODUCT_FACTS.photo.parent}')
  })

  it('デモ: 入れたものは本物として扱われるので「すべて見本」とは書かず、共用であることを伝える', () => {
    expect(PRODUCT_FACTS.demo.note).not.toContain('すべて見本')
    expect(PRODUCT_FACTS.demo.note).toContain('本物として扱われ')
    expect(PRODUCT_FACTS.demo.shared).toContain('ほかの人も使います')
  })

  it('お問い合わせのフォームを公開したら、プライバシーポリシーの預け先にも自動で載る', () => {
    expect(read('app/privacy/page.tsx')).toMatch(/\{BRAND\.contactFormUrl && <li>Google フォーム/)
  })

  it('AR: 速く移動しているときはお知らせを止める。数字は判定と同じ値で、AR の起動時と紹介HPで同じ文を出す(項目45)', () => {
    expect(PRODUCT_FACTS.ar.speedSuppress).toContain(`時速${AR_SPEED_SUPPRESS_THRESHOLD_KMH}km`)
    // 速さを測れない端末では止まらないので、言い切らない
    expect(PRODUCT_FACTS.ar.speedSuppress).toContain('速さを測れる端末')
    expect(LP_TRUST.items.some((item) => item.description.includes(PRODUCT_FACTS.ar.speedSuppress))).toBe(true)
    expect(read('components/map/ar-view.tsx').match(/\{PRODUCT_FACTS\.ar\.speedSuppress\}/g)).toHaveLength(2)
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
