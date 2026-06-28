-- 不審者アラート 地図化機能
-- danger_reports に「危険エリア円」の半径と AI一次審査の結果カラムを追加する。
-- danger_type='suspicious' は自由文字列のため型追加は不要（DB制約・既存通知・RLSに影響なし）。

-- 1) 半径（メートル）。クライアント既定は 300m。不正値・巨大値を防ぐため許可値を限定する。
alter table danger_reports
  add column if not exists alert_radius_m integer;

-- 2) AI一次審査の結果。
--    ai_moderation_status: pending | approved | needs_review | rejected
alter table danger_reports
  add column if not exists ai_moderation_status text;

alter table danger_reports
  add column if not exists ai_moderation_reason text;

alter table danger_reports
  add column if not exists ai_moderation_checked_at timestamptz;

alter table danger_reports
  add column if not exists ai_moderation_score numeric;

-- 半径の許可値を限定（null は未指定＝クライアント既定 300m を使う）。
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'danger_reports_alert_radius_m_check'
  ) then
    alter table danger_reports
      add constraint danger_reports_alert_radius_m_check
      check (alert_radius_m is null or alert_radius_m in (200, 300, 500, 1000));
  end if;
end $$;

comment on column danger_reports.alert_radius_m is '不審者アラートの危険エリア円の半径（メートル）。null は未指定＝クライアント既定300m。';
comment on column danger_reports.ai_moderation_status is 'AI一次審査の状態: pending | approved | needs_review | rejected';
comment on column danger_reports.ai_moderation_reason is 'AI一次審査の判定理由（管理者確認用）';
comment on column danger_reports.ai_moderation_checked_at is 'AI一次審査を実行した日時';
comment on column danger_reports.ai_moderation_score is 'AI一次審査のリスクスコア（0〜1など、実装依存）';
