-- Vista de lectura para el listado de clientes: cada cliente junto con su
-- contrato más reciente (si existe) y el plan asociado.
create view clients_with_contract as
select
  c.*,
  sc.id             as contract_id,
  sc.contract_number,
  sc.status         as contract_status,
  sc.plan_id,
  p.name            as plan_name,
  sc.monthly_fee
from clients c
left join lateral (
  select *
  from service_contracts
  where service_contracts.client_id = c.id
  order by created_at desc
  limit 1
) sc on true
left join plans p on p.id = sc.plan_id;

alter view clients_with_contract set (security_invoker = on);
