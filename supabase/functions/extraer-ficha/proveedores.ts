/**
 * Adaptadores de proveedor de vision.
 *
 * Los dos hacen lo mismo --mirar una foto y devolver JSON-- pero con
 * formatos de request distintos, asi que cada uno vive detras de la
 * misma interfaz y el orquestador no sabe cual esta usando.
 *
 *   A (principal): NVIDIA NIM, API compatible con OpenAI
 *   B (respaldo):  Gemini de Google
 *
 * Si A falla --sin clave, cuota agotada, timeout, JSON invalido-- se usa
 * B. Que un proveedor se caiga no deja al taller sin poder cargar fichas.
 *
 * Pero el respaldo NO espera a que A se de por vencido: ver
 * `extraerConRespaldo` al final. Esperar el timeout completo del
 * principal antes de intentar el respaldo es lo que hacia que una ficha
 * tardara dos minutos, y a veces que no saliera nunca.
 */

import { ESQUEMA, PROMPT, type Extraccion } from './esquema.ts';

export interface Resultado {
  extraccion: Extraccion;
  proveedor: string;
  modelo: string;
  tokensEntrada: number | null;
  tokensSalida: number | null;
}

export interface Proveedor {
  nombre: string;
  modelo: string;
  disponible(): boolean;
  extraer(base64: string, mimeType: string, tiempoMs: number): Promise<Resultado>;
}

/**
 * Un intento contra un proveedor, haya salido bien o mal.
 *
 * Se guarda junto con la ficha. Diagnosticar por que una lectura tardo
 * dos minutos requirio ir a buscar los logs de la plataforma y cruzarlos
 * a mano con las filas por timestamp; con esto, la fila sola cuenta la
 * historia: quien contesto, quien fallo, cuanto tardo cada uno.
 */
export interface Intento {
  proveedor: string;
  modelo: string;
  ms: number;
  ok: boolean;
  error?: string;
}

/**
 * Los modelos devuelven el JSON envuelto de formas distintas segun el dia:
 * a veces pelado, a veces en un bloque markdown, a veces con una frase
 * antes. Esto lo recupera igual en vez de tirar todo el trabajo por un
 * par de backticks.
 */
function extraerJson(texto: string): unknown {
  const limpio = texto.trim();

  try {
    return JSON.parse(limpio);
  } catch { /* sigue */ }

  const bloque = limpio.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (bloque) {
    try {
      return JSON.parse(bloque[1].trim());
    } catch { /* sigue */ }
  }

  // Ultimo recurso: el tramo entre la primera llave y la ultima.
  const desde = limpio.indexOf('{');
  const hasta = limpio.lastIndexOf('}');
  if (desde !== -1 && hasta > desde) {
    return JSON.parse(limpio.slice(desde, hasta + 1));
  }

  throw new Error('La respuesta del modelo no contenia JSON.');
}

function validar(dato: unknown): Extraccion {
  const o = dato as Partial<Extraccion>;
  if (!o || typeof o !== 'object') throw new Error('Respuesta vacia.');
  if (!Array.isArray(o.lineas)) throw new Error('La respuesta no trae "lineas".');
  return {
    lineas: o.lineas,
    legible: o.legible !== false,
    nota: typeof o.nota === 'string' ? o.nota : undefined,
  };
}

/**
 * Techo por intento.
 *
 * Estaba en 90s, que es mas de lo que la Edge Function entera puede
 * vivir si ademas hay que reintentar: el limite de reloj de pared son
 * 150s y dos intentos de 90 no entran. Medido en produccion, un
 * proveedor que va a contestar contesta en 21-27s; pasados los 45 no
 * esta lento, esta colgado, y lo unico que se logra esperandolo es
 * gastar el presupuesto que necesita el respaldo.
 */
const TIEMPO_LIMITE_MS = Number(Deno.env.get('EXTRACCION_TIMEOUT_MS') ?? '45000');

