import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  HAZARD_CATEGORY_MAP,
  analyzeHazardWithVLM,
  getSeverityVariant,
  getRiskLevelLabel,
  type HazardCategory,
} from "@/lib/vlm-analysis"

// Set environment to disable mock data and test real code path
const originalEnv = process.env.NEXT_PUBLIC_VLM_USE_MOCK
const originalNodeEnv = process.env.NODE_ENV
beforeEach(() => {
  // Ensure tests run against real Edge Function code, not mock
  process.env.NEXT_PUBLIC_VLM_USE_MOCK = "false"
  process.env.NODE_ENV = "test"
})

afterEach(() => {
  // Restore original environment
  process.env.NEXT_PUBLIC_VLM_USE_MOCK = originalEnv
  process.env.NODE_ENV = originalNodeEnv
})

describe("vlm-analysis", () => {
  describe("HAZARD_CATEGORY_MAP", () => {
    it("should have all 15 hazard categories", () => {
      const categories = Object.keys(HAZARD_CATEGORY_MAP)
      expect(categories).toHaveLength(15)
    })

    it("should have required properties for each category", () => {
      Object.entries(HAZARD_CATEGORY_MAP).forEach(([key, value]) => {
        expect(value).toHaveProperty("label")
        expect(value).toHaveProperty("icon")
        expect(value).toHaveProperty("color")
        expect(typeof value.label).toBe("string")
        expect(typeof value.icon).toBe("string")
        expect(typeof value.color).toBe("string")
      })
    })

    it("should contain expected categories", () => {
      const expectedCategories: HazardCategory[] = [
        "traffic",
        "visibility",
        "pedestrian_space",
        "barriers",
        "lighting",
        "terrain",
        "infrastructure",
        "crossings",
        "signage",
        "environmental",
        "social",
        "emergency",
        "behavioral",
        "surveillance",
        "maintenance",
      ]

      expectedCategories.forEach((category) => {
        expect(HAZARD_CATEGORY_MAP).toHaveProperty(category)
      })
    })
  })

  describe("getSeverityVariant", () => {
    it("should return destructive for severity 4 and 5", () => {
      expect(getSeverityVariant(4)).toBe("destructive")
      expect(getSeverityVariant(5)).toBe("destructive")
    })

    it("should return secondary for severity 3", () => {
      expect(getSeverityVariant(3)).toBe("secondary")
    })

    it("should return default for severity 1 and 2", () => {
      expect(getSeverityVariant(1)).toBe("default")
      expect(getSeverityVariant(2)).toBe("default")
    })
  })

  describe("getRiskLevelLabel", () => {
    it("should return correct Japanese labels", () => {
      expect(getRiskLevelLabel(1)).toBe("低リスク")
      expect(getRiskLevelLabel(2)).toBe("やや注意")
      expect(getRiskLevelLabel(3)).toBe("要注意")
      expect(getRiskLevelLabel(4)).toBe("高リスク")
      expect(getRiskLevelLabel(5)).toBe("非常に危険")
    })
  })

  describe("analyzeHazardWithVLM", () => {
    let mockSupabase: any

    beforeEach(() => {
      mockSupabase = {
        functions: {
          invoke: vi.fn(),
        },
      }
    })

    it("should throw error if image_url is missing", async () => {
      await expect(
        analyzeHazardWithVLM(mockSupabase, {
          image_url: "",
          report_id: "test-id",
        })
      ).rejects.toThrow("image_url and report_id are required")
    })

    it("should throw error if report_id is missing", async () => {
      await expect(
        analyzeHazardWithVLM(mockSupabase, {
          image_url: "https://example.com/image.jpg",
          report_id: "",
        })
      ).rejects.toThrow("image_url and report_id are required")
    })

    it("should throw error if image_url is not a valid URL", async () => {
      await expect(
        analyzeHazardWithVLM(mockSupabase, {
          image_url: "not-a-url",
          report_id: "test-id",
        })
      ).rejects.toThrow("image_url must be a valid HTTPS URL")
    })

    it("should throw error for non-HTTPS URL", async () => {
      await expect(
        analyzeHazardWithVLM(mockSupabase, {
          image_url: "http://example.com/image.jpg",
          report_id: "test-id",
        })
      ).rejects.toThrow("image_url must use HTTPS")
    })

    it("should throw error when additional_context is too long", async () => {
      await expect(
        analyzeHazardWithVLM(mockSupabase, {
          image_url: "https://example.com/image.jpg",
          report_id: "test-id",
          additional_context: "a".repeat(1201),
        })
      ).rejects.toThrow("additional_context must be at most 1200 characters")
    })

    it("should reject mock mode in production", async () => {
      process.env.NEXT_PUBLIC_VLM_USE_MOCK = "true"
      process.env.NODE_ENV = "production"

      await expect(
        analyzeHazardWithVLM(mockSupabase, {
          image_url: "https://example.com/image.jpg",
          report_id: "test-id",
        })
      ).rejects.toThrow("VLM mock mode is disabled in production")
    })

    it("should call Edge Function with correct parameters", async () => {
      const mockAnalysis = {
        hazards: [],
        overall_safety_score: 85,
        overall_risk_level: 2,
        child_perspective_summary: "Test summary",
        time_weather_risks: {},
        improvement_suggestions: {},
      }

      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          analysis: mockAnalysis,
          analysis_id: "test-analysis-id",
        },
        error: null,
      })

      const result = await analyzeHazardWithVLM(mockSupabase, {
        image_url: "https://example.com/image.jpg",
        report_id: "test-report-id",
        additional_context: "Test context",
      })

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        "analyze-hazard",
        {
          body: {
            image_url: "https://example.com/image.jpg",
            report_id: "test-report-id",
            additional_context: "Test context",
          },
        }
      )

      expect(result).toEqual({
        success: true,
        analysis: mockAnalysis,
        analysis_id: "test-analysis-id",
      })
    })

    it("should handle Edge Function error response", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: "Rate limit exceeded" },
      })

      const result = await analyzeHazardWithVLM(mockSupabase, {
        image_url: "https://example.com/image.jpg",
        report_id: "test-report-id",
      })

      expect(result).toEqual({
        success: false,
        error: "Rate limit exceeded",
      })
    })

    it("should handle empty data response", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await analyzeHazardWithVLM(mockSupabase, {
        image_url: "https://example.com/image.jpg",
        report_id: "test-report-id",
      })

      expect(result).toEqual({
        success: false,
        error: "分析結果が空です",
      })
    })

    it("should handle invalid analysis schema from Edge Function", async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          analysis: {
            hazards: [{ category: "invalid", severity: 10 }],
          },
        },
        error: null,
      })

      const result = await analyzeHazardWithVLM(mockSupabase, {
        image_url: "https://example.com/image.jpg",
        report_id: "test-report-id",
      })

      expect(result).toEqual({
        success: false,
        error: "分析結果の形式が不正です",
      })
    })

    it("should handle network errors", async () => {
      mockSupabase.functions.invoke.mockRejectedValue(
        new Error("Network timeout")
      )

      await expect(
        analyzeHazardWithVLM(mockSupabase, {
          image_url: "https://example.com/image.jpg",
          report_id: "test-report-id",
        })
      ).rejects.toThrow("Network timeout")
    })

    it("should use empty string for missing additional_context", async () => {
      const mockAnalysis = {
        hazards: [],
        overall_safety_score: 85,
        overall_risk_level: 2,
        child_perspective_summary: "Test",
        time_weather_risks: {},
        improvement_suggestions: {},
      }

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { analysis: mockAnalysis },
        error: null,
      })

      await analyzeHazardWithVLM(mockSupabase, {
        image_url: "https://example.com/image.jpg",
        report_id: "test-report-id",
      })

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        "analyze-hazard",
        {
          body: {
            image_url: "https://example.com/image.jpg",
            report_id: "test-report-id",
            additional_context: "",
          },
        }
      )
    })
  })
})
