-- ============================================================
--  Los presupuestos pasan de cinco estados a dos
-- ============================================================
--
-- Habia borrador, enviado, aceptado, rechazado y vencido. Cuatro de
-- esos cinco dependen de que alguien vuelva al sistema a marcarlos
-- despues de hablar con el cliente, y eso no pasa: en el taller el
-- presupuesto se arma, se manda por WhatsApp y ahi termina. Un campo
-- que nadie mantiene no es informacion, es ruido que ademas se lee
-- como verdad ("todos en borrador" no significaba que estuvieran sin
-- terminar).
--
-- Quedan los dos que el sistema puede sostener solo:
--   creado  - existe
--   vencido - paso la fecha de emision mas los dias de validez
--
-- Postgres no permite quitar valores de un enum, asi que se crea el
-- tipo nuevo y se migra la columna.

create type public.estado_presupuesto_v2 as enum ('creado', 'vencido');

alter table public.presupuesto
  alter column estado drop default;

-- Todo lo que no estaba vencido pasa a creado. No se pierde nada que
-- se estuviera usando: aceptado y rechazado nunca se llegaron a
-- registrar desde la interfaz.
alter table public.presupuesto
  alter column estado type public.estado_presupuesto_v2
  using (case when estado::text = 'vencido' then 'vencido' else 'creado' end)::public.estado_presupuesto_v2;

alter table public.presupuesto
  alter column estado set default 'creado';

drop type public.estado_presupuesto;
alter type public.estado_presupuesto_v2 rename to estado_presupuesto;


-- ---------- El congelado de los datos del cliente ----------
--
-- Antes los datos fiscales del cliente se copiaban al presupuesto en el
-- momento de salir de borrador. Sin borrador hay que elegir otro
-- momento: se copian al crearlo, y se vuelven a copiar solo si alguien
-- cambia el cliente a proposito.
--
-- Esto es lo que hace que corregir el CUIT de un cliente hoy no
-- reescriba un presupuesto que se entrego el mes pasado.

create or replace function public.trg_congelar_cliente_presupuesto()
returns trigger
language plpgsql
as $$
declare
  c public.cliente;
begin
  if new.punto_venta is null then
    select punto_venta into new.punto_venta from public.configuracion where id = 1;
    new.punto_venta := coalesce(new.punto_venta, 1);
  end if;

  if new.cliente_id is null then
    -- Presupuesto de mostrador, sin cliente asignado. Si antes tenia
    -- uno y se lo sacaron, no puede quedar el nombre viejo pegado.
    new.cliente_nombre           := null;
    new.cliente_documento        := null;
    new.cliente_documento_tipo   := null;
    new.cliente_condicion_fiscal := null;

  elsif old is null or old.cliente_id is distinct from new.cliente_id then
    select * into c from public.cliente where id = new.cliente_id;
    if found then
      new.cliente_nombre           := c.nombre;
      new.cliente_documento        := c.documento;
      new.cliente_documento_tipo   := c.documento_tipo;
      new.cliente_condicion_fiscal := c.condicion_fiscal;
    end if;
  end if;

  return new;
end;
$$;
