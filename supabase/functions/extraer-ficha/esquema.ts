/**
 * Esquema y prompt de extraccion.
 *
 * DISEÑO: el modelo transcribe, nosotros mapeamos.
 *
 * La primera version le pedia al modelo que devolviera directamente los
 * nombres internos de la base (`aislacion_largo_mm`, `diam_int_mm`...).
 * Medido contra una ficha de prueba dio 5 de 11: transcribia el texto
 * casi perfecto pero lo ubicaba mal, porque un modelo de 12B no puede
 * inferir la semantica de un esquema que no conoce. "Largo: 58 mm"
 * terminaba en `aislacion_largo_mm`.
 *
 * Ahora se le pide lo unico que hace bien: leer el papel y decir que
 * etiqueta acompaña a cada valor, con las palabras del papel. La
 * traduccion a campos ocurre en _shared/mapeo-ficha.js, que se testea
 * sin gastar llamadas a la API y sirve igual para cualquier proveedor.
 *
 * El esquema resultante es chico y uniforme, que es justo lo que los
 * modelos abiertos respetan mejor.
 */

export const ESQUEMA = {
  type: 'object',
  properties: {
    lineas: {
      type: 'array',
      description: 'Un item por dato leido, en el orden en que aparece en la ficha.',
      items: {
        type: 'object',
        properties: {
          seccion: {
            type: 'string',
            enum: ['general', 'arranque', 'trabajo'],
            description: 'A que bloque de la ficha pertenece la linea.',
          },
          etiqueta: {
            type: 'string',
            description: 'El rotulo tal como esta escrito: "Largo", "RANURAS", "Paso", "ABERT.".',
          },
          valor: {
            type: 'string',
            description: 'Lo que sigue al rotulo, tal como se lee.',
          },
          confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
          texto_fuente: {
            type: 'string',
            description: 'El renglon completo como esta en el papel.',
          },
        },
        required: ['seccion', 'etiqueta', 'valor', 'confianza', 'texto_fuente'],
        additionalProperties: false,
      },
    },
    legible: {
      type: 'boolean',
      description: 'false si la foto esta muy borrosa, cortada, o no es una ficha de motor.',
    },
    nota: { type: 'string', description: 'Una linea sobre problemas de lectura, si los hubo.' },
  },
  required: ['lineas', 'legible'],
  additionalProperties: false,
};

export const PROMPT = `Sos un asistente de un taller de bobinado de motores electricos en Argentina.
Te paso la foto de una ficha tecnica, escrita a mano o en un formulario preimpreso.

Tu trabajo es TRANSCRIBIR lo que dice, no interpretarlo. Devolves una lista de
lineas: para cada dato, el rotulo tal como esta escrito y el valor que lo sigue.

No traduzcas ni renombres los rotulos. Si el papel dice "ABERT." escribi
"ABERT.". Si dice "VTAS" escribi "VTAS". De ubicarlos nos encargamos nosotros.

SECCIONES
- "general": todo lo de arriba (motor, cliente, HP, ranuras, medidas) y las
  observaciones del pie.
- "arranque": las lineas que estan debajo del titulo "Arranque".
- "trabajo": las lineas que estan debajo del titulo "TRABAJO".
Los titulos de seccion en si NO son lineas: solo indican donde empieza cada
bloque.

COMO SE ESCRIBEN LOS NUMEROS EN ESTAS FICHAS

1. La COMA es el separador decimal: "0,35" es zero coma treinta y cinco.

2. El PUNTO NO es decimal: separa valores de una lista, igual que el guion.
   "150.150" son DOS valores. "20.20-37" son TRES. "33.62-66-88-88" son CINCO.
   Copialo tal cual esta escrito, con su punto. No lo conviertas a decimal ni
   lo reescribas.

3. PASO y VUELTAS van de a pares y suelen tener la misma cantidad de valores.
   Si contas distinta cantidad, transcribi igual lo que ves y poné confianza
   "baja" en esas dos lineas.

4. VALORES TACHADOS: si hay un numero tachado y otro corregido al lado o
   abajo, escribi el corregido en "valor" y mencioná el tachado en
   "texto_fuente". Confianza "media".

5. Copiá el valor completo aunque tenga varias partes:
   "0,40 mm   0,320 KG" va entero en una sola linea con etiqueta "Alambre".
   "38mm (2/3)" va entero con etiqueta "ABERT.".

QUE MIRAR
- Arriba a la izquierda suele estar el motor. Arriba a la derecha, el nombre
  del cliente: si ves un nombre de persona, usá etiqueta "Cliente".
- Abajo suele haber uno o mas croquis rectangulares con numeros: son las
  aislaciones. Usá etiquetas "Aislacion largo", "Aislacion ancho" y
  "Aislacion cantidad".
  Puede haber VARIAS (fondo de ranura, cuña, entre fases). Transcribilas
  todas, una linea por medida, en el orden en que aparecen: repetí las
  mismas etiquetas para cada croquis en vez de quedarte con uno solo.
- Un campo preimpreso vacio ("AMP:" sin nada al lado) NO se incluye.

CONFIANZA
- "alta": se lee claro y sin ambiguedad.
- "media": se entiende pero hay dudas (letra floja, tachadura, mancha).
- "baja": es una interpretacion; podria ser otra cosa.

Se honesto con esto. Una persona revisa todo antes de guardarlo y mira primero
lo marcado como dudoso. Marcar "alta" algo incierto es peor que marcar "baja"
algo correcto.

No inventes datos. Si algo no esta en la ficha, no lo incluyas.`;

export interface LineaLeida {
  seccion: 'general' | 'arranque' | 'trabajo';
  etiqueta: string;
  valor: string;
  confianza: 'alta' | 'media' | 'baja';
  texto_fuente: string;
}

export interface Extraccion {
  lineas: LineaLeida[];
  legible: boolean;
  nota?: string;
}
