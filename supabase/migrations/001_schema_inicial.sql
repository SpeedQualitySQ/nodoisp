-- Fase 1: estructura base — clientes, contratos, planes, geografía e inventario documental.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Geografía (Ecuador). Estructura aquí; los datos se cargan en 002_seed_ecuador.sql
-- para que las FKs de clients/installation_addresses existan desde el arranque.
-- ---------------------------------------------------------------------------
create table provinces (
  id   smallserial primary key,
  name text not null unique
);

create table cantons (
  id          serial primary key,
  province_id smallint not null references provinces (id) on delete cascade,
  name        text not null,
  unique (province_id, name)
);

-- ---------------------------------------------------------------------------
-- Zonas comerciales/geográficas. Placeholder liviano: se profundiza cuando se
-- construya el mapa de infraestructura (OLT/NAP) en una fase posterior.
-- ---------------------------------------------------------------------------
create table zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Perfiles de usuario interno (técnicos, atención, etc). Se crea un perfil
-- automáticamente cuando se registra un usuario en Supabase Auth.
-- ---------------------------------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text,
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
create table clients (
  id             uuid primary key default gen_random_uuid(),
  first_name     text not null,
  last_name      text not null,
  identification text not null unique,
  email          text,
  mobile         text,
  phone          text,
  status         text not null default 'prospect'
                 check (status in ('prospect', 'pending', 'active', 'suspended', 'cut', 'retired')),
  province_id    smallint references provinces (id),
  canton_id      int references cantons (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index clients_status_idx on clients (status);
create index clients_name_idx on clients (last_name, first_name);

create table installation_addresses (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients (id) on delete cascade,
  address_line text not null default '',
  reference    text,
  lat          double precision,
  lng          double precision,
  province_id  smallint references provinces (id),
  canton_id    int references cantons (id),
  zone_id      uuid references zones (id),
  is_primary   boolean not null default true,
  created_at   timestamptz not null default now()
);

create index installation_addresses_client_idx on installation_addresses (client_id);

-- Un solo domicilio primario por cliente.
create unique index installation_addresses_one_primary
  on installation_addresses (client_id)
  where is_primary;

create table client_status_history (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now(),
  note       text
);

create index client_status_history_client_idx on client_status_history (client_id, changed_at desc);

create table client_documents (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients (id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  doc_type    text,
  uploaded_by uuid references auth.users (id),
  uploaded_at timestamptz not null default now()
);

create index client_documents_client_idx on client_documents (client_id);

-- ---------------------------------------------------------------------------
-- Planes de servicio
-- ---------------------------------------------------------------------------
create table plans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  download_speed numeric not null check (download_speed > 0),
  upload_speed   numeric not null check (upload_speed > 0),
  price          numeric not null check (price >= 0),
  technology     text not null default 'fiber' check (technology in ('fiber', 'radio', 'cable')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contratos de servicio
-- ---------------------------------------------------------------------------
create table service_contracts (
  id                 uuid primary key default gen_random_uuid(),
  contract_number    text unique,
  client_id          uuid not null references clients (id) on delete restrict,
  plan_id            uuid not null references plans (id) on delete restrict,
  monthly_fee        numeric not null check (monthly_fee >= 0),
  billing_day        smallint not null default 1 check (billing_day between 1 and 28),
  installation_date  date,
  start_date         date,
  status             text not null default 'pending'
                      check (status in ('pending', 'active', 'suspended', 'cut', 'terminated')),
  technician_id      uuid references profiles (id),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index service_contracts_client_idx on service_contracts (client_id);
create index service_contracts_status_idx on service_contracts (status);
create index service_contracts_technician_idx on service_contracts (technician_id);

-- Numeración automática de contrato: C-<año>-<consecutivo>.
create sequence contract_number_seq;

create function set_contract_number()
returns trigger
language plpgsql
as $$
begin
  if new.contract_number is null then
    new.contract_number :=
      'C-' || extract(year from now())::text || '-' ||
      lpad(nextval('contract_number_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger service_contracts_set_number
  before insert on service_contracts
  for each row execute function set_contract_number();

-- updated_at automático
create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

create trigger service_contracts_set_updated_at
  before update on service_contracts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage: documentos de cliente
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS — Fase 1 usa una política simple (cualquier usuario autenticado tiene
-- acceso completo). El control de roles granular llega en la fase de Auth/RBAC.
-- ---------------------------------------------------------------------------
alter table provinces enable row level security;
alter table cantons enable row level security;
alter table zones enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table installation_addresses enable row level security;
alter table client_status_history enable row level security;
alter table client_documents enable row level security;
alter table plans enable row level security;
alter table service_contracts enable row level security;

create policy "provinces_auth" on provinces for all to authenticated using (true) with check (true);
create policy "cantons_auth" on cantons for all to authenticated using (true) with check (true);
create policy "zones_auth" on zones for all to authenticated using (true) with check (true);
create policy "profiles_auth" on profiles for all to authenticated using (true) with check (true);
create policy "clients_auth" on clients for all to authenticated using (true) with check (true);
create policy "installation_addresses_auth" on installation_addresses for all to authenticated using (true) with check (true);
create policy "client_status_history_auth" on client_status_history for all to authenticated using (true) with check (true);
create policy "client_documents_auth" on client_documents for all to authenticated using (true) with check (true);
create policy "plans_auth" on plans for all to authenticated using (true) with check (true);
create policy "service_contracts_auth" on service_contracts for all to authenticated using (true) with check (true);

create policy "client_documents_storage_auth" on storage.objects for all to authenticated
  using (bucket_id = 'client-documents')
  with check (bucket_id = 'client-documents');

-- ---------------------------------------------------------------------------
-- Privilegios de tabla. RLS decide QUÉ FILAS se ven, pero Postgres exige por
-- separado el permiso de tabla/secuencia; sin este GRANT explícito, anon y
-- authenticated reciben "permission denied" incluso con una política que
-- dice USING (true). anon no recibe privilegios aquí a propósito: sin ellos,
-- cualquier tabla de negocio queda bloqueada para usuarios sin sesión.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
