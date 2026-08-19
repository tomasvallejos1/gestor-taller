-- =============================================================
--  "tarjeta", a secas
--
--  El enum ya tenia `debito` y `credito`. En el mostrador esa
--  distincion no se hace: el cliente apoya la tarjeta, el posnet
--  cobra y lo que al taller le importa es que esa venta lleva
--  recargo de servicio. Pedirle a quien cobra que ademas elija
--  entre dos tarjetas es un toque de mas para un dato que despues
--  nadie mira.
--
--  Los dos valores viejos se dejan: hay remitos emitidos que los
--  usan y Postgres no permite sacar valores de un enum sin
--  recrear el tipo. Simplemente no se ofrecen mas en la interfaz.
--
--  Va en una migracion propia porque un valor nuevo de enum no se
--  puede usar en la misma transaccion en la que se agrega, y la
--  tabla `pago` de la migracion que sigue lo necesita disponible.
-- =============================================================

alter type public.medio_pago add value if not exists 'tarjeta';
