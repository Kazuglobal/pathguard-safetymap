// app/badges/page.tsx
import { createServerClient } from "@/lib/supabase-server";
import { Database } from "@/lib/database.types";

type UserBadgesRow = Database["public"]["Tables"]["user_badges"]["Row"];

export default async function BadgePage() {
  // 1) Supabase クライアント生成
  const supabase = await createServerClient();

  // 2) セッション取得
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return <div>Please log in to view your badges.</div>;
  }

  // 3) ユーザー ID を profiles.id の型に合わせる
  const userId =
    session.user.id as Database["public"]["Tables"]["profiles"]["Row"]["id"];

  // 4) user_badges からこのユーザーのバッジ ID を取得
  const { data, error } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId as any); // ← 型キャストで TypeScript を通す

  if (error) throw new Error(error.message);

  // 5) データを整形
  const rows = data as { badge_id: UserBadgesRow["badge_id"] }[];
  const ownedIds = new Set(rows.map((r) => r.badge_id));

  // 6) 画面描画
  return (
    <div>
      <h1>My Badges</h1>
      <p>You own {ownedIds.size} badges.</p>
    </div>
  );
}
