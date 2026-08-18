-- ============================================================
--  telegram_id solo se escribe por el camino que prueba el vinculo
-- ============================================================
--
-- La policy perfil_update_propio deja a cualquiera editar su propia fila
-- entera, columna por columna, porque las policies de RLS son por FILA,
-- no por columna. Eso significa que hoy, con solo el cliente de
-- Supabase en la consola del navegador, un usuario logueado puede hacer
--
--   supabase.from('perfil').update({ telegram_id: 123456789 })
--
-- y listo: se asigna un telegram_id sin haber probado nunca que controla
-- ese chat de Telegram. Eso vuelve inutil el codigo de 6 digitos: el
-- vinculo dejaria de significar "esta persona escribio desde ese chat" y
-- pasaria a significar solo "alguien logueado eligio este numero".
--
-- El indice unico (perfil_telegram_id_unico) evita que dos perfiles
-- terminen con el mismo telegram_id, pero no evita que alguien ocupe por
-- adelantado el telegram_id de otra persona antes de que esa persona se
-- vincule de verdad --y ahi los mensajes de esa persona en Telegram
-- terminarian atendidos como si fueran del perfil equivocado--.
--
-- El arreglo: un authenticated puede LIMPIAR su propio telegram_id
-- (desvincularse no tiene riesgo, es sacar acceso), pero no puede
-- ASIGNARLO directamente. Asignar uno nuevo solo pasa por
-- vincular_telegram(), que el bot llama con service_role despues de
-- validar el codigo.

create or replace function public.proteger_telegram_id()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated'
     and new.telegram_id is not null
     and new.telegram_id is distinct from old.telegram_id then
    raise exception 'El telegram_id solo se asigna vinculando la cuenta desde el bot.';
  end if;
  return new;
end;
$$;

drop trigger if exists perfil_proteger_telegram_id on public.perfil;
create trigger perfil_proteger_telegram_id
  before update on public.perfil
  for each row
  execute function public.proteger_telegram_id();
