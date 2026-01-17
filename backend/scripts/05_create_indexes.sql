-- 05_create_indexes.sql
-- Add useful indexes for barcode and timeline queries

CREATE INDEX IF NOT EXISTS idx_barcodes_barcode ON barcodes (lower(barcode));
CREATE INDEX IF NOT EXISTS idx_barcodes_created_at ON barcodes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_barcode_timeline_barcode_id_created_at ON barcode_timeline (barcode_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots (created_at DESC);

-- Vacuum analyze to refresh planner stats
ANALYZE barcodes;
ANALYZE barcode_timeline;
ANALYZE snapshots;

