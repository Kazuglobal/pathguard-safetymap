-- push_subscriptions に通知の地域出し分け用の都道府県カラムを追加
--
-- 朝のダイジェスト通知（/api/cron/daily-news-digest）が購読者を
-- 都道府県ごとにグループ化し、「全国X件・{都道府県}でY件」の文面を
-- 出し分けるために使用する。null は全国文面。
-- 値は47都道府県の正式名称のみ（アプリ側 lib/user-region.ts で正規化してから保存する）。

alter table public.push_subscriptions
  add column if not exists prefecture text;

comment on column public.push_subscriptions.prefecture is
  '朝のダイジェスト通知の地域出し分け用。47都道府県の正式名称。null は全国文面';
