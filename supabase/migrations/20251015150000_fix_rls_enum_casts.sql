-- Recreate user resubmit policy with explicit enum casts
DROP POLICY IF EXISTS "Users can resubmit rejected documents" ON public.process_documents;

CREATE POLICY "Users can resubmit rejected documents"
  ON public.process_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.processes p
      WHERE p.id = process_documents.process_id
      AND p.user_id = auth.uid()
    )
    AND process_documents.status = 'rejected'::step_status
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes p
      WHERE p.id = process_documents.process_id
      AND p.user_id = auth.uid()
    )
    AND process_documents.status = 'pending'::step_status
  );