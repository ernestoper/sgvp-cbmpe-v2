-- Create notifications table to log automatic messages (WhatsApp and Email)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stage text not null,
  status text not null check (status in ('approved','rejected')),
  message text not null,
  whatsapp_status text,
  email_status text,
  error text,
  created_at timestamp with time zone default now()
);

comment on table public.notifications is 'Logs de notificações automáticas enviadas ao usuário';
comment on column public.notifications.stage is 'Etapa do processo referente à notificação';
comment on column public.notifications.status is 'Tipo do evento: approved ou rejected';
comment on column public.notifications.message is 'Mensagem enviada (texto base)';

-- Indexes for querying by process and user
create index if not exists notifications_process_id_idx on public.notifications(process_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);

-- Basic RLS: allow authenticated insert/select their own; admins unrestricted via has_role
alter table public.notifications enable row level security;

create policy notifications_select_own
  on public.notifications for select
  using (auth.uid() = user_id or has_role('admin', auth.uid()));

create policy notifications_insert_admin_or_owner
  on public.notifications for insert
  with check (auth.uid() = user_id or has_role('admin', auth.uid()));

create policy notifications_delete_admin
  on public.notifications for delete
  using (has_role('admin', auth.uid()));