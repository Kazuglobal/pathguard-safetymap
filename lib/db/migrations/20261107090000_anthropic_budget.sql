-- 写真の解析(きけんハンター・危険さがしゲーム)で Claude を使い始めたので、管理画面の予算に anthropic の行を足す。
-- 後方互換の追加だけ(既にあれば何もしない)。予算の行は管理者が作れない(insert は service だけ)ため、ここで用意する。
INSERT INTO `api_budget_settings`
  (`id`, `api_provider`, `monthly_budget_usd`, `alert_threshold_percent`)
VALUES
  ('budget-anthropic', 'anthropic', 100, 80)
ON CONFLICT (`api_provider`) DO NOTHING;
