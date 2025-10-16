-- Safe RPC to resubmit a rejected document
-- Allows users to update their own document from 'rejected' to 'pending'
-- while setting new file_url, justification and resubmitted_at.

CREATE OR REPLACE FUNCTION public.resubmit_document(
  _doc_id uuid,
  _process_id uuid,
  _file_url text,
  _justification text,
  _resubmitted_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure caller owns the process
  IF NOT EXISTS (
    SELECT 1 FROM public.processes p
    WHERE p.id = _process_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- Update only if current status is rejected
  UPDATE public.process_documents
  SET file_url = _file_url,
      status = 'pending'::step_status,
      rejection_reason = NULL,
      correction_justification = _justification,
      resubmitted_at = COALESCE(_resubmitted_at, now()),
      updated_at = now()
  WHERE id = _doc_id
    AND process_id = _process_id
    AND status = 'rejected'::step_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'document not found or not rejected';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resubmit_document(uuid, uuid, text, text, timestamptz) TO authenticated;