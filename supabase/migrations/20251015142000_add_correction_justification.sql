-- Add correction justification and resubmission timestamp to process_documents
ALTER TABLE public.process_documents
  ADD COLUMN IF NOT EXISTS correction_justification text;

ALTER TABLE public.process_documents
  ADD COLUMN IF NOT EXISTS resubmitted_at timestamptz;

-- No RLS changes here; UI will surface justification to admins.