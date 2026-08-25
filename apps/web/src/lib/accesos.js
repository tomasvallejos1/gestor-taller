import {
  Hammer, FileText, Tags, Settings, BarChart3, Users, ScanLine, Wrench, Receipt,
} from 'lucide-react';

/**
 * Los destinos que no viven en la barra de abajo.
 *
 * Una sola lista para dos consumidores: la pantalla "Mas" y los accesos
 * directos del panel. Cuando estaban duplicados, agregar una seccion
 * significaba acordarse de tocar los dos lados, y no pasaba.
 *
 * `rol: 'editor'` esconde el destino para un lector. Mostrarselo y que
 * despues le rebote por RLS es peor que no ofrecerselo.
 */
export const DESTINOS = [
  {
    id: 'reparaciones',
    to: '/sistema/reparaciones',
    label: 'Reparaciones',
    corto: 'Reparaciones',
    ayuda: 'Ordenes abiertas y cerradas',
    grupo: 'Taller',
    icon: Hammer,
  },
  {
    id: 'nueva-ficha',
    to: '/sistema/motores/nuevo',
    label: 'Nueva ficha',
    corto: 'Nueva ficha',
    ayuda: 'Escanear una ficha de papel o cargarla a mano',
    grupo: 'Taller',
    rol: 'editor',
    icon: ScanLine,
  },
  {
    id: 'motores',
    to: '/sistema/motores',
    label: 'Fichas tecnicas',
    corto: 'Fichas',
    ayuda: 'Todos los motores del taller',
    grupo: 'Taller',
    icon: Wrench,
  },
  {
    id: 'clientes',
    to: '/sistema/clientes',
    label: 'Clientes',
    corto: 'Clientes',
    ayuda: 'Quien trajo cada motor',
    grupo: 'Taller',
    icon: Users,
  },
  {
    id: 'presupuestos',
    to: '/sistema/presupuestos',
    label: 'Presupuestos',
    corto: 'Presupuestos',
    ayuda: 'Cotizaciones y PDF para el cliente',
    grupo: 'Facturacion',
    rol: 'editor',
    icon: FileText,
  },
  {
    id: 'catalogo',
    to: '/sistema/catalogo',
    label: 'Lista de precios',
    corto: 'Precios',
    ayuda: 'Trabajos frecuentes y su precio',
    grupo: 'Facturacion',
    rol: 'editor',
    icon: Tags,
  },
  {
    id: 'facturas',
    to: '/sistema/facturacion',
    label: 'Facturas',
    corto: 'Facturas',
    ayuda: 'Comprobantes emitidos con CAE de ARCA',
    grupo: 'Facturacion',
    rol: 'editor',
    icon: Receipt,
  },
  {
    id: 'informes',
    to: '/sistema/informes',
    label: 'Informes',
    corto: 'Informes',
    ayuda: 'Estadisticas del taller',
    grupo: 'Sistema',
    icon: BarChart3,
  },
  {
    id: 'ajustes',
    to: '/sistema/ajustes',
    label: 'Ajustes',
    corto: 'Ajustes',
    ayuda: 'Tu perfil, usuarios y datos del taller',
    grupo: 'Sistema',
    icon: Settings,
  },
];

export const GRUPOS = ['Taller', 'Facturacion', 'Sistema'];

/**
 * Los destinos que en el celular ya estan en la barra de abajo.
 *
 * Un atajo a algo que esta a un toque de distancia no ahorra nada, y
 * ocupa el lugar mas caro de la app: la primera pantalla del panel.
 */
export const EN_BARRA_MOBILE = ['reparaciones', 'motores', 'clientes'];

/**
 * Lo que ve alguien que recien entra, antes de configurar nada.
 *
 * Antes eran los mismos cuatro para todos, y en el celular dos de ellos
 * --reparaciones y clientes-- repetian botones que ya estaban en la
 * barra de abajo. Se gastaban dos de los cuatro atajos en algo que ya
 * estaba a un toque.
 *
 * Ahora dependen del rol, porque el rol cambia por completo cual es el
 * trabajo del dia. Un editor carga fichas y cotiza; a un lector esas
 * secciones ni siquiera le aparecen --`puedeVer` las filtra-- y unos
 * defaults pensados solo para el editor le dejaban el panel vacio.
 */
export const POR_DEFECTO_EDITOR = ['nueva-ficha', 'presupuestos', 'catalogo', 'facturas'];
export const POR_DEFECTO_LECTOR = ['motores', 'reparaciones', 'clientes', 'informes'];

/** Mas de esto y deja de ser un atajo: es otra pantalla de menu. */
export const MAXIMO = 8;

const CLAVE = 'gt.accesos-directos';

export const destinoDe = (id) => DESTINOS.find((d) => d.id === id);

export const puedeVer = (destino, esEditor) => (
  destino.rol !== 'editor' ? true : Boolean(esEditor)
);

/**
 * Se guarda en el navegador y no en el perfil a proposito: es una
 * preferencia del aparato, no de la persona. El celular del taller y la
 * compu del escritorio se usan para cosas distintas y no tiene sentido
 * que compartan los mismos cuatro atajos.
 */
export function leerAccesos(esEditor = false) {
  const porDefecto = esEditor ? POR_DEFECTO_EDITOR : POR_DEFECTO_LECTOR;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return porDefecto;

    const ids = JSON.parse(crudo);
    if (!Array.isArray(ids)) return porDefecto;

    // Se filtra contra el catalogo: un id guardado hace meses puede
    // apuntar a una seccion que ya no existe, y no se puede confiar en
    // que lo que hay en localStorage siga siendo valido.
    const validos = ids.filter((id) => destinoDe(id)).slice(0, MAXIMO);
    return validos.length ? validos : porDefecto;
  } catch {
    // localStorage puede tirar en modo privado o con el JSON corrupto.
    return porDefecto;
  }
}

export function guardarAccesos(ids) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ids.slice(0, MAXIMO)));
  } catch {
    // Que no se pueda recordar la preferencia no es motivo para
    // romperle la pantalla a nadie.
  }
}
