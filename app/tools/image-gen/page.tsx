"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

type PresetKey =
  | "hazard-visual"
  | "earthquake"
  | "typhoon"
  | "flood"
  | "fire"

function buildPresetPrompt(key: PresetKey): string {
  switch (key) {
    case "hazard-visual":
      return (
        "Generate a single photorealistic 2K infographic based on the uploaded street photo, " +
        "maintaining the exact viewpoint and daylight. Overlay semi-transparent hazard markings and warning icons: " +
        "- Collapsed fence: red translucent shading + exclamation icons, label in Japanese 'フェンス倒壊'. " +
        "- Fallen utility pole: red circle and directional arrow, label '電柱倒壊'. " +
        "- Flooding risk: blue translucent shading with droplet icon, label '冠水'. " +
        "- Fire spread risk: orange flame icons, label '延焼'. " +
        "Use clean, minimal annotations placed naturally over the photo. Keep original perspective, realistic shadows and reflections, Japanese suburban street context, no people, no watermarks, no model names."
      )
    case "earthquake":
      return (
        "Photorealistic 2K render from the same viewpoint and daylight as the uploaded photo: major earthquake aftermath. " +
        "Depict a fallen fence and a fallen utility pole, scattered debris on sidewalk and street. " +
        "Keep framing identical to the source, Japanese suburban street, realistic textures, no people, no watermarks, no model names."
      )
    case "typhoon":
      return (
        "Photorealistic 2K render from the same viewpoint and daylight as the uploaded photo: after typhoon-class strong wind. " +
        "Show a bent fence, scattered branches and leaves, wet surfaces and small puddles. " +
        "Keep framing identical to the source, Japanese suburban street, realistic textures, no people, no watermarks, no model names."
      )
    case "flood":
      return (
        "Photorealistic 2K render from the same viewpoint and daylight as the uploaded photo: flash flood scene. " +
        "Approx. 20 cm water depth covering the road and sidewalk, realistic reflections, gentle ripples, and small floating rubbish. " +
        "Keep framing identical to the source, Japanese suburban street, realistic textures, no people, no watermarks, no model names."
      )
    case "fire":
      return (
        "Photorealistic 2K render from the same viewpoint and daylight as the uploaded photo: post-fire aftermath. " +
        "Show a burnt car beyond the fence, warped wire, and lingering smoke. " +
        "Keep framing identical to the source, Japanese suburban street, realistic textures, no people, no watermarks, no model names."
      )
  }
}

export default function ImageGenPage() {
  const [file, setFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState("")
  const [preset, setPreset] = useState<PresetKey>("hazard-visual")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<{ mimeType: string; dataUrl: string }[]>([])

  useEffect(() => {
    // Initialize with the default preset prompt
    setPrompt(buildPresetPrompt("hazard-visual"))
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
  }, [])

  const canSubmit = useMemo(() => !!file && prompt.trim().length > 0, [file, prompt])

  const onChangePreset = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value as PresetKey
    setPreset(key)
    setPrompt(buildPresetPrompt(key))
  }, [])

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("画像をアップロードしてください。")
      return
    }
    if (!prompt.trim()) {
      setError("プロンプトを入力またはプリセットを選択してください。")
      return
    }
    setError(null)
    setLoading(true)
    setResults([])
    try {
      const fd = new FormData()
      fd.append("prompt", prompt.trim())
      fd.append("image", file)
      fd.append("situation", "custom")
      const res = await fetch("/api/gemini/generate-image", {
        method: "POST",
        body: fd,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Request failed: ${res.status} ${res.statusText} - ${text}`)
      }
      const data = await res.json()
      setResults(data.images || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [file, prompt])

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Gemini 画像生成 (防災イメージアシスタントGPT プリセット)</h1>
      <p className="text-sm text-gray-600">
        画像をアップロードすると、指定のプリセットに沿って生成します。環境変数 <code>GOOGLE_API_KEY</code> を設定してください。
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">プリセットを選択</label>
          <select
            value={preset}
            onChange={onChangePreset}
            className="w-full rounded border p-2"
          >
            <option value="hazard-visual">ハザード可視化（英語プロンプト）</option>
            <option value="earthquake">地震後シミュレーション</option>
            <option value="typhoon">台風（強風）後シミュレーション</option>
            <option value="flood">ゲリラ豪雨・冠水シミュレーション</option>
            <option value="fire">火災後シミュレーション</option>
          </select>
          <p className="text-xs text-gray-600">※ アップロード画像の視点・明るさを維持し、2Kフォトリアル、人物なし、モデル名は記載しません。</p>
          <p className="text-xs font-medium text-amber-700">
            教育用の想像図であり、実在地点の浸水想定を示すものではありません。
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">プロンプト（編集可）</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded border p-2"
            rows={6}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="image-gen-reference" className="block text-sm font-medium">
            参照画像（必須）
          </label>
          <input id="image-gen-reference" type="file" accept="image/*" onChange={onFileChange} />
          {file && (
            <p className="text-xs text-gray-600">選択中: {file.name} ({Math.round(file.size / 1024)} KB)</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "生成中..." : "画像を生成"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {results.map((img, idx) => (
            <div key={idx} className="rounded border p-2">
              <img src={img.dataUrl} alt={`generated-${idx}`} className="w-full h-auto" />
              <p className="text-xs text-gray-500 mt-1">{img.mimeType}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