/**
 * Cuanta ventaja se le da al principal antes de largar el respaldo en
 * paralelo. Por debajo del tiempo tipico de respuesta (~25s) se estarian
 * pagando dos llamadas siempre; por encima del timeout no serviria de
 * nada. En 30s el principal gana solo en el caso normal, y el respaldo
 * arranca apenas la cosa se sale de lo normal.
 */
const ADELANTO_MS = Number(Deno.env.get('EXTRACCION_ADELANTO_MS') ?? '30000');

async function pedir(url: string, opciones: RequestInit, tiempoMs: number): Promise<Response> {
  const corte = AbortSignal.timeout(Math.max(1000, tiempoMs));
  const r = await fetch(url, { ...opciones, signal: corte });
  if (!r.ok) {
    const cuerpo = await r.text();
    throw new Error(`HTTP ${r.status}: ${cuerpo.slice(0, 400)}`);
  }
  return r;
}

// ---------------------------------------------------------------
//  A — NVIDIA NIM (compatible con OpenAI)
// ---------------------------------------------------------------

export function proveedorNim(): Proveedor {
  const clave = Deno.env.get('NVIDIA_API_KEY') ?? '';
  // El modelo se configura por variable de entorno porque los de NIM
  // llegan a fin de vida: llama-4-maverick murio el 2026-07-27 y la API
  // devuelve 410. Cambiarlo no deberia requerir tocar codigo.
  const modelo = Deno.env.get('NVIDIA_MODELO')
    ?? 'nvidia/nemotron-nano-12b-v2-vl';

  return {
    nombre: 'nvidia-nim',
    modelo,
    disponible: () => clave.length > 0,

    async extraer(base64, mimeType, tiempoMs) {
      const r = await pedir('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clave}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: modelo,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          }],
          // Temperatura baja: esto es transcripcion, no redaccion. No se
          // busca variedad, se busca leer lo que dice el papel.
          temperature: 0.1,
          top_p: 0.9,
          max_tokens: 4096,
          // NIM acepta el response_format de OpenAI. Si el modelo elegido
          // no lo soporta, la peticion falla y cae al respaldo; el
          // extractor tolerante de mas arriba cubre el resto de los casos.
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'ficha_motor', strict: true, schema: ESQUEMA },
          },
        }),
      }, tiempoMs);

      const j = await r.json();
      const texto = j.choices?.[0]?.message?.content;
      if (!texto) throw new Error('NIM no devolvio contenido.');

      return {
        extraccion: validar(extraerJson(texto)),
        proveedor: 'nvidia-nim',
        modelo,
        tokensEntrada: j.usage?.prompt_tokens ?? null,
        tokensSalida: j.usage?.completion_tokens ?? null,
      };
    },
  };
}

// ---------------------------------------------------------------
//  B — Gemini
// ---------------------------------------------------------------

/**
 * Modelos con vision que la cuenta tiene habilitados hoy, verificados
 * contra GET /v1beta/models. El orden es el sugerido: 3.6 flash es el
 * mas nuevo y el que mejor salio en la prueba; los lite son mas baratos
 * y los "preview" pueden desaparecer sin aviso.
 */
export const MODELOS_GEMINI = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
] as const;

/**
 * Cuanto razona el modelo antes de contestar: "minimal", "low", "medium"
 * o "high" (generation_config.thinking_level de la Interactions API).
 *
 * Vacio = como venia, con Gemini decidiendo solo. Y ese es el default a
 * proposito: medido en produccion, Gemini gasta 4000-5000 tokens de
 * salida contra los ~1000 de NIM, casi todos de "thought", asi que bajar
 * esto acorta la espera de verdad. Pero acorta pensando menos sobre
 * letra manuscrita, numeros tachados y comas que no son puntos, que es
 * justo la parte dificil. Una ficha lenta cuesta un minuto; una ficha
 * mal leida cuesta un motor rebobinado al pedo.
 *
 * O sea: se puede probar con GEMINI_THINKING=low y comparar contra las
 * fichas ya leidas --la transcripcion cruda queda guardada en
 * datos_json--, pero no se activa solo.
 */
const GEMINI_THINKING = (Deno.env.get('GEMINI_THINKING') ?? '').trim();

