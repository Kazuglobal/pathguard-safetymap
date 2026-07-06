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

  it("50m以内だけ接近中として扱う", () => {
    expect(isApproachingHazard(49.9)).toBe(true)
    expect(isApproachingHazard(50)).toBe(true)
    expect(isApproachingHazard(50.1)).toBe(false)
  })
})
