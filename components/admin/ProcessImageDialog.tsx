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
import { useSupabase } from "@/components/providers/supabase-provider"; // Supabaseフックをインポート
import { v4 as uuidv4 } from 'uuid'; // ファイル名の一意性を高めるためにuuidをインポート

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
  const { supabase } = useSupabase(); // Supabaseクライアントを取得
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    if (!selectedFile || !supabase) {
      alert("加工画像を選択してください。または、Supabaseクライアントが初期化されていません。");
      setUploadError("加工画像が選択されていないか、クライアントエラーです。");
      return;
    }
    setIsUploading(true);
    setUploadError(null);

    const fileExtension = selectedFile.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`; // 一意なファイル名
    const filePath = `processed-images/${report.id}/${fileName}`; // report.id をフォルダパスに含める

    try {
      const { data, error } = await supabase.storage
        .from("processed_images") // ここは実際に作成したバケット名に置き換えてください
        .upload(filePath, selectedFile, {
          cacheControl: "3600", // 任意: キャッシュ設定
          upsert: false, // 任意: 同名ファイルが存在する場合の動作 (false: エラー, true: 上書き)
        });

      if (error) {
        console.error("Upload error:", error);
        setUploadError(`アップロードに失敗しました: ${error.message}`);
        throw error;
      }

      if (data) {
        // 公開URLの取得 (Storageの設定による)
        // RLSで保護されている場合や公開URLを直接使わない場合は、パス(data.path)のみDBに保存し、
        // 表示時に署名付きURLを生成するなどの対応が必要になります。
        // ここでは、バケットが公開設定されていると仮定して直接URLを組み立てます。
        // 実際には Supabase の getPublicUrl を使うのがより安全です。
        const { data: publicUrlData } = supabase.storage
          .from("processed_images")
          .getPublicUrl(filePath);

        if (publicUrlData && publicUrlData.publicUrl) {
            alert(`加工画像 ${selectedFile.name} のアップロードが完了しました。`);
            if (onUploadComplete) {
              onUploadComplete(publicUrlData.publicUrl, report.id);
            }
            setSelectedFile(null);
             // モーダルを閉じる
            const closeButton = document.getElementById(`close-dialog-${report.id}`);
            if (closeButton) {
                closeButton.click();
            }
        } else {
            setUploadError("公開URLの取得に失敗しました。");
            console.error("Failed to get public URL for path:", filePath);
        }
      }
    } catch (e: any) {
      console.error("Upload failed:", e);
      if (!uploadError) { // supabase.storage.upload でのエラーがセットされていなければ汎用エラー
        setUploadError(`アップロード中に予期せぬエラーが発生しました: ${e.message || e}`);
      }
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
              <div className="relative w-full h-64 border rounded-md overflow-hidden">
                <Image
                  id={`original-image-${report.id}`}
                  src={report.originalImageUrl}
                  alt={`元画像 (報告ID: ${report.id})`}
                  fill
                  style={{ objectFit: "contain" }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
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