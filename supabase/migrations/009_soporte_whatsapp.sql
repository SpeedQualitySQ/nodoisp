-- Fase 7: soporte al cliente, portal de clientes y notificaciones WhatsApp.
-- Primera migración del proyecto con RLS realmente segmentada por rol: hasta
-- acá toda tabla usaba "for all to authenticated using (true)" porque todo
-- usuario autenticado era del equipo del ISP. Ahora existe un segundo rol
-- (cliente del portal) que solo debe ver sus propios tickets, y nunca las
-- notas internas.

-- ---------------------------------------------------------------------------
-- Rol de portal en profiles. client_id solo se llena para usuarios de
-- portal (uno por cliente); el resto del sistema sigue asumiendo 'staff'.
-- ---------------------------------------------------------------------------
alter table profiles add column role text not null default 'staff' check (role in ('staff', 'cliente_portal'));
alter table profiles add column client_id uuid references clients (id) on delete cascade;
create index profiles_client_idx on profiles (client_id);

-- Uso repetido en las policies de abajo; evita repetir el subselect y deja
-- el plan de RLS más legible.
create function current_profile_role() returns text
language sql stable
as $$
  select role from profiles where id = auth.uid();
$$;

create function current_profile_client_id() returns uuid
language sql stable
as $$
  select client_id from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Tickets de soporte
-- ---------------------------------------------------------------------------
create table support_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_number text unique,
  client_id     uuid not null references clients (id) on delete cascade,
  contract_id   uuid references service_contracts (id),
  type          text not null default 'other'
                check (type in ('incident', 'request', 'billing', 'complaint', 'other')),
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status        text not null default 'open'
                check (status in ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
  title         text not null,
  description   text,
  assigned_to   uuid references profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index support_tickets_client_idx on support_tickets (client_id);
create index support_tickets_status_idx on support_tickets (status);
create index support_tickets_assigned_idx on support_tickets (assigned_to);

-- Numeración automática: <año>-<consecutivo de 6 dígitos>, igual patrón que
-- contract_number_seq en 001_schema_inicial.sql.
create sequence ticket_number_seq;

create function set_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null then
    new.ticket_number :=
      extract(year from now())::text || '-' ||
      lpad(nextval('ticket_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger support_tickets_set_number
  before insert on support_tickets
  for each row execute function set_ticket_number();

create trigger support_tickets_set_updated_at
  before update on support_tickets
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Actualizaciones del ticket — 'reply' es visible para el cliente del
-- portal, 'internal' nunca (lo aplica la RLS de más abajo, no solo la UI).
-- ---------------------------------------------------------------------------
create table ticket_updates (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references support_tickets (id) on delete cascade,
  update_type text not null default 'reply' check (update_type in ('reply', 'internal')),
  body        text not null,
  created_by  uuid references profiles (id),
  created_at  timestamptz not null default now()
);

create index ticket_updates_ticket_idx on ticket_updates (ticket_id);

-- ---------------------------------------------------------------------------
-- Configuración de WhatsApp Business — singleton (una sola fila), mismo
-- truco que sri_emitter_config en 005_facturacion_sri.sql.
-- ---------------------------------------------------------------------------
create table whatsapp_config (
  id                  uuid primary key default gen_random_uuid(),
  enabled             boolean not null default false,
  phone_number_id     text,
  access_token        text,
  technician_phones   text,
  check_interval      int not null default 5,
  notify_venc_enabled boolean not null default false,
  venc_dias_1         int not null default 3,
  venc_dias_2         int not null default 7,
  venc_dias_3         int not null default 15,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index whatsapp_config_singleton on whatsapp_config ((1));

create trigger whatsapp_config_set_updated_at
  before update on whatsapp_config
  for each row execute function set_updated_at();

insert into whatsapp_config default values;

-- ---------------------------------------------------------------------------
-- Registro de notificaciones de vencimiento ya enviadas — evita mandar el
-- mismo nivel dos veces a la misma factura.
-- ---------------------------------------------------------------------------
create table vencimiento_notifications (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references electronic_documents (id) on delete cascade,
  nivel       smallint not null check (nivel in (1, 2, 3)),
  sent_at     timestamptz not null default now(),
  unique (document_id, nivel)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table support_tickets enable row level security;
alter table ticket_updates enable row level security;
alter table whatsapp_config enable row level security;
alter table vencimiento_notifications enable row level security;

-- Staff: acceso total, como el resto del sistema.
create policy "support_tickets_staff" on support_tickets for all
  to authenticated using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');

-- Portal: solo sus propios tickets, puede crear los suyos, no puede
-- reasignarlos ni tocar el estado (eso es responsabilidad del staff).
create policy "support_tickets_portal_select" on support_tickets for select
  to authenticated using (current_profile_role() = 'cliente_portal' and client_id = current_profile_client_id());
create policy "support_tickets_portal_insert" on support_tickets for insert
  to authenticated with check (current_profile_role() = 'cliente_portal' and client_id = current_profile_client_id());

create policy "ticket_updates_staff" on ticket_updates for all
  to authenticated using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');

-- Portal: solo respuestas (nunca notas internas) de sus propios tickets;
-- solo puede insertar respuestas, nunca notas internas.
create policy "ticket_updates_portal_select" on ticket_updates for select
  to authenticated using (
    current_profile_role() = 'cliente_portal'
    and update_type = 'reply'
    and ticket_id in (select id from support_tickets where client_id = current_profile_client_id())
  );
create policy "ticket_updates_portal_insert" on ticket_updates for insert
  to authenticated with check (
    current_profile_role() = 'cliente_portal'
    and update_type = 'reply'
    and ticket_id in (select id from support_tickets where client_id = current_profile_client_id())
  );

create policy "whatsapp_config_staff" on whatsapp_config for all
  to authenticated using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');

create policy "vencimiento_notifications_staff" on vencimiento_notifications for all
  to authenticated using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');

grant select, insert, update, delete on
  support_tickets, ticket_updates, whatsapp_config, vencimiento_notifications
  to authenticated, service_role;
