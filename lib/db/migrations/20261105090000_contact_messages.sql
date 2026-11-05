-- お問い合わせ・サービス改善要望(/contact)。後方互換の追加だけ(新しい表と索引のみ)。
-- 送られた内容は先にこの表へ保存し、そのあとメールで運営者へ転送する(転送に失敗しても取りこぼさない)。
CREATE TABLE contact_messages (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('inquiry','improvement')),
 message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),
 reply_email TEXT,
 delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','sent','failed','skipped')),
 delivery_error TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_contact_messages_created ON contact_messages(created_at);
CREATE INDEX idx_contact_messages_delivery ON contact_messages(delivery_status, created_at);
