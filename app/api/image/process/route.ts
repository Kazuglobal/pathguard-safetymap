import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createServerClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { readFileWithSentryContext } from "@/lib/sentry-upload-context";
// Node.js ランタイムを強制
export const runtime = "nodejs";

// --- トップレベル (関数の外) ---
// 環境変数を取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase Admin クライアントを初期化 (キーがない場合は null になる)
const supabaseAdmin: SupabaseClient<Database> | null =
  supabaseUrl && supabaseKey
    ? createClient<Database>(supabaseUrl, supabaseKey)
    : null;
// --- ここまでトップレベル ---

const BUCKET_NAME = "danger-reports";

type ImageType = "processed" | "original";

function parseImageType(value: FormDataEntryValue | null): ImageType {
  return value === "original" ? "original" : "processed";
}

function parseReplaceIndex(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!/^-?\d+$/.test(value.trim())) return Number.NaN;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function extractStoragePathFromPublicUrl(publicUrl: string, bucketName: string): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx < 0) return null;
    const path = decodeURIComponent(url.pathname.slice(idx + marker.length));
    return path || null;
  } catch {
    return null;
  }
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

    const admin = isAdminEmail(user.email)
      || user.app_metadata?.role === "admin"
      || user.user_metadata?.role === "admin";
    if (existingReport.user_id !== user.id && !admin) {
      return new Response(
        JSON.stringify({ message: "このレポートを更新する権限がありません" }),
        { status: 403 },
      );
    }

    const buffer = Buffer.from(
      await readFileWithSentryContext({
        route: "/api/image/process",
        fieldName: "file",
        file,
      }),
    );
    const timestamp = Date.now();
    const rawExt = file.name.split(".").pop() || "bin";
    const safeExt = /^[a-zA-Z0-9]+$/.test(rawExt) ? rawExt : "bin";
    const fileName = `${reportId}-${timestamp}-${Math.random().toString(36).substring(2, 15)}.${safeExt}`;
    // danger-reports bucket enforces owner-scoped folder policies:
    // storage.foldername(name)[1] must match auth.uid().
    // Store under the report owner's folder to satisfy RLS consistently.
    const ownerFolder = existingReport.user_id;
    const filePath = `${ownerFolder}/${reportId}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
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