export function proveedorGemini(): Proveedor {
  const clave = Deno.env.get('GEMINI_API_KEY') ?? '';
  const modelo = Deno.env.get('GEMINI_MODELO') ?? MODELOS_GEMINI[0];

  return {
    nombre: 'gemini',
    modelo,
    disponible: () => clave.length > 0,

    async extraer(base64, mimeType, tiempoMs) {
      const r = await pedir('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'x-goog-api-key': clave, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelo,
          input: [
            { type: 'text', text: PROMPT },
            { type: 'image', data: base64, mime_type: mimeType },
          ],
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: ESQUEMA,
          },
          // Solo va si esta configurado: mandar generation_config vacio
          // es pedirle a la API que valide un objeto sin nada adentro.
          ...(GEMINI_THINKING
            ? { generation_config: { thinking_level: GEMINI_THINKING } }
            : {}),
        }),
      }, tiempoMs);

      const j = await r.json();

      // La respuesta viene como una lista de "steps". El primero es el
      // razonamiento del modelo (type "thought") y NO trae el JSON: hay
      // que buscar el de type "model_output". Tomar steps[0] a ciegas
      // devuelve el pensamiento y hace fallar el parseo.
      const pasos = Array.isArray(j.steps) ? j.steps : [];
      const salida = pasos.find((s: { type?: string }) => s.type === 'model_output');
      const texto = salida?.content
        ?.find((c: { type?: string }) => c.type === 'text')?.text
        // Variantes por si la API cambia de forma otra vez.
        ?? j.output_text
        ?? j.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!texto) {
        const tipos = pasos.map((s: { type?: string }) => s.type).join(',') || 'ninguno';
        throw new Error(
          `Gemini no devolvio texto (status "${j.status}", steps: ${tipos}).`,
        );
      }

      const uso = j.usage ?? {};
      return {
        extraccion: validar(extraerJson(texto)),
        proveedor: 'gemini',
        modelo,
        // Los tokens de "thought" se cobran y se cuentan aparte; se suman
        // a la salida para que el costo registrado sea el real.
        tokensEntrada: uso.total_input_tokens ?? null,
        tokensSalida: uso.total_output_tokens != null
          ? uso.total_output_tokens + (uso.total_thought_tokens ?? 0)
          : null,
      };
    },
  };
}

// ---------------------------------------------------------------
//  Orquestacion
// ---------------------------------------------------------------

/**
 * Orden de preferencia. Se puede dar vuelta por variable de entorno
 * --EXTRACCION_ORDEN="gemini,nvidia-nim"-- sin tocar codigo, porque cual
 * conviene primero cambia con la disponibilidad real de cada uno, y eso
 * no se sabe hasta mirar los logs de la semana.
 */
