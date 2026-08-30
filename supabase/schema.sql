-- Julius — schema do Supabase
-- Rode este arquivo inteiro em: Supabase > SQL Editor > New query

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  household_id uuid references households (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text not null default '#a8452c',
  monthly_budget numeric(12, 2),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- Caso a tabela já exista de uma versão anterior do schema, garante as colunas novas
alter table categories add column if not exists monthly_budget numeric(12, 2);
alter table categories add column if not exists pinned boolean not null default false;

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  type text not null check (type in ('income', 'expense')),
  date date not null default current_date,
  payment_method text check (payment_method in ('debito', 'credito', 'pix', 'dinheiro')),
  created_at timestamptz not null default now()
);

alter table transactions add column if not exists payment_method text
  check (payment_method in ('debito', 'credito', 'pix', 'dinheiro'));

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  current_amount numeric(12, 2) not null default 0,
  deadline date,
  created_at timestamptz not null default now()
);

-- Compras parceladas: lançada uma vez, aparece automaticamente nos meses
-- seguintes (calculado no app, sem precisar duplicar linhas no banco).
create table if not exists installments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  description text not null,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  installments_count int not null check (installments_count >= 1),
  first_date date not null,
  payment_method text check (payment_method in ('debito', 'credito', 'pix', 'dinheiro')),
  created_at timestamptz not null default now()
);

alter table installments add column if not exists payment_method text
  check (payment_method in ('debito', 'credito', 'pix', 'dinheiro'));

-- Despesas (ou receitas) fixas recorrentes: lançada uma vez, repete todo mês
-- indefinidamente (até ser desativada), calculado no app igual às parcelas.
create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null default 'expense' check (type in ('income', 'expense')),
  day_of_month int not null check (day_of_month between 1 and 31),
  start_date date not null default current_date,
  active boolean not null default true,
  payment_method text check (payment_method in ('debito', 'credito', 'pix', 'dinheiro')),
  created_at timestamptz not null default now()
);

alter table recurring_expenses add column if not exists payment_method text
  check (payment_method in ('debito', 'credito', 'pix', 'dinheiro'));

create index if not exists idx_transactions_household on transactions (household_id, date);
create index if not exists idx_categories_household on categories (household_id);
create index if not exists idx_goals_household on goals (household_id);

-- ---------------------------------------------------------------------
-- Cria automaticamente um "profile" para cada novo usuário
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- Funções para criar/entrar em um lar (household) via código de convite
-- Rodam com privilégio elevado (security definer) para poder gerar o
-- código e vincular o perfil, mas só afetam o próprio usuário logado.
-- ---------------------------------------------------------------------

create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_id uuid;
  new_code text;
begin
  new_code := upper(substr(md5(random()::text), 1, 6));
  insert into households (name, invite_code) values (household_name, new_code) returning id into new_id;
  update profiles set household_id = new_id where id = auth.uid();
  return new_id;
end;
$$;

create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id from households where invite_code = upper(code);
  if target_id is null then
    raise exception 'invite code not found';
  end if;
  update profiles set household_id = target_id where id = auth.uid();
  return target_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security: cada lar só enxerga os próprios dados
-- ---------------------------------------------------------------------

alter table households enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table goals enable row level security;
alter table installments enable row level security;
alter table recurring_expenses enable row level security;

-- Função auxiliar: busca o household_id do usuário logado.
-- É "security definer" para NÃO disparar as políticas de RLS de profiles de
-- novo enquanto executa — se as políticas abaixo consultassem a tabela
-- profiles diretamente, isso causaria recursão infinita (erro 500).
create or replace function public.get_my_household_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select household_id from profiles where id = auth.uid();
$$;

-- profiles: cada um vê/edita o próprio perfil, e vê os perfis do mesmo lar
drop policy if exists "profiles: select self or household" on profiles;
drop policy if exists "profiles: update self" on profiles;
drop policy if exists "households: select own" on households;
drop policy if exists "categories: household access" on categories;
drop policy if exists "transactions: household access" on transactions;
drop policy if exists "goals: household access" on goals;

create policy "profiles: select self or household" on profiles
  for select using (
    id = auth.uid()
    or household_id = public.get_my_household_id()
  );

create policy "profiles: update self" on profiles
  for update using (id = auth.uid());

-- households: só vê o próprio lar (inserção acontece via create_household)
create policy "households: select own" on households
  for select using (
    id = public.get_my_household_id()
  );

-- categories / transactions / goals: acesso restrito ao lar do usuário
create policy "categories: household access" on categories
  for all using (
    household_id = public.get_my_household_id()
  ) with check (
    household_id = public.get_my_household_id()
  );

create policy "transactions: household access" on transactions
  for all using (
    household_id = public.get_my_household_id()
  ) with check (
    household_id = public.get_my_household_id()
  );

create policy "goals: household access" on goals
  for all using (
    household_id = public.get_my_household_id()
  ) with check (
    household_id = public.get_my_household_id()
  );

drop policy if exists "installments: household access" on installments;
create policy "installments: household access" on installments
  for all using (
    household_id = public.get_my_household_id()
  ) with check (
    household_id = public.get_my_household_id()
  );

drop policy if exists "recurring_expenses: household access" on recurring_expenses;
create policy "recurring_expenses: household access" on recurring_expenses
  for all using (
    household_id = public.get_my_household_id()
  ) with check (
    household_id = public.get_my_household_id()
  );
