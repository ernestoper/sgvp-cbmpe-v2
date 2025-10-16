-- Add user release and stamping metadata to process_documents
-- - disponivel_usuario: when true, document is visible to the user for download
-- - carimbado_por: name/identification of the admin who applied the stamp
-- - data_carimbo: timestamp when the stamp was applied

BEGIN;

ALTER TABLE public.process_documents
  ADD COLUMN IF NOT EXISTS disponivel_usuario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carimbado_por text,
  ADD COLUMN IF NOT EXISTS data_carimbo timestamptz;

-- Backfill: mark existing final certificates as available to users
UPDATE public.process_documents
SET disponivel_usuario = true
WHERE document_type = 'certificado_final' AND status = 'completed';

COMMIT;