-- Fase 2: facturación electrónica SRI (Ecuador) — emisor, comprobantes, cobros y caja.
-- El envío/firma real al SRI (XAdES-BES + SOAP) se simula en el frontend
-- (ver src/lib/sri.ts); esta migración solo modela los datos y automatiza lo
-- que el motor de facturación resuelve siempre igual: numeración secuencial,
-- clave de acceso (algoritmo módulo 11 real del SRI) y totales.

-- ---------------------------------------------------------------------------
-- Configuración del emisor. Instancia única: la constraint de abajo impide
-- una segunda fila.
-- ---------------------------------------------------------------------------
create table sri_emitter_config (
  id                      uuid primary key default gen_random_uuid(),
  ruc                     text not null,
  razon_social            text not null,
  nombre_comercial        text,
  direccion               text not null,
  establecimiento         text not null default '001',
  punto_emision           text not null default '001',
  ambiente                smallint not null default 1 check (ambiente in (1, 2)),
  certificado_path        text,
  certificado_password    text,
  secuencial_factura      int not null default 0,
  secuencial_nota_credito int not null default 0,
  secuencial_nota_debito  int not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index sri_emitter_config_singleton on sri_emitter_config ((1));

create trigger sri_emitter_config_set_updated_at
  before update on sri_emitter_config
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Comprobantes electrónicos
-- ---------------------------------------------------------------------------
create table electronic_documents (
  id                       uuid primary key default gen_random_uuid(),
  tipo_comprobante         text not null default '01' check (tipo_comprobante in ('01', '04', '05')),
  establecimiento          text,
  punto_emision            text,
  secuencial               text,
  numero_completo          text,
  ambiente                 smallint,
  fecha_emision            date not null default current_date,
  client_id                uuid references clients (id),
  contract_id              uuid references service_contracts (id),
  razon_social_comprador   text not null default 'CONSUMIDOR FINAL',
  identificacion_comprador text not null default '9999999999999',
  subtotal_sin_impuestos   numeric not null default 0,
  iva                      numeric not null default 0,
  importe_total            numeric not null default 0,
  estado                   text not null default 'BORRADOR'
                           check (estado in ('BORRADOR', 'PROCESANDO', 'AUTORIZADO', 'RECHAZADO', 'ANULADO')),
  clave_acceso             text unique,
  numero_autorizacion      text,
  motivo_rechazo           text,
  paid_at                  timestamptz,
  payment_method           text check (payment_method in ('efectivo', 'transferencia', 'deposito', 'tarjeta', 'cheque')),
  payment_notes            text,
  paid_by                  uuid references profiles (id),
  created_by               uuid references profiles (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index electronic_documents_estado_idx on electronic_documents (estado);
create index electronic_documents_client_idx on electronic_documents (client_id);
create index electronic_documents_contract_idx on electronic_documents (contract_id);
create index electronic_documents_fecha_idx on electronic_documents (fecha_emision);

create unique index electronic_documents_numero_unico
  on electronic_documents (tipo_comprobante, establecimiento, punto_emision, secuencial);

create trigger electronic_documents_set_updated_at
  before update on electronic_documents
  for each row execute function set_updated_at();

create table document_items (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references electronic_documents (id) on delete cascade,
  description text not null,
  quantity    numeric not null default 1 check (quantity > 0),
  unit_price  numeric not null check (unit_price >= 0),
  subtotal    numeric generated always as (quantity * unit_price) stored,
  created_at  timestamptz not null default now()
);

create index document_items_document_idx on document_items (document_id);

-- ---------------------------------------------------------------------------
-- Clave de acceso (49 dígitos) — algoritmo oficial del SRI: 48 dígitos
-- (fecha + tipo + RUC + ambiente + establ/punto + secuencial + código
-- numérico + tipo emisión) más un dígito verificador módulo 11.
-- ---------------------------------------------------------------------------
create function calcular_digito_verificador_mod11(p_digits text)
returns int
language plpgsql
immutable
as $$
declare
  factores  int[] := array[2, 3, 4, 5, 6, 7];
  suma      int := 0;
  i         int;
  digito    int;
  resultado int;
begin
  for i in 0 .. length(p_digits) - 1 loop
    digito := substr(p_digits, length(p_digits) - i, 1)::int;
    suma := suma + digito * factores[(i % 6) + 1];
  end loop;
  resultado := 11 - (suma % 11);
  if resultado = 11 then
    return 0;
  elsif resultado = 10 then
    return 1;
  else
    return resultado;
  end if;
end;
$$;

create function generar_clave_acceso(
  p_fecha      date,
  p_tipo       text,
  p_ruc        text,
  p_ambiente   smallint,
  p_establ     text,
  p_punto      text,
  p_secuencial text
) returns text
language plpgsql
as $$
declare
  codigo_numerico text := lpad(floor(random() * 100000000)::text, 8, '0');
  base48          text;
begin
  base48 :=
    to_char(p_fecha, 'DDMMYYYY') ||
    p_tipo ||
    p_ruc ||
    p_ambiente::text ||
    p_establ || p_punto ||
    p_secuencial ||
    codigo_numerico ||
    '1'; -- tipo de emisión: 1 = normal
  return base48 || calcular_digito_verificador_mod11(base48)::text;
end;
$$;

-- Asigna establecimiento/punto/ambiente/secuencial/clave_acceso desde la
-- configuración del emisor. La numeración es un contador por tipo de
-- comprobante, igual que la numeración de contratos en Fase 1.
create function set_document_defaults()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  cfg      sri_emitter_config;
  next_seq int;
begin
  select * into cfg from sri_emitter_config limit 1 for update;
  if cfg is null then
    raise exception 'Configure primero el emisor SRI en Configuración → Emisor SRI';
  end if;

  new.establecimiento := coalesce(new.establecimiento, cfg.establecimiento);
  new.punto_emision := coalesce(new.punto_emision, cfg.punto_emision);
  new.ambiente := coalesce(new.ambiente, cfg.ambiente);

  if new.secuencial is null then
    if new.tipo_comprobante = '01' then
      update sri_emitter_config set secuencial_factura = secuencial_factura + 1
        where id = cfg.id returning secuencial_factura into next_seq;
    elsif new.tipo_comprobante = '04' then
      update sri_emitter_config set secuencial_nota_credito = secuencial_nota_credito + 1
        where id = cfg.id returning secuencial_nota_credito into next_seq;
    else
      update sri_emitter_config set secuencial_nota_debito = secuencial_nota_debito + 1
        where id = cfg.id returning secuencial_nota_debito into next_seq;
    end if;
    new.secuencial := lpad(next_seq::text, 9, '0');
  end if;

  new.numero_completo := new.establecimiento || '-' || new.punto_emision || '-' || new.secuencial;

  if new.clave_acceso is null then
    new.clave_acceso := generar_clave_acceso(
      new.fecha_emision, new.tipo_comprobante, cfg.ruc,
      new.ambiente, new.establecimiento, new.punto_emision, new.secuencial
    );
  end if;

  return new;
end;
$$;

create trigger electronic_documents_set_defaults
  before insert on electronic_documents
  for each row execute function set_document_defaults();

-- Recalcula subtotal/IVA/total del comprobante cuando cambian sus líneas.
-- IVA vigente en Ecuador: 15%.
create function recalc_document_totals()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  doc_id     uuid := coalesce(new.document_id, old.document_id);
  v_subtotal numeric;
  v_iva      numeric;
begin
  select coalesce(sum(quantity * unit_price), 0) into v_subtotal
  from document_items where document_id = doc_id;

  v_iva := round(v_subtotal * 0.15, 2);

  update electronic_documents
  set subtotal_sin_impuestos = v_subtotal,
      iva = v_iva,
      importe_total = v_subtotal + v_iva
  where id = doc_id;

  return null;
end;
$$;

create trigger document_items_recalc_totals
  after insert or update or delete on document_items
  for each row execute function recalc_document_totals();

-- ---------------------------------------------------------------------------
-- Facturación recurrente: genera borradores para contratos activos cuyo
-- billing_day coincide con la fecha dada, evitando duplicar dentro del
-- mismo mes.
-- ---------------------------------------------------------------------------
create function generar_facturas_recurrentes(p_fecha date default current_date)
returns setof electronic_documents
language plpgsql
security definer set search_path = public
as $$
declare
  r       record;
  new_doc electronic_documents;
begin
  for r in
    select sc.*, c.first_name, c.last_name, c.identification, p.name as plan_name
    from service_contracts sc
    join clients c on c.id = sc.client_id
    join plans p on p.id = sc.plan_id
    where sc.status = 'active'
      and sc.billing_day = extract(day from p_fecha)::int
      and not exists (
        select 1 from electronic_documents ed
        where ed.contract_id = sc.id
          and date_trunc('month', ed.fecha_emision) = date_trunc('month', p_fecha)
          and ed.estado <> 'ANULADO'
      )
  loop
    insert into electronic_documents (
      tipo_comprobante, fecha_emision, client_id, contract_id,
      razon_social_comprador, identificacion_comprador
    ) values (
      '01', p_fecha, r.client_id, r.id,
      r.first_name || ' ' || r.last_name, r.identification
    )
    returning * into new_doc;

    insert into document_items (document_id, description, quantity, unit_price)
    values (new_doc.id, 'Servicio de internet — ' || r.plan_name, 1, r.monthly_fee);

    return next new_doc;
  end loop;
  return;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: certificado digital (.p12) del emisor
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('sri-certificates', 'sri-certificates', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS — misma política simple de Fase 1 (cualquier usuario autenticado tiene
-- acceso completo); se endurece en la fase de Auth/RBAC.
-- ---------------------------------------------------------------------------
alter table sri_emitter_config enable row level security;
alter table electronic_documents enable row level security;
alter table document_items enable row level security;

create policy "sri_emitter_config_auth" on sri_emitter_config for all to authenticated using (true) with check (true);
create policy "electronic_documents_auth" on electronic_documents for all to authenticated using (true) with check (true);
create policy "document_items_auth" on document_items for all to authenticated using (true) with check (true);

create policy "sri_certificates_storage_auth" on storage.objects for all to authenticated
  using (bucket_id = 'sri-certificates')
  with check (bucket_id = 'sri-certificates');

grant select, insert, update, delete on sri_emitter_config, electronic_documents, document_items
  to authenticated, service_role;
grant execute on function generar_facturas_recurrentes(date) to authenticated, service_role;
