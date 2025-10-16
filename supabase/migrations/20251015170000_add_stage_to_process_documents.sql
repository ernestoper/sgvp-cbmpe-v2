-- Add stage column to process_documents to support stage-gated approvals
-- This column records the process stage at the time of document upload

begin;

alter table public.process_documents
  add column if not exists stage text;

-- Backfill existing documents to initial stage 'cadastro' to avoid null behavior
update public.process_documents
  set stage = coalesce(stage, 'cadastro');

commit;