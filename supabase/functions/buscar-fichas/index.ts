/**
 * Busqueda de fichas en lenguaje natural.
 *
 * Traduce "los trifasicos de 5hp que rebobinamos para Gonzalez" a los
 * filtros que la pantalla de motores ya sabe aplicar. NO busca: traduce.
 * La consulta la sigue haciendo el navegador contra la base, con las
 * policies del usuario, igual que si hubiera tocado los filtros a mano.
 *
 * Esa separacion es a proposito y es lo que hace la funcion segura y
 * barata: el modelo nunca ve una ficha, nunca ve un cliente, y no puede
 * devolver resultados inventados. Lo peor que puede pasar es que traduzca
 * mal, y para eso la pantalla muestra lo que entendio como fichas
 * removibles: si puso "Czerweny" donde iba "Czerweny 5HP", se ve y se
 * saca de un toque.
 *
 * Si el modelo falla, se cae de pie: devuelve la frase entera como
 * busqueda de texto, que es lo que la pantalla habria hecho sin IA.
 * Nunca deja al usuario sin resultados por un problema del proveedor.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

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

/** Los campos que `listarMotores` sabe aplicar. Nada mas que esto. */
const ESQUEMA = {
  type: 'object',
  properties: {
    nro: { type: ['string', 'null'], description: 'Numero de ficha, solo digitos' },
    marca: { type: ['string', 'null'] },
    modelo: { type: ['string', 'null'] },
    hp: { type: ['string', 'null'], description: 'Potencia tal como se escribe: "5", "1/2", "0,5"' },
    tipo: { type: ['string', 'null'], description: 'Tipo electrico o aplicacion' },
    duenio: { type: ['string', 'null'], description: 'Apellido o nombre del cliente' },
    texto: { type: ['string', 'null'], description: 'Lo que no entro en ningun campo' },
  },
  required: ['nro', 'marca', 'modelo', 'hp', 'tipo', 'duenio', 'texto'],
  additionalProperties: false,
} as const;

const PROMPT = `Sos el traductor de busquedas de un taller de bobinado de motores electricos en Argentina.
Convertis lo que escribe el usuario en filtros. Devolves SOLO el JSON del esquema.

Los campos:
- nro: numero de ficha. Solo si el usuario habla de la ficha o la orden ("la 42", "ficha 7").
- marca: fabricante del motor (Czerweny, WEG, Siemens, Motorarg...).
- modelo: designacion del modelo, si la nombra.
- hp: potencia. Se copia como la dice: "5", "1/2", "0,5", "3/4". Sin la palabra HP.
- tipo: tipo electrico (monofasico, trifasico) O para que se usa (bombeador, batidor,
  ventilador, compresor). Va uno solo; si dice los dos, poné el tipo electrico.
- duenio: nombre o apellido del CLIENTE. Solo cuando queda claro que habla de una persona
  o empresa duenia del motor ("de Gonzalez", "los del molino San Jose", "para Perez").
- texto: lo que quede y sea util para buscar en la descripcion. Si toda la frase entro en
  los otros campos, devolve null. Nunca repitas aca algo que ya pusiste en otro campo.

Reglas:
- El campo que no aplica va en null. No inventes valores.
- No agregues palabras que el usuario no escribio.
- "rebobinamos", "arreglamos", "entraron", "hicimos" son ruido: no van a ningun campo.`;

/** El JSON puede venir pelado, en un bloque markdown o con una frase antes. */
function extraerJson(texto: string): Record<string, unknown> {
  const limpio = texto.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const desde = limpio.indexOf('{');
  const hasta = limpio.lastIndexOf('}');
  if (desde === -1 || hasta === -1) throw new Error('sin JSON en la respuesta');
  return JSON.parse(limpio.slice(desde, hasta + 1));
}

async function traducir(texto: string) {
  const clave = Deno.env.get('GEMINI_API_KEY') ?? '';
  const modelo = Deno.env.get('GEMINI_MODELO') ?? 'gemini-3.6-flash';
  if (!clave) throw new Error('Falta GEMINI_API_KEY.');

  const control = new AbortController();
  // Una busqueda que tarda mas que escribir los filtros a mano no sirve.
  const reloj = setTimeout(() => control.abort(), 12_000);

  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': clave, 'Content-Type': 'application/json' },
      signal: control.signal,
      body: JSON.stringify({
        model: modelo,
        input: [
          { type: 'text', text: PROMPT },
          { type: 'text', text: `Busqueda: ${texto}` },
        ],
        response_format: { type: 'text', mime_type: 'application/json', schema: ESQUEMA },
        // Traducir una frase corta a siete campos no necesita que el
        // modelo razone: lo unico que agrega es espera.
        generation_config: { thinking_level: 'minimal' },
      }),
    });

    if (!r.ok) throw new Error(`Gemini respondio ${r.status}`);

    const j = await r.json();
    const pasos = Array.isArray(j.steps) ? j.steps : [];
    const salida = pasos.find((s: { type?: string }) => s.type === 'model_output');
    const crudo = salida?.content?.find((c: { type?: string }) => c.type === 'text')?.text
      ?? j.output_text
      ?? j.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!crudo) throw new Error('Gemini no devolvio texto');
    return extraerJson(crudo);
  } finally {
    clearTimeout(reloj);
  }
}

/** Deja solo campos con contenido y recorta lo que venga desmedido. */
function limpiar(bruto: Record<string, unknown>) {
  const campos = ['nro', 'marca', 'modelo', 'hp', 'tipo', 'duenio', 'texto'];
  const filtros: Record<string, string> = {};

  for (const campo of campos) {
    const v = bruto[campo];
    if (typeof v !== 'string') continue;
    const limpio = v.trim().slice(0, 60);
    // "null" y "ninguno" como texto aparecen cuando el modelo contesta
    // en prosa el campo que deberia haber dejado vacio.
    if (!limpio || /^(null|none|ninguno|n\/a|-)$/i.test(limpio)) continue;
    filtros[campo] = limpio;
  }
  if (filtros.nro) filtros.nro = filtros.nro.replace(/\D/g, '');
  if (filtros.nro === '') delete filtros.nro;

  return filtros;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ error: 'Metodo no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const autorizacion = req.headers.get('Authorization');
  if (!autorizacion) return responder({ error: 'Falta autorizacion.' }, 401);

  const comoUsuario = createClient(url, anonKey, {
    global: { headers: { Authorization: autorizacion } },
  });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return responder({ error: 'Sesion invalida.' }, 401);

  let cuerpo: { texto?: string };
  try { cuerpo = await req.json(); } catch { return responder({ error: 'Cuerpo invalido.' }, 400); }

  const texto = (cuerpo.texto ?? '').trim().slice(0, 300);
  if (!texto) return responder({ error: 'Escribi que estas buscando.' }, 400);

  try {
    const filtros = limpiar(await traducir(texto));
    // Si no entendio ningun campo, la frase entera como texto es mejor
    // que devolver la lista sin filtrar.
    if (Object.keys(filtros).length === 0) {
      return responder({ filtros: { texto }, degradado: true });
    }
    return responder({ filtros });
  } catch (e) {
    return responder({
      filtros: { texto },
      degradado: true,
      motivo: (e as Error).message,
    });
  }
});
