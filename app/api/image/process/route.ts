import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createServerClient } from "@/lib/supabase-server";
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop() || "bin";
    const fileName = `${reportId}-${timestamp}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("danger-reports")
      .upload(filePath, buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
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
      .from("danger-reports")
      .getPublicUrl(filePath);

    const processedUrl = urlData.publicUrl;

    // 1. 現在の danger_reports レコードを取得
    const { data: existingReport, error: fetchError } = await supabaseAdmin
      .from("danger_reports")
      .select("processed_image_urls")
      .eq("id", reportId)
      .single();

    if (fetchError) {
      await supabaseAdmin.storage.from("danger-reports").remove([filePath]);
      return new Response(
        JSON.stringify({
          message: `Database fetch error: ${fetchError.message}`,
        }),
        { status: 500 },
      );
    }

    if (!existingReport) {
      await supabaseAdmin.storage.from("danger-reports").remove([filePath]);
      return new Response(
        JSON.stringify({ message: `Report with id ${reportId} not found.` }),
        { status: 404 },
      );
    }

    // 2. processed_image_urls 配列を更新
    const currentUrls = existingReport.processed_image_urls || [];
    const updatedUrls = [...currentUrls, processedUrl];

    // 3. danger_reports テーブルを更新
    const { error: updateError } = await supabaseAdmin
      .from("danger_reports")
      .update({
        processed_image_urls: updatedUrls,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (updateError) {
      await supabaseAdmin.storage.from("danger-reports").remove([filePath]);
      return new Response(
        JSON.stringify({
          message: `Database update error: ${updateError.message}`,
        }),
        { status: 500 },
      );
    }

    return new Response(
      JSON.stringify({
        message: "Image processed and report updated successfully.",
        processedImageUrl: processedUrl,
        updatedUrls: updatedUrls,
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
