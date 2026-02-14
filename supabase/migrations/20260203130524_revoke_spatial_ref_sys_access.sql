
-- ============================================
-- spatial_ref_sys テーブルへのアクセス制限
-- PostGISシステムテーブルをAPIから保護
-- ============================================

-- anon と authenticated ロールからのアクセスを取り消し
REVOKE ALL ON public.spatial_ref_sys FROM anon;
REVOKE ALL ON public.spatial_ref_sys FROM authenticated;

-- service_roleのみSELECT権限を付与（PostGISが機能するために必要）
GRANT SELECT ON public.spatial_ref_sys TO service_role;
;
