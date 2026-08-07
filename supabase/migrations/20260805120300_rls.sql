-- =============================================================
--  Row Level Security
--
--  Modelo de permisos:
--    lector  -> consulta tecnica. Ve motores, fichas, clientes y
--               reparaciones. NO ve precios ni presupuestos.
--    editor  -> lo anterior + alta/edicion de todo el dominio,
--               incluidos presupuestos y catalogo.
--    super   -> todo + gestion de usuarios.
--
--  Lo publico (landing, consulta de estado, link de presupuesto) NO se
--  resuelve abriendo policies a `anon`. Se expone por funciones
--  SECURITY DEFINER que devuelven exactamente los campos necesarios;
--  ver el final del archivo. Abrir la tabla entera a anonimo para que
--  un cliente vea el estado de su motor filtraria el padron completo.
-- =============================================================

alter table public.perfil            enable row level security;
alter table public.cliente           enable row level security;
alter table public.motor             enable row level security;
alter table public.motor_circuito    enable row level security;
alter table public.bobinado_seccion  enable row level security;
alter table public.motor_foto        enable row level security;
alter table public.reparacion        enable row level security;
alter table public.ficha_extraccion  enable row level security;
alter table public.catalogo_item     enable row level security;
alter table public.presupuesto       enable row level security;
alter table public.presupuesto_item  enable row level security;


-- ---------- Perfil ----------
-- Cada uno ve y edita el suyo; super ve y edita todos.
-- El rol NO se puede auto-modificar: la policy de update para el propio
-- perfil pasa por una funcion que preserva el rol previo.

create policy perfil_select_propio on public.perfil
  for select using (id = auth.uid() or public.es_super());

create policy perfil_update_propio on public.perfil
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy perfil_super_todo on public.perfil
  for all using (public.es_super()) with check (public.es_super());

-- Impide la escalada de privilegios: sin esto, `perfil_update_propio`
-- permitiria a un lector hacerse super con un solo UPDATE.
create or replace function public.trg_perfil_protege_rol()
returns trigger
language plpgsql
as $$
begin
  if not public.es_super() and new.rol is distinct from old.rol then
    raise exception 'No podes cambiar tu propio rol';
  end if;
  if not public.es_super() and new.activo is distinct from old.activo then
    raise exception 'No podes cambiar tu estado de activacion';
  end if;
  return new;
end;
$$;

create trigger perfil_protege_rol
  before update on public.perfil
  for each row execute function public.trg_perfil_protege_rol();


-- ---------- Dominio tecnico: lectura para todo usuario activo ----------

create policy cliente_select on public.cliente
  for select using (public.esta_autenticado());
create policy cliente_escribe on public.cliente
  for all using (public.es_editor()) with check (public.es_editor());

create policy motor_select on public.motor
  for select using (public.esta_autenticado());
create policy motor_escribe on public.motor
  for all using (public.es_editor()) with check (public.es_editor());

create policy circuito_select on public.motor_circuito
  for select using (public.esta_autenticado());
create policy circuito_escribe on public.motor_circuito
  for all using (public.es_editor()) with check (public.es_editor());

create policy seccion_select on public.bobinado_seccion
  for select using (public.esta_autenticado());
create policy seccion_escribe on public.bobinado_seccion
  for all using (public.es_editor()) with check (public.es_editor());

create policy foto_select on public.motor_foto
  for select using (public.esta_autenticado());
create policy foto_escribe on public.motor_foto
  for all using (public.es_editor()) with check (public.es_editor());

create policy reparacion_select on public.reparacion
  for select using (public.esta_autenticado());
create policy reparacion_escribe on public.reparacion
  for all using (public.es_editor()) with check (public.es_editor());


-- ---------- Extracciones ----------
-- Cada uno ve las suyas; super ve todas (para auditar consumo de API).

create policy extraccion_select on public.ficha_extraccion
  for select using (creado_por = auth.uid() or public.es_super());
create policy extraccion_escribe on public.ficha_extraccion
  for all using (public.es_editor() and (creado_por = auth.uid() or public.es_super()))
  with check (public.es_editor());


-- ---------- Plata: solo editor y super ----------

create policy catalogo_select on public.catalogo_item
  for select using (public.es_editor());
create policy catalogo_escribe on public.catalogo_item
  for all using (public.es_editor()) with check (public.es_editor());

create policy presupuesto_select on public.presupuesto
  for select using (public.es_editor());
create policy presupuesto_escribe on public.presupuesto
  for all using (public.es_editor()) with check (public.es_editor());

create policy presupuesto_item_select on public.presupuesto_item
  for select using (public.es_editor());
create policy presupuesto_item_escribe on public.presupuesto_item
  for all using (public.es_editor()) with check (public.es_editor());


-- =============================================================
--  Acceso publico controlado
-- =============================================================

-- Consulta de estado de reparacion (pagina /estado).
-- Devuelve el minimo indispensable: ni datos del cliente, ni el detalle
-- tecnico del motor, ni notas internas. Solo lo que el dueño del motor
-- necesita para saber si puede pasar a buscarlo.
create or replace function public.consultar_estado(p_numero bigint)
returns table (
  numero      bigint,
  estado      public.estado_reparacion,
  ingreso     date,
  egreso      date,
  descripcion text
)
language sql
security definer
stable
set search_path = public
as $$
  select r.numero, r.estado, r.ingreso, r.egreso, m.descripcion
  from public.reparacion r
  left join public.motor m on m.id = r.motor_id
  where r.numero = p_numero
$$;

grant execute on function public.consultar_estado(bigint) to anon, authenticated;


-- Presupuesto por link compartible.
-- Se busca por token_publico (uuid aleatorio), nunca por numero: eso haria
-- que /p/1, /p/2, /p/3 revelen todos los presupuestos del taller.
create or replace function public.presupuesto_publico(p_token uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'numero',   p.numero,
    'estado',   p.estado,
    'creado_en', p.creado_en,
    'vigencia_dias', p.vigencia_dias,
    'subtotal', p.subtotal,
    'descuento', p.descuento,
    'iva_pct',  p.iva_pct,
    'total',    p.total,
    'notas',    p.notas,
    'cliente',  c.nombre,
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
  where p.token_publico = p_token
    and p.estado <> 'borrador'   -- un borrador no se comparte
$$;

grant execute on function public.presupuesto_publico(uuid) to anon, authenticated;


-- =============================================================
--  Storage
-- =============================================================

insert into storage.buckets (id, name, public)
values ('fichas', 'fichas', false), ('presupuestos', 'presupuestos', false)
on conflict (id) do nothing;

-- Buckets privados: se sirven por signed URL con vencimiento. Un bucket
-- publico haria que la foto de una ficha (con el nombre del cliente
-- escrito arriba) quede accesible para cualquiera con la URL, para siempre.

create policy fichas_lectura on storage.objects
  for select using (bucket_id = 'fichas' and public.esta_autenticado());

create policy fichas_escritura on storage.objects
  for insert with check (bucket_id = 'fichas' and public.es_editor());

create policy fichas_borrado on storage.objects
  for delete using (bucket_id = 'fichas' and public.es_editor());

create policy presupuestos_lectura on storage.objects
  for select using (bucket_id = 'presupuestos' and public.es_editor());

create policy presupuestos_escritura on storage.objects
  for insert with check (bucket_id = 'presupuestos' and public.es_editor());
