"use client"

import useSWR from "swr";
import { useSupabase } from "@/components/providers/supabase-provider";
import type { Database } from "@/lib/database.types";

interface UserPointsRow {
  user_id: string;
  points: number;
  level: number;
}

export function useGamification() {
  const { supabase } = useSupabase();
  const fetcher = async (): Promise<UserPointsRow | null> => {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return null;

    const { data } = await supabase
      .from("user_points")
      .select("points, level")
      .eq("user_id", user.id)
      .single();
    return data as UserPointsRow | null;
  };

  const { data, error, mutate, isLoading } = useSWR("user_points", fetcher, {
    refreshInterval: 60_000, // 1分ごとに再取得
  });

  return {
    points: data?.points ?? 0,
    level: data?.level ?? 1,
    isLoading,
    error,
    mutate,
  };
} 