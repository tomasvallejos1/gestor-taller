-- =============================================================
--  El ticket de acceso se guarda por entorno y por CUIT
--
--  `arca_token` tenia una sola fila posible, con `servicio` de clave
--  primaria. Alcanzaba mientras el ticket lo pidiera siempre el mismo
--  intermediario contra el mismo ambiente.
--
--  Ahora no: el TA que devuelve WSAA vale para UN CUIT y UN ambiente.
--  Un ticket de homologacion no sirve en produccion, y uno emitido
--  para el CUIT de pruebas prestado no sirve para el del taller. Las
--  dos confusiones se provocan cambiando un secret, y las dos dan
--  errores que no hablan del ticket: ARCA contesta "Token invalido" o
--  directamente rechaza el comprobante.
--
--  La fila pasa a estar partida por ambiente, y el CUIT queda anotado
--  para que la aplicacion pueda descartar un ticket ajeno antes de
--  usarlo.
-- =============================================================

alter table public.arca_token
  -- 'dev' para lo que ya estaba: todo lo emitido hasta hoy fue contra
  -- homologacion.
  add column entorno text not null default 'dev',
  add column cuit    text;

alter table public.arca_token drop constraint arca_token_pkey;
alter table public.arca_token add primary key (servicio, entorno);

-- Sin default: quien escriba un ticket tiene que decir de que ambiente
-- es. Es justamente el dato que se olvida.
alter table public.arca_token alter column entorno drop default;

comment on column public.arca_token.cuit is
  'CUIT para el que ARCA emitio este ticket. Si no coincide con el que '
  'esta configurado, el ticket se descarta y se pide uno nuevo.';
