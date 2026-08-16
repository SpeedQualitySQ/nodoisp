-- Fase 4: gestión de ONUs/ONTs — catálogo de modelos, registro y activación
-- de equipos en puertos PON, señal óptica (RX) e IP pools.
-- Igual que Fase 3 con la OLT: la activación real por SSH (comandos
-- `ont add`, lectura de `display ont optical-info`) se simula en el
-- frontend (ver src/lib/olt.ts); esta migración solo modela el dato.

-- ---------------------------------------------------------------------------
-- Catálogo de tipos de ONU
-- ---------------------------------------------------------------------------
create table olt_onu_types (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  manufacturer       text not null default 'Huawei',
  port_type          text not null default 'VEIP' check (port_type in ('VEIP', 'ETH')),
  eth_ports          int not null default 4 check (eth_ports >= 0),
  wifi_bands         text not null default 'dual' check (wifi_bands in ('none', '2.4ghz', '5ghz', 'dual')),
  line_profile_id    uuid references line_profiles (id),
  service_profile_id uuid references service_profiles (id),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger olt_onu_types_set_updated_at
  before update on olt_onu_types
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ONUs registradas — se identifican por frame/slot/port + ONT ID dentro de
-- una OLT, igual que en el CLI de Huawei. No se referencia olt_pon_ports
-- directamente: esa tabla solo refleja el último "sincronizar" de tarjetas
-- (se borra y recrea completa), y encadenar una FK ahí rompería el registro
-- de ONUs cada vez que se vuelve a sincronizar.
-- ---------------------------------------------------------------------------
create table olt_onus (
  id                  uuid primary key default gen_random_uuid(),
  olt_id              uuid not null references olt_devices (id) on delete cascade,
  frame               int not null default 0,
  slot                int not null,
  port                int not null,
  ont_id              int not null check (ont_id between 0 and 127),
  serial_number       text not null unique,
  onu_type_id         uuid references olt_onu_types (id),
  line_profile_id     uuid references line_profiles (id),
  service_profile_id  uuid references service_profiles (id),
  vlan_id             int,
  client_id           uuid references clients (id),
  contract_id         uuid references service_contracts (id),
  status              text not null default 'pending' check (status in ('pending', 'active', 'online', 'offline')),
  signal_rx_dbm       numeric check (signal_rx_dbm is null or signal_rx_dbm between -40 and 0),
  signal_checked_at   timestamptz,
  activated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (olt_id, slot, port, ont_id)
);

create index olt_onus_olt_idx on olt_onus (olt_id);
create index olt_onus_client_idx on olt_onus (client_id);
create index olt_onus_contract_idx on olt_onus (contract_id);

create trigger olt_onus_set_updated_at
  before update on olt_onus
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- IP Pools — rangos por VLAN para las ONUs
-- ---------------------------------------------------------------------------
create table olt_ip_pools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  network       text not null,
  gateway       text not null,
  dns_primary   text not null default '8.8.8.8',
  dns_secondary text default '8.8.4.4',
  range_start   text not null,
  range_end     text not null,
  vlan_id       int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger olt_ip_pools_set_updated_at
  before update on olt_ip_pools
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — misma política simple de fases anteriores (cualquier usuario
-- autenticado tiene acceso completo); se endurece junto con RBAC.
-- ---------------------------------------------------------------------------
alter table olt_onu_types enable row level security;
alter table olt_onus enable row level security;
alter table olt_ip_pools enable row level security;

create policy "olt_onu_types_auth" on olt_onu_types for all to authenticated using (true) with check (true);
create policy "olt_onus_auth" on olt_onus for all to authenticated using (true) with check (true);
create policy "olt_ip_pools_auth" on olt_ip_pools for all to authenticated using (true) with check (true);

grant select, insert, update, delete on
  olt_onu_types, olt_onus, olt_ip_pools
  to authenticated, service_role;
