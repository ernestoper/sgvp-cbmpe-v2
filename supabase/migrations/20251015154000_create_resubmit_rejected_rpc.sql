-- Create RPC to resubmit a rejected document safely
-- Matches client payload: p_document_id, p_file_url, p_correction_justification

CREATE OR REPLACE FUNCTION public.resubmit_rejected_document(
  p_document_id uuid,
  p_file_url text,
  p_correction_justification text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure the document belongs to a process owned by the authenticated user
  IF NOT EXISTS (
    SELECT 1
    FROM public.process_documents pd
    JOIN public.processes p ON p.id = pd.process_id
    WHERE pd.id = p_document_id
      AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- Update only if current status is rejected
  UPDATE public.process_documents
  SET file_url = p_file_url,
      status = 'pending'::step_status,
      rejection_reason = NULL,
      correction_justification = p_correction_justification,
      resubmitted_at = now(),
      updated_at = now()
  WHERE id = p_document_id
    AND status = 'rejected'::step_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'document not found or not rejected';
  END IF;
END;
$$;

-- Ensure RPC can be called by authenticated users
GRANT EXECUTE ON FUNCTION public.resubmit_rejected_document(uuid, text, text) TO authenticated;