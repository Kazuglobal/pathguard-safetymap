import { describe, expect, it } from "vitest"

import {
  createKidsHazardCue,
  isApproachingHazard,
} from "@/lib/ar-learning-tour-kids"
import { createMockDangerReport } from "@/tests/fixtures/dangers"

describe("ar-learning-tour-kids", () => {
  it("交通危険では止まって左右を見る低学年向け注意を返す", () => {
    const cue = createKidsHazardCue(
      createMockDangerReport({
        danger_type: "traffic",
        title: "見通しの悪い交差点",
        description: "車から見えにくい場所",
      }),
    )

    expect(cue.shortMessage).toBe("ここでは止まって、みぎ・ひだりを見よう")
    expect(cue.action).toBe("車が止まったことを見てからわたろう")
    expect(cue.dangerKind).toBe("交通")
  })

  it("歩道が狭い内容では車道から離れる注意を優先する", () => {
    const cue = createKidsHazardCue(
      createMockDangerReport({
        danger_type: "other",
        title: "歩道が狭い",
        description: "自転車との接触に注意",
      }),
    )

    expect(cue.shortMessage).toBe("歩道がせまいから、車道に近づきすぎないようにしよう")
    expect(cue.dangerKind).toBe("歩道")
  })

  it("工事タイプでは車道にはみ出さない注意を返す", () => {
    const cue = createKidsHazardCue(
      createMockDangerReport({
        danger_type: "construction",
        title: "道路工事中",
        description: "通学路の一部が通行止め",
      }),
    )

    expect(cue.shortMessage).toBe("こうじで あるく ばしょが かわっているよ")
    expect(cue.action).toBe("くるまみちに はみださないで、ゆっくり あるこう")
    expect(cue.dangerKind).toBe("こうじ")
  })

  it("タイプがotherでも本文に「工事」があれば工事の注意を返す", () => {
    const cue = createKidsHazardCue(
      createMockDangerReport({
        danger_type: "other",
        title: "工事現場のそば",
        description: null,
      }),
    )

    expect(cue.dangerKind).toBe("こうじ")
  })

  it("災害タイプは本文に「歩道」が含まれても災害の注意を優先する（誤マッチ回帰）", () => {
    // 実データ「フェンスの倒壊」(disaster)の説明に「歩道ふさがり」が含まれ、
    // 本来の災害助言でなく「歩道がせまいから…」という無関係な助言が出ていた。
    const cue = createKidsHazardCue(
      createMockDangerReport({
        danger_type: "disaster",
        title: "フェンスの倒壊",
        description: "電柱倒壊による電線落下・歩道ふさがり",
      }),
    )

    expect(cue.dangerKind).toBe("災害")
    expect(cue.shortMessage).toBe("いつもとちがう日は、むりに通らないようにしよう")
  })

  it("交通タイプは本文に「雨」が含まれても交通の注意を優先する", () => {
    const cue = createKidsHazardCue(
      createMockDangerReport({
        danger_type: "traffic",
        title: "雨の日に見通しが悪い交差点",
        description: "雨天時に車が見えにくい",
      }),
    )

    expect(cue.dangerKind).toBe("交通")
  })

  it("不審者アラート(suspicious)は本文に防犯キーワードが無くても防犯の注意を返す", () => {
    // danger_type='suspicious' は防犯として扱う。無いと汎用文言に落ちていた。
    const cue = createKidsHazardCue(
      createMockDangerReport({
        danger_type: "suspicious",
        title: "知らない人が声をかけてきた",
        description: "知らない人が声をかけてきた",
      }),
    )

    expect(cue.dangerKind).toBe("防犯")
    expect(cue.shortMessage).toBe("こまったら、大人がいる明るい場所へ行こう")
  })

  it("50m以内だけ接近中として扱う", () => {
    expect(isApproachingHazard(49.9)).toBe(true)
    expect(isApproachingHazard(50)).toBe(true)
    expect(isApproachingHazard(50.1)).toBe(false)
  })
})
