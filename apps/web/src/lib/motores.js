import { supabase } from './supabase';
import * as datos from '@shared/datos-motores.js';

/**
 * Acceso a datos de motores, desde el navegador.
 *
 * Las consultas viven en _shared/datos-motores.js, que tambien usa el bot
 * de Telegram. Aca solo se les ata el cliente con la sesion del usuario,
 * para que las paginas sigan llamando `listarMotores(filtros)` sin tener
 * que pasarlo en cada lugar.
 */

export const listarMotores = (filtros) => datos.listarMotores(supabase, filtros);
export const obtenerMotor = (nroOId) => datos.obtenerMotor(supabase, nroOId);
export const guardarMotor = (motor) => datos.guardarMotor(supabase, motor);
export const eliminarMotor = (id) => datos.eliminarMotor(supabase, id);

// No toca la base: se reexporta tal cual.
export const { etiquetaPotencia } = datos;
