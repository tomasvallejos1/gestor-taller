-- =============================================================
--  El punto de venta de la factura no es el del remito
--
--  Hasta aca `configuracion.punto_venta` servia para los tres
--  comprobantes. Funcionaba porque los tres usaban el numero 1, pero
--  eso era una coincidencia, no una regla: son dos registros distintos
--  que nunca tuvieron por que coincidir.
--
--    presupuesto y remito - series internas del taller. El "punto de
--      venta" que imprimen es decorativo: nadie afuera lo valida, y
--      existe solo porque el cliente reconoce ese formato de numero.
--
--    factura - lo declara ARCA. Es un punto de venta dado de alta en
--      "Administracion de Puntos de Venta y Domicilios", atado a una
--      modalidad concreta (web services), y ARCA rechaza cualquier
--      comprobante que llegue con uno que no tenga registrado.
--
--  El taller se topo con la diferencia el dia que fue a dar de alta el
--  punto de venta para web services: el numero 1 ya estaba tomado por
--  "Comprobantes en linea", y los numeros son unicos por CUIT sin
--  importar la modalidad. Le toco el 2.
--
--  Se agrega una columna aparte en vez de cambiar `punto_venta` a 2
--  para no reescribir la numeracion de los remitos y presupuestos ya
--  entregados: el papel que el cliente tiene en la mano dice 0001, y
--  tiene que seguir diciendo 0001.
-- =============================================================

alter table public.configuracion
  add column punto_venta_fiscal smallint
    check (punto_venta_fiscal is null or punto_venta_fiscal between 1 and 9999);

comment on column public.configuracion.punto_venta_fiscal is
  'Punto de venta habilitado en ARCA para facturar por web services. '
  'Si es null se usa `punto_venta`, que es el de las series internas.';


-- El default de la factura pasa a ser el fiscal.
create or replace function public.trg_congelar_cliente_factura()
returns trigger
language plpgsql
as $$
declare
  c public.cliente;
begin
  -- Una vez autorizada no se toca nada, ni siquiera para "mejorar" los
  -- datos del receptor: son parte de lo que se declaro.
  if new.cae is not null then return new; end if;

  if new.punto_venta is null then
    select coalesce(punto_venta_fiscal, punto_venta) into new.punto_venta
    from public.configuracion where id = 1;
    new.punto_venta := coalesce(new.punto_venta, 1);
  end if;

  if new.cliente_id is not null
     and (old is null or old.cliente_id is distinct from new.cliente_id) then
    select * into c from public.cliente where id = new.cliente_id;
    if found then
      new.cliente_nombre           := c.nombre;
      new.cliente_documento        := c.documento;
      new.cliente_documento_tipo   := c.documento_tipo;
      new.cliente_condicion_fiscal := c.condicion_fiscal;
      new.cliente_domicilio        := c.direccion;
    end if;
  end if;

  new.doc_tipo := case new.cliente_documento_tipo
    when 'cuit' then 80
    when 'dni'  then 96
    else 99
  end;

  new.doc_nro := coalesce(
    nullif(regexp_replace(coalesce(new.cliente_documento, ''), '\D', '', 'g'), '')::bigint,
    0
  );

  if new.doc_nro = 0 then new.doc_tipo := 99; end if;

  return new;
end;
$$;


-- Y el alta desde el remito deja de heredar el del remito.
--
-- Era la fuente del problema: el remito nace con el punto de venta de
-- las series internas, y la factura lo copiaba. Con los dos numeros
-- distintos, cada factura salia declarando un punto de venta que ARCA
-- no tiene registrado --y el rechazo que devuelve es un generico
-- "Error interno de base de datos" que no menciona el punto de venta
-- por ningun lado--.
create or replace function public.crear_factura_desde_remito(p_remito_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  r    public.remito;
  v_id uuid;
begin
  select * into r from public.remito where id = p_remito_id;
  if not found then
    raise exception 'No existe ese remito';
  end if;

  if exists (
    select 1 from public.factura
    where remito_id = p_remito_id and estado in ('pendiente', 'autorizada')
  ) then
    raise exception 'Ese remito ya tiene una factura en curso o autorizada';
  end if;

  insert into public.factura (
    reparacion_id, remito_id, cliente_id,
    cbte_tipo, punto_venta, concepto,
    serv_desde, serv_hasta, vto_pago,
    descuento, iva_pct, creado_por
  )
  values (
    r.reparacion_id, r.id, r.cliente_id,
    -- Factura C mientras el emisor sea monotributista. Si algun dia pasa
    -- a responsable inscripto esto se decide por la condicion del
    -- receptor (A si esta inscripto, B si no).
    case (select condicion_fiscal from public.configuracion where id = 1)
      when 'responsable_inscripto' then
        case when r.cliente_condicion_fiscal = 'responsable_inscripto' then 1 else 6 end
      else 11
    end,
    (select coalesce(punto_venta_fiscal, punto_venta) from public.configuracion where id = 1),
    2,                                  -- servicios
    r.fecha, r.fecha, r.fecha,
    r.descuento, r.iva_pct, auth.uid()
  )
  returning id into v_id;

  insert into public.factura_item
    (factura_id, orden, catalogo_item_id, descripcion, cantidad, precio_unit)
  select v_id, i.orden, i.catalogo_item_id, i.descripcion, i.cantidad, i.precio_unit
  from public.remito_item i
  where i.remito_id = p_remito_id
  order by i.orden;

  return v_id;
end;
$$;
