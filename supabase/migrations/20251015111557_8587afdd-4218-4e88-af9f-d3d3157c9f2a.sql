-- Create enum for process status
CREATE TYPE public.process_status AS ENUM (
  'cadastro',
  'triagem',
  'vistoria',
  'comissao',
  'aprovacao',
  'concluido',
  'exigencia'
);

-- Create enum for process step status
CREATE TYPE public.step_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'rejected'
);

-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM (
  'user',
  'admin'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cnpj TEXT,
  company_name TEXT,
  role user_role DEFAULT 'user' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create processes table
CREATE TABLE public.processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  process_number TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  address TEXT NOT NULL,
  current_status process_status DEFAULT 'cadastro' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create process_history table
CREATE TABLE public.process_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES public.processes(id) ON DELETE CASCADE NOT NULL,
  status process_status NOT NULL,
  step_status step_status NOT NULL,
  observations TEXT,
  responsible_id UUID REFERENCES public.profiles(id),
  responsible_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create process_documents table
CREATE TABLE public.process_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES public.processes(id) ON DELETE CASCADE NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  status step_status DEFAULT 'pending' NOT NULL,
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for processes
CREATE POLICY "Users can view their own processes"
  ON public.processes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own processes"
  ON public.processes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own processes"
  ON public.processes FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all processes"
  ON public.processes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all processes"
  ON public.processes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for process_history
CREATE POLICY "Users can view history of their processes"
  ON public.process_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = process_history.process_id
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all history"
  ON public.process_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can create history entries"
  ON public.process_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for process_documents
CREATE POLICY "Users can view documents of their processes"
  ON public.process_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = process_documents.process_id
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload documents to their processes"
  ON public.process_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = process_documents.process_id
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all documents"
  ON public.process_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update documents"
  ON public.process_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'user')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_processes_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.process_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();