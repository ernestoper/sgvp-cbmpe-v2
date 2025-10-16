-- Create table to keep all versions of a document
CREATE TABLE IF NOT EXISTS public.process_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.process_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  status public.step_status DEFAULT 'pending' NOT NULL,
  rejection_reason TEXT,
  correction_justification TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  UNIQUE (document_id, version_number)
);

-- RLS
ALTER TABLE public.process_document_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of documents in their processes
CREATE POLICY "Users can view versions of their documents"
  ON public.process_document_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.process_documents d
      JOIN public.processes p ON p.id = d.process_id
      WHERE d.id = process_document_versions.document_id
        AND p.user_id = auth.uid()
    )
  );

-- Users can insert versions for their documents (resubmission)
CREATE POLICY "Users can insert versions for their documents"
  ON public.process_document_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.process_documents d
      JOIN public.processes p ON p.id = d.process_id
      WHERE d.id = process_document_versions.document_id
        AND p.user_id = auth.uid()
    )
  );

-- Admins can view all versions
CREATE POLICY "Admins can view all versions"
  ON public.process_document_versions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update versions (approve/reject latest version metadata)
CREATE POLICY "Admins can update all versions"
  ON public.process_document_versions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to set incremental version_number per document
CREATE OR REPLACE FUNCTION public.set_next_document_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM public.process_document_versions
  WHERE document_id = NEW.document_id;

  NEW.version_number := next_version;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BEFORE INSERT trigger to assign version_number
DROP TRIGGER IF EXISTS trg_set_next_document_version ON public.process_document_versions;
CREATE TRIGGER trg_set_next_document_version
  BEFORE INSERT ON public.process_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_next_document_version();

-- Create initial version automatically when a document is inserted
CREATE OR REPLACE FUNCTION public.create_initial_document_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.process_document_versions (
    document_id,
    file_url,
    status,
    uploaded_by
  ) VALUES (
    NEW.id,
    NEW.file_url,
    NEW.status,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_initial_document_version ON public.process_documents;
CREATE TRIGGER trg_create_initial_document_version
  AFTER INSERT ON public.process_documents
  FOR EACH ROW EXECUTE FUNCTION public.create_initial_document_version();