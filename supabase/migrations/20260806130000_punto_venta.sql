-- =============================================================
--  Punto de venta y numeracion de comprobante
--
--  Un presupuesto NO es un comprobante fiscal: no lleva CAE ni se
--  informa a AFIP. Pero se emite con el mismo formato --letra X en el
--  recuadro, "documento no valido como factura", punto de venta y
--  numero correlativo-- porque es lo que el cliente reconoce y lo que
--  despues se convierte en factura sin rehacer nada.
-- =============================================================

alter table public.configuracion
  add column punto_venta smallint not null default 1
    check (punto_venta between 1 and 9999),
  add column leyenda_validez text not null default
    'Presupuesto valido por los dias indicados desde su emision. '
    'Pasada esa fecha, solicitar uno nuevo.';

-- "0001-00000042": 4 digitos de punto de venta, 8 de numero.
create or replace function public.numero_comprobante(
  p_punto_venta integer,
  p_numero bigint
)
returns text
language sql
immutable
as $$
  select lpad(coalesce(p_punto_venta, 1)::text, 4, '0')
      || '-'
      || lpad(coalesce(p_numero, 0)::text, 8, '0');
$$;

-- El punto de venta se congela junto con el resto: si el taller lo
-- cambia despues, un presupuesto ya emitido tiene que seguir mostrando
-- el numero con el que salio.
alter table public.presupuesto
  add column punto_venta smallint;

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

  -- Los datos del cliente se congelan al salir de borrador. Mientras es
  -- borrador siguen los cambios del cliente, que es lo util para
  -- corregir antes de emitir.
  if new.estado <> 'borrador' and (old is null or old.estado = 'borrador')
     and new.cliente_id is not null then
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

update public.presupuesto set punto_venta = 1 where punto_venta is null;


-- ---------- Vista publica del presupuesto ----------
-- Se reemplaza para incluir los datos del emisor y el numero de
-- comprobante, que el link compartible tiene que mostrar igual que el PDF.

create or replace function public.presupuesto_publico(p_token uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'numero',        p.numero,
    'comprobante',   public.numero_comprobante(p.punto_venta, p.numero),
    'estado',        p.estado,
    'creado_en',     p.creado_en,
    'vigencia_dias', p.vigencia_dias,
    'vence_el',      (p.creado_en + (p.vigencia_dias || ' days')::interval)::date,
    'subtotal',      p.subtotal,
    'descuento',     p.descuento,
    'iva_pct',       p.iva_pct,
    'total',         p.total,
    'notas',         p.notas,
    'emisor', jsonb_build_object(
      'razon_social',     cfg.razon_social,
      'cuit',             cfg.cuit,
      'domicilio',        cfg.domicilio,
      'localidad',        cfg.localidad,
      'telefono',         cfg.telefono,
      'email',            cfg.email,
      'condicion_fiscal', cfg.condicion_fiscal,
      'leyenda',          cfg.leyenda_validez
    ),
    'cliente', jsonb_build_object(
      'nombre',           coalesce(p.cliente_nombre, c.nombre),
      'documento',        coalesce(p.cliente_documento, c.documento),
      'documento_tipo',   coalesce(p.cliente_documento_tipo, c.documento_tipo),
      'condicion_fiscal', coalesce(p.cliente_condicion_fiscal, c.condicion_fiscal),
      'domicilio',        c.direccion
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descripcion', i.descripcion,
        'cantidad',    i.cantidad,
        'precio_unit', i.precio_unit,
        'subtotal',    i.subtotal
      ) order by i.orden)
      from public.presupuesto_item i where i.presupuesto_id = p.id
    ), '[]'::jsonb)
  )
  from public.presupuesto p
  left join public.cliente c on c.id = p.cliente_id
  cross join public.configuracion cfg
  where p.token_publico = p_token
    and p.estado <> 'borrador'   -- un borrador no se comparte
    and cfg.id = 1
$$;

grant execute on function public.presupuesto_publico(uuid) to anon, authenticated;
grant execute on function public.numero_comprobante(integer, bigint) to anon, authenticated;
