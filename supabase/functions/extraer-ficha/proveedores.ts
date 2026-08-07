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
 * Si A falla --sin clave, cuota agotada, timeout, JSON invalido-- se
 * intenta con B automaticamente. Que un proveedor se caiga no deja al
 * taller sin poder cargar fichas.
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
  extraer(base64: string, mimeType: string): Promise<Resultado>;
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

const TIEMPO_LIMITE_MS = 90_000;

async function pedir(url: string, opciones: RequestInit): Promise<Response> {
  const corte = AbortSignal.timeout(TIEMPO_LIMITE_MS);
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

    async extraer(base64, mimeType) {
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
      });

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

export function proveedorGemini(): Proveedor {
  const clave = Deno.env.get('GEMINI_API_KEY') ?? '';
  const modelo = Deno.env.get('GEMINI_MODELO') ?? MODELOS_GEMINI[0];

  return {
    nombre: 'gemini',
    modelo,
    disponible: () => clave.length > 0,

    async extraer(base64, mimeType) {
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
        }),
      });

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

/**
 * Intenta con cada proveedor disponible en orden y devuelve el primero
 * que funcione. Solo falla si fallan todos, y en ese caso informa que
 * paso con cada uno: "no anduvo" sin decir por que es inservible para
 * diagnosticar.
 */
export async function extraerConRespaldo(
  base64: string,
  mimeType: string,
): Promise<Resultado> {
  const candidatos = [proveedorNim(), proveedorGemini()];
  const disponibles = candidatos.filter((p) => p.disponible());

  if (disponibles.length === 0) {
    throw new Error(
      'No hay ningun proveedor configurado. Falta NVIDIA_API_KEY o GEMINI_API_KEY '
      + 'en los secretos del proyecto.',
    );
  }

  const fallos: string[] = [];

  for (const p of disponibles) {
    try {
      const inicio = Date.now();
      const r = await p.extraer(base64, mimeType);
      console.log(`${p.nombre} (${p.modelo}) respondio en ${Date.now() - inicio}ms`);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${p.nombre} fallo: ${msg}`);
      fallos.push(`${p.nombre}: ${msg}`);
    }
  }

  throw new Error(`Fallaron todos los proveedores. ${fallos.join(' | ')}`);
}
