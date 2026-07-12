const FALLBACK_PATH = "/map"

/**
 * ログイン後の戻り先を同一オリジンのアプリ内パスだけに制限する。
 * `//example.com` やバックスラッシュを含む値は open redirect になり得るため拒否する。
 */
export function getSafeNextPath(
  value: string | string[] | null | undefined,
  fallback = FALLBACK_PATH,
): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback
  }

  try {
    const base = new URL("https://pathguardian.local")
    const resolved = new URL(raw, base)
    if (resolved.origin !== base.origin) return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return fallback
  }
}
