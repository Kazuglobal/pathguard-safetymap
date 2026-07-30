/**
 * image_url の SSRF ガード。
 *
 * Deno 依存を持たない純関数だけを置き、vitest から実挙動をテストできるようにする
 * (index.ts 本体は Deno 専用 import を持つため vitest から読めない)。
 *
 * 重要な前提: 入力は WHATWG URL の `hostname`。この正規化を誤解すると判定が丸ごと死ぬ。
 * - IPv6 リテラルは角括弧付きで返る: `new URL("https://[::1]/").hostname === "[::1]"`
 * - IPv6 に埋め込まれた IPv4 は**16進ピースへ正規化される**:
 *   `[::ffff:127.0.0.1]` → `[::ffff:7f00:1]` / `[::127.0.0.1]` → `[::7f00:1]`
 *   (ドット付き十進で判定しようとすると一度も一致しない)
 * - IPv4 の10進・16進・省略表記は正規化される: `2130706433` / `0x7f.0.0.1` / `127.1` → `127.0.0.1`
 */

export function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".")
  if (parts.length !== 4) {
    return null
  }
  const numbers = parts.map((part) => Number(part))
  const valid = numbers.every((num) => Number.isInteger(num) && num >= 0 && num <= 255)
  return valid ? numbers : null
}

export function isPrivateIpv4Address(parts: number[]): boolean {
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  )
}

/** `::ffff:7f00:1` のような正規化済み IPv6 から、埋め込まれた IPv4 の4オクテットを取り出す。 */
function embeddedIpv4Octets(host: string): number[] | null {
  const mapped = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host)
  if (!mapped) {
    return null
  }
  const high = Number.parseInt(mapped[1], 16)
  const low = Number.parseInt(mapped[2], 16)
  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff]
}

export function isPrivateIpv6Address(host: string): boolean {
  if (host === "::1" || host === "::") {
    return true
  }

  // IPv4-mapped (::ffff:a.b.c.d) / IPv4-compatible (::a.b.c.d)。
  // WHATWG 正規化後は16進ピースになるため、そこから IPv4 を復元して判定する
  const octets = embeddedIpv4Octets(host)
  if (octets) {
    return isPrivateIpv4Address(octets)
  }

  // fc00::/7 (ユニークローカル) と fe80::/10 (リンクローカル)
  return /^f[cd]/.test(host) || /^fe[89ab]/.test(host)
}

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return true
  }

  if (host.startsWith("[") && host.endsWith("]")) {
    return isPrivateIpv6Address(host.slice(1, -1))
  }

  const ipv4 = parseIpv4(host)
  return ipv4 ? isPrivateIpv4Address(ipv4) : false
}

/**
 * 取得を許可してよい image_url か検証する。問題があれば理由文字列、無ければ null。
 *
 * 注意: ホスト名がプライベートIPへ解決するケース(`127.0.0.1.nip.io` 等)は文字列判定では
 * 塞げない。根本対策は allowedHosts(VLM_ALLOWED_IMAGE_HOSTS)を必須運用にすること。
 */
export function validateImageUrl(imageUrl: string, allowedHosts: string[] = []): string | null {
  let parsed: URL

  try {
    parsed = new URL(imageUrl)
  } catch {
    return "image_url must be a valid HTTPS URL"
  }

  if (parsed.protocol !== "https:") {
    return "image_url must use HTTPS"
  }

  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    return "image_url host is not allowed"
  }

  if (allowedHosts.length > 0) {
    const host = parsed.hostname.toLowerCase()
    const isAllowed = allowedHosts.some((allowedHost) => {
      return host === allowedHost || host.endsWith(`.${allowedHost}`)
    })
    if (!isAllowed) {
      return "image_url host is not allowed"
    }
  }

  return null
}
