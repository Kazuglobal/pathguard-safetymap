-- 不審者アラート: danger_reports.danger_type の許可値に 'suspicious' を追加する。
--
-- 既存の CHECK 制約 danger_reports_danger_type_check はダッシュボードで作成され repo 未管理だった。
-- 'suspicious' 投稿がこの制約に弾かれて 23514 になるため、ここで明示的に再定義して管理下に置く。
-- 既存データの danger_type は投稿フォームの選択肢（traffic/crime/disaster/other）のみのため、
-- これらに 'suspicious' を加えた集合で再作成しても既存行は制約違反にならない。

alter table danger_reports
  drop constraint if exists danger_reports_danger_type_check;

alter table danger_reports
  add constraint danger_reports_danger_type_check
  check (danger_type in ('traffic', 'crime', 'disaster', 'other', 'suspicious'));
