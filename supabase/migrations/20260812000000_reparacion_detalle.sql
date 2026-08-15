-- =============================================================
--  La orden guarda las dos mitades del trabajo
--
--  Hasta ahora todo lo que se sabia de una reparacion entraba en
--  `notas`, que es interna y no sale nunca de la pantalla del sistema.
--  Ahi convivian dos cosas distintas:
--
--    problema    - lo que dijo el cliente al traer el motor
--                  ("hace ruido y no arranca")
--    diagnostico - lo que se encontro al abrirlo y que se hizo
--                  ("bobinado de arranque quemado, rebobinado completo")
--
--  Separarlas permite imprimir el problema en el remito y mostrarle al
--  cliente que se le hizo, sin arrastrar las notas del taller. `notas`
--  queda para lo interno y sigue sin salir a ningun documento.
-- =============================================================

alter table public.reparacion
  add column problema    text,
  add column diagnostico text;

comment on column public.reparacion.problema is
  'Falla declarada por el cliente al ingresar el motor. Se imprime.';

comment on column public.reparacion.diagnostico is
  'Que se encontro y que se hizo. Va al remito. Lo interno del taller '
  'sigue en `notas`, que no se imprime en ningun lado.';

-- `cliente_id` sigue siendo nullable a proposito.
--
-- La interfaz ya lo pide obligatorio para las ordenes nuevas, pero un
-- `not null` aca exige backfillear a mano cada fila vieja antes de
-- poder aplicar la migracion, y ademas bloquearia cualquier UPDATE
-- sobre esas filas hasta que alguien les invente un cliente.
--
-- La consecuencia esta asumida: desde la migracion del seguimiento, una
-- orden sin cliente no se puede consultar en /estado, porque el segundo
-- factor es justamente el apellido del cliente.
