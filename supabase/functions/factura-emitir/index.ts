/**
 * Emision de una factura: le pide el CAE a ARCA y lo persiste.
 *
 * El protocolo completo esta explicado en la migracion
 * 20260812000300_factura.sql, junto a `factura_secuencia` y las
 * funciones `tomar_turno_factura` / `anotar_intento_factura` /
 * `confirmar_factura` / `rechazar_factura`. El resumen:
 *
 *   1. Se toma un turno para el punto de venta (serializa emisiones
 *      concurrentes; el que pierde recibe 409).
 *   2. Se le pregunta a ARCA el ultimo numero autorizado.
 *   3. Se ESCRIBE el numero elegido en la factura ANTES de pedir el CAE.
 *      Esto es lo que hace recuperable un fallo a mitad de camino: si
 *      ARCA autoriza y la escritura de la confirmacion se pierde, queda
 *      una fila pendiente CON numero, y factura-reconciliar puede
 *      preguntarle a ARCA por ese numero exacto.
 *   4. Se pide el CAE.
 *   5. Se confirma o se rechaza, liberando el turno en los dos casos.
 *
 * Si la factura ya tenia un numero anotado de un intento anterior que
 * no llego a confirmarse ni rechazarse (la Edge Function se corto a
 * mitad de camino), este archivo reconcilia antes de intentar de nuevo:
 * nunca se vuelve a llamar FECAESolicitar para un numero ya anotado.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  leerContextoArca, fecompUltimoAutorizado, fecompConsultar, fecaeSolicitar, fechaArca,
} from '../_shared/deno/arca.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

// RG 5616. Validar contra FEParamGetCondicionIvaReceptor antes de
// confiar en esta tabla a ciegas si ARCA la actualiza.
const CONDICION_IVA_RECEPTOR: Record<string, number> = {
  responsable_inscripto: 1,
  exento: 4,
  consumidor_final: 5,
  monotributo: 6,
  no_alcanzado: 15,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ error: 'Metodo no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta autorizacion.' }, 401);

  const admin = createClient(url, servicio);

  const comoUsuario = createClient(url, anonKey, {
    global: { headers: { Authorization: autorizacion } },
  });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return responder({ error: 'Sesion invalida.' }, 401);

  const { data: rol } = await comoUsuario.rpc('rol_actual');
  if (rol !== 'super' && rol !== 'editor') {
    return responder({ error: 'Tu perfil no puede emitir facturas.' }, 403);
  }

  let cuerpo: { factura_id?: string };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Cuerpo invalido.' }, 400); }
  if (!cuerpo.factura_id) return responder({ error: 'Falta factura_id.' }, 400);

  const { data: f, error: eF } = await admin
    .from('factura')
    .select('*')
    .eq('id', cuerpo.factura_id)
    .maybeSingle();

  if (eF || !f) return responder({ error: 'No encontramos esa factura.' }, 404);

  if (f.estado === 'autorizada') {
    return responder({ cae: f.cae, cae_vencimiento: f.cae_vencimiento, numero: f.numero, ya_estaba: true });
  }
  if (f.estado === 'anulada') {
    return responder({ error: 'Esta factura esta anulada.' }, 409);
  }

  const { count } = await admin
    .from('factura_item').select('id', { count: 'exact', head: true }).eq('factura_id', f.id);
  if (!count) return responder({ error: 'La factura no tiene renglones cargados.' }, 400);
  if (!(Number(f.total) > 0)) return responder({ error: 'El total tiene que ser mayor que cero.' }, 400);

  let ctx;
  try {
    ctx = leerContextoArca();
  } catch (e) {
    return responder({ error: (e as Error).message }, 500);
  }

  // Reconciliacion antes de reintentar: si ya habia un numero anotado de
  // una corrida anterior que se corto, se pregunta por el en vez de
  // pedir uno nuevo.
  if (f.numero) {
    const consulta = await fecompConsultar(admin, ctx, f.punto_venta, f.cbte_tipo, f.numero);
    if (consulta) {
      await admin.rpc('confirmar_factura', {
        p_factura_id: f.id, p_cae: consulta.cae, p_cae_vto: consulta.caeVencimiento, p_obs: null,
      });
      return responder({ cae: consulta.cae, cae_vencimiento: consulta.caeVencimiento, numero: f.numero });
    }
    // ARCA no tiene nada para ese numero: no se consumio. Se libera
    // para que el intento de aca abajo pida uno de nuevo.
    await admin.rpc('rechazar_factura', {
      p_factura_id: f.id,
      p_errores: { motivo: 'numero anotado sin confirmar en ARCA; se libero para reintentar' },
    });
  }

  const { data: ultimoLocal, error: eTurno } = await admin.rpc('tomar_turno_factura', {
    p_factura_id: f.id, p_cbte_tipo: f.cbte_tipo, p_punto_venta: f.punto_venta,
  });
  if (eTurno) {
    const enCurso = eTurno.code === '55006' || /P0001|55006/.test(eTurno.message ?? '');
    return responder({ error: eTurno.message }, enCurso ? 409 : 500);
  }

  try {
    const ultimoArca = await fecompUltimoAutorizado(admin, ctx, f.punto_venta, f.cbte_tipo);
    const numero = Math.max(ultimoArca, Number(ultimoLocal) || 0) + 1;
    const cbteFecha = f.cbte_fecha ?? new Date().toISOString().slice(0, 10);

    await admin.rpc('anotar_intento_factura', {
      p_factura_id: f.id, p_numero: numero, p_cbte_fecha: cbteFecha,
    });

    const condicionIva = CONDICION_IVA_RECEPTOR[f.cliente_condicion_fiscal as string] ?? 5;

    const resultado = await fecaeSolicitar(admin, ctx, f.punto_venta, f.cbte_tipo, {
      concepto: f.concepto,
      docTipo: f.doc_tipo,
      docNro: f.doc_nro,
      cbteDesde: numero,
      cbteHasta: numero,
      cbteFch: fechaArca(cbteFecha),
      servDesde: f.concepto !== 1 ? fechaArca(f.serv_desde) : null,
      servHasta: f.concepto !== 1 ? fechaArca(f.serv_hasta) : null,
      vtoPago: f.concepto !== 1 ? fechaArca(f.vto_pago) : null,
      impTotal: Number(f.total),
      impNeto: Number(f.imp_neto),
      impIva: Number(f.imp_iva),
      moneda: f.moneda,
      cotizacion: Number(f.cotizacion),
      condicionIvaReceptorId: condicionIva,
    });

    if (resultado.resultado === 'A' && resultado.cae) {
      await admin.rpc('confirmar_factura', {
        p_factura_id: f.id,
        p_cae: resultado.cae,
        p_cae_vto: resultado.caeVencimiento,
        p_obs: resultado.observaciones,
      });
      return responder({ cae: resultado.cae, cae_vencimiento: resultado.caeVencimiento, numero });
    }

    await admin.rpc('rechazar_factura', {
      p_factura_id: f.id,
      p_errores: resultado.errores ?? resultado.observaciones ?? { motivo: 'ARCA rechazo sin detalle' },
    });
    return responder({
      error: 'ARCA rechazo el comprobante.',
      detalle: resultado.errores ?? resultado.observaciones,
    }, 422);
  } catch (e) {
    // Cualquier error de red o de ARCA a partir de aca deja la factura
    // en 'pendiente' con numero anotado (si llego a anotar_intento_factura)
    // o sin numero (si fallo antes). En ambos casos el proximo intento de
    // emitir o de reconciliar sabe que hacer.
    return responder({ error: (e as Error).message }, 502);
  }
});
