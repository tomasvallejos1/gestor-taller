-- =============================================================
--  Datos fiscales de clientes + configuracion del taller
-- =============================================================

create type public.tipo_persona as enum ('fisica', 'juridica');

create type public.condicion_fiscal as enum (
  'responsable_inscripto',
  'monotributo',
  'exento',
  'consumidor_final',
  'no_alcanzado'
);

create type public.tipo_documento as enum ('dni', 'cuit', 'cuil');


-- ---------- Validacion de CUIT / CUIL ----------
--
-- El ultimo digito es un verificador calculado por modulo 11 sobre los
-- diez anteriores. Chequearlo atrapa el error mas comun --un digito
-- tipeado mal-- en el momento de la carga y no cuando el cliente recibe
-- un presupuesto con su CUIT equivocado.

create or replace function public.cuit_valido(p_cuit text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_num   text;
  v_pesos int[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  v_suma  int := 0;
  v_resto int;
  v_dv    int;
  i       int;
begin
  if p_cuit is null then return true; end if;

  v_num := regexp_replace(p_cuit, '[^0-9]', '', 'g');
  if length(v_num) <> 11 then return false; end if;

  -- Prefijos validos: 20/23/24/27 personas fisicas, 30/33/34 juridicas,
  -- 50..59 otros. Cualquier otro es un numero mal escrito.
  if substring(v_num, 1, 2) not in
     ('20','23','24','27','30','33','34','50','51','55','56','57','58','59')
  then
    return false;
  end if;

  for i in 1..10 loop
    v_suma := v_suma + (substring(v_num, i, 1))::int * v_pesos[i];
  end loop;

  v_resto := v_suma % 11;
  v_dv := case
            when v_resto = 0 then 0
            when v_resto = 1 then 9   -- convencion de AFIP
            else 11 - v_resto
          end;

  return v_dv = (substring(v_num, 11, 1))::int;
end;
$$;

comment on function public.cuit_valido(text) is
  'Verifica el digito verificador de un CUIT/CUIL por modulo 11. '
  'NULL se considera valido: el documento es opcional.';


-- ---------- Cliente ----------

alter table public.cliente
  add column tipo_persona     public.tipo_persona,
  add column condicion_fiscal public.condicion_fiscal,
  add column documento_tipo   public.tipo_documento,
  add column documento        text;

-- Se normaliza a solo digitos al guardar: asi "20-12345678-3" y
-- "20123456783" no conviven como dos clientes distintos.
create or replace function public.trg_normalizar_documento()
returns trigger
language plpgsql
as $$
begin
  if new.documento is not null then
    new.documento := regexp_replace(new.documento, '[^0-9]', '', 'g');
    if new.documento = '' then new.documento := null; end if;
  end if;

  -- Una persona juridica no tiene DNI ni CUIL.
  if new.tipo_persona = 'juridica' and new.documento_tipo in ('dni', 'cuil') then
    raise exception 'Una persona juridica se identifica con CUIT, no con %',
      upper(new.documento_tipo::text);
  end if;

  if new.documento is not null and new.documento_tipo in ('cuit', 'cuil')
     and not public.cuit_valido(new.documento) then
    raise exception 'El % % no es valido (fallo el digito verificador). Revisá los numeros.',
      upper(new.documento_tipo::text), new.documento;
  end if;

  if new.documento is not null and new.documento_tipo = 'dni'
     and length(new.documento) not between 7 and 8 then
    raise exception 'Un DNI tiene 7 u 8 digitos, y este tiene %', length(new.documento);
  end if;

  return new;
end;
$$;

create trigger cliente_normaliza_documento
  before insert or update on public.cliente
  for each row execute function public.trg_normalizar_documento();

-- Sin indice unico rigido: puede haber clientes cargados sin documento,
-- y un mismo CUIT podria repetirse por un alta duplicada que se corrige
-- despues. El indice sirve para buscar y para detectar duplicados.
create index cliente_documento_idx on public.cliente (documento)
  where documento is not null;


-- ---------- Configuracion del taller ----------
--
-- Tabla de una sola fila. El check sobre una constante fuerza que id
-- siempre valga 1, asi que no puede haber una segunda configuracion
-- "fantasma" que despues aparezca en un PDF.

create table public.configuracion (
  id                integer primary key default 1 check (id = 1),
  razon_social      text not null default 'Bobinados David',
  nombre_fantasia   text,
  cuit              text,
  condicion_fiscal  public.condicion_fiscal not null default 'monotributo',
  domicilio         text,
  localidad         text,
  telefono          text,
  email             text,

  -- IVA que se propone al crear un presupuesto. Un monotributista no
  -- discrimina IVA, asi que el default es 0.
  iva_por_defecto   numeric(5,2) not null default 0,
  vigencia_dias     smallint not null default 15,
  pie_presupuesto   text,

  actualizado_en    timestamptz not null default now()
);

insert into public.configuracion (id, razon_social, domicilio, localidad, telefono, email)
values (1, 'Bobinados David', '26 de Abril 97', 'Venado Tuerto, Santa Fe',
        '(3462) 55-3285', 'jdavid39val@yahoo.com.ar')
on conflict (id) do nothing;

create trigger configuracion_actualizada
  before update on public.configuracion
  for each row execute function public.tocar_actualizado_en();

alter table public.configuracion enable row level security;

-- La lee cualquiera autenticado (el formulario de presupuesto la
-- necesita); la edita solo un super.
create policy configuracion_lectura on public.configuracion
  for select using (public.esta_autenticado());
create policy configuracion_escritura on public.configuracion
  for all using (public.es_super()) with check (public.es_super());


-- ---------- Copia de datos fiscales en el presupuesto ----------
--
-- Un presupuesto ya emitido no puede cambiar porque alguien corrigio la
-- condicion fiscal del cliente seis meses despues. Se congela lo que
-- valia al emitirlo, igual que ya se hace con la descripcion y el
-- precio de cada item.

alter table public.presupuesto
  add column cliente_nombre           text,
  add column cliente_documento        text,
  add column cliente_documento_tipo   public.tipo_documento,
  add column cliente_condicion_fiscal public.condicion_fiscal;

create or replace function public.trg_congelar_cliente_presupuesto()
returns trigger
language plpgsql
as $$
declare
  c public.cliente;
begin
  -- Solo al pasar de borrador a emitido: mientras es borrador sigue los
  -- cambios del cliente, que es lo util para corregir.
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

create trigger presupuesto_congela_cliente
  before insert or update on public.presupuesto
  for each row execute function public.trg_congelar_cliente_presupuesto();
