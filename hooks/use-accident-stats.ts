/**
 * use-accident-stats.ts
 * 交通事故統計データのReact Hook
 * PathGuardian - 通学路安全マップ
 */

"use client";

import { useState, useCallback, useRef } from "react";
import {
  AccidentStats,
  getAccidentStatsRPC,
  enrichReportWithAccidents,
} from "@/lib/traffic-accident-data";

export type AccidentStatsStatus = "idle" | "loading" | "loaded" | "error";
type Status = AccidentStatsStatus;

export function useAccidentStats() {
  const [stats, setStats] = useState<AccidentStats | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);

  const beginRequest = useCallback(() => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setStatus("loading");
    setError(null);
    return requestId;
  }, []);

  const isLatestRequest = useCallback(
    (requestId: number) => latestRequestIdRef.current === requestId,
    []
  );

  /** 座標を指定して近隣事故統計を取得 */
  const fetchStats = useCallback(
    async (params: {
      latitude: number;
      longitude: number;
      radiusMeters?: number;
      years?: number;
    }) => {
      const requestId = beginRequest();

      try {
        // Edge Function経由ではなくRPC直接呼び出し（高速・コスト0）
        const data = await getAccidentStatsRPC(params);
        if (!isLatestRequest(requestId)) return null;
        setStats(data);
        setStatus("loaded");
        return data;
      } catch (e) {
        if (!isLatestRequest(requestId)) return null;
        const msg = e instanceof Error ? e.message : "統計取得に失敗しました";
        setError(msg);
        setStatus("error");
        return null;
      }
    },
    [beginRequest, isLatestRequest]
  );

  /** レポートIDを指定して事故統計を付与 & 取得 */
  const enrichReport = useCallback(async (reportId: string) => {
    const requestId = beginRequest();

    try {
      const data = await enrichReportWithAccidents(reportId);
      if (!isLatestRequest(requestId)) return null;
      if (!data) {
        setError("統計付与に失敗しました");
        setStatus("error");
        return null;
      }
      setStats(data);
      setStatus("loaded");
      return data;
    } catch (e) {
      if (!isLatestRequest(requestId)) return null;
      const msg = e instanceof Error ? e.message : "統計付与に失敗しました";
      setError(msg);
      setStatus("error");
      return null;
    }
  }, [beginRequest, isLatestRequest]);

  /** リセット */
  const reset = useCallback(() => {
    // invalidate in-flight requests
    latestRequestIdRef.current += 1;
    setStats(null);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    stats,
    status,
    error,
    isLoading: status === "loading",
    isLoaded: status === "loaded",
    hasData: stats !== null,
    fetchStats,
    enrichReport,
    reset,
  };
}
