-- Ensure RPC can be called by authenticated users
GRANT EXECUTE ON FUNCTION public.resubmit_rejected_document(uuid, text, text) TO authenticated;