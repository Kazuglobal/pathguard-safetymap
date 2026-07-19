import { describe, expect, it } from "vitest"

import {
  DEFAULT_ANTHROPIC_MODELS,
  buildAnthropicModelCandidates,
} from "../../../supabase/functions/analyze-hazard/model-config"

describe("analyze-hazard Anthropic model configuration", () => {
  it("uses the supported Claude Haiku 4.5 model by default", () => {
    expect(DEFAULT_ANTHROPIC_MODELS).toEqual(["claude-haiku-4-5-20251001"])
    expect(buildAnthropicModelCandidates(undefined, [])).toEqual([
      "claude-haiku-4-5-20251001",
    ])
  })

  it("falls back to Haiku 4.5 when an explicitly configured legacy model is retired", () => {
    expect(
      buildAnthropicModelCandidates("claude-3-5-haiku-20241022", [
        "claude-3-haiku-20240307",
      ]),
    ).toEqual([
      "claude-3-5-haiku-20241022",
      "claude-3-haiku-20240307",
      "claude-haiku-4-5-20251001",
    ])
  })
})
