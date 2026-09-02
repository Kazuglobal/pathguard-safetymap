// app/badges/page.tsx
import { getActor } from "@/lib/auth/actor";
import { listBadges } from "@/lib/db/repos/gamification.repo";
import { BadgeCard, BadgeData } from "@/components/badges/badge-card";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";

export default async function BadgePage() {
  const actor = await getActor();
  if (actor.kind !== "user") redirect("/login?redirect=/badges");
  const isLoggedIn = true;
  const result = await listBadges(actor, actor.id);
  const allBadges = result.badges;

  // 4) ユーザー取得済みバッジを取得（ログイン時のみ）
  let userBadges: { badge_id: number; acquired_at: string | null }[] = [];
  let currentPoints = 0;

  if (isLoggedIn) {
    userBadges = result.owned.map((row) => ({ badge_id: row.badgeId, acquired_at: row.acquiredAt }));
    currentPoints = result.points;
  }

  // 5) 取得済みバッジをマップに変換
  const ownedBadgesMap = new Map<number, string | null>();
  userBadges.forEach((ub) => {
    ownedBadgesMap.set(ub.badge_id, ub.acquired_at);
  });

  // 6) バッジデータを整形
  const badges: BadgeData[] = allBadges.map((badge) => ({
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
