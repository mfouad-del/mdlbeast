-- Create a unified numeric sequence for new barcodes (doc_seq)
CREATE SEQUENCE IF NOT EXISTS doc_seq START 1;

-- Note: existing doc_in_seq/doc_out_seq remain and are not modified to preserve history.
-- New documents will use doc_seq and produce numeric-only barcodes like 0000001, 0000002, ...
