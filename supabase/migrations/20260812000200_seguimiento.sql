-- =============================================================
--  Consulta publica de estado, con segundo factor
--
--  Hasta aca /estado pedia solo el numero de orden. Los numeros son un
--  correlativo, asi que escribiendo 1, 2, 3 cualquiera recorria las
--  ordenes del taller de a una.
--
--  El apellido no es un secreto fuerte --el que trajo el motor lo
--  sabe, y el que no, lo puede adivinar-- pero convierte la enumeracion
--  en un producto cartesiano, y es lo unico que el cliente tiene a mano
--  cuando llama desde la vereda. Es el nivel de friccion correcto para
--  lo que hay del otro lado: un estado y dos links.
--
--  Lo que se devuelve es deliberadamente pobre: numero, estado, fechas
--  y los links a los documentos que ya son publicos de por si. Ni la
--  descripcion del motor, ni el problema, ni el diagnostico, ni las
--  notas internas.
-- =============================================================

-- En Supabase las extensiones viven en el schema `extensions`, no en
-- public. Por eso el `set search_path` de las funciones de abajo lo
-- incluye.
create extension if not exists unaccent with schema extensions;


-- Deja una palabra en minusculas, sin acentos y sin puntuacion, para
-- poder comparar "Pérez", "PEREZ," y "perez" como la misma cosa.
--
-- STABLE y no IMMUTABLE: unaccent() depende del diccionario instalado.
-- Declararla immutable seria mentir, y aca no se indexa nada con ella,
-- asi que no hace falta.
create or replace function public.normalizar_palabra(p text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select regexp_replace(lower(unaccent(coalesce(p, ''))), '[^a-z0-9]', '', 'g')
$$;


-- La firma vieja se ELIMINA, no se deja al lado. PostgREST resuelve por
-- nombre de argumento: si consultar_estado(bigint) sigue existiendo,
-- cualquiera la sigue llamando y el segundo factor no sirve de nada.
drop function if exists public.consultar_estado(bigint);

create or replace function public.consultar_estado(
  p_numero   bigint,
  p_apellido text
)
returns jsonb
language sql
security definer
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'numero',  r.numero,
    'estado',  r.estado,
    'ingreso', r.ingreso,
    'egreso',  r.egreso,

    -- Solo el token y el numero de comprobante. El detalle y los
    -- importes se ven entrando al link, que es el mismo que el taller
    -- manda por WhatsApp.
    'presupuesto', (
      select jsonb_build_object(
               'token',       p.token_publico,
               'comprobante', public.numero_comprobante(p.punto_venta, p.numero))
      from public.presupuesto p
      where p.reparacion_id = r.id
      order by p.creado_en desc
      limit 1
    ),
    'remito', (
      select jsonb_build_object(
               'token',       x.token_publico,
               'comprobante', public.numero_comprobante(x.punto_venta, x.numero))
      from public.remito x
      where x.reparacion_id = r.id
      limit 1
    )
  )
  from public.reparacion r
  -- INNER join: sin cliente no hay segundo factor, y sin segundo factor
  -- no se contesta. Las ordenes viejas cargadas sin cliente dejan de
  -- poder consultarse hasta que se les asigne uno.
  join public.cliente c on c.id = r.cliente_id
  where r.numero = p_numero
    -- "de", "la", "y" matchearian medio padron.
    and length(public.normalizar_palabra(p_apellido)) >= 3
    -- Se compara contra CADA palabra del nombre porque el padron real
    -- tiene "Juan Perez", "PEREZ, Juan", "Maria Jose Gonzalez Lopez" y
    -- "Bobinados del Sur SRL".
    and public.normalizar_palabra(p_apellido) = any (
      select public.normalizar_palabra(w)
      from unnest(regexp_split_to_array(c.nombre, '\s+')) w
    )
$$;

-- Numero equivocado, apellido equivocado o los dos dan el mismo
-- resultado: cero filas. Es una sola condicion conjunta, sin ramas ni
-- salidas tempranas, justamente para que no haya forma de distinguir
-- "esa orden no existe" de "existe pero el apellido no coincide".
--
-- No convertir esto despues en un plpgsql que devuelva temprano cuando
-- no encuentra el numero: eso reintroduce el oraculo de existencia y
-- ademas abre un canal por tiempo de respuesta.
comment on function public.consultar_estado(bigint, text) is
  'Consulta publica de /estado. Requiere numero de orden Y apellido del '
  'cliente. Devuelve el mismo resultado vacio ante cualquier fallo.';

grant execute on function public.consultar_estado(bigint, text) to anon, authenticated;
