import { supabase } from './supabase';
import { comprimirImagen } from './fotos';
import { armarSecciones, parsearNumero, parsearEntero, parsearAlambre, parsearAbertura } from '@shared/parseo.js';
import { mapearLineas } from '@shared/mapeo-ficha.js';

const BUCKET = 'fichas';

/**
 * Sube la foto de una ficha y dispara la extraccion.
 * Devuelve la fila de ficha_extraccion; el resultado llega despues,
 * por Realtime o por consulta.
 */
export async function cargarFichaPorFoto(archivo, { origen = 'web' } = {}) {
  const { blob } = await comprimirImagen(archivo);

  const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
  const ruta = `extracciones/${crypto.randomUUID()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET).upload(ruta, blob, { contentType: blob.type });
  if (errorSubida) throw errorSubida;

  const { data: { user } } = await supabase.auth.getUser();

  const { data: fila, error } = await supabase
    .from('ficha_extraccion')
    .insert({ storage_path: ruta, origen, creado_por: user?.id })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([ruta]);
    throw error;
  }

  // No se espera la respuesta: la extraccion tarda entre 15 y 40
  // segundos y bloquear la interfaz todo ese rato no aporta nada. El
  // estado se sigue por Realtime.
  supabase.functions.invoke('extraer-ficha', { body: { extraccion_id: fila.id } })
    .catch((e) => console.error('No se pudo disparar la extraccion:', e));

  return fila;
}

export async function obtenerExtraccion(id) {
  const { data, error } = await supabase
    .from('ficha_extraccion').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Estados en los que la lectura ya termino y hay algo que hacer. */
const ESTADOS_FINALES = new Set(['revision', 'error', 'confirmada']);

const SONDEO_MS = 3000;

/**
 * Espera a que termine la lectura de una ficha.
 *
 * Realtime solo no alcanza. Antes esto era una suscripcion pelada y la
 * pantalla se quedaba girando para siempre por dos motivos distintos:
 * la tabla no estaba publicada en supabase_realtime (arreglado en la
 * migracion 20260808000000), y ademas el websocket se corta solo en un
 * celular --pantalla apagada, cambio de wifi a datos, señal de taller--.
 * Lo primero se arreglo una vez; lo segundo va a seguir pasando.
 *
 * Asi que hay dos caminos hacia el mismo resultado: Realtime avisa al
 * instante cuando funciona, y un sondeo cada 3 segundos garantiza que la
 * pantalla avance igual cuando no. El que llega primero corta al otro.
 *
 * `alCambiar` se llama una sola vez, con la fila ya en estado final.
 */
export function seguirExtraccion(id, alCambiar) {
  let vivo = true;
  let temporizador = null;
  let canal = null;

  const soltar = () => {
    vivo = false;
    clearTimeout(temporizador);
    if (canal) supabase.removeChannel(canal);
  };

  const resolver = (fila) => {
    if (!vivo || !fila || !ESTADOS_FINALES.has(fila.estado)) return;
    soltar();
    alCambiar(fila);
  };

  canal = supabase
    .channel(`extraccion-${id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'ficha_extraccion',
      filter: `id=eq.${id}`,
    }, (evento) => resolver(evento.new))
    .subscribe();

  const sondear = async () => {
    if (!vivo) return;
    try {
      resolver(await obtenerExtraccion(id));
    } catch {
      // Un sondeo que falla no es un error del flujo: puede ser el
      // ascensor o el tunel. Se reintenta en el proximo ciclo.
    }
    if (vivo) temporizador = setTimeout(sondear, SONDEO_MS);
  };
  temporizador = setTimeout(sondear, SONDEO_MS);

  return soltar;
}

export async function confirmarExtraccion(id, datos) {
  const { data, error } = await supabase.rpc('confirmar_extraccion', {
    p_extraccion_id: id,
    p_datos: datos,
  });
  if (error) throw error;
  return data; // uuid del motor creado
}

export async function descartarExtraccion(id, storagePath) {
  const { error } = await supabase.rpc('descartar_extraccion', { p_extraccion_id: id });
  if (error) throw error;
  if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]);
}

export async function urlDeExtraccion(storagePath, segundos = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET).createSignedUrl(storagePath, segundos);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------------------------------------------------------
//  Traduccion del resultado del modelo al formulario
// ---------------------------------------------------------------

const NUMERICOS = new Set(['largo_mm', 'diam_int_mm', 'diam_ext_mm']);
const ENTEROS = new Set(['ranuras', 'rpm']);

const TIPOS_VALIDOS = ['monofasico', 'trifasico', 'continua', 'otro'];

