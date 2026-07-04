"use client"; // Supabaseクライアントや状態管理のためクライアントコンポーネントに

import { useState, useEffect, useCallback } from "react"; // useEffect, useState, useCallback をインポート
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProcessImageDialog } from "@/components/admin/ProcessImageDialog";
import { useSupabase } from "@/components/providers/supabase-provider";
import type { Database } from "@/lib/database.types";
import type { ReportWithProfile } from "@/lib/admin-reports-service";
import { Button } from "@/components/ui/button";
import { useDangerReportSignedImageUrl } from "@/lib/danger-report-image-access";

type ReportImageInsert = Database["public"]["Tables"]["report_images"]["Insert"];

/**
 * 元画像へのダウンロードリンク。danger-reports バケット非公開化に備え、
 * DB保存済みの公開URL文字列を表示直前に短TTLの署名URLへ差し替える。
 * (テーブルの行ごとにフックを1回だけ呼び出すため、独立したコンポーネントに分離)
 */
function ReportImageDownloadLink({ imageUrl }: { imageUrl: string | null }) {
  const { supabase } = useSupabase();
  const signedUrl = useDangerReportSignedImageUrl(supabase, imageUrl);

  if (!imageUrl) return <>画像なし</>;
  if (!signedUrl) return <span className="text-muted-foreground">読み込み中...</span>;

  return (
    <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
      画像表示
    </a>
  );
}

export default function AdminDashboardPage() {
  const { supabase } = useSupabase();
  const [reports, setReports] = useState<ReportWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // サーバー側 API 経由でレポートデータを取得する関数
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/reports');
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'レポートの取得に失敗しました');
      }

      setReports(json.reports || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'レポートの取得に失敗しました';
      setError(`レポートの取得に失敗しました: ${message}`);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // 加工画像アップロード完了時の処理
  const handleImageUploadComplete = async (processedImageUrl: string, reportId: string) => {
    if (!supabase) {
      alert("Supabaseクライアントが初期化されていません。");
      return;
    }
    console.log(
      `Report ID ${reportId} の加工画像がアップロードされました: ${processedImageUrl}`
    );

    // --- ここに report_images テーブルへの保存処理を実装 ---
    try {
      const newReportImage: ReportImageInsert = {
        report_id: reportId, // reportId は ProcessImageDialog から渡される report.id
        image_url: processedImageUrl,
        image_type: "processed", // 'processed' 固定
        // uploaded_by: (await supabase.auth.getUser()).data.user?.id, // 管理者のID (要認証)
        // created_at, updated_at はDB側で自動設定される想定
      };

      const { error: insertError } = await supabase
        .from("report_images") // ここは実際のテーブル名に置き換えてください
        .insert(newReportImage);

      if (insertError) {
        throw insertError;
      }

      alert(`報告ID ${reportId} の加工画像情報をデータベースに保存しました。`);
      // 必要に応じて、UIのレポート一覧を再取得またはローカルで更新
      fetchReports(); // 簡単のため再取得
    } catch (dbError: any) {
      console.error("Error saving processed image to DB:", dbError);
      alert(
        `加工画像情報のデータベース保存に失敗しました: ${dbError.message}`
      );
    }
    // ---------------------------------------------------------
  };

  // 仮のレポートデータを ProcessImageDialog が期待する形に変換
  const reportForDialog = (report: ReportWithProfile) => ({
    id: report.id,
    originalImageUrl: report.image_url || "", // danger_reports.image_url を想定 (nullableなら空文字)
    reportedAt: report.created_at ? new Date(report.created_at).toLocaleString('ja-JP') : "不明",
  });

  if (isLoading) {
    return <div className="container mx-auto py-10 text-center">読み込み中...</div>;
  }

  if (error) {
    return <div className="container mx-auto py-10 text-center text-red-600">{error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">管理者ダッシュボード</h1>
      <div className="mb-4">
        <Button onClick={fetchReports} disabled={isLoading}>
          {isLoading ? "更新中..." : "レポート一覧を更新"}
        </Button>
      </div>
      <h2 className="text-2xl font-semibold mb-4">危険箇所報告一覧</h2>
      {reports.length === 0 && !isLoading ? (
        <p>報告はありません。</p>
      ) : (
        <Table>
          <TableCaption>最近の危険箇所報告</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>報告日時</TableHead>
              <TableHead>報告者</TableHead>
              <TableHead>場所 (緯度経度)</TableHead>
              <TableHead>カテゴリ</TableHead>
              <TableHead>元画像</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  {report.created_at ? new Date(report.created_at).toLocaleString('ja-JP') : "不明"}
                </TableCell>
                <TableCell>
                  {report.profiles?.display_name || report.user_id?.substring(0, 8) || "匿名"}
                </TableCell>
                <TableCell>
                  {report.latitude?.toFixed(4)}, {report.longitude?.toFixed(4)}
                </TableCell>
                <TableCell>{report.danger_type}</TableCell>
                <TableCell>
                  <ReportImageDownloadLink imageUrl={report.image_url} />
                </TableCell>
                <TableCell>
                  {report.processed_image_urls && report.processed_image_urls.length > 0 ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800">
                      加工済み ({report.processed_image_urls.length}枚)
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-200 text-yellow-800">
                      未処理
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <ProcessImageDialog
                    report={reportForDialog(report)}
                    onUploadComplete={handleImageUploadComplete}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
} 