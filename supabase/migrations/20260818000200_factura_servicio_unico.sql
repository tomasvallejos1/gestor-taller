-- =============================================================
--  Facturar un trabajo que nunca se detallo
--
--  El circuito de papeles del taller es presupuesto -> remito ->
--  factura, y cada paso copia los renglones del anterior. Pero la
--  mitad de los trabajos entran sin presupuesto: el cliente trae el
--  motor, se arregla, se acuerda un precio de palabra y se cobra.
--  Esa orden llega a la factura sin un solo renglon, con total 0, y
--  ARCA no autoriza un comprobante de cero.
--
--  Hasta aca la unica salida era volver atras a inventar un
--  presupuesto para un trabajo ya entregado, solo para que el
--  importe bajara por la cadena.
--
--  El importe ya existe en otro lado: es el que se cargo a mano en la
--  cobranza de la orden, el mismo contra el que se registraron los
--  pagos. Esta funcion lo baja a un renglon unico. Un solo renglon
--  que dice "Servicio" es ademas lo que el taller escribe a mano en
--  una factura C cuando no hay detalle que dar.
--
--  Es deliberadamente una operacion aparte y no un default de
--  `crear_factura_desde_remito`: que un comprobante fiscal se
--  autocomplete solo con un importe sacado de otra tabla tiene que
--  ser una decision de alguien, tomada en el momento y con el numero
--  a la vista. La interfaz la pide confirmar antes de emitir.
-- =============================================================

create or replace function public.completar_factura_con_servicio(p_factura_id uuid)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_f     public.factura;
  v_monto numeric(12,2);
begin
  select * into v_f from public.factura where id = p_factura_id;
  if not found then
    raise exception 'No existe esa factura';
  end if;

  if v_f.cae is not null then
    raise exception 'Esa factura ya esta autorizada por ARCA: no se le agregan renglones';
  end if;

  -- Se niega a completar una factura que ya tiene detalle. Sin esto,
  -- un doble toque en el boton duplica el importe del trabajo.
  if exists (select 1 from public.factura_item where factura_id = p_factura_id) then
    raise exception 'Esa factura ya tiene renglones cargados';
  end if;

  if v_f.reparacion_id is null then
    raise exception 'Esa factura no esta atada a una orden, no hay de donde tomar el importe';
  end if;

  -- `total` de la cobranza es el importe puesto a mano y, si no hay,
  -- el del remito o el presupuesto. Cualquiera de los tres sirve: lo
  -- que importa es que sea el numero que el taller acordo cobrar.
  select c.total into v_monto
  from public.cobranza c
  where c.reparacion_id = v_f.reparacion_id;

  if v_monto is null or v_monto <= 0 then
    raise exception 'La orden no tiene un importe a cobrar cargado';
  end if;

  insert into public.factura_item (factura_id, orden, descripcion, cantidad, precio_unit)
  values (p_factura_id, 0, 'Servicio', 1, v_monto);

  -- El trigger `factura_item_recalcula` ya reescribio subtotal, total,
  -- imp_neto e imp_iva con la formula que corresponde al tipo de
  -- comprobante. Aca no se toca ningun total a mano.
  return v_monto;
end;
$$;

comment on function public.completar_factura_con_servicio(uuid) is
  'Carga en una factura sin renglones un unico "Servicio" por el importe '
  'de la cobranza de su orden. Devuelve el importe usado.';
