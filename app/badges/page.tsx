// app/badges/page.tsx
import { createServerClient } from "@/lib/supabase-server";
import { Database } from "@/lib/database.types";
import { BadgeCard, BadgeData } from "@/components/badges/badge-card";

type BadgeRow = Database["public"]["Tables"]["badges"]["Row"];
type UserBadgeRow = Database["public"]["Tables"]["user_badges"]["Row"];

export default async function BadgePage() {
  // 1) Supabase クライアント生成
  const supabase = await createServerClient();

  // 2) セッション取得
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const isLoggedIn = !sessionError && session?.user;
  const userId = session?.user?.id;

  // 3) 全バッジを取得（ログイン不要）
  const { data: allBadges, error: badgesError } = await supabase
    .from("badges")
    .select("id, name, icon, threshold, created_at")
    .order("threshold", { ascending: true });

  if (badgesError) {
    console.error("Failed to fetch badges:", badgesError);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 data-testid="badges-title" className="text-2xl font-bold mb-4">
          バッジ一覧
        </h1>
        <p className="text-destructive">バッジの取得に失敗しました。</p>
      </div>
    );
  }

  // 4) ユーザー取得済みバッジを取得（ログイン時のみ）
  let userBadges: { badge_id: number; acquired_at: string | null }[] = [];
  if (isLoggedIn && userId) {
    const { data, error: userBadgesError } = await supabase
      .from("user_badges")
      .select("badge_id, acquired_at")
      .eq("user_id", userId as any);

    if (userBadgesError) {
      console.error("Failed to fetch user badges:", userBadgesError);
    } else {
      userBadges = data ?? [];
    }
  }

  // 5) 取得済みバッジをマップに変換
  const ownedBadgesMap = new Map<number, string | null>();
  userBadges.forEach((ub) => {
    ownedBadgesMap.set(ub.badge_id, ub.acquired_at);
  });

  // 6) バッジデータを整形
  const badges: BadgeData[] = (allBadges ?? []).map((badge: BadgeRow) => ({
    id: badge.id,
    name: badge.name,
    icon: badge.icon,
    threshold: badge.threshold,
    isOwned: ownedBadgesMap.has(badge.id),
    acquiredAt: ownedBadgesMap.get(badge.id) ?? null,
  }));

  // 7) サマリー計算
  const totalBadges = badges.length;
  const ownedBadges = badges.filter((b) => b.isOwned).length;

  // 8) 画面描画
  return (
    <div className="container mx-auto px-4 py-8">
      {/* ページタイトル */}
      <h1 data-testid="badges-title" className="text-2xl font-bold mb-2">
        バッジ一覧
      </h1>

      {/* 未ログイン時のメッセージ */}
      {!isLoggedIn && (
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-muted-foreground text-center">
            ログインすると取得状況が表示されます
          </p>
        </div>
      )}

      {/* バッジ取得サマリー（ログイン時のみ） */}
      {isLoggedIn && (
        <div data-testid="badge-summary" className="badge-summary mb-6">
          <p 
            data-testid="owned-badge-count" 
            className="owned-count text-muted-foreground"
          >
            {totalBadges}個中{ownedBadges}個取得
          </p>
        </div>
      )}

      {/* バッジグリッド */}
      <div
        data-testid="badge-grid"
        className="badge-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
      >
        {badges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>

      {/* バッジがない場合 */}
      {badges.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            バッジがまだ登録されていません。
          </p>
        </div>
      )}
    </div>
  );
}
