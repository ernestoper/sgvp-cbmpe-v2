-- Revoke user UPDATE/DELETE on storage objects in 'process-documents' bucket
DO $$
BEGIN
  -- Drop user UPDATE policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND polname = 'Users can update their process documents'
  ) THEN
    DROP POLICY "Users can update their process documents" ON storage.objects;
  END IF;

  -- Drop user DELETE policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND polname = 'Users can delete their process documents'
  ) THEN
    DROP POLICY "Users can delete their process documents" ON storage.objects;
  END IF;
END$$;

-- Keep INSERT (upload) and SELECT policies as-is; admins retain full management via existing policies