import { supabase } from './supabase';
import { idUnico } from './navegador';

const BUCKET = 'fichas';

/**
 * 2576px es el lado maximo que Claude procesa en alta resolucion. Mandar
 * mas no aporta detalle y cuesta tokens; mandar menos pierde trazo fino
 * de la letra manuscrita, que es justo lo dificil de leer en las fichas.
 */
export const LADO_MAXIMO = 2576;

/**
 * Comprime en el navegador antes de subir.
 *
 * El backend viejo recibia el archivo crudo y lo procesaba del lado del
 * servidor. Ahora no hay servidor donde correr `sharp`, pero hacerlo en
 * el cliente es mejor igual: una foto de celular pesa 4-8 MB y el tecnico
 * la sube desde el taller con datos moviles. Comprimir antes de salir
 * ahorra esa subida.
 */
export async function comprimirImagen(archivo, ladoMaximo = LADO_MAXIMO) {
  if (!archivo.type.startsWith('image/')) {
    throw new Error(`"${archivo.name}" no es una imagen.`);
  }

  const bitmap = await createImageBitmap(archivo);
  const { width: w, height: h } = bitmap;
  const escala = Math.min(1, ladoMaximo / Math.max(w, h));

  // Ya entra: no reencodear, para no degradar dos veces.
  if (escala === 1 && archivo.size < 1_500_000) {
    bitmap.close();
    return { blob: archivo, ancho: w, alto: h, recomprimida: false };
  }

  const ancho = Math.round(w * escala);
  const alto = Math.round(h * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise((resolve) => {
    lienzo.toBlob(resolve, 'image/jpeg', 0.88);
  });

  if (!blob) throw new Error('No se pudo procesar la imagen.');
  return { blob, ancho, alto, recomprimida: true };
}

/**
 * Sube una foto y la registra en motor_foto.
 * @param {string} motorId
 * @param {File} archivo
 * @param {{esFicha?: boolean, orden?: number}} opciones
 */
export async function subirFoto(motorId, archivo, opciones = {}) {
  const { esFicha = false, orden = 0 } = opciones;
  const { blob } = await comprimirImagen(archivo);

  const extension = blob.type === 'image/jpeg' ? 'jpg' : (archivo.name.split('.').pop() || 'jpg');
  const ruta = `motores/${motorId}/${idUnico()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, blob, { contentType: blob.type, upsert: false });
  if (errorSubida) throw errorSubida;

  const { data, error } = await supabase
    .from('motor_foto')
    .insert({ motor_id: motorId, storage_path: ruta, es_ficha: esFicha, orden })
    .select()
    .single();

  if (error) {
    // El registro fallo pero el archivo ya esta en el bucket: sin esto
    // queda un huerfano que nadie va a encontrar ni borrar.
    await supabase.storage.from(BUCKET).remove([ruta]);
    throw error;
  }

  return data;
}

/**
 * URLs para mostrar.
 *
 * El bucket es privado a proposito: la foto de una ficha lleva el nombre
 * del cliente escrito arriba. Un bucket publico la dejaria accesible para
 * siempre a cualquiera que tenga el link.
 *
 * Las fotos heredadas de Cloudinary (es_externa) ya son URLs absolutas.
 */
export async function conUrls(fotos, segundos = 3600) {
  if (!fotos?.length) return [];

  const internas = fotos.filter((f) => !f.es_externa);
  let firmadas = {};

  if (internas.length) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(internas.map((f) => f.storage_path), segundos);
    if (error) throw error;
    firmadas = Object.fromEntries(data.map((d) => [d.path, d.signedUrl]));
  }

  return fotos.map((f) => ({
    ...f,
    url: f.es_externa ? f.storage_path : (firmadas[f.storage_path] ?? null),
  }));
}

export async function eliminarFoto(foto) {
  const { error } = await supabase.from('motor_foto').delete().eq('id', foto.id);
  if (error) throw error;
  // El archivo se borra despues: si falla, queda basura en el bucket pero
  // la ficha ya esta consistente, que es lo que importa.
  if (!foto.es_externa) {
    await supabase.storage.from(BUCKET).remove([foto.storage_path]);
  }
}

/** Marca una foto como la de la ficha de papel, desmarcando la anterior. */
export async function marcarComoFicha(motorId, fotoId) {
  const { error: e1 } = await supabase
    .from('motor_foto').update({ es_ficha: false }).eq('motor_id', motorId);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from('motor_foto').update({ es_ficha: true }).eq('id', fotoId);
  if (e2) throw e2;
}
