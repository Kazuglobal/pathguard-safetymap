"use client";

import { cn } from "@/lib/utils";
import { Check, Lock } from "lucide-react";

export interface BadgeData {
  id: number;
  name: string;
  icon: string | null;
  threshold: number | null;
  isOwned: boolean;
  acquiredAt: string | null;
}

interface BadgeCardProps {
  badge: BadgeData;
  className?: string;
}

export function BadgeCard({ badge, className }: BadgeCardProps) {
  const { id, name, icon, threshold, isOwned, acquiredAt } = badge;

  // 取得日時のフォーマット
  const formatDateUtc = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
  };

  return (
    <div
      data-testid="badge-card"
      data-owned={isOwned ? "true" : "false"}
      className={cn(
        "badge-card relative flex flex-col items-center p-4 rounded-lg border bg-card text-card-foreground shadow-sm transition-all",
        isOwned ? "owned" : "unowned opacity-50 grayscale",
        className
      )}
    >
      {/* 取得済みチェックマーク */}
      {isOwned && (
        <div 
          data-testid="badge-check"
          className="badge-check absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      {/* 未取得ロックアイコン */}
      {!isOwned && (
        <div 
          data-testid="badge-lock"
          className="badge-lock absolute top-2 right-2 w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center"
        >
          <Lock className="w-3 h-3 text-white" />
        </div>
      )}

      {/* バッジアイコン */}
      <div
        data-testid="badge-icon"
        className="badge-icon w-16 h-16 flex items-center justify-center text-4xl mb-3"
      >
        {icon || "🏅"}
      </div>

      {/* バッジ名 */}
      <h4
        data-testid="badge-name"
        className="badge-name text-sm font-semibold text-center mb-2 line-clamp-2"
      >
        {name}
      </h4>

      {/* 取得条件 */}
      <p
        data-testid="badge-threshold"
        className="badge-threshold text-xs text-muted-foreground text-center"
      >
        {threshold !== null ? `${threshold}ポイント達成` : "条件なし"}
      </p>

      {/* 取得日時 */}
      <div
        data-testid="badge-acquired-date"
        className="acquired-date text-xs text-muted-foreground mt-2 text-center"
      >
        {isOwned && acquiredAt ? (
          <span>{formatDateUtc(acquiredAt)} 取得</span>
        ) : (
          <span className="text-gray-400">未取得</span>
        )}
      </div>
    </div>
  );
}
