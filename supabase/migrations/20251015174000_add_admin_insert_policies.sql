-- Grant admin INSERT permissions on documents and versions, plus SELECT/UPDATE on versions
BEGIN;

-- Admins can insert documents into process_documents
CREATE POLICY IF NOT EXISTS "Admins can insert documents"
  ON public.process_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can view all versions
CREATE POLICY IF NOT EXISTS "Admins can view all versions"
  ON public.process_document_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert versions
CREATE POLICY IF NOT EXISTS "Admins can insert versions"
  ON public.process_document_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update versions
CREATE POLICY IF NOT EXISTS "Admins can update versions"
  ON public.process_document_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

COMMIT;