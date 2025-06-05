export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ここで管理者認証チェックなどを将来的に追加
  return (
    <section>
      {/* 将来的には管理者用ナビゲーションなどをここに追加 */}
      {children}
    </section>
  );
} 