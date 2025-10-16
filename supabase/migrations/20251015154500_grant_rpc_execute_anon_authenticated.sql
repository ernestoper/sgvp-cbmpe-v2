-- Grant EXECUTE to both anon and authenticated roles to avoid 404 when JWT is missing
-- Functions themselves check auth.uid() so calls without a logged-in user will fail safely

GRANT EXECUTE ON FUNCTION public.resubmit_rejected_document(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resubmit_rejected_document(uuid, text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.resubmit_document(uuid, uuid, text, text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.resubmit_document(uuid, uuid, text, text, timestamptz) TO authenticated;