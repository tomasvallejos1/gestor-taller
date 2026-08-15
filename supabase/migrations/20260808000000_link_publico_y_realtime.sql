-- ============================================================
--  Dos cosas que quedaron rotas y no avisan
-- ============================================================


-- ---------- 1. El link publico ----------
--
-- presupuesto_publico filtraba con `p.estado <> 'borrador'`. Al reducir
-- el enum a (creado, vencido) ese literal dejo de existir, y Postgres no
-- lo trata como "ningun estado coincide": tira 22P02 al arrancar la
-- funcion. O sea que TODOS los links compartidos por WhatsApp pasaron a
-- responder "no encontramos este presupuesto", no solo los borradores.
--
-- El filtro se va entero en vez de traducirse. Ya no hay un estado que
-- signifique "todavia no se muestra": un presupuesto existe o no existe.
-- Y uno vencido tiene que poder abrirse igual --el cliente que recibe el
-- link una semana tarde necesita ver que le habian cotizado--; la
-- pantalla ya le avisa arriba que vencio.

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
    and cfg.id = 1
$$;

grant execute on function public.presupuesto_publico(uuid) to anon, authenticated;


-- ---------- 2. Realtime de la lectura de fichas ----------
--
-- La pantalla "Leyendo la ficha" se quedaba girando para siempre.
-- No era el modelo ni la Edge Function: la publicacion supabase_realtime
-- no tenia NINGUNA tabla, asi que la suscripcion de seguirExtraccion se
-- conectaba bien y no recibia un solo evento. Recargar la pagina
-- funcionaba porque ahi el estado se consulta directo.
--
-- replica identity full ademas de publicar la tabla: sin eso el filtro
-- por id y el chequeo de RLS sobre el UPDATE no tienen contra que
-- evaluarse de forma confiable.

alter table public.ficha_extraccion replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ficha_extraccion'
  ) then
    alter publication supabase_realtime add table public.ficha_extraccion;
  end if;
end $$;
