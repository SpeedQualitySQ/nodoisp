-- Fase 5: gestión de MikroTik — dispositivos (RouterOS API), IP pools
-- PPPoE, reglas de Firewall, bloqueos de clientes (Address-List/PPPoE) y
-- pools IPv6.
-- Igual que la OLT en Fase 3: la conexión real a la API de RouterOS se
-- simula en el frontend (ver src/lib/mikrotik.ts); esta migración solo
-- modela el dato. Los bloqueos guardan la IP/usuario PPPoE directamente en
-- el propio registro (no se referencia el contrato del cliente): ese campo
-- todavía no existe en service_contracts, y añadirlo sin una pantalla que
-- lo edite dejaría columnas muertas en el esquema.
-- ---------------------------------------------------------------------------
-- Dispositivos MikroTik
-- ---------------------------------------------------------------------------
create table mikrotik_devices (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  host              text not null,
  api_port          int not null default 8728,
  api_ssl           boolean not null default false,
  api_user          text not null,
  -- Igual que olt_devices.ssh_password (006): texto plano, mismo gap de
  -- seguridad ya aceptado en el repo; se endurece junto con RBAC.
  api_password      text not null,
  model             text not null default 'RB4011iGS+',
  status            text not null default 'offline' check (status in ('online', 'offline', 'unreachable')),
  firmware_version  text,
  last_checked_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger mikrotik_devices_set_updated_at
  before update on mikrotik_devices
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- IP Address pools (PPPoE)
-- ---------------------------------------------------------------------------
create table mikrotik_ip_pools (
  id                uuid primary key default gen_random_uuid(),
  mikrotik_id       uuid not null references mikrotik_devices (id) on delete cascade,
  name              text not null,
  ranges            text not null,
  ppp_profile_name  text,
  local_address     text,
  dns_primary       text not null default '8.8.8.8',
  dns_secondary     text default '8.8.4.4',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (mikrotik_id, name)
);

create index mikrotik_ip_pools_mikrotik_idx on mikrotik_ip_pools (mikrotik_id);

create trigger mikrotik_ip_pools_set_updated_at
  before update on mikrotik_ip_pools
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Reglas de Firewall (filter y nat)
-- ---------------------------------------------------------------------------
create table mikrotik_firewall_rules (
  id                uuid primary key default gen_random_uuid(),
  mikrotik_id       uuid not null references mikrotik_devices (id) on delete cascade,
  table_name        text not null default 'filter' check (table_name in ('filter', 'nat')),
  chain             text not null,
  action            text not null check (action in ('accept', 'drop', 'reject', 'masquerade', 'log')),
  src_address       text,
  dst_address       text,
  protocol          text,
  dst_port          text,
  src_address_list  text,
  out_interface     text,
  comment           text,
  position          int not null default 0,
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index mikrotik_firewall_rules_mikrotik_idx on mikrotik_firewall_rules (mikrotik_id, position);

create trigger mikrotik_firewall_rules_set_updated_at
  before update on mikrotik_firewall_rules
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Bloqueos de clientes — Address-List (IP) y/o PPPoE (usuario)
-- ---------------------------------------------------------------------------
create table mikrotik_client_blocks (
  id              uuid primary key default gen_random_uuid(),
  mikrotik_id     uuid not null references mikrotik_devices (id) on delete cascade,
  client_id       uuid not null references clients (id) on delete cascade,
  ip_address      text,
  pppoe_username  text,
  reason          text,
  status          text not null default 'active' check (status in ('active', 'blocked')),
  blocked_at      timestamptz,
  unblocked_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (mikrotik_id, client_id)
);

create index mikrotik_client_blocks_mikrotik_idx on mikrotik_client_blocks (mikrotik_id);
create index mikrotik_client_blocks_client_idx on mikrotik_client_blocks (client_id);

create trigger mikrotik_client_blocks_set_updated_at
  before update on mikrotik_client_blocks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Pools IPv6
-- ---------------------------------------------------------------------------
create table mikrotik_ipv6_pools (
  id              uuid primary key default gen_random_uuid(),
  mikrotik_id     uuid not null references mikrotik_devices (id) on delete cascade,
  name            text not null,
  prefix          text not null,
  prefix_length   int not null default 56 check (prefix_length between 1 and 128),
  interface_name  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (mikrotik_id, name)
);

create index mikrotik_ipv6_pools_mikrotik_idx on mikrotik_ipv6_pools (mikrotik_id);

create trigger mikrotik_ipv6_pools_set_updated_at
  before update on mikrotik_ipv6_pools
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — misma política simple de fases anteriores (cualquier usuario
-- autenticado tiene acceso completo); se endurece junto con RBAC.
-- ---------------------------------------------------------------------------
alter table mikrotik_devices enable row level security;
alter table mikrotik_ip_pools enable row level security;
alter table mikrotik_firewall_rules enable row level security;
alter table mikrotik_client_blocks enable row level security;
alter table mikrotik_ipv6_pools enable row level security;

create policy "mikrotik_devices_auth" on mikrotik_devices for all to authenticated using (true) with check (true);
create policy "mikrotik_ip_pools_auth" on mikrotik_ip_pools for all to authenticated using (true) with check (true);
create policy "mikrotik_firewall_rules_auth" on mikrotik_firewall_rules for all to authenticated using (true) with check (true);
create policy "mikrotik_client_blocks_auth" on mikrotik_client_blocks for all to authenticated using (true) with check (true);
create policy "mikrotik_ipv6_pools_auth" on mikrotik_ipv6_pools for all to authenticated using (true) with check (true);

grant select, insert, update, delete on
  mikrotik_devices, mikrotik_ip_pools, mikrotik_firewall_rules, mikrotik_client_blocks, mikrotik_ipv6_pools
  to authenticated, service_role;
