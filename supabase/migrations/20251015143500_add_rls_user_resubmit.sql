-- Allow users to resubmit rejected documents by updating their own rows
CREATE POLICY "Users can resubmit rejected documents"
  ON public.process_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.processes p
      WHERE p.id = process_documents.process_id
      AND p.user_id = auth.uid()
    )
    AND process_documents.status = 'rejected'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes p
      WHERE p.id = process_documents.process_id
      AND p.user_id = auth.uid()
    )
    AND process_documents.status = 'pending'
  );

-- Allow users to create history entries for their own processes (e.g., resubmission justification)
CREATE POLICY "Users can create history entries for own processes"
  ON public.process_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes p
      WHERE p.id = process_history.process_id
      AND p.user_id = auth.uid()
    )
  );