-- 07_create_sequences.sql
-- Sequences for document barcode numbering

CREATE SEQUENCE IF NOT EXISTS doc_in_seq START 1;
CREATE SEQUENCE IF NOT EXISTS doc_out_seq START 1;
