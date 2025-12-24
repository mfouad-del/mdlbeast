-- Change documents.date from DATE to TIMESTAMP preserving date info
BEGIN;
ALTER TABLE IF EXISTS documents ALTER COLUMN date TYPE TIMESTAMP USING (date::timestamp);
COMMIT;