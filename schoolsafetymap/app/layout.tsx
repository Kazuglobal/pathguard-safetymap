import { SupabaseProvider } from '@/components/providers/supabase-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* これでアプリ内のどこからでも SupabaseClient を参照できる */}
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  )
}