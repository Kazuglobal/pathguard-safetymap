import { createClient, SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "@/lib/database.types";
import { createServerClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { readFileWithSentryContext } from "@/lib/sentry-upload-context";
import { extractStoragePathFromPublicUrl } from "@/lib/storage-path";
// Node.js ランタイムを強制
export const runtime = "nodejs";

const BUCKET_NAME = "danger-reports";
let supabaseAdminClient: SupabaseClient<Database> | null | undefined;

type ImageType = "processed" | "original";

type ReencodedImage = {
  buffer: Buffer;
  contentType: string;
  ext: string;
};

/**
 * アップロード前に必ず sharp で再エンコードし、EXIF(GPS位置情報・機種情報・撮影時刻)を除去する。
 * - rotate(): EXIFのOrientationを画素へ反映してから、そのEXIF自体は破棄する。
 * - withMetadata()を呼ばない: sharpはデフォルトで出力にメタデータ(EXIF/ICC等)を引き継がないため、
 *   GPS等の位置情報は確実に落ちる。
 * - 出力フォーマットは元のcontentTypeに応じてjpeg/png/webpへ正規化する。
 * 失敗時(壊れた画像等)はthrowし、呼び出し側で400を返す(生バッファのフォールスルーは行わない)。
 */
async function reencodeImageForUpload(
  buffer: Buffer,
  contentType: string,
): Promise<ReencodedImage> {
  const pipeline = sharp(buffer).rotate();

  if (contentType === "image/png") {
    return {
      buffer: await pipeline.png().toBuffer(),
      contentType: "image/png",
      ext: "png",
    };
  }

  if (contentType === "image/webp") {
    return {
      buffer: await pipeline.webp({ quality: 85 }).toBuffer(),
      contentType: "image/webp",
      ext: "webp",
    };
  }

  return {
    buffer: await pipeline.jpeg({ quality: 85 }).toBuffer(),
    contentType: "image/jpeg",
    ext: "jpg",
  };
}

function parseImageType(value: FormDataEntryValue | null): ImageType {
  return value === "original" ? "original" : "processed";
}

function parseReplaceIndex(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!/^-?\d+$/.test(value.trim())) return Number.NaN;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function getSupabaseAdminClient(): SupabaseClient<Database> | null {
  if (supabaseAdminClient !== undefined) return supabaseAdminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  supabaseAdminClient =
    supabaseUrl && supabaseKey
      ? createClient<Database>(supabaseUrl, supabaseKey)
      : null;

  return supabaseAdminClient;
}


// --- POST 関数定義 ---
export async function POST(req: Request) {
  // 認証チェック
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ message: "認証が必要です" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Supabase Admin クライアントが初期化されているかチェック
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return new Response(
      JSON.stringify({
        message: "Server configuration error: Failed to initialize Supabase.",
      }),
      { status: 500 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const reportId = formData.get("reportId") as string;
    const imageType = parseImageType(formData.get("imageType"));
    const replaceIndex = parseReplaceIndex(formData.get("replaceIndex"));

    if (!file) {
      return new Response(JSON.stringify({ message: "file not provided" }), {
        status: 400,
      });
    }
    if (!reportId) {
      return new Response(JSON.stringify({ message: "reportId not provided" }), {
        status: 400,
      });
    }
    if (Number.isNaN(replaceIndex)) {
      return new Response(
        JSON.stringify({ message: "replaceIndex must be an integer" }),
        { status: 400 },
      );
    }

    // 1. 対象レポートを取得し、所有者/管理者を検証
    const { data: existingReport, error: fetchError } = await supabaseAdmin
      .from("danger_reports")
      .select("user_id, image_url, processed_image_urls")
      .eq("id", reportId)
      .maybeSingle();

    if (fetchError) {
      return new Response(
        JSON.stringify({
          message: `Database fetch error: ${fetchError.message}`,
        }),
        { status: 500 },
      );
    }

    if (!existingReport) {
      return new Response(
        JSON.stringify({ message: `Report with id ${reportId} not found.` }),
        { status: 404 },
      );
    }

    const admin = isAdminEmail(user.email) || user.app_metadata?.role === "admin";
    if (existingReport.user_id !== user.id && !admin) {
      return new Response(
        JSON.stringify({ message: "このレポートを更新する権限がありません" }),
        { status: 403 },
      );
    }

    const rawBuffer = Buffer.from(
      await readFileWithSentryContext({
        route: "/api/image/process",
        fieldName: "file",
        file,
      }),
    );

    let reencoded: ReencodedImage;
    try {
      reencoded = await reencodeImageForUpload(rawBuffer, file.type || "");
    } catch (reencodeError: unknown) {
      const message =
        reencodeError instanceof Error ? reencodeError.message : "unknown error";
      return new Response(
        JSON.stringify({
          message: `画像の処理に失敗しました。壊れた画像またはサポートされていない形式です: ${message}`,
        }),
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const fileName = `${reportId}-${timestamp}-${Math.random().toString(36).substring(2, 15)}.${reencoded.ext}`;
    // danger-reports bucket enforces owner-scoped folder policies:
    // storage.foldername(name)[1] must match auth.uid().
    // Store under the report owner's folder to satisfy RLS consistently.
    const ownerFolder = existingReport.user_id;
    const filePath = `${ownerFolder}/${reportId}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, reencoded.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: reencoded.contentType,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({
          message: `Storage upload error: ${uploadError.message}`,
        }),
        { status: 500 },
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const processedUrl = urlData.publicUrl;

    if (imageType === "original") {
      const { error: originalUpdateError } = await supabaseAdmin
        .from("danger_reports")
        .update({
          image_url: processedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      if (originalUpdateError) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([filePath]);
        return new Response(
          JSON.stringify({
            message: `Database update error: ${originalUpdateError.message}`,
          }),
          { status: 500 },
        );
      }

      return new Response(
        JSON.stringify({
          message: "Original image uploaded and report updated successfully.",
          imageUrl: processedUrl,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // processed image: append or replace
    const currentUrls = existingReport.processed_image_urls || [];
    let updatedUrls = [...currentUrls];
    let oldReplacedUrl: string | null = null;

    if (replaceIndex === null) {
      updatedUrls = [...currentUrls, processedUrl];
    } else {
      if (replaceIndex < 0 || replaceIndex >= currentUrls.length) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([filePath]);
        return new Response(
          JSON.stringify({ message: "replaceIndex is out of range" }),
          { status: 400 },
        );
      }
      oldReplacedUrl = currentUrls[replaceIndex] || null;
      updatedUrls[replaceIndex] = processedUrl;
    }

    const { error: processedUpdateError } = await supabaseAdmin
      .from("danger_reports")
      .update({
        processed_image_urls: updatedUrls,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (processedUpdateError) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([filePath]);
      return new Response(
        JSON.stringify({
          message: `Database update error: ${processedUpdateError.message}`,
        }),
        { status: 500 },
      );
    }

    // replace時は旧ファイルをベストエフォートで削除
    if (oldReplacedUrl) {
      const oldPath = extractStoragePathFromPublicUrl(oldReplacedUrl, BUCKET_NAME);
      if (oldPath) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([oldPath]);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Processed image uploaded and report updated successfully.",
        processedImageUrl: processedUrl,
        updatedUrls,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Internal Server Error";
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
    });
  }
}
