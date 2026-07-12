// app/badges/page.tsx
import { createServerClient } from "@/lib/supabase-server";
import { Database } from "@/lib/database.types";
import { BadgeCard, BadgeData } from "@/components/badges/badge-card";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type BadgeRow = Database["public"]["Tables"]["badges"]["Row"];

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
  let userBadgesFetchFailed = false;
  let currentPoints = 0;

  if (isLoggedIn && userId) {
    const { data, error: userBadgesError } = await supabase
      .from("user_badges")
      .select("badge_id, acquired_at")
      .eq("user_id", userId as any);

    if (userBadgesError) {
      console.error("Failed to fetch user badges:", userBadgesError);
      userBadgesFetchFailed = true;
    } else {
      userBadges = data ?? [];
    }

    // ユーザーポイントを取得
    const { data: userPointsData } = await supabase
      .from("user_points")
      .select("points")
      .eq("user_id", userId as any)
      .single();

    currentPoints = userPointsData?.points ?? 0;
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

  // 8) 次のバッジまでの進捗計算
  const nextBadge = badges.find(
    (b) => !b.isOwned && b.threshold !== null && b.threshold > currentPoints
  );
  const progressPercent = nextBadge?.threshold
    ? Math.min(100, Math.round((currentPoints / nextBadge.threshold) * 100))
    : 100;

  // 9) 画面描画
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

      {/* 取得状況取得失敗メッセージ（ログイン時のみ） */}
      {isLoggedIn && userBadgesFetchFailed && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6">
          <p className="text-sm text-center">
            取得状況の取得に失敗しました。表示内容が正確でない可能性があります。時間をおいて再読み込みしてください。
          </p>
        </div>
      )}

      {/* バッジ進捗セクション（ログイン時のみ） */}
      {isLoggedIn && (
        <div
          data-testid="badge-progress-section"
          className="bg-card rounded-lg p-6 mb-6 shadow-sm border"
        >
          {/* 現在ポイント */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground">現在のポイント</span>
            <span data-testid="current-points" className="text-2xl font-bold">
              {currentPoints}pt
            </span>
          </div>

          {/* 次のバッジまでの進捗 */}
          {nextBadge ? (
            <div data-testid="next-badge-progress">
              <div className="flex justify-between text-sm mb-2">
                <span data-testid="next-badge-name">
                  次のバッジ: {nextBadge.name}
                </span>
                <span>
                  {currentPoints}/{nextBadge.threshold}pt
                </span>
              </div>
              <Progress
                value={progressPercent}
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                あと {Math.max(nextBadge.threshold - currentPoints, 0)}pt で「{nextBadge.name}」
              </p>
              <Link href="/missions" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">
                ポイントを取りにいく <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div data-testid="badges-complete" className="text-center py-2">
              <span className="text-primary font-medium">
                🎉 すべてのバッジを取得しました！
              </span>
            </div>
          )}

          {/* バッジ取得数 */}
          <p
            data-testid="owned-badge-count"
            className="owned-count text-muted-foreground mt-4"
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
