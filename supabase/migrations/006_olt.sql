-- Fase 3: gestión de OLTs (Huawei/ZTE) — dispositivos, tarjetas, puertos PON,
-- uplinks, VLANs de servicio y perfiles (velocidad, línea, servicio ONU,
-- TR-069/ACS), más backups de configuración.
-- La conexión SSH real al equipo se simula en el frontend (ver
-- src/lib/olt.ts), igual que Fase 2 simula la firma/envío al SRI: no hay
-- infraestructura de backend (supabase/functions, ssh2) en este repo para
-- abrir sesiones SSH reales; esta migración solo modela el dato.

-- ---------------------------------------------------------------------------
-- Dispositivos OLT
-- ---------------------------------------------------------------------------
create table olt_devices (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  host              text not null,
  ssh_port          int not null default 22,
  ssh_user          text not null,
  -- Igual que sri_emitter_config.certificado_password (005): texto plano,
  -- mismo gap de seguridad ya aceptado en el repo; se endurece junto con
  -- RBAC en una fase posterior.
  ssh_password      text not null,
  model             text not null default 'MA5800-X7',
  status            text not null default 'offline' check (status in ('online', 'offline', 'unreachable')),
  firmware_version  text,
  last_checked_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger olt_devices_set_updated_at
  before update on olt_devices
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Tarjetas — no se crean manualmente, solo vía "sincronizar" (simulado)
-- ---------------------------------------------------------------------------
create table olt_cards (
  id          uuid primary key default gen_random_uuid(),
  olt_id      uuid not null references olt_devices (id) on delete cascade,
  slot        int not null,
  card_type   text not null check (card_type in ('H901GPSF', 'H901XGHD', 'H901CSHF', 'H901MPSC')),
  port_count  int not null default 0,
  status      text not null default 'active' check (status in ('active', 'inactive')),
  synced_at   timestamptz not null default now(),
  unique (olt_id, slot)
);

create index olt_cards_olt_idx on olt_cards (olt_id);

-- ---------------------------------------------------------------------------
-- Puertos PON — uno por tarjeta GPON/XGS-PON, también sincronizados
-- ---------------------------------------------------------------------------
create table olt_pon_ports (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references olt_cards (id) on delete cascade,
  frame      int not null default 0,
  port       int not null,
  onu_count  int not null default 0,
  status     text not null default 'active' check (status in ('active', 'inactive')),
  synced_at  timestamptz not null default now(),
  unique (card_id, port)
);

create index olt_pon_ports_card_idx on olt_pon_ports (card_id);

-- ---------------------------------------------------------------------------
-- Uplinks — CRUD normal
-- ---------------------------------------------------------------------------
create table olt_uplink_ports (
  id                uuid primary key default gen_random_uuid(),
  olt_id            uuid not null references olt_devices (id) on delete cascade,
  port              text not null,
  management_vlan   int,
  management_ip     text,
  status            text not null default 'active' check (status in ('active', 'inactive')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (olt_id, port)
);

create index olt_uplink_ports_olt_idx on olt_uplink_ports (olt_id);

create trigger olt_uplink_ports_set_updated_at
  before update on olt_uplink_ports
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- VLANs de servicio — por OLT
-- ---------------------------------------------------------------------------
create table olt_vlans (
  id          uuid primary key default gen_random_uuid(),
  olt_id      uuid not null references olt_devices (id) on delete cascade,
  vlan_id     int not null check (vlan_id between 1 and 4094),
  name        text not null,
  modo        text not null default 'smart' check (modo in ('smart', 'standard')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (olt_id, vlan_id)
);

create index olt_vlans_olt_idx on olt_vlans (olt_id);

create trigger olt_vlans_set_updated_at
  before update on olt_vlans
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Perfiles — globales, reutilizables entre OLTs (no dependen de un chasis)
-- ---------------------------------------------------------------------------
create table speed_profiles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  cir_down_kbps   int not null check (cir_down_kbps >= 0),
  pir_down_kbps   int not null check (pir_down_kbps >= 0),
  cir_up_kbps     int not null check (cir_up_kbps >= 0),
  pir_up_kbps     int not null check (pir_up_kbps >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger speed_profiles_set_updated_at
  before update on speed_profiles
  for each row execute function set_updated_at();

create table line_profiles (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  tcont              int not null default 1,
  gem_port_id        int not null default 0,
  vlan_id            int not null,
  mapping            text not null default '802.1p',
  speed_profile_id   uuid references speed_profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger line_profiles_set_updated_at
  before update on line_profiles
  for each row execute function set_updated_at();

create table service_profiles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  tipo        text not null default 'VEIP' check (tipo in ('VEIP', 'ETH')),
  puerto_ani  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger service_profiles_set_updated_at
  before update on service_profiles
  for each row execute function set_updated_at();

create table tr069_profiles (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  acs_url           text not null,
  acs_user          text,
  acs_password      text,
  interval_seconds  int not null default 3600,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger tr069_profiles_set_updated_at
  before update on tr069_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Backups de configuración — por OLT
-- ---------------------------------------------------------------------------
create table olt_backups (
  id           uuid primary key default gen_random_uuid(),
  olt_id       uuid not null references olt_devices (id) on delete cascade,
  config_text  text not null,
  created_by   uuid references profiles (id),
  created_at   timestamptz not null default now()
);

create index olt_backups_olt_idx on olt_backups (olt_id);

-- ---------------------------------------------------------------------------
-- RLS — misma política simple de Fase 1/2 (cualquier usuario autenticado
-- tiene acceso completo); se endurece en la fase de Auth/RBAC.
-- ---------------------------------------------------------------------------
alter table olt_devices enable row level security;
alter table olt_cards enable row level security;
alter table olt_pon_ports enable row level security;
alter table olt_uplink_ports enable row level security;
alter table olt_vlans enable row level security;
alter table speed_profiles enable row level security;
alter table line_profiles enable row level security;
alter table service_profiles enable row level security;
alter table tr069_profiles enable row level security;
alter table olt_backups enable row level security;

create policy "olt_devices_auth" on olt_devices for all to authenticated using (true) with check (true);
create policy "olt_cards_auth" on olt_cards for all to authenticated using (true) with check (true);
create policy "olt_pon_ports_auth" on olt_pon_ports for all to authenticated using (true) with check (true);
create policy "olt_uplink_ports_auth" on olt_uplink_ports for all to authenticated using (true) with check (true);
create policy "olt_vlans_auth" on olt_vlans for all to authenticated using (true) with check (true);
create policy "speed_profiles_auth" on speed_profiles for all to authenticated using (true) with check (true);
create policy "line_profiles_auth" on line_profiles for all to authenticated using (true) with check (true);
create policy "service_profiles_auth" on service_profiles for all to authenticated using (true) with check (true);
create policy "tr069_profiles_auth" on tr069_profiles for all to authenticated using (true) with check (true);
create policy "olt_backups_auth" on olt_backups for all to authenticated using (true) with check (true);

grant select, insert, update, delete on
  olt_devices, olt_cards, olt_pon_ports, olt_uplink_ports, olt_vlans,
  speed_profiles, line_profiles, service_profiles, tr069_profiles, olt_backups
  to authenticated, service_role;
