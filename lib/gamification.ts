"use client"

import { SupabaseClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/database.types";

/** Supabase RPC 名 */
const RPC_INCREMENT = "increment_user_points";

/**
 * ユーザーにポイントを加算し、最新の points / level を返す
 * （サーバー側では increment_user_points RPC が実装されている前提）
 */
export async function addPoints(
  supabase: SupabaseClient<Database>,
  userId: string,
  delta: number,
) {
  const { data, error } = await supabase.rpc(RPC_INCREMENT, {
    p_user_id: userId,
    p_delta: delta,
  });
  if (error) throw error;
  
  // RPCが配列を返す場合は最初の要素を取得、単一オブジェクトの場合はそのまま使用
  const result = Array.isArray(data) ? data[0] : data;
  return result as { points: number; level: number };
}

/** 条件を満たしたバッジを自動付与し、新たに付与したバッジ一覧を返す */
export async function checkBadges(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  // 現在ポイント取得
  const { data: pointRow, error: pointErr } = await supabase
    .from("user_points")
    .select("points")
    .eq("user_id", userId)
    .single();
  if (pointErr) throw pointErr;

  const points = pointRow?.points ?? 0;

  // すべてのバッジ定義
  const { data: allBadges, error: badgeErr } = await supabase.from("badges").select("id, threshold, name, icon");
  if (badgeErr) throw badgeErr;

  // 取得済み
  const { data: owned } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);
  const ownedIds = new Set((owned ?? []).map((b) => b.badge_id));

  const toGive = (allBadges ?? []).filter(
    (b) => b.threshold !== null && points >= b.threshold && !ownedIds.has(b.id),
  );
  if (toGive.length) {
    await supabase.from("user_badges").insert(
      toGive.map((b) => ({ user_id: userId, badge_id: b.id })),
    );
  }
  return toGive;
}

/**
 * ミッション進捗を更新し、完了した場合はポイント/バッジを付与
 * @param missionId 対象ミッションID
 * @param step デフォルト1（報告ごとに+1など）
 * @returns 更新後の progress / completed
 */
export async function updateMissionProgress(
  supabase: SupabaseClient<Database>,
  userId: string,
  missionId: number,
  step = 1,
) {
  // 既存 progress 取得 or 0
  const { data: progressRow } = await supabase
    .from("user_mission_progress")
    .select("progress, completed")
    .eq("user_id", userId)
    .eq("mission_id", missionId)
    .single();

  let newProgress = step;
  let completed = false;

  // ミッション定義取得（目標値・報酬など）
  const { data: mission } = await supabase
    .from("missions")
    .select("target_value, reward_points, reward_badge_id")
    .eq("id", missionId)
    .single();

  const targetValue = mission?.target_value ?? 1;

  if (progressRow) {
    newProgress = (progressRow.progress ?? 0) + step;
  }

  if (newProgress >= targetValue) {
    newProgress = targetValue;
    completed = true;
  }

  if (progressRow) {
    await supabase
      .from("user_mission_progress")
      .update({ progress: newProgress, completed })
      .eq("user_id", userId)
      .eq("mission_id", missionId);
  } else {
    await supabase.from("user_mission_progress").insert({
      user_id: userId,
      mission_id: missionId,
      progress: newProgress,
      completed,
    });
  }

  // 報酬ポイント
  if (completed && mission?.reward_points) {
    await addPoints(supabase, userId, mission.reward_points);
  }

  // 報酬バッジ
  if (completed && mission?.reward_badge_id) {
    await supabase.from("user_badges").upsert({
      user_id: userId,
      badge_id: Number(mission.reward_badge_id),
    });
  }

  return { progress: newProgress, completed };
}

// SWR & React フックはプロジェクトに応じて追加してください。
// import useSWR from 'swr'
// import { useSupabase } from '@/components/providers/supabase-provider'
//
// export function useGamification() {
//   const { supabase } = useSupabase()
//   const { data: user } = supabase.auth.getUser()
//   return useSWR(user?.id ? ['points', user.id] : null, async () => {
//     if (!user?.id) return { points: 0, level: 1 }
//     return await getOrInitPoints(user.id, supabase)
//   })
// } 