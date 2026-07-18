BEGIN;

SELECT plan(4);

INSERT INTO public.profiles (id, email, role)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'moderation-owner@example.test', 'user'),
  ('10000000-0000-0000-0000-000000000002', 'moderation-admin@example.test', 'admin');

INSERT INTO public.danger_reports (
  id,
  user_id,
  title,
  description,
  latitude,
  longitude,
  danger_type,
  danger_level,
  status,
  ai_moderation_status
)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '見通しの悪い交差点',
  '左右が見えません',
  35.68,
  139.76,
  'traffic',
  3,
  'pending',
  'pending'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$UPDATE public.danger_reports
    SET ai_moderation_status = 'approved'
    WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  '42501',
  'AI moderation fields are server-managed',
  'owner cannot approve their own pending report'
);

SELECT throws_ok(
  $$UPDATE public.danger_reports
    SET ai_moderation_status = NULL
    WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  '42501',
  'AI moderation fields are server-managed',
  'owner cannot reset moderation for repeated AI attempts'
);

SELECT lives_ok(
  $$UPDATE public.danger_reports
    SET description = '本文の通常編集'
    WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  'owner can still edit ordinary fields while pending'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

SELECT lives_ok(
  $$UPDATE public.danger_reports
    SET ai_moderation_status = 'needs_review'
    WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  'admin can update server-managed moderation fields'
);

SELECT * FROM finish();

ROLLBACK;
