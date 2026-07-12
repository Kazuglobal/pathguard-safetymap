import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * 認証が必要なルートプレフィックス一覧
 */
const PROTECTED_PREFIXES = [
  '/map',
  '/dashboard',
  '/report',
  '/mypage',
  '/badges',
  '/missions',
  '/leaderboard',
  '/routes',
  '/hazard-game',
  '/route-quiz',
  '/3d-route-poc',
  '/xroad',
  '/admin',
  '/tools',
]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // 静的ファイル・Next.js内部パスはスキップ
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // レスポンスを準備（セッションCookieの書き込みに使用）
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  // @supabase/ssr でセッションリフレッシュ
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // セッション取得（副作用としてトークンリフレッシュが行われる）
  const { data: { user } } = await supabase.auth.getUser()

  // 保護ルートかつ未認証 → ログインページにリダイレクト
  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのリクエストにマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