function proveedoresDisponibles(): Proveedor[] {
  const todos = [proveedorNim(), proveedorGemini()];
  const orden = (Deno.env.get('EXTRACCION_ORDEN') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  if (orden.length === 0) return todos.filter((p) => p.disponible());

  const preferidos = orden
    .map((n) => todos.find((p) => p.nombre === n))
    .filter((p): p is Proveedor => Boolean(p));
  const resto = todos.filter((p) => !preferidos.includes(p));

  return [...preferidos, ...resto].filter((p) => p.disponible());
}

interface Desenlace {
  indice: number;
  resultado?: Resultado;
  fallo?: string;
}

/**
 * Intenta con los proveedores disponibles y devuelve el primero que
 * funcione. Solo falla si fallan todos, y en ese caso informa que paso
 * con cada uno: "no anduvo" sin decir por que es inservible para
 * diagnosticar.
 *
 * NO es una cadena de respaldo pura. Antes lo era, y el costo estaba
 * medido en produccion: NIM se colgaba, se comia sus 90s de timeout
 * enteros, y recien ahi arrancaba Gemini --que despues contestaba en
 * 21s--. Total: 117s de reloj para 21s de trabajo. Peor todavia, en la
 * corrida del 18/08 esos 90s desperdiciados hicieron que la Edge
 * Function pasara los 150s de reloj de pared y la mataran a mitad de
 * camino: la fila quedo en 'procesando' para siempre y la pantalla
 * girando sin fin.
 *
 * Asi que el respaldo arranca por adelantado: si el principal no
 * contesto en ADELANTO_MS, el segundo sale en paralelo y gana el que
 * llegue primero. En el caso normal el principal contesta antes y el
 * respaldo nunca se lanza --no hay costo extra--; en el caso malo se
 * paga una llamada de mas y se ahorra un minuto de reloj.
 *
 * `presupuestoMs` es el techo total: ningun intento se lanza ni se
 * extiende mas alla de el, para que la funcion siempre llegue viva a
 * escribir el resultado en la fila.
 *
 * `bitacora`, si se pasa, se va llenando con un registro por intento.
 * Queda guardada con la ficha para no tener que reconstruir a mano que
 * paso la proxima vez que algo tarde de mas.
 */
export async function extraerConRespaldo(
  base64: string,
  mimeType: string,
  presupuestoMs: number,
  bitacora?: Intento[],
): Promise<Resultado> {
  const disponibles = proveedoresDisponibles();

  if (disponibles.length === 0) {
    throw new Error(
      'No hay ningun proveedor configurado. Falta NVIDIA_API_KEY o GEMINI_API_KEY '
      + 'en los secretos del proyecto.',
    );
  }

  const vence = Date.now() + presupuestoMs;
  const fallos: string[] = [];
  const enVuelo = new Map<number, Promise<Desenlace>>();
  let proximo = 0;

  const lanzar = () => {
    const indice = proximo++;
    const p = disponibles[indice];
    const inicio = Date.now();
    // Ningun intento puede sobrevivir al presupuesto global.
    const tiempoMs = Math.min(TIEMPO_LIMITE_MS, vence - inicio);

    enVuelo.set(indice, p.extraer(base64, mimeType, tiempoMs).then(
      (resultado) => {
        const ms = Date.now() - inicio;
        console.log(`${p.nombre} (${p.modelo}) respondio en ${ms}ms`);
        bitacora?.push({ proveedor: p.nombre, modelo: p.modelo, ms, ok: true });
        return { indice, resultado };
      },
      (e) => {
        const ms = Date.now() - inicio;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`${p.nombre} fallo a los ${ms}ms: ${msg}`);
        bitacora?.push({
          proveedor: p.nombre, modelo: p.modelo, ms, ok: false, error: msg.slice(0, 300),
        });
        return { indice, fallo: `${p.nombre}: ${msg}` };
      },
    ));
  };

  lanzar();

  while (enVuelo.size > 0) {
    const quedanSinLanzar = proximo < disponibles.length;

    // Los que estan en vuelo corren contra el reloj del adelanto. Si gana
    // el reloj se suma el proveedor siguiente SIN cancelar a los que ya
    // estan: a partir de ahi puede contestar cualquiera de los dos.
    let reloj: number | undefined;
    const carrera: Promise<Desenlace | 'adelanto'>[] = [...enVuelo.values()];
    if (quedanSinLanzar) {
      const espera = Math.max(0, Math.min(ADELANTO_MS, vence - Date.now()));
      carrera.push(new Promise<'adelanto'>((resolver) => {
        reloj = setTimeout(() => resolver('adelanto'), espera);
      }));
    }

    const ganador = await Promise.race(carrera);
    if (reloj !== undefined) clearTimeout(reloj);

    if (ganador === 'adelanto') {
      console.log(`Sin respuesta en ${ADELANTO_MS}ms: se larga el respaldo en paralelo.`);
      lanzar();
      continue;
    }

    enVuelo.delete(ganador.indice);
    if (ganador.resultado) return ganador.resultado;

    fallos.push(ganador.fallo!);
    // Uno menos que puede contestar: si queda alguno sin lanzar, va ahora.
    if (quedanSinLanzar) lanzar();
  }

  throw new Error(`Fallaron todos los proveedores. ${fallos.join(' | ')}`);
}