/**
 * Convierte `{campos: [...], circuitos: [...]}` en el objeto que espera
 * el formulario, mas los mapas de confianza y texto de origen.
 *
 * Todo lo que dice el modelo pasa por el parser propio antes de entrar:
 * el modelo puede devolver "0,35" o "150.150" tal cual los leyo, y las
 * reglas de como se interpretan esos numeros viven en un solo lugar.
 */
export function aFormulario(datosJson) {
  // El modelo devuelve renglones con la etiqueta del papel; la
  // traduccion a campos vive en _shared/mapeo-ficha.js, que se testea
  // sin gastar llamadas a la API.
  const mapeado = mapearLineas(datosJson?.lineas ?? []);

  const form = {};
  const confianza = { ...mapeado.confianza };
  const fuente = { ...mapeado.fuente };

  for (const [nombre, valor] of Object.entries(mapeado.campos)) {
    if (NUMERICOS.has(nombre)) {
      form[nombre] = parsearNumero(valor).valor ?? '';
    } else if (ENTEROS.has(nombre)) {
      form[nombre] = parsearEntero(valor).valor ?? '';
    } else if (nombre === 'tipo_electrico') {
      const t = String(valor).toLowerCase();
      form[nombre] = TIPOS_VALIDOS.find((v) => t.includes(v.slice(0, 5))) ?? '';
    } else {
      form[nombre] = String(valor);
    }
  }

  const circuitos = ['arranque', 'trabajo'].map((tipo) => {
    const c = mapeado.circuitos[tipo] ?? {};

    // Alambre viene como un solo texto ("2x0,50 mm  0,880 KG") porque asi
    // esta en el papel. El parser separa hilos, diametro y peso.
    const alambre = parsearAlambre(c.alambre);
    const abertura = parsearAbertura(c.abertura);

    // armarSecciones es lo que garantiza que paso y vueltas queden
    // emparejados, y avisa si no coinciden en cantidad.
    const { secciones, alineado } = armarSecciones(c.paso, c.vueltas);

    const peorConfianza = ['baja', 'media', 'alta'].find((n) => [
      c.paso_confianza, c.vueltas_confianza, c.alambre_confianza,
    ].includes(n)) ?? 'media';

    confianza[`circuito_${tipo}`] = alineado ? peorConfianza : 'baja';
    if (!alineado) {
      fuente[`circuito_${tipo}`] = 'El paso y las vueltas no coinciden en cantidad. '
        + 'Revisar contra la foto.';
    } else if (c.vueltas_fuente) {
      fuente[`circuito_${tipo}`] = c.vueltas_fuente;
    }

    return {
      tipo,
      alambre_mm: alambre.mm ?? '',
      alambre_hilos: String(alambre.hilos ?? 1),
      alambre_kg: alambre.kg ?? '',
      abertura_mm: abertura.mm ?? '',
      abertura_fraccion: abertura.fraccion ?? '',
      secciones: secciones.length
        ? secciones.map((s) => ({
            paso: s.paso ?? '',
            vueltas: s.vueltas ?? '',
            vueltas_tachadas: '',
          }))
        : [{ paso: '', vueltas: '', vueltas_tachadas: '' }],
    };
  });

  // Las aislaciones vienen como lista: el papel puede traer varias.
  // Cada medida pasa por el mismo parser que el resto de los numeros.
  const aislaciones = (mapeado.aislaciones ?? []).map((a, i) => {
    const peor = ['baja', 'media', 'alta'].find((n) => [
      a.largo_mm_confianza, a.ancho_mm_confianza, a.cantidad_confianza,
    ].includes(n)) ?? 'media';
    confianza[`aislacion_${i}`] = peor;
    fuente[`aislacion_${i}`] = a.largo_mm_fuente || a.ancho_mm_fuente || a.cantidad_fuente || '';

    return {
      descripcion: '',
      largo_mm: parsearNumero(a.largo_mm).valor ?? '',
      ancho_mm: parsearNumero(a.ancho_mm).valor ?? '',
      cantidad: parsearEntero(a.cantidad).valor ?? '',
    };
  });

  return {
    form,
    circuitos,
    // Al menos una fila para que la revision no muestre la seccion vacia.
    aislaciones: aislaciones.length
      ? aislaciones
      : [{ descripcion: '', largo_mm: '', ancho_mm: '', cantidad: '' }],
    confianza,
    fuente,
    cliente: form.cliente ?? '',
    // Datos que el modelo leyo bien pero que no supimos ubicar. Se
    // muestran en la revision en vez de descartarse en silencio.
    sinReconocer: mapeado.sinReconocer,
  };
}

export const COLOR_CONFIANZA = {
  alta: 'var(--success, #10b981)',
  media: 'var(--warning, #d97706)',
  baja: 'var(--danger, #ef4444)',
};

export const ETIQUETA_CONFIANZA = {
  alta: 'Se lee claro',
  media: 'Con dudas',
  baja: 'Revisar bien',
};
