-- Add contact fields to processes for mandatory form inputs
BEGIN;

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS contact_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.processes.contact_name IS 'Nome completo do solicitante do processo';
COMMENT ON COLUMN public.processes.contact_phone IS 'Telefone de contato do solicitante';
COMMENT ON COLUMN public.processes.contact_email IS 'Email de contato do solicitante';

COMMIT;