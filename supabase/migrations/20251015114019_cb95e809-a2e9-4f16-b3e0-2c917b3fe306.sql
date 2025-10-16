-- Create storage bucket for process documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'process-documents',
  'process-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/vnd.dwg', 'image/vnd.dwg']
);

-- RLS Policies for storage bucket
-- Users can view documents from their own processes
CREATE POLICY "Users can view their process documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'process-documents' 
  AND EXISTS (
    SELECT 1 FROM public.processes p
    INNER JOIN public.process_documents pd ON pd.process_id = p.id
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- Users can upload documents to their own processes
CREATE POLICY "Users can upload to their processes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'process-documents'
  AND EXISTS (
    SELECT 1 FROM public.processes p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- Users can update/delete their process documents
CREATE POLICY "Users can update their process documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'process-documents'
  AND EXISTS (
    SELECT 1 FROM public.processes p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Users can delete their process documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'process-documents'
  AND EXISTS (
    SELECT 1 FROM public.processes p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- Admins can view all documents
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'process-documents'
  AND public.has_role(auth.uid(), 'admin')
);

-- Admins can manage all documents
CREATE POLICY "Admins can manage all documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'process-documents'
  AND public.has_role(auth.uid(), 'admin')
);