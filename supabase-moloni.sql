-- Executar UMA vez no Supabase (SQL Editor) para ativar os módulos ao estilo Moloni:
-- documentos (faturas, guias, recibos, notas de crédito, compras, inventário) e fornecedores.
-- Usa a mesma regra de acesso das outras tabelas: só contas autorizadas (função is_member).

create table if not exists public.documentos (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.fornecedores (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists documentos_updated_at_idx on public.documentos (updated_at);
create index if not exists fornecedores_updated_at_idx on public.fornecedores (updated_at);

-- atualiza updated_at em cada gravação (a app usa-o para sincronizar entre aparelhos)
create or replace function public.mc_touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists documentos_touch on public.documentos;
create trigger documentos_touch before insert or update on public.documentos
  for each row execute function public.mc_touch_updated_at();
drop trigger if exists fornecedores_touch on public.fornecedores;
create trigger fornecedores_touch before insert or update on public.fornecedores
  for each row execute function public.mc_touch_updated_at();

-- segurança: só membros autorizados leem e gravam
alter table public.documentos enable row level security;
alter table public.fornecedores enable row level security;
drop policy if exists documentos_membros on public.documentos;
create policy documentos_membros on public.documentos for all to authenticated
  using (public.is_member()) with check (public.is_member());
drop policy if exists fornecedores_membros on public.fornecedores;
create policy fornecedores_membros on public.fornecedores for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- alterações em tempo real entre aparelhos
do $$ begin
  begin alter publication supabase_realtime add table public.documentos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.fornecedores; exception when duplicate_object then null; end;
end $$;
