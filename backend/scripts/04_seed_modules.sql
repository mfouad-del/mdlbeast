-- 04_seed_modules.sql
-- Seed a test barcode and a timeline entry (idempotent)

WITH user_id AS (
  SELECT id as uid FROM users WHERE username='admin@mdlbeast.com' OR username='admin@zaco.sa' LIMIT 1
), upsert AS (
  INSERT INTO barcodes (barcode, type, status, priority, subject, attachments, user_id)
  VALUES ('TEST123456','incoming','وارد','عادي','Seeded test barcode','[]'::jsonb, (SELECT uid FROM user_id))
  ON CONFLICT (barcode) DO UPDATE SET subject = EXCLUDED.subject
  RETURNING id
)
INSERT INTO barcode_timeline (barcode_id, actor_id, action, meta)
SELECT b.id, u.uid, 'seeded', jsonb_build_object('note','seeded test barcode')
FROM (SELECT id FROM barcodes WHERE barcode='TEST123456' LIMIT 1) b, user_id u
WHERE NOT EXISTS (SELECT 1 FROM barcode_timeline t WHERE t.barcode_id = b.id AND t.action = 'seeded');

