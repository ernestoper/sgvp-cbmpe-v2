-- Phase 1: Fix RLS Infinite Recursion
-- Create user_roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Drop problematic profiles policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new safe policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Update processes policies
DROP POLICY IF EXISTS "Admins can view all processes" ON public.processes;
DROP POLICY IF EXISTS "Admins can update all processes" ON public.processes;

CREATE POLICY "Admins can view all processes"
  ON public.processes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all processes"
  ON public.processes FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update process_history policies
DROP POLICY IF EXISTS "Admins can view all history" ON public.process_history;
DROP POLICY IF EXISTS "Admins can create history entries" ON public.process_history;

CREATE POLICY "Admins can view all history"
  ON public.process_history FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create history entries"
  ON public.process_history FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update process_documents policies
DROP POLICY IF EXISTS "Admins can view all documents" ON public.process_documents;
DROP POLICY IF EXISTS "Admins can update documents" ON public.process_documents;

CREATE POLICY "Admins can view all documents"
  ON public.process_documents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update documents"
  ON public.process_documents FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Remove role column from profiles table (roles now stored in user_roles)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Update handle_new_user function to use user_roles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get role from metadata, default to 'user'
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'user');
  
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, cnpj, company_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.raw_user_meta_data->>'cnpj',
    NEW.raw_user_meta_data->>'company_name'
  );
  
  -- Insert role into separate table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$$;