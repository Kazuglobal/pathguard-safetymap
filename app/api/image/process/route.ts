import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types"; // Database 型をインポート
// Node.js ランタイムを強制
export const runtime = "nodejs";

// --- トップレベル (関数の外) ---
// 環境変数を取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase Admin クライアントを初期化 (キーがない場合は null になる)
// 型アサーションを追加
const supabaseAdmin: SupabaseClient<Database> | null =
  supabaseUrl && supabaseKey
    ? createClient<Database>(supabaseUrl, supabaseKey) // 型を指定
    : null;

console.log(
  "[API Init Check - Top Level] NEXT_PUBLIC_SUPABASE_URL:",
  supabaseUrl ? "Loaded" : "MISSING",
);
console.log(
  "[API Init Check - Top Level] SUPABASE_SERVICE_ROLE_KEY:",
  supabaseKey ? "Loaded" : "MISSING",
);
// --- ここまでトップレベル ---


// --- POST 関数定義 ---
export async function POST(req: Request) {
  // --- ▼▼▼ POST 関数の開始カッコ { のすぐ内側 ▼▼▼ ---

  console.log("[POST Start] Request received."); // POST 関数が呼ばれたことを確認

  // Supabase Admin クライアントが初期化されているかチェック
  if (!supabaseAdmin) {
    console.error(
      "[POST Error] Supabase Admin Client is not initialized. Check server environment variables.",
    );
    // ★★★ この return は POST 関数の内側にある必要があります ★★★
    return new Response(
      JSON.stringify({
        message: "Server configuration error: Failed to initialize Supabase.",
      }),
      { status: 500 },
    );
  }

  console.log("[POST Info] Supabase Admin Client seems initialized.");

  // --- ▲▲▲ チェック終了 ▲▲▲ ---

  try {
    // --- ここから元の try ブロックの内容 ---\
    console.log("[POST Info] Processing form data...");
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const reportId = formData.get("reportId") as string; // reportId を取得

    if (!file) {
      console.log("[POST Warn] File not provided in form data.");
      return new Response(JSON.stringify({ message: "file not provided" }), {
        status: 400,
      });
    }
    if (!reportId) {
      console.log("[POST Warn] reportId not provided in form data.");
      return new Response(JSON.stringify({ message: "reportId not provided" }), {
        status: 400,
      });
    }
    console.log(
      `[POST Info] File received: ${file.name}, type: ${file.type}, size: ${file.size}`,
    );
    console.log(`[POST Info] Target reportId: ${reportId}`); // reportId をログ出力

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop() || "bin";
    // ファイルパスを一意にする（reportIdを含めるなど検討の余地あり）
    const fileName = `${reportId}-${timestamp}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `danger-reports/${fileName}`; // 保存先を danger-reports バケット直下に

    console.log(`[POST Info] Uploading to Supabase Storage: ${filePath}`);
    const { error: uploadError } = await supabaseAdmin.storage
      .from("danger-reports") // バケット名を指定
      .upload(filePath, buffer, {
        cacheControl: "3600",
        upsert: false, // 同じファイルパスがあればエラーにする（上書きしない）
        contentType: file.type,
      });

    if (uploadError) {
      console.error("[POST Error] Storage upload failed:", uploadError);
      return new Response(
        JSON.stringify({
          message: `Storage upload error: ${uploadError.message}`,
        }),
        { status: 500 },
      );
    }
    console.log(`[POST Info] Storage upload successful.`);

    const { data: urlData } = supabaseAdmin.storage
      .from("danger-reports") // バケット名を指定
      .getPublicUrl(filePath);

    const processedUrl = urlData.publicUrl; // 加工済み画像の公開URL
    console.log(`[POST Info] Got public URL: ${processedUrl}`);

    // --- ▼▼▼ データベース更新処理 ▼▼▼ ---
    console.log(
      `[POST Info] Updating danger_reports table for reportId: ${reportId}`,
    );

    // 1. 現在の danger_reports レコードを取得
    const { data: existingReport, error: fetchError } = await supabaseAdmin
      .from("danger_reports")
      .select("processed_image_urls")
      .eq("id", reportId)
      .single();

    if (fetchError) {
      console.error(
        `[POST Error] Failed to fetch danger_report (id: ${reportId}):`,
        fetchError,
      );
      // アップロードしたファイルを削除するなどのロールバック処理が必要な場合がある
      await supabaseAdmin.storage.from("danger-reports").remove([filePath]);
      console.log(`[POST Info] Rolled back storage upload: ${filePath}`);
      return new Response(
        JSON.stringify({
          message: `Database fetch error: ${fetchError.message}`,
        }),
        { status: 500 },
      );
    }

    if (!existingReport) {
      console.error(`[POST Error] Danger report not found (id: ${reportId})`);
       // アップロードしたファイルを削除
      await supabaseAdmin.storage.from("danger-reports").remove([filePath]);
      console.log(`[POST Info] Rolled back storage upload: ${filePath}`);
      return new Response(
        JSON.stringify({ message: `Report with id ${reportId} not found.` }),
        { status: 404 },
      );
    }

    // 2. processed_image_urls 配列を更新
    const currentUrls = existingReport.processed_image_urls || [];
    const updatedUrls = [...currentUrls, processedUrl]; // 新しいURLを配列に追加

    // 3. danger_reports テーブルを更新
    const { error: updateError } = await supabaseAdmin
      .from("danger_reports")
      .update({
        processed_image_urls: updatedUrls,
        updated_at: new Date().toISOString(), // updated_atも更新
      })
      .eq("id", reportId);

    if (updateError) {
      console.error(
        `[POST Error] Failed to update danger_report (id: ${reportId}):`,
        updateError,
      );
      // ここでもロールバック処理を検討
      await supabaseAdmin.storage.from("danger-reports").remove([filePath]);
       console.log(`[POST Info] Rolled back storage upload: ${filePath}`);
      return new Response(
        JSON.stringify({
          message: `Database update error: ${updateError.message}`,
        }),
        { status: 500 },
      );
    }

    console.log(
      `[POST Info] Successfully updated danger_reports for reportId: ${reportId}`,
    );
    // --- ▲▲▲ データベース更新処理 ▲▲▲ ---

    // 仮の解析結果 (本来はここで画像解析処理) -> これは不要になるかも？
    // const analysisResult = { risks: ["仮のリスク情報"] };
    // console.log("[POST Info] Generating dummy analysis result.");

    // レスポンスとして更新後のURL配列や成功ステータスを返す
    return new Response(
      JSON.stringify({
        message: "Image processed and report updated successfully.",
        processedImageUrl: processedUrl, // 追加された画像のURL
        updatedUrls: updatedUrls, // 更新後の全URL配列
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
    // --- ここまで try ブロック ---\
  } catch (err: any) {
    console.error("[POST Catch Error] An unexpected error occurred:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Internal Server Error";
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
    });
  }
  // --- POST 関数の終わりカッコ } ---
}