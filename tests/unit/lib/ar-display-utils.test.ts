/**
 * AR表示改善のためのユニットテスト
 * TDD: まずテストを書いて失敗を確認してから実装する
 */

import { describe, it, expect } from "vitest"
import {
  translateDangerType,
  getDangerLevelLabel,
  getDangerLevelColor,
  hexToRgba,
  formatHeadingDisplay,
} from "@/lib/ar-display-utils"

describe("AR表示改善ユーティリティ", () => {
  /**
   * フェーズ2: カテゴリの日本語化
   */
  describe("translateDangerType - カテゴリ日本語化", () => {
    it("disaster を 災害リスク に変換する", () => {
      expect(translateDangerType("disaster")).toBe("災害リスク")
    })

    it("traffic を 交通危険 に変換する", () => {
      expect(translateDangerType("traffic")).toBe("交通危険")
    })

    it("construction を 工事中 に変換する", () => {
      expect(translateDangerType("construction")).toBe("工事中")
    })

    it("crime を 防犯注意 に変換する", () => {
      expect(translateDangerType("crime")).toBe("防犯注意")
    })

    it("other を その他 に変換する", () => {
      expect(translateDangerType("other")).toBe("その他")
    })

    it("suspicious を 不審者情報 に変換する(AR画面に英語の生文字列を出さない)", () => {
      expect(translateDangerType("suspicious")).toBe("不審者情報")
    })

    it("未知のカテゴリはそのまま返す", () => {
      expect(translateDangerType("unknown_category")).toBe("unknown_category")
    })

    it("空文字の場合は その他 を返す", () => {
      expect(translateDangerType("")).toBe("その他")
    })

    it("nullish値の場合は その他 を返す", () => {
      expect(translateDangerType(null as unknown as string)).toBe("その他")
      expect(translateDangerType(undefined as unknown as string)).toBe("その他")
    })
  })

  /**
   * フェーズ3: 危険度表示の改善
   */
  // 危険度の色・ラベルは danger-level-presentation.ts の一元定義に委譲。
  // 表示は1〜4にクランプされ、レベル5は4(いちばんちゅうい)と同表示になる。
  describe("getDangerLevelLabel - 危険度ラベル(一元定義委譲)", () => {
    it("レベル5は4にクランプされ いちばんちゅうい を返す", () => {
      expect(getDangerLevelLabel(5)).toBe("いちばんちゅうい")
    })

    it("レベル4は いちばんちゅうい を返す", () => {
      expect(getDangerLevelLabel(4)).toBe("いちばんちゅうい")
    })

    it("レベル3は とてもちゅうい を返す", () => {
      expect(getDangerLevelLabel(3)).toBe("とてもちゅうい")
    })

    it("レベル2は ちゅうい を返す", () => {
      expect(getDangerLevelLabel(2)).toBe("ちゅうい")
    })

    it("レベル1は きをつけて を返す", () => {
      expect(getDangerLevelLabel(1)).toBe("きをつけて")
    })

    it("範囲外のレベル（0以下）は きをつけて を返す", () => {
      expect(getDangerLevelLabel(0)).toBe("きをつけて")
      expect(getDangerLevelLabel(-1)).toBe("きをつけて")
    })

    it("範囲外のレベル（6以上）は いちばんちゅうい を返す", () => {
      expect(getDangerLevelLabel(6)).toBe("いちばんちゅうい")
      expect(getDangerLevelLabel(10)).toBe("いちばんちゅうい")
    })
  })

  describe("getDangerLevelColor - 危険度色(一元定義委譲)", () => {
    it("レベル5は4にクランプされ赤を返す", () => {
      expect(getDangerLevelColor(5)).toBe("#ef4444")
    })

    it("レベル4は赤を返す", () => {
      expect(getDangerLevelColor(4)).toBe("#ef4444")
    })

    it("レベル3はオレンジを返す", () => {
      expect(getDangerLevelColor(3)).toBe("#f97316")
    })

    it("レベル2はアンバーを返す", () => {
      expect(getDangerLevelColor(2)).toBe("#f59e0b")
    })

    it("レベル1は黄を返す(緑は使わない: 危険報告に安全色を出さない)", () => {
      expect(getDangerLevelColor(1)).toBe("#eab308")
    })

    it("範囲外のレベル（0以下）は黄を返す", () => {
      expect(getDangerLevelColor(0)).toBe("#eab308")
      expect(getDangerLevelColor(-1)).toBe("#eab308")
    })

    it("範囲外のレベル（6以上）は赤を返す", () => {
      expect(getDangerLevelColor(6)).toBe("#ef4444")
      expect(getDangerLevelColor(10)).toBe("#ef4444")
    })
  })

  /**
   * フェーズ1: 不要情報の削除・整理
   * 方向表示から精度情報(±XX°)を除去
   */
  describe("formatHeadingDisplay - 方向表示フォーマット", () => {
    it("精度情報なしで方向のみを表示する", () => {
      const result = formatHeadingDisplay(359)
      expect(result).toBe("北向き")
      expect(result).not.toContain("±")
      expect(result).not.toContain("°")
    })

    it("0度は北向きを返す", () => {
      expect(formatHeadingDisplay(0)).toBe("北向き")
    })

    it("90度は東向きを返す", () => {
      expect(formatHeadingDisplay(90)).toBe("東向き")
    })

    it("180度は南向きを返す", () => {
      expect(formatHeadingDisplay(180)).toBe("南向き")
    })

    it("270度は西向きを返す", () => {
      expect(formatHeadingDisplay(270)).toBe("西向き")
    })

    it("45度は北東向きを返す", () => {
      expect(formatHeadingDisplay(45)).toBe("北東向き")
    })

    it("135度は南東向きを返す", () => {
      expect(formatHeadingDisplay(135)).toBe("南東向き")
    })

    it("225度は南西向きを返す", () => {
      expect(formatHeadingDisplay(225)).toBe("南西向き")
    })

    it("315度は北西向きを返す", () => {
      expect(formatHeadingDisplay(315)).toBe("北西向き")
    })

    it("360度は北向きを返す（正規化）", () => {
      expect(formatHeadingDisplay(360)).toBe("北向き")
    })

    it("負の角度も正しく処理する", () => {
      expect(formatHeadingDisplay(-90)).toBe("西向き")
    })
  })

  describe("hexToRgba - 色変換", () => {
    it("6桁hexをrgbaに変換する", () => {
      expect(hexToRgba("#ef4444", 0.8)).toBe("rgba(239, 68, 68, 0.8)")
    })

    it("alpha=0を正しく変換する", () => {
      expect(hexToRgba("#22c55e", 0)).toBe("rgba(34, 197, 94, 0)")
    })

    it("alpha=1を正しく変換する", () => {
      expect(hexToRgba("#22c55e", 1)).toBe("rgba(34, 197, 94, 1)")
    })
  })
})
