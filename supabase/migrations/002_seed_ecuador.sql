-- Datos base de geografía de Ecuador.
-- Provincias: catálogo completo (24). Cantones: solo un subconjunto de
-- Pichincha y Guayas como punto de partida — completar con el listado
-- oficial del INEC antes de usar en producción a nivel nacional.

insert into provinces (name) values
  ('Azuay'),
  ('Bolívar'),
  ('Cañar'),
  ('Carchi'),
  ('Chimborazo'),
  ('Cotopaxi'),
  ('El Oro'),
  ('Esmeraldas'),
  ('Galápagos'),
  ('Guayas'),
  ('Imbabura'),
  ('Loja'),
  ('Los Ríos'),
  ('Manabí'),
  ('Morona Santiago'),
  ('Napo'),
  ('Orellana'),
  ('Pastaza'),
  ('Pichincha'),
  ('Santa Elena'),
  ('Santo Domingo de los Tsáchilas'),
  ('Sucumbíos'),
  ('Tungurahua'),
  ('Zamora Chinchipe');

insert into cantons (province_id, name)
select id, canton
from provinces
cross join lateral (
  values
    ('Quito'),
    ('Cayambe'),
    ('Mejía'),
    ('Pedro Moncayo'),
    ('Rumiñahui'),
    ('San Miguel de los Bancos'),
    ('Pedro Vicente Maldonado'),
    ('Puerto Quito')
) as t(canton)
where provinces.name = 'Pichincha';

insert into cantons (province_id, name)
select id, canton
from provinces
cross join lateral (
  values
    ('Guayaquil'),
    ('Durán'),
    ('Samborondón'),
    ('Daule'),
    ('Milagro'),
    ('Playas'),
    ('Naranjal'),
    ('Salitre'),
    ('Yaguachi')
) as t(canton)
where provinces.name = 'Guayas';
