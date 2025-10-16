-- Add new step_status enum value for resubmission tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'step_status' AND e.enumlabel = 'resubmitted'
  ) THEN
    ALTER TYPE public.step_status ADD VALUE 'resubmitted';
  END IF;
END$$;

-- Optional: update comments or documentation if any