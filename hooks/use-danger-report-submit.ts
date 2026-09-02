"use client"

import type { Dispatch, SetStateAction } from "react"
import type { DangerReport, UserRoute } from "@/lib/types"
import type { DangerReportSubmitPayload } from "@/components/danger-report/danger-report-form"
import { useToast } from "@/components/ui/use-toast"
import { isValidCoordinates } from "@/lib/coordinates"
import { reverseGeocodeLocation } from "@/lib/map/reverse-geocode"
import {
  buildFamilyShareAction,
  buildFamilyShareMapLabel,
  buildFamilyShareSummary,
} from "@/lib/report-generation/family-share-card"

// 送信済みレポートの状態用
export interface SubmittedReportState {
  reportId: string
  title: string
  summary: string
  action: string | null
  mapLabel: string
  location: [number, number]
  originalImage: string | null
  processedImages: string[] // 複数画像に対応
}

interface UseDangerReportSubmitParams {
  supabase: any
  selectedLocation: [number, number] | null
  selectedUserRoute: UserRoute | null
  toast: ReturnType<typeof useToast>["toast"]
  /** 送信済みプレビューを表示しない導線(/report 等)では省略可 */
  setSubmittedReport?: Dispatch<SetStateAction<SubmittedReportState | null>>
  setIsSubmittedPreviewOpen?: Dispatch<SetStateAction<boolean>>
  setPendingReports?: Dispatch<SetStateAction<DangerReport[]>>
}

/**
 * 危険レポート送信フロー（INSERT →（必要なら）画像処理API → ポイント付与 → プレビュー/ローカル状態更新）
 * を担うフック。挙動・戻り値（{ reportId, imageUrl }）は map-container.tsx から不変で抽出。
 * 返す関数は毎レンダー最新の引数を読むクロージャで、従来のインライン実装と等価。
 */
export function useDangerReportSubmit({
  supabase,
  selectedLocation,
  selectedUserRoute,
  toast,
  setSubmittedReport,
  setIsSubmittedPreviewOpen,
  setPendingReports,
}: UseDangerReportSubmitParams) {
  const handleReportSubmit = async (
    reportData: DangerReportSubmitPayload & { imageFile?: File | null },
    options?: { suppressPreview?: boolean; suppressSuccessToast?: boolean }
  ): Promise<{ reportId: string; imageUrl: string | null }> => {
    if (!supabase || !selectedLocation) { // Check supabase and selectedLocation
      toast({ title: "エラー", description: "地図上で位置を選択してください。", variant: "destructive" });
      throw new Error("地図上で位置を選択してください。");
    }

    if (!isValidCoordinates(selectedLocation[1], selectedLocation[0])) {
      toast({ title: "エラー", description: "位置情報が不正です。地図で地点を再選択してください。", variant: "destructive" });
      throw new Error("位置情報が不正です。地図で地点を再選択してください。");
    }

    // insert するデータからファイル・画像URL配列を除外（アップロードは API 側へ一本化）
    const {
      imageFile: legacyImageFile,
      originalImageFile,
      processedImageFiles,
      route_context_id,
      route_context_name,
      image_url: _ignoredImageUrl,
      processed_image_urls: _ignoredProcessedImageUrls,
      ...reportDataToInsert
    } = reportData;

    const originalFileToUpload =
      (originalImageFile instanceof File ? originalImageFile : null)
      ?? (legacyImageFile instanceof File ? legacyImageFile : null);
    const processedFilesToUpload = (processedImageFiles || []).filter(
      (file): file is File => file instanceof File,
    );

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ユーザー情報が取得できませんでした。", variant: "destructive" });
        throw new Error("ユーザー情報が取得できませんでした。");
      }

      // 1. 基本情報をまず INSERT (processed_image_urls は含めないか NULL)
      console.log("Inserting basic report data...");

      const locationDetails = selectedLocation
        ? await reverseGeocodeLocation(selectedLocation[1], selectedLocation[0])
        : { prefecture: null as string | null, city: null as string | null };

      const createResponse = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...reportDataToInsert,
          latitude: selectedLocation[1],
          longitude: selectedLocation[0],
          prefecture: locationDetails.prefecture,
          city: locationDetails.city,
          title: reportDataToInsert.title || "無題の報告",
          danger_type: reportDataToInsert.danger_type || "other",
          danger_level: reportDataToInsert.danger_level || 1,
          route_context_id,
          route_context_name,
        }),
      });
      const createPayload = await createResponse.json().catch(() => ({})) as {
        report?: DangerReport
        pointsAwarded?: number
        error?: string
      };
      if (!createResponse.ok) throw new Error(createPayload.error || "レポートの保存に失敗しました");
      const insertedData = createPayload.report;
      if (!insertedData) throw new Error("挿入されたレポートデータの取得に失敗しました。");
      const pointsAwarded = Number(createPayload.pointsAwarded) || 0;

      const newReportId = insertedData.id;
      console.log(`Report inserted successfully with ID: ${newReportId}`);

      // 危険レポートアラート: 通学路300m圏内のユーザーにプッシュ通知 (fire-and-forget)
      fetch('/api/push/notify-danger-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: newReportId }),
      }).catch(() => {
        // プッシュ通知の失敗はレポート投稿の成功に影響しない
      })

      // 2. 画像があれば、画像処理 API を呼び出す（original / processed）
      let finalReportData = insertedData as DangerReport; // 型アサーション
      if (newReportId && (originalFileToUpload || processedFilesToUpload.length > 0)) {
        console.log(`Calling /api/image/process for report ID: ${newReportId}`);

        const uploadViaApi = async (file: File, imageType: "original" | "processed") => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("reportId", newReportId);
          formData.append("imageType", imageType);
          const response = await fetch("/api/image/process", {
            method: "POST",
            body: formData,
          });
          let data: any = {};
          try {
            data = await response.json();
          } catch {
            data = {};
          }
          if (!response.ok) {
            throw new Error(data.message || `画像処理APIエラー: status=${response.status}`);
          }
          return data;
        };

        try {
          if (originalFileToUpload) {
            const originalResult = await uploadViaApi(originalFileToUpload, "original");
            finalReportData = {
              ...finalReportData,
              image_url: originalResult.imageUrl || finalReportData.image_url || null,
            };
          }

          for (const processedFile of processedFilesToUpload) {
            const processedResult = await uploadViaApi(processedFile, "processed");
            finalReportData = {
              ...finalReportData,
              processed_image_urls: processedResult.updatedUrls || finalReportData.processed_image_urls || [],
            };
          }

          if (originalFileToUpload || processedFilesToUpload.length > 0) {
            toast({ title: "画像処理完了", description: "画像がアップロード・処理されました。" });
          }
        } catch (apiError: any) {
          console.error("Error calling /api/image/process:", apiError);
          toast({
            title: "画像処理エラー",
            description: `レポートは保存されましたが、画像の処理に失敗しました: ${apiError.message || "不明なエラー"}`,
            variant: "destructive",
          });
        }
      } else {
        console.log("No image file provided or report ID missing, skipping image processing.");
      }

      // 画像処理完了後にAI一次審査を発火する。suspiciousは専用フローが
      // レスポンスを画面状態へ反映するため、従来の専用エンドポイントに任せる。
      if (reportDataToInsert.danger_type !== "suspicious") {
        fetch("/api/danger-report/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: newReportId }),
        }).catch(() => {
          // AI審査失敗は投稿成功のUXへ影響させない。cronが後で救済する。
        })
      }


      // 3. 後続処理 (トースト、ポイント、プレビュー、ローカル状態更新)
      if (!options?.suppressSuccessToast) {
        toast({ title: "報告完了", description: "危険箇所報告が送信されました。" }); // 最終的な完了トースト
      }

      if (pointsAwarded > 0 && !options?.suppressSuccessToast) {
        toast({ title: "ポイント獲得", description: `報告送信で +${pointsAwarded}pt 獲得しました。` });
      }

      // プレビュー用のデータを設定 (selectedLocation が null でないことを確認)
      if (selectedLocation && !options?.suppressPreview) {
        setSubmittedReport?.({
          reportId: newReportId,
          title: finalReportData.title || "無題の報告",
          summary: buildFamilyShareSummary(finalReportData.description, finalReportData.title),
          action: buildFamilyShareAction(
            finalReportData.learning_checkpoints,
            selectedUserRoute?.name
              ? `${selectedUserRoute.name}で立ち止まる場所と待機位置を確認する`
              : null,
          ),
          mapLabel: buildFamilyShareMapLabel(
            [route_context_name ?? selectedUserRoute?.name ?? null, finalReportData.prefecture, finalReportData.city],
            selectedLocation,
          ),
          location: selectedLocation,
          originalImage: finalReportData.image_url || null,
          processedImages: finalReportData.processed_image_urls || [],
        });
      } else {
        console.error("Selected location is null, cannot set submitted report state.");
        // selectedLocation が null の場合のエラーハンドリングが必要な場合がある
      }

      // TEMP: Keep form open to show VLM analysis results
      // setIsReportFormOpen(false); // Close form

      // プレビューモーダル表示 (API の結果を反映したデータで判断)
      if (!options?.suppressPreview && (finalReportData.image_url || (finalReportData.processed_image_urls && finalReportData.processed_image_urls.length > 0))) {
        // selectedLocation が null の場合でもプレビューは表示できるかもしれない
        // ただし、SubmittedReportPreview が location を期待している場合は問題
        if (selectedLocation) {
            setIsSubmittedPreviewOpen?.(true);
        }
      }

      // ローカル状態を更新 (API の結果を反映したデータを使う)
      setPendingReports?.(prev => [finalReportData, ...prev]);

      // Return report ID and image URL for VLM analysis
      return {
        reportId: newReportId,
        imageUrl: finalReportData.image_url || null,
      };
    } catch (error: any) {
      console.error("Error submitting report:", error);
      toast({ title: "送信エラー", description: `報告の送信エラー: ${error.message}`, variant: "destructive" });
      throw error; // Re-throw so form can handle it
    }
  };

  return handleReportSubmit
}
