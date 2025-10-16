-- Trigger types regeneration by adding a helpful comment
-- This migration ensures all database types are properly synced

-- Add comment to existing function to trigger regeneration
COMMENT ON FUNCTION public.has_role IS 'Checks if a user has a specific role - used for RLS policies';

-- Verify all tables exist with proper structure
COMMENT ON TABLE public.processes IS 'Main processes table - stores vistoria process data';
COMMENT ON TABLE public.process_history IS 'Process history tracking - stores timeline of status changes';
COMMENT ON TABLE public.process_documents IS 'Process documents - stores uploaded files and approval status';
COMMENT ON TABLE public.profiles IS 'User profiles - stores additional user information';
COMMENT ON TABLE public.user_roles IS 'User roles - stores role assignments for authorization';