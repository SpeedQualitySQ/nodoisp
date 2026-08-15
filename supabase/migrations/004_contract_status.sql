-- Automatiza el ciclo de vida cliente ↔ contrato:
--   1) Todo cambio de estado del cliente queda en client_status_history.
--   2) El estado del contrato (Kanban) propaga el estado del cliente.
-- Nota: esto NO sincroniza con MikroTik ni con la OLT — eso vive en los
-- middlewares de las fases de integración de red.

create function log_client_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into client_status_history (client_id, old_status, new_status, changed_by)
    values (new.id, case when tg_op = 'INSERT' then null else old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger clients_log_status_change
  after insert or update of status on clients
  for each row execute function log_client_status_change();

create function sync_client_status_from_contract()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_status text;
begin
  target_status := case new.status
    when 'pending'     then 'pending'
    when 'active'      then 'active'
    when 'suspended'   then 'suspended'
    when 'cut'         then 'cut'
    when 'terminated'  then 'retired'
  end;

  update clients
  set status = target_status
  where id = new.client_id
    and status is distinct from target_status;

  return new;
end;
$$;

create trigger service_contracts_sync_client_status
  after insert or update of status on service_contracts
  for each row execute function sync_client_status_from_contract();
