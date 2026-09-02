"use client"

import useSWR from "swr";
import { useToast } from "@/components/ui/use-toast";

interface UserPointsRow {
  user_id: string;
  points: number;
  level: number;
}

export function useGamification() {
  const { toast } = useToast();
  
  const fetcher = async (): Promise<UserPointsRow | null> => {
    try {
      const response = await fetch("/api/gamification", { credentials: "same-origin" })
      if (!response.ok) return null
      return await response.json() as UserPointsRow
    } catch (e) {
      console.error("useGamification: unexpected error", e)
      return null
    }
  };

  const { data, error, mutate, isLoading } = useSWR("user_points", fetcher, {
    refreshInterval: 60_000, // 1分ごとに再取得
  });

  // ポイント獲得通知
  const showPointsNotification = (pointsEarned: number, reason: string) => {
    toast({
      title: `+${pointsEarned}ポイント獲得！`,
      description: reason,
      duration: 3000,
    });
  };

  // レベルアップ通知
  const showLevelUpNotification = (newLevel: number) => {
    toast({
      title: `レベルアップ！`,
      description: `レベル${newLevel}に到達しました！`,
      duration: 5000,
    });
  };

  return {
    points: data?.points ?? 0,
    level: data?.level ?? 1,
    isLoading,
    error,
    mutate,
    showPointsNotification,
    showLevelUpNotification,
  };
}
