-- Update RPCs to also insert a new version record on resubmission

-- resubmit_rejected_document: single-parameter document-only flow
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
DECLARE
  v_updated_id uuid;
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

  -- Register a new version for traceability
  INSERT INTO public.process_document_versions (
    document_id,
    file_url,
    status,
    correction_justification,
    uploaded_by
  ) VALUES (
    p_document_id,
    p_file_url,
    'pending'::step_status,
    p_correction_justification,
    auth.uid()
  );
END;
$$;

-- resubmit_document: legacy signature including process_id and custom timestamp
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

  -- Register a new version for traceability
  INSERT INTO public.process_document_versions (
    document_id,
    file_url,
    status,
    correction_justification,
    uploaded_by
  ) VALUES (
    _doc_id,
    _file_url,
    'pending'::step_status,
    _justification,
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resubmit_rejected_document(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_document(uuid, uuid, text, text, timestamptz) TO authenticated;