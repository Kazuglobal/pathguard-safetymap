-- UIUX改装 項目55: 氏名(profiles.full_name)は預からないので、列ごと消す。表の作り直しは無い(DROP COLUMN だけ)。
-- 本番に適用してよいのは、グループ3(PR #271。アプリのスキーマから full_name を外した)が本番にデプロイされたあと。
-- それより前のコードは profiles を読むときに full_name も選ぶので、先に消すとプロフィールが読めなくなる。
-- 適用の前に D1 の export を取る(Time Travel でも戻せる)。中身は scripts/ops/scrub-personal-names.ts で空にしてある(2026-10-30)。
ALTER TABLE `profiles` DROP COLUMN `full_name`;
