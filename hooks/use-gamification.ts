"use client"

import useSWR from "swr";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/lib/database.types";

interface UserPointsRow {
  user_id: string;
  points: number;
  level: number;
}

export function useGamification() {
  const { supabase } = useSupabase();
  const { toast } = useToast();
  
  const fetcher = async (): Promise<UserPointsRow | null> => {
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) {
        // "Auth session missing"は未ログイン状態なのでエラーではない
        if (!userErr.message?.includes("Auth session missing")) {
          console.error("useGamification: getUser error", userErr)
        }
        return null
      }
      if (!user) return null;

      const { data } = await supabase
        .from("user_points")
        .select("points, level")
        .eq("user_id", user.id)
        .single();
      return data as UserPointsRow | null;
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