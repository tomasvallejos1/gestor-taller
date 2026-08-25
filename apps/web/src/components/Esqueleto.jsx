import React from 'react';

/**
 * Esqueleto de carga: el dibujo de la pantalla antes de que lleguen los
 * datos.
 *
 * Reemplaza al spinner en las pantallas completas. Un spinner dice "algo
 * esta pasando" y nada mas: la pantalla queda en blanco, el usuario no
 * sabe si va a aparecer una lista o un formulario, y cuando llega el
 * contenido todo salta de lugar. El esqueleto dibuja de entrada la forma
 * que va a tener --el buscador aca, las tarjetas alla-- y despues cada
 * bloque se rellena en su sitio. No es mas rapido, pero se siente mas
 * rapido, que es de lo que se trata: el ojo tiene algo que leer mientras
 * espera y no hay salto al final.
 *
 * El spinner sigue existiendo para lo otro: botones que guardan, esperas
 * cortas adentro de una pantalla ya dibujada. Ahi no hay forma que
 * anticipar.
 */

/** Una barra gris. `ancho` acepta cualquier medida de CSS. */
const Bloque = ({ ancho = '100%', alto = 14, radio = 7, style }) => (
  <span className="esq" style={{ width: ancho, height: alto, borderRadius: radio, ...style }} />
);

/** Tarjeta de listado: dos renglones de texto y un par de etiquetas. */
const FilaLista = () => (
  <div className="esq-fila">
    <div className="esq-fila__cab">
      <Bloque ancho="45%" alto={15} />
      <Bloque ancho="52px" alto={11} />
    </div>
    <Bloque ancho="70%" alto={12} style={{ marginTop: 9 }} />
    <div className="esq-fila__etiquetas">
      <Bloque ancho="88px" alto={22} radio={6} />
      <Bloque ancho="104px" alto={22} radio={6} />
    </div>
  </div>
);

const Cabecera = () => (
  <div className="esq-cab">
    <Bloque ancho="180px" alto={24} />
    <Bloque ancho="240px" alto={13} style={{ marginTop: 9 }} />
  </div>
);

const Seccion = ({ children }) => <div className="esq-seccion">{children}</div>;

const CUERPOS = {
  /** Listados: motores, clientes, ordenes, presupuestos. */
  lista: (filas) => (
    <>
      <Cabecera />
      <Bloque alto={44} radio={10} style={{ marginBottom: 14 }} />
      <div className="esq-chips">
        {[72, 96, 84, 60].map((w, i) => (
          <Bloque key={i} ancho={`${w}px`} alto={36} radio={999} />
        ))}
      </div>
      <div className="esq-lista">
        {Array.from({ length: filas }, (_, i) => <FilaLista key={i} />)}
      </div>
    </>
  ),

  /** Pantallas de detalle: una orden, una ficha. */
  detalle: () => (
    <>
      <Cabecera />
      <Seccion>
        <Bloque ancho="90px" alto={11} />
        <Bloque ancho="140px" alto={26} radio={999} style={{ marginTop: 10 }} />
        <Bloque alto={52} radio={12} style={{ marginTop: 18 }} />
      </Seccion>
      <Seccion>
        <Bloque ancho="120px" alto={15} />
        <div className="esq-datos">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Bloque ancho="60%" alto={10} />
              <Bloque ancho="85%" alto={14} style={{ marginTop: 7 }} />
            </div>
          ))}
        </div>
      </Seccion>
      <Seccion>
        <Bloque ancho="100px" alto={15} />
        <Bloque alto={58} radio={12} style={{ marginTop: 12 }} />
        <Bloque alto={58} radio={12} style={{ marginTop: 10 }} />
      </Seccion>
    </>
  ),

  /** La cola de pendientes del panel. */
  tareas: () => (
    <div className="esq-lista">
      <Bloque alto={72} radio={12} />
      <Bloque alto={72} radio={12} />
    </div>
  ),

  /** Formularios largos: alta de ficha, presupuesto, remito. */
  formulario: () => (
    <>
      <Cabecera />
      <Seccion>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ marginTop: i ? 16 : 0 }}>
            <Bloque ancho="110px" alto={11} />
            <Bloque alto={44} radio={8} style={{ marginTop: 7 }} />
          </div>
        ))}
      </Seccion>
    </>
  ),

  /** Fallback de las rutas que se cargan aparte. */
  pagina: () => (
    <>
      <Cabecera />
      <Seccion>
        <Bloque ancho="70%" alto={14} />
        <Bloque ancho="90%" alto={14} style={{ marginTop: 10 }} />
        <Bloque ancho="55%" alto={14} style={{ marginTop: 10 }} />
      </Seccion>
    </>
  ),
};

/**
 * @param {'lista'|'detalle'|'tareas'|'formulario'|'pagina'} tipo
 * @param {number} filas cuantas tarjetas dibujar en el tipo lista
 */
const Esqueleto = ({ tipo = 'pagina', filas = 5 }) => (
  // `aria-busy` y el rotulo son lo unico que un lector de pantalla
  // recibe: las barras grises no significan nada para quien no las ve.
  <div className="esq-envoltura" role="status" aria-busy="true" aria-label="Cargando">
    {(CUERPOS[tipo] ?? CUERPOS.pagina)(filas)}
  </div>
);

export default Esqueleto;
