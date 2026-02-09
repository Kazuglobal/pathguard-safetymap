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
  describe("getDangerLevelLabel - 危険度ラベル", () => {
    it("レベル5は 非常に危険 を返す", () => {
      expect(getDangerLevelLabel(5)).toBe("非常に危険")
    })

    it("レベル4は 危険 を返す", () => {
      expect(getDangerLevelLabel(4)).toBe("危険")
    })

    it("レベル3は 注意 を返す", () => {
      expect(getDangerLevelLabel(3)).toBe("注意")
    })

    it("レベル2は やや注意 を返す", () => {
      expect(getDangerLevelLabel(2)).toBe("やや注意")
    })

    it("レベル1は 低リスク を返す", () => {
      expect(getDangerLevelLabel(1)).toBe("低リスク")
    })

    it("範囲外のレベル（0以下）は 低リスク を返す", () => {
      expect(getDangerLevelLabel(0)).toBe("低リスク")
      expect(getDangerLevelLabel(-1)).toBe("低リスク")
    })

    it("範囲外のレベル（6以上）は 非常に危険 を返す", () => {
      expect(getDangerLevelLabel(6)).toBe("非常に危険")
      expect(getDangerLevelLabel(10)).toBe("非常に危険")
    })
  })

  describe("getDangerLevelColor - 危険度色", () => {
    it("レベル5は非常に濃い赤を返す", () => {
      expect(getDangerLevelColor(5)).toBe("#991b1b")
    })

    it("レベル4は濃い赤を返す", () => {
      expect(getDangerLevelColor(4)).toBe("#dc2626")
    })

    it("レベル3は赤を返す", () => {
      expect(getDangerLevelColor(3)).toBe("#ef4444")
    })

    it("レベル2は黄色を返す", () => {
      expect(getDangerLevelColor(2)).toBe("#f59e0b")
    })

    it("レベル1は緑を返す", () => {
      expect(getDangerLevelColor(1)).toBe("#22c55e")
    })

    it("範囲外のレベル（0以下）は緑を返す", () => {
      expect(getDangerLevelColor(0)).toBe("#22c55e")
      expect(getDangerLevelColor(-1)).toBe("#22c55e")
    })

    it("範囲外のレベル（6以上）は非常に濃い赤を返す", () => {
      expect(getDangerLevelColor(6)).toBe("#991b1b")
      expect(getDangerLevelColor(10)).toBe("#991b1b")
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
