-- Fase 9: administración — roles/permisos granulares, datos de empresa,
-- inventario, y ubicación para el mapa de infraestructura.

-- ---------------------------------------------------------------------------
-- Roles de staff: de 'staff' único a 3 niveles (admin/operador/visor), más
-- 'cliente_portal' que ya existía (Fase 7). Los perfiles 'staff' existentes
-- migran a 'admin' para no perderle acceso a nadie.
-- ---------------------------------------------------------------------------
alter table profiles drop constraint profiles_role_check;
update profiles set role = 'admin' where role = 'staff';
alter table profiles alter column role set default 'operador';
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'operador', 'visor', 'cliente_portal'));

-- Visibilidad de módulos por usuario (independiente de si puede escribir).
-- admin ignora esto (siempre ve todo); operador/visor lo usan para calibrar
-- qué secciones del menú ven. Ejemplo: {"clientes": true, "olt": false}.
alter table profiles add column permissions jsonb not null default '{}'::jsonb;

-- Reemplaza las 4 policies de la Fase 7 que comparaban contra el rol
-- 'staff', que ya no existe — ahora cualquier rol que no sea del portal
-- cuenta como staff (el filtrado fino de módulos es a nivel de UI/rutas,
-- ver router/index.ts).
drop policy "support_tickets_staff" on support_tickets;
create policy "support_tickets_staff" on support_tickets for all
  to authenticated using (current_profile_role() != 'cliente_portal') with check (current_profile_role() != 'cliente_portal');

drop policy "ticket_updates_staff" on ticket_updates;
create policy "ticket_updates_staff" on ticket_updates for all
  to authenticated using (current_profile_role() != 'cliente_portal') with check (current_profile_role() != 'cliente_portal');

drop policy "whatsapp_config_staff" on whatsapp_config;
create policy "whatsapp_config_staff" on whatsapp_config for all
  to authenticated using (current_profile_role() != 'cliente_portal') with check (current_profile_role() != 'cliente_portal');

drop policy "vencimiento_notifications_staff" on vencimiento_notifications;
create policy "vencimiento_notifications_staff" on vencimiento_notifications for all
  to authenticated using (current_profile_role() != 'cliente_portal') with check (current_profile_role() != 'cliente_portal');

-- Para las tablas NUEVAS de esta fase (inventario) sí se bloquea escritura a
-- "visor". Las ~25 tablas de las Fases 1-8 quedan con su política simple
-- "using (true)" de siempre — endurecerlas es una tarea aparte, revisando
-- cada una (varias ya tienen comentarios propios diciendo "se endurece en
-- la fase de Auth/RBAC", que es esta, pero hacerlo de golpe sobre todo el
-- esquema existente es un cambio grande para meter de paso acá).
create function current_profile_can_write() returns boolean
language sql stable
as $$
  select current_profile_role() not in ('visor', 'cliente_portal');
$$;

-- ---------------------------------------------------------------------------
-- Datos de empresa — se extiende sri_emitter_config (ya tiene ruc/razón
-- social/dirección) en vez de crear una tabla nueva con los mismos datos.
-- ---------------------------------------------------------------------------
alter table sri_emitter_config add column telefono text;
alter table sri_emitter_config add column email text;
alter table sri_emitter_config add column logo_path text;

insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do nothing;

create policy "company_assets_storage_auth" on storage.objects for all to authenticated
  using (bucket_id = 'company-assets')
  with check (bucket_id = 'company-assets');

-- ---------------------------------------------------------------------------
-- Ubicación para el mapa de infraestructura — olt_devices y zones no tenían
-- coordenadas. Nullable: si no se cargan, ese marcador no aparece.
-- ---------------------------------------------------------------------------
alter table olt_devices add column lat numeric;
alter table olt_devices add column lng numeric;
alter table zones add column lat numeric;
alter table zones add column lng numeric;

-- ---------------------------------------------------------------------------
-- Inventario
-- ---------------------------------------------------------------------------
create table products (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  category   text,
  unit       text not null default 'Unidad',
  min_stock  int not null default 0 check (min_stock >= 0),
  cost_price numeric not null default 0 check (cost_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

create table inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  type       text not null check (type in ('in', 'out')),
  quantity   int not null check (quantity > 0),
  notes      text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index inventory_movements_product_idx on inventory_movements (product_id);

alter table products enable row level security;
alter table inventory_movements enable row level security;

create policy "products_select" on products for select
  to authenticated using (current_profile_role() != 'cliente_portal');
create policy "products_write" on products for insert
  to authenticated with check (current_profile_can_write());
create policy "products_update" on products for update
  to authenticated using (current_profile_can_write()) with check (current_profile_can_write());
create policy "products_delete" on products for delete
  to authenticated using (current_profile_can_write());

create policy "inventory_movements_select" on inventory_movements for select
  to authenticated using (current_profile_role() != 'cliente_portal');
create policy "inventory_movements_write" on inventory_movements for insert
  to authenticated with check (current_profile_can_write());

grant select, insert, update, delete on products, inventory_movements to authenticated, service_role;

create view product_stock as
select
  p.*,
  coalesce(sum(case when m.type = 'in' then m.quantity when m.type = 'out' then -m.quantity end), 0) as stock
from products p
left join inventory_movements m on m.product_id = p.id
group by p.id;

alter view product_stock set (security_invoker = on);

-- Evita egresos que dejen stock negativo por una condición de carrera (dos
-- egresos concurrentes que individualmente parecían válidos en el
-- formulario). La vista product_stock ya agrega los movimientos existentes,
-- así que esto no cuenta la fila que se está por insertar todavía.
create function guard_inventory_stock() returns trigger
language plpgsql
as $$
declare
  current_stock int;
begin
  if new.type = 'out' then
    select stock into current_stock from product_stock where id = new.product_id;
    if current_stock is null or current_stock < new.quantity then
      raise exception 'Stock insuficiente para este producto (disponible: %)', coalesce(current_stock, 0);
    end if;
  end if;
  return new;
end;
$$;

create trigger inventory_movements_guard_stock
  before insert on inventory_movements
  for each row execute function guard_inventory_stock();

-- ---------------------------------------------------------------------------
-- Guarda contra escalada de privilegios: "profiles_auth" (Fase 1) es
-- "using (true)" para cualquier autenticado, así que sin esto un
-- operador/visor podría hacer un PATCH directo a su propia fila y ponerse
-- role='admin' o permissions={"olt": true}, sin pasar por /configuracion/
-- usuarios (que sí restringe esto a nivel de UI, pero eso no alcanza).
-- auth.role() = 'service_role' deja pasar las llamadas del servidor
-- (server/api.ts /api/staff/create-user y /api/portal/create-user), que sí
-- necesitan setear el rol/permisos al crear el usuario.
create function guard_profile_role_change() returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if (new.role is distinct from old.role or new.permissions is distinct from old.permissions)
     and current_profile_role() != 'admin' then
    raise exception 'Solo un administrador puede cambiar el rol o los permisos';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role_change
  before update on profiles
  for each row execute function guard_profile_role_change();
