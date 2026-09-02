"use client"; // モーダル操作や状態管理のためクライアントコンポーネントに

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // DialogClose をインポート
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image"; // Next.js の Image コンポーネント
import { useDangerReportSignedImageUrl } from "@/lib/danger-report-image-access";

// 親コンポーネントから渡されるレポート情報の型 (仮)
// TODO: 실제 DangerReport 타입으로 변경
interface ReportData {
  id: string;
  originalImageUrl: string;
  reportedAt?: string; // 元画像の撮影日時など
  // ...その他必要な情報
}

interface ProcessImageDialogProps {
  report: ReportData;
  onUploadComplete?: (processedImageUrl: string, reportId: string) => void; // アップロード完了時のコールバックに reportId を追加
}

export function ProcessImageDialog({ report, onUploadComplete }: ProcessImageDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // danger-reports バケット非公開化に備え、DB保存済みの公開URL文字列を
  // 表示直前に短TTLの署名URLへ差し替える(取得中/失敗時は null)。
  const signedOriginalImageUrl = useDangerReportSignedImageUrl(null, report.originalImageUrl || null);

  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl); // クリーンアップ
    }
    setPreviewUrl(null);
  }, [selectedFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("加工画像を選択してください。");
      setUploadError("加工画像が選択されていません。");
      return;
    }
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('reportId', report.id);
      formData.append('imageType', 'processed');
      const response = await fetch('/api/image/process', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({})) as { message?: string; processedImageUrl?: string };
      if (!response.ok || !data.processedImageUrl) throw new Error(data.message ?? 'アップロードに失敗しました');
      alert(`加工画像 ${selectedFile.name} のアップロードが完了しました。`);
      onUploadComplete?.(data.processedImageUrl, report.id);
      setSelectedFile(null);
      document.getElementById(`close-dialog-${report.id}`)?.click();
    } catch (e: unknown) {
      console.error("Upload failed:", e);
      const message = e instanceof Error ? e.message : String(e);
      setUploadError(`アップロード中にエラーが発生しました: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog onOpenChange={(open) => { if (!open) { setUploadError(null); setSelectedFile(null); }}}> {/* モーダルが閉じる時にエラーと選択ファイルをリセット */}
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">加工画像処理</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>報告ID: {report.id} の画像処理</DialogTitle>
          <DialogDescription>
            元画像を確認し、加工済みの画像をアップロードしてください。
            {report.reportedAt && ` (元画像報告日時: ${report.reportedAt})`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* 元画像表示 */}
          <div className="space-y-2">
            <Label htmlFor={`original-image-${report.id}`}>元画像</Label>
            {report.originalImageUrl ? (
              signedOriginalImageUrl ? (
                <div className="relative w-full h-64 border rounded-md overflow-hidden">
                  <Image
                    id={`original-image-${report.id}`}
                    src={signedOriginalImageUrl}
                    alt={`元画像 (報告ID: ${report.id})`}
                    fill
                    style={{ objectFit: "contain" }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
              ) : (
                <div className="flex h-64 w-full items-center justify-center rounded-md border bg-muted/30">
                  <p className="text-sm text-muted-foreground">画像を読み込んでいます...</p>
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">元画像はありません。</p>
            )}
          </div>

          {/* 加工画像アップロードフォーム */}
          <div className="space-y-2">
            <Label htmlFor={`processed-image-upload-${report.id}`}>加工画像をアップロード</Label>
            <Input
              id={`processed-image-upload-${report.id}`}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {previewUrl && !uploadError && ( // エラーがない時だけプレビュー表示
              <div className="mt-2 relative w-full h-48 border rounded-md overflow-hidden">
                <Image
                  src={previewUrl}
                  alt="加工画像プレビュー"
                  fill
                  style={{ objectFit: "contain" }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            )}
            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
            )}
          </div>

          {/* TODO: 既存の加工画像表示エリア (あれば) */}

        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" id={`close-dialog-${report.id}`}>
              閉じる
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? "アップロード中..." : "アップロード実行"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
