// =============================================
// きけんハンター AI応答からのJSON堅牢抽出 (純粋ロジック)
// LLMはコードフェンス・前置き文・途中で切れたJSONを返すことがある。
// 例外を投げずに { ok, value } を返す。ネットワーク再試行はここに持たない。
// =============================================

export interface ExtractResult {
  readonly ok: boolean
  readonly value?: unknown
}

const FAIL: ExtractResult = { ok: false }

/** ```json ... ``` のコードフェンスがあれば中身を取り出す。 */
function stripFences(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return fence ? fence[1] : text
}

function tryParse(candidate: string): ExtractResult {
  try {
    return { ok: true, value: JSON.parse(candidate) }
  } catch {
    return FAIL
  }
}

interface ScanResult {
  /** バランスが取れて閉じた位置(複完了)。未完了は null。 */
  readonly end: number | null
  /** 走査終了時点の未閉じ括弧スタック。 */
  readonly stack: readonly string[]
  /** 走査終了時点で文字列リテラルの内側にいたか。 */
  readonly inString: boolean
}

/** 最初の '{' からバランス括弧を走査する(文字列・エスケープを考慮)。 */
function scanObject(s: string, start: number): ScanResult {
  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let i = start; i < s.length; i += 1) {
    const ch = s[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch)
    } else if (ch === "}" || ch === "]") {
      stack.pop()
      if (stack.length === 0) {
        return { end: i, stack: [], inString: false }
      }
    }
  }
  return { end: null, stack, inString }
}

/** 末尾が欠落したJSONを、未閉じ括弧/文字列/カンマ/宙ぶらりんキーを補修して解析する。 */
function repairTruncated(raw: string, scan: ScanResult): ExtractResult {
  let body = raw
  if (scan.inString) body += '"' // 未終端の文字列を閉じる
  body = body.replace(/\s+$/, "")
  body = body.replace(/,\s*$/, "") // 末尾カンマ
  body = body.replace(/,?\s*"[^"]*"\s*:\s*$/, "") // 値の無い宙ぶらりんキー
  body = body.replace(/,\s*$/, "")
  const closers = scan.stack
    .slice()
    .reverse()
    .map((c) => (c === "{" ? "}" : "]"))
    .join("")
  return tryParse(body + closers)
}

/**
 * AIのテキスト出力から最初の完全なJSONオブジェクトを抽出する。
 * 完全に取れればそれを、欠落していれば簡易補修を試みる。例外は投げない。
 */
export function extractHunterJson(text: unknown): ExtractResult {
  if (typeof text !== "string" || text.trim().length === 0) return FAIL

  const unfenced = stripFences(text)
  const start = unfenced.indexOf("{")
  if (start < 0) return FAIL

  const scan = scanObject(unfenced, start)
  if (scan.end !== null) {
    const slice = unfenced.slice(start, scan.end + 1)
    const parsed = tryParse(slice)
    if (parsed.ok) return parsed
  }

  return repairTruncated(unfenced.slice(start), scan)
}
