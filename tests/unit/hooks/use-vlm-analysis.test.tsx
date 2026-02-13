import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useVlmAnalysis } from "@/hooks/use-vlm-analysis"
import * as vlmAnalysis from "@/lib/vlm-analysis"

// Mock dependencies
vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({
    supabase: { mock: "supabase-client" },
  }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

vi.mock("@/lib/vlm-analysis", () => ({
  analyzeHazardWithVLM: vi.fn(),
}))

describe("useVlmAnalysis", () => {
  let mockAnalyzeHazardWithVLM: any

  beforeEach(() => {
    mockAnalyzeHazardWithVLM = vi.mocked(vlmAnalysis.analyzeHazardWithVLM)
    mockAnalyzeHazardWithVLM.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should initialize with idle state", () => {
    const { result } = renderHook(() => useVlmAnalysis())

    expect(result.current.status).toBe("idle")
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isAnalyzing).toBe(false)
    expect(result.current.isCompleted).toBe(false)
    expect(result.current.hasFailed).toBe(false)
  })

  it("should transition to analyzing state when startAnalysis is called", async () => {
    const { result } = renderHook(() => useVlmAnalysis())

    const mockAnalysis = {
      hazards: [],
      overall_safety_score: 85,
      overall_risk_level: 2 as const,
      child_perspective_summary: "Test summary",
      time_weather_risks: {},
      improvement_suggestions: {},
    }

    mockAnalyzeHazardWithVLM.mockResolvedValue({
      success: true,
      analysis: mockAnalysis,
      analysis_id: "test-id",
    })

    act(() => {
      result.current.startAnalysis({
        reportId: "test-report-id",
        imageUrl: "https://example.com/image.jpg",
        additionalContext: "Test context",
      })
    })

    // Should be analyzing immediately
    expect(result.current.status).toBe("analyzing")
    expect(result.current.isAnalyzing).toBe(true)

    // Wait for analysis to complete
    await waitFor(() => {
      expect(result.current.status).toBe("completed")
    })

    expect(result.current.isCompleted).toBe(true)
    expect(result.current.result).toEqual(mockAnalysis)
    expect(result.current.error).toBeNull()
  })

  it("should transition to failed state on error", async () => {
    const { result } = renderHook(() => useVlmAnalysis())

    mockAnalyzeHazardWithVLM.mockRejectedValue(
      new Error("Network error")
    )

    act(() => {
      result.current.startAnalysis({
        reportId: "test-report-id",
        imageUrl: "https://example.com/image.jpg",
      })
    })

    await waitFor(() => {
      expect(result.current.status).toBe("failed")
    })

    expect(result.current.hasFailed).toBe(true)
    expect(result.current.error).toBe("Network error")
    expect(result.current.result).toBeNull()
  })

  it("should prevent concurrent requests", async () => {
    const { result } = renderHook(() => useVlmAnalysis())

    mockAnalyzeHazardWithVLM.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                success: true,
                analysis: {
                  hazards: [],
                  overall_safety_score: 85,
                  overall_risk_level: 2 as const,
                  child_perspective_summary: "Test",
                  time_weather_risks: {},
                  improvement_suggestions: {},
                },
              }),
            100
          )
        })
    )

    // Start first analysis
    act(() => {
      result.current.startAnalysis({
        reportId: "test-1",
        imageUrl: "https://example.com/image1.jpg",
      })
    })

    // Try to start second analysis while first is in progress
    act(() => {
      result.current.startAnalysis({
        reportId: "test-2",
        imageUrl: "https://example.com/image2.jpg",
      })
    })

    // Should only call once (second call blocked)
    expect(mockAnalyzeHazardWithVLM).toHaveBeenCalledTimes(1)
  })

  it("should retry with stored request parameters", async () => {
    const { result } = renderHook(() => useVlmAnalysis())

    // First attempt fails
    mockAnalyzeHazardWithVLM.mockRejectedValueOnce(
      new Error("First attempt failed")
    )

    act(() => {
      result.current.startAnalysis({
        reportId: "test-report-id",
        imageUrl: "https://example.com/image.jpg",
        additionalContext: "Test context",
      })
    })

    await waitFor(() => {
      expect(result.current.status).toBe("failed")
    })

    // Second attempt succeeds
    const mockAnalysis = {
      hazards: [],
      overall_safety_score: 85,
      overall_risk_level: 2 as const,
      child_perspective_summary: "Test",
      time_weather_risks: {},
      improvement_suggestions: {},
    }

    mockAnalyzeHazardWithVLM.mockResolvedValueOnce({
      success: true,
      analysis: mockAnalysis,
    })

    act(() => {
      result.current.retry()
    })

    await waitFor(() => {
      expect(result.current.status).toBe("completed")
    })

    expect(result.current.result).toEqual(mockAnalysis)

    // Verify retry used same parameters
    expect(mockAnalyzeHazardWithVLM).toHaveBeenCalledTimes(2)
    expect(mockAnalyzeHazardWithVLM).toHaveBeenLastCalledWith(
      expect.anything(),
      {
        report_id: "test-report-id",
        image_url: "https://example.com/image.jpg",
        additional_context: "Test context",
      }
    )
  })

  it("should reset all state", async () => {
    const { result } = renderHook(() => useVlmAnalysis())

    const mockAnalysis = {
      hazards: [],
      overall_safety_score: 85,
      overall_risk_level: 2 as const,
      child_perspective_summary: "Test",
      time_weather_risks: {},
      improvement_suggestions: {},
    }

    mockAnalyzeHazardWithVLM.mockResolvedValue({
      success: true,
      analysis: mockAnalysis,
    })

    // Complete an analysis
    act(() => {
      result.current.startAnalysis({
        reportId: "test-report-id",
        imageUrl: "https://example.com/image.jpg",
      })
    })

    await waitFor(() => {
      expect(result.current.status).toBe("completed")
    })

    // Reset
    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe("idle")
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("should not call analyzeHazardWithVLM if params are missing", () => {
    const { result } = renderHook(() => useVlmAnalysis())

    act(() => {
      result.current.startAnalysis({
        reportId: "",
        imageUrl: "https://example.com/image.jpg",
      })
    })

    expect(mockAnalyzeHazardWithVLM).not.toHaveBeenCalled()
    expect(result.current.status).toBe("idle")
  })

  it("should handle Edge Function returning success: false", async () => {
    const { result } = renderHook(() => useVlmAnalysis())

    mockAnalyzeHazardWithVLM.mockResolvedValue({
      success: false,
      error: "API rate limit exceeded",
    })

    act(() => {
      result.current.startAnalysis({
        reportId: "test-report-id",
        imageUrl: "https://example.com/image.jpg",
      })
    })

    await waitFor(() => {
      expect(result.current.status).toBe("failed")
    })

    expect(result.current.error).toBe("API rate limit exceeded")
  })
})
