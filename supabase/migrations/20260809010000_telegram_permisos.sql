-- ============================================================
--  Cerrar generar_codigo_telegram a los anonimos
-- ============================================================
--
-- Postgres le da EXECUTE a PUBLIC por defecto a toda funcion nueva, y el
-- `grant ... to authenticated` de la migracion anterior no lo saca: lo
-- suma. Resultado: anon tambien podia llamarla.
--
-- La funcion se defiende sola --aborta si auth.uid() es null-- asi que
-- no habia forma de sacarle un codigo. Pero es SECURITY DEFINER y
-- escribe en perfil: que un anonimo ni siquiera pueda invocarla es una
-- linea de defensa que no cuesta nada y no depende de que el guard de
-- adentro siga estando ahi el dia que alguien edite el cuerpo.

revoke execute on function public.generar_codigo_telegram() from public, anon;
grant execute on function public.generar_codigo_telegram() to authenticated;
