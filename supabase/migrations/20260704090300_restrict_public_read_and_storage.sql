-- ============================================
-- T-03 [Critical] 未認証(anon)公開の停止 + 座標丸め
-- ============================================
--
-- 背景:
-- - danger_reports の "danger_reports_select" ポリシー(20260203131004)は
--   TO public で status IN ('approved','resolved') の行を生の緯度経度付きで
--   anon key に公開していた。
-- - components/landing/HiyariHatReport.tsx はランディングページ(/landing、
--   middleware.ts の PROTECTED_PREFIXES に含まれず未ログインで閲覧可能)から
--   createBrowserClient(anon key) で danger_reports を直接 SELECT しており、
--   「匿名向け近似プレビュー」自体は意図された機能として実在する。
-- - よって単純に anon アクセスを閉じるのではなく、匿名向けには座標を粗い
--   グリッドへ丸めた公開VIEWのみ許可し、ベーステーブルへの anon SELECT は
--   完全に閉じる方針(チケット方針 a)を採用する。
-- - danger_spots は grep 上どのフロントエンドからも anon 向けに参照されて
--   いないため、VIEW化はせず単純に TO authenticated へ制限する。
-- - local_safety_alerts は prefecture/city の粗い文字列のみで緯度経度を
--   一切含まないため、ランディングページの「今日の地域アラート」向けに
--   anon SELECT を維持する(意図されたスコープ内であり変更不要)。
--
-- 重要な注意 (画像ストレージについて):
-- storage.buckets.public = true のバケットは、GET /object/public/{bucket}/{path}
-- エンドポイントで storage.objects の RLS を一切評価せず配信する
-- (Supabase Storage の仕様)。そのため本マイグレーションで storage.objects の
-- SELECT ポリシーを TO authenticated に変更するだけでは、bucket public フラグが
-- true のままだと直リンクでの閲覧を実際には防げない。
-- ここでは danger-reports バケットの public フラグも false に変更するが、
-- アプリ側は現在 getPublicUrl() で生成した「常時アクセス可能なURL」を
-- image_url / processed_image_urls に保存し、20箇所以上のコンポーネントが
-- それをそのまま <img src> 等で使っている。署名URL化はそのうち一部
-- (最終報告に記載)のみ完了しており、本マイグレーションを適用すると
-- 未対応コンポーネントの画像表示が壊れる。適用前に必ず最終報告を確認すること。

-- ============================================
-- 1. danger_reports: ベーステーブルへの anon SELECT を閉じる
-- ============================================

DROP POLICY IF EXISTS "danger_reports_select" ON public.danger_reports;

CREATE POLICY "danger_reports_select" ON public.danger_reports
  FOR SELECT
  TO authenticated
  USING (
    status IN ('approved', 'resolved', 'published')
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ============================================
-- 2. danger_reports_public_preview: 匿名プレビュー用VIEW
-- ============================================
-- - あえて SECURITY INVOKER を指定しない(デフォルトの security_invoker = false
--   = 従来の SECURITY DEFINER 相当の挙動)。
--   理由: 本マイグレーションはベーステーブル danger_reports の SELECT ポリシーを
--   TO authenticated のみに変更しており、anon 向けの許可ポリシーは存在しない。
--   もし本VIEWを security_invoker = true で作成すると、VIEW経由のクエリも
--   「呼び出し側(anon)」の権限でベーステーブルへアクセスすることになり、
--   本VIEWのWHERE句に到達する前にベーステーブル側のRLSで0件になってしまう
--   (=匿名向けプレビューが常に空になる回帰バグ)。
--   security_invoker を指定しない場合、VIEWはオーナー(マイグレーション実行者、
--   実質 postgres/supabase_admin ロール)権限で評価されるためベーステーブルの
--   RLSに阻まれない。この結果、本VIEW自身の
--   `WHERE status IN ('approved','resolved','published')` だけが匿名向けの
--   唯一のフィルタとなる。したがって安全性はこの WHERE句を弱めない限り保たれる
--   (=このVIEWに新しい列やWHERE条件の緩和を加える際は要注意)。
-- - 緯度経度は roundToGrid(0.01度 ≒ 約1.1km四方)相当の丸め込みをSQL側でも実施し、
--   本人・admin であっても本VIEW経由では常に丸め座標のみを返す
--   (正確な座標が必要な本人・adminはベーステーブルを直接SELECTする)。
-- - user_id 等の投稿者特定に繋がりうるカラムは含めない。
-- - image_url / processed_image_url / processed_image_urls は含めない。
--   danger-reports storage バケットは本マイグレーションで非公開化されており、
--   匿名ユーザーはこれらのURLへ元々アクセスできない。存在しても開けない画像URLを
--   返すよりも、最初から返さない方が安全かつUX的に誠実なため。
-- - HiyariHatReport.tsx の LANDING_REPORT_SELECT_COLUMNS と同じカラム名を
--   維持し、フロントエンドは .from("danger_reports") を
--   .from("danger_reports_public_preview") に差し替えるだけで動作する
--   (画像系カラムはフロントエンド側のSELECT一覧からも除外済み)。

DROP VIEW IF EXISTS public.danger_reports_public_preview;

CREATE VIEW public.danger_reports_public_preview AS
SELECT
  id,
  title,
  description,
  danger_type,
  danger_level,
  status,
  ROUND((latitude / 0.01)::numeric) * 0.01 AS latitude,
  ROUND((longitude / 0.01)::numeric) * 0.01 AS longitude,
  prefecture,
  prefecture_code,
  city,
  municipality_code,
  town,
  postal_code,
  created_at,
  updated_at
FROM public.danger_reports
WHERE status IN ('approved', 'resolved', 'published');

GRANT SELECT ON public.danger_reports_public_preview TO anon, authenticated;

COMMENT ON VIEW public.danger_reports_public_preview IS
  '匿名(anon)向けの近似プレビュー。security_invoker を指定しないことで'
  'ベーステーブルのRLS(authenticatedのみSELECT可)を迂回してオーナー権限で評価され、'
  '本VIEW自身のWHERE句のみが匿名向けの唯一のフィルタとなる。'
  '緯度経度は約1.1km四方のグリッドへ丸めており、正確な座標はベーステーブル側にのみ存在する。'
  '画像系カラム(image_url等)はstorageバケット非公開化に伴い含めていない。';

-- ============================================
-- 3. danger_spots: anon SELECT を閉じる(フロントエンドで未使用のため単純化)
-- ============================================

DROP POLICY IF EXISTS "danger_spots_select_policy" ON public.danger_spots;

CREATE POLICY "danger_spots_select_policy" ON public.danger_spots
  FOR SELECT TO authenticated
  USING (true);

-- ============================================
-- 4. storage: danger-reports バケットの anon 閲覧を閉じる
-- ============================================

DROP POLICY IF EXISTS "danger_reports_select_public" ON storage.objects;

CREATE POLICY "danger_reports_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'danger-reports');

UPDATE storage.buckets
SET public = false
WHERE id = 'danger-reports';
