"use client"; // Supabaseクライアントや状態管理のためクライアントコンポーネントに

import { useState, useEffect } from "react"; // useEffect, useState をインポート
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
import { useSupabase } from "@/components/providers/supabase-provider"; // useSupabase をインポート
import type { Database } from "@/lib/database.types"; // 生成された型をインポート
import { Button } from "@/components/ui/button"; // Button をインポート

// 実際のDangerReport型 (database.types.ts から)
type DangerReport = Database["public"]["Tables"]["danger_reports"]["Row"];
// report_images テーブルの型 (仮。実際の型に合わせてください)
type ReportImageInsert = Database["public"]["Tables"]["report_images"]["Insert"];

export default function AdminDashboardPage() {
  const { supabase } = useSupabase();
  const [reports, setReports] = useState<DangerReport[]>([]); // Supabaseから取得するレポート
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Supabaseからレポートデータを取得する関数
  const fetchReports = async () => {
    if (!supabase) return;
    setIsLoading(true);
    setError(null);
    try {
      // TODO: 必要に応じて、管理者のみが閲覧できるようにRLSを設定するか、ここでフィルタリング
      // TODO: report_imagesテーブルとJOINして、加工画像の有無なども取得すると良い
      const { data, error } = await supabase
        .from("danger_reports")
        .select(`
          *,
          profiles ( display_name )
        `) // ユーザー名も取得する例
        .order("created_at", { ascending: false }); // 新しい順

      if (error) throw error;
      setReports(data || []);
    } catch (err: any) {
      console.error("Error fetching reports:", err);
      setError(`レポートの取得に失敗しました: ${err.message}`);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (supabase) { // supabase クライアントが利用可能になってから fetchReports を呼び出す
      fetchReports();
    }
  }, [supabase]);

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
  const reportForDialog = (report: DangerReport) => ({
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
              {/* <TableHead>ステータス</TableHead> */}
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
                  {/* @ts-ignore */}
                  {report.profiles?.display_name || report.user_id?.substring(0, 8) || "匿名"}
                </TableCell>
                <TableCell>
                  {report.latitude?.toFixed(4)}, {report.longitude?.toFixed(4)}
                </TableCell>
                <TableCell>{report.danger_type}</TableCell>
                <TableCell>
                  {report.image_url ? (
                    <a
                      href={report.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      画像表示
                    </a>
                  ) : (
                    "画像なし"
                  )}
                </TableCell>
                {/* <TableCell>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      // TODO: 加工画像の有無などでステータスを決定
                      "bg-yellow-200 text-yellow-800"
                    }`}
                  >
                    未処理
                  </span>
                </TableCell> */}
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