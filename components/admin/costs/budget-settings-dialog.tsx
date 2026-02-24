"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface BudgetSetting {
  readonly provider: string
  readonly monthly_budget_usd: number
  readonly alert_threshold_percent: number
}

interface BudgetFormState {
  readonly [provider: string]: {
    readonly monthly_budget_usd: string
    readonly alert_threshold_percent: string
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  mapbox: "Mapbox",
}

const DEFAULT_PROVIDERS = ["gemini", "openai", "mapbox"]

function settingsToFormState(settings: readonly BudgetSetting[]): BudgetFormState {
  const state: Record<string, { monthly_budget_usd: string; alert_threshold_percent: string }> = {}
  for (const provider of DEFAULT_PROVIDERS) {
    const setting = settings.find((s) => s.provider === provider)
    state[provider] = {
      monthly_budget_usd: setting ? String(setting.monthly_budget_usd) : "100",
      alert_threshold_percent: setting ? String(setting.alert_threshold_percent) : "80",
    }
  }
  return state
}

export default function BudgetSettingsDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState<BudgetFormState>(() =>
    settingsToFormState([])
  )

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/costs/budget")
      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status}`)
      }
      const data: BudgetSetting[] = await response.json()
      setFormState(settingsToFormState(data))
    } catch (err) {
      const message = err instanceof Error ? err.message : "設定の取得に失敗しました"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchSettings()
    }
  }, [open, fetchSettings])

  function handleFieldChange(
    provider: string,
    field: "monthly_budget_usd" | "alert_threshold_percent",
    value: string
  ) {
    setFormState((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const settings = DEFAULT_PROVIDERS.map((provider) => ({
        provider,
        monthly_budget_usd: parseFloat(formState[provider]?.monthly_budget_usd ?? "0"),
        alert_threshold_percent: parseInt(formState[provider]?.alert_threshold_percent ?? "80", 10),
      }))

      const invalidSetting = settings.find(
        (s) => isNaN(s.monthly_budget_usd) || isNaN(s.alert_threshold_percent)
      )
      if (invalidSetting) {
        throw new Error("数値を正しく入力してください")
      }

      const outOfRangeSetting = settings.find(
        (s) => s.alert_threshold_percent < 0 || s.alert_threshold_percent > 100
      )
      if (outOfRangeSetting) {
        throw new Error("アラート閾値は0〜100%の範囲で入力してください")
      }

      for (const setting of settings) {
        const response = await fetch("/api/admin/costs/budget", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(setting),
        })
        if (!response.ok) throw new Error(`保存エラー: ${response.status}`)
      }

      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "設定の保存に失敗しました"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">予算設定</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>予算設定</DialogTitle>
          <DialogDescription>
            各APIプロバイダーの月間予算とアラート閾値を設定します。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {DEFAULT_PROVIDERS.map((provider) => (
              <div
                key={provider}
                className="space-y-3 rounded-lg border p-4"
              >
                <h4 className="text-sm font-semibold">
                  {PROVIDER_LABELS[provider] ?? provider}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${provider}-budget`}>
                      月間予算 (USD)
                    </Label>
                    <Input
                      id={`${provider}-budget`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState[provider]?.monthly_budget_usd ?? ""}
                      onChange={(e) =>
                        handleFieldChange(provider, "monthly_budget_usd", e.target.value)
                      }
                      placeholder="100.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${provider}-threshold`}>
                      アラート閾値 (%)
                    </Label>
                    <Input
                      id={`${provider}-threshold`}
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={formState[provider]?.alert_threshold_percent ?? ""}
                      onChange={(e) =>
                        handleFieldChange(provider, "alert_threshold_percent", e.target.value)
                      }
                      placeholder="80"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button onClick={handleSave} loading={saving}>
                保存
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
