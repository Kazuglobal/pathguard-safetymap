import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import BudgetSettingsDialog from "@/components/admin/costs/budget-settings-dialog"

const fetchMock = vi.fn()

function respond(rows: unknown) {
  return { ok: true, status: 200, json: async () => rows } as Response
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "予算設定" }))
  return screen.findByRole("dialog")
}

describe("BudgetSettingsDialog", () => {
  it("shows the saved budgets the API returns (api_provider), including Claude's once its row exists", async () => {
    fetchMock.mockResolvedValue(respond([
      { api_provider: "gemini", monthly_budget_usd: 42, alert_threshold_percent: 70 },
      { api_provider: "anthropic", monthly_budget_usd: 12.5, alert_threshold_percent: 90 },
    ]))
    render(<BudgetSettingsDialog />)
    await openDialog()

    await waitFor(() => expect(screen.getByLabelText("月間予算 (USD)", { selector: "#gemini-budget" })).toHaveValue(42))
    expect(screen.getByLabelText("アラート閾値 (%)", { selector: "#gemini-threshold" })).toHaveValue(70)
    expect(screen.getByLabelText("月間予算 (USD)", { selector: "#anthropic-budget" })).toHaveValue(12.5)
    expect(screen.getByText("Anthropic")).toBeInTheDocument()
    // 予算の行が無い会社は出さない(保存すると失敗するため)
    expect(screen.queryByText("OpenAI")).not.toBeInTheDocument()
  })

  it("saves only the providers that have a row, with the values on screen", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? respond({})
        : respond([
            { api_provider: "gemini", monthly_budget_usd: 42, alert_threshold_percent: 70 },
            { api_provider: "mapbox", monthly_budget_usd: 5, alert_threshold_percent: 80 },
          ]))
    render(<BudgetSettingsDialog />)
    await openDialog()
    const geminiBudget = await screen.findByLabelText("月間予算 (USD)", { selector: "#gemini-budget" })
    await waitFor(() => expect(geminiBudget).toHaveValue(42))

    fireEvent.change(geminiBudget, { target: { value: "60" } })
    fireEvent.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(2))
    const bodies = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "PUT")
      .map(([, init]) => JSON.parse(String(init.body)))
    expect(bodies).toEqual([
      { provider: "gemini", monthly_budget_usd: 60, alert_threshold_percent: 70 },
      { provider: "mapbox", monthly_budget_usd: 5, alert_threshold_percent: 80 },
    ])
  })
})
