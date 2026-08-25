import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil, FileText, X, Layers, Ruler, StickyNote, Images,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Esqueleto from '../components/Esqueleto';
import { useAuth } from '../context/AuthContext';
import { obtenerMotor, etiquetaPotencia } from '../lib/motores';
import { conUrls } from '../lib/fotos';

/**
 * Ver una ficha de motor.
 *
 * Antes esto era el formulario de edicion con los campos apagados. Un
 * formulario existe para completarlo: reserva un casillero por dato,
 * lo rotula, y muestra el casillero aunque este vacio. Leerlo es otra
 * cosa. En el taller la ficha se abre parado frente al banco, con el
 * motor desarmado, para buscar UN dato --el paso, las vueltas, el
 * diametro del alambre-- y esos numeros estaban dentro de cajas grises
 * del mismo tamaño que las quince cajas vacias de al lado.
 *
 * Asi que esto es un documento, no un formulario:
 *
 *  - Lo que no se cargo no ocupa lugar. Quince "N/A" no informan nada y
 *    empujan hacia abajo lo unico que se vino a buscar.
 *  - Paso y vueltas son una tabla de verdad, con numeros grandes y de
 *    ancho fijo, porque se leen renglon por renglon contra el bobinado
 *    que se esta contando a mano.
 *  - El total de vueltas se calcula solo. Es una suma que hoy se hace
 *    con la calculadora del celular, al lado de la pantalla que ya
 *    tiene todos los sumandos.
 *  - La foto de la ficha de papel va primera y se abre a pantalla
 *    completa: es contra lo que se verifica cuando un dato no cierra.
 */

const ETIQUETA_CIRCUITO = { arranque: 'Arranque', trabajo: 'Trabajo' };

/** Un valor "hay que mostrarlo" solo si tiene algo adentro. El cero es
 *  un valor: `hay(0)` es true. */
const hay = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/**
 * Con coma decimal.
 *
 * La base guarda numeric y JSON lo entrega como number, asi que un
 * alambre de 0,60 llega como 0.6 y se imprimiria "0.6 mm". En una ficha
 * argentina el separador decimal es la coma --el prompt de lectura de
 * fichas insiste con eso mismo-- y ver el punto donde va la coma hace
 * dudar de si el numero es el que uno cree.
 */
const num = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : String(v));

/**
 * Suma de vueltas del circuito.
 *
 * Devuelve null si alguna seccion no es un numero: un total a medias es
 * peor que ningun total, porque parece completo. Los valores entran
 * como los escribio la persona, asi que la coma decimal vale.
 */
const totalVueltas = (secciones) => {
  const numeros = secciones.map((s) => Number(String(s.vueltas ?? '').replace(',', '.')));
  if (numeros.length === 0 || numeros.some((n) => !Number.isFinite(n))) return null;
  return numeros.reduce((a, b) => a + b, 0);
};

/** Alambre en una linea, como se dice en el taller: "⌀ 0,45 mm ×2 · 0,300 kg". */
const textoAlambre = (c) => {
  if (!hay(c.alambre_mm) && !hay(c.alambre_kg)) return null;
  const partes = [];
  if (hay(c.alambre_mm)) {
    const hilos = Number(c.alambre_hilos);
    partes.push(`⌀ ${num(c.alambre_mm)} mm${hilos > 1 ? ` ×${hilos}` : ''}`);
  }
  if (hay(c.alambre_kg)) partes.push(`${num(c.alambre_kg)} kg`);
  return partes.join(' · ');
};

const textoAbertura = (c) => {
  if (!hay(c.abertura_mm) && !hay(c.abertura_fraccion)) return null;
  const mm = hay(c.abertura_mm) ? `${num(c.abertura_mm)} mm` : '';
  const fr = hay(c.abertura_fraccion) ? `(${c.abertura_fraccion})` : '';
  return [mm, fr].filter(Boolean).join(' ');
};

/** Bloque con titulo. No se dibuja si no hay nada que poner adentro. */
const Seccion = ({ icono, titulo, children, accion }) => {
  const Icono = icono;
  return (
    <section className="ficha__seccion">
      <div className="ficha__seccion-cab">
        <Icono size={15} aria-hidden="true" />
        <h3>{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
};

const Dato = ({ etiqueta, valor }) => (
  <div className="ficha__dato">
    <span className="ficha__dato-et">{etiqueta}</span>
    <span className="ficha__dato-val">{valor}</span>
  </div>
);

const FichaMotor = () => {
  const { id } = useParams();
  const { esEditor } = useAuth();

  /**
   * Lo cargado viaja junto con el id al que corresponde.
   *
   * Asi "esta cargando" se deduce --es que lo que hay en mano todavia no
   * es de esta ficha-- en vez de ser una bandera que hay que acordarse
   * de prender al entrar y apagar al salir. Al pasar de una ficha a otra
   * sin desmontar la pantalla, esa bandera es la que se olvida y deja
   * los datos del motor anterior a la vista bajo el numero nuevo.
   */
  const [datos, setDatos] = useState({ de: null, ficha: null, error: '' });
  // Las fotos llevan su id por el mismo motivo que los datos: al saltar
  // de una ficha a otra no pueden quedar colgadas las del motor anterior.
  const [album, setAlbum] = useState({ de: null, lista: [] });
  const [ampliada, setAmpliada] = useState(null);

  const cargando = datos.de !== id;
  const ficha = cargando ? null : datos.ficha;
  const error = cargando ? '' : datos.error;
  const fotos = album.de === id ? album.lista : [];

  useEffect(() => {
    let vigente = true;
    const setFotos = (lista) => setAlbum({ de: id, lista });

    obtenerMotor(id)
      .then(async (f) => {
        if (!vigente) return;
        if (!f) { setDatos({ de: id, ficha: null, error: 'No encontramos esa ficha.' }); return; }
        setDatos({ de: id, ficha: f, error: '' });

        // Las fotos van aparte: son URLs firmadas, y si falla la firma la
        // ficha tiene que verse igual. Los datos son lo que se vino a
        // buscar; las fotos son el respaldo.
        try {
          const conUrl = await conUrls(f.fotos ?? []);
          // La ficha de papel primero: es contra lo que se verifica.
          if (vigente) setFotos([...conUrl].sort((a, b) => Number(b.es_ficha) - Number(a.es_ficha)));
        } catch {
          if (vigente) setFotos(f.fotos ?? []);
        }
      })
      .catch((e) => {
        if (vigente) setDatos({ de: id, ficha: null, error: e.message ?? 'No se pudo abrir la ficha.' });
      });

    return () => { vigente = false; };
  }, [id]);

  // Cerrar la foto ampliada con Escape, igual que cualquier dialogo.
  useEffect(() => {
    if (!ampliada) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') setAmpliada(null); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [ampliada]);

  if (cargando) {
    return <Esqueleto tipo="detalle" />;
  }

  if (error || !ficha) {
    return (
      <div>
        <Link to="/sistema/motores" className="btn btn-secondary" style={{ textDecoration: 'none', fontWeight: 600 }}>
          <ArrowLeft size={15} /> Motores
        </Link>
        <Alert variant="error" className="mb-3" style={{ marginTop: '16px' }}>
          {error || 'No encontramos esa ficha.'}
        </Alert>
      </div>
    );
  }

  const { motor, circuitos = [], aislaciones = [] } = ficha;

  const potencia = etiquetaPotencia(motor);
  const subtitulo = [motor.marca, motor.modelo].filter(Boolean).join(' · ');

  // Los distintivos de arriba: lo que identifica al motor de un vistazo,
  // sin tener que leer la ficha entera.
  const chips = [
    potencia && { texto: potencia, fuerte: true },
    hay(motor.tipo_electrico) && { texto: motor.tipo_electrico },
    hay(motor.rpm) && { texto: `${motor.rpm} RPM` },
    hay(motor.ranuras) && { texto: `${motor.ranuras} ranuras` },
    hay(motor.amperaje_texto) && { texto: `${motor.amperaje_texto} A` },
    hay(motor.capacitor_texto) && { texto: `Cap. ${motor.capacitor_texto}` },
  ].filter(Boolean);

  const medidas = [
    hay(motor.largo_mm) && ['Largo', `${num(motor.largo_mm)} mm`],
    hay(motor.diam_int_mm) && ['Diámetro interior', `${num(motor.diam_int_mm)} mm`],
    hay(motor.diam_ext_mm) && ['Diámetro exterior', `${num(motor.diam_ext_mm)} mm`],
  ].filter(Boolean);

  // Un circuito sin alambre y sin ninguna seccion cargada no es un
  // circuito: es una fila vacia que quedo del formulario.
  const conDatos = circuitos.filter((c) => (
    textoAlambre(c) || textoAbertura(c)
    || (c.secciones ?? []).some((s) => hay(s.paso) || hay(s.vueltas))
  ));

  const aislacionesReales = aislaciones.filter((a) => (
    hay(a.descripcion) || hay(a.largo_mm) || hay(a.ancho_mm) || hay(a.cantidad)
  ));

  return (
    <div className="ficha">
      <div className="ficha__barra">
        <Link to="/sistema/motores" className="btn btn-secondary" style={{ textDecoration: 'none', fontWeight: 600 }}>
          <ArrowLeft size={15} /> Motores
        </Link>
        {esEditor && (
          <Link to={`/sistema/motores/editar/${motor.nro_motor ?? motor.id}`}
            className="btn btn-primary" style={{ textDecoration: 'none' }}>
            <Pencil size={15} /> Editar
          </Link>
        )}
      </div>

      <header className="ficha__cab">
        <span className="ficha__nro">N° {motor.nro_motor}</span>
        <h2 className="ficha__titulo">{motor.descripcion || 'Ficha sin descripción'}</h2>
        {subtitulo && <p className="ficha__sub">{subtitulo}</p>}
        {hay(motor.aplicacion) && <p className="ficha__uso">{motor.aplicacion}</p>}

        {chips.length > 0 && (
          <div className="ficha__chips">
            {chips.map((c) => (
              <span key={c.texto} className={`etiqueta${c.fuerte ? ' etiqueta--fuerte' : ''}`}>
                {c.texto}
              </span>
            ))}
          </div>
        )}
      </header>

      {conDatos.length > 0 && (
        <Seccion icono={Layers} titulo="Bobinado">
          <div className="ficha__circuitos">
            {conDatos.map((c) => {
              const secciones = (c.secciones ?? []).filter((s) => hay(s.paso) || hay(s.vueltas));
              const total = totalVueltas(secciones);
              const alambre = textoAlambre(c);
              const abertura = textoAbertura(c);

              return (
                <article key={c.tipo} className="circuito">
                  <h4 className="circuito__tipo">{ETIQUETA_CIRCUITO[c.tipo] ?? c.tipo}</h4>

                  {(alambre || abertura) && (
                    <dl className="circuito__cabos">
                      {alambre && <Dato etiqueta="Alambre" valor={alambre} />}
                      {abertura && <Dato etiqueta="Abertura" valor={abertura} />}
                    </dl>
                  )}

                  {secciones.length > 0 && (
                    <>
                      <table className="tabla-paso">
                        <thead>
                          <tr>
                            <th scope="col" className="tabla-paso__n">#</th>
                            <th scope="col">Paso</th>
                            <th scope="col">Vueltas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {secciones.map((s, i) => (
                            <tr key={i}>
                              <td className="tabla-paso__n">{i + 1}</td>
                              <td>{hay(s.paso) ? num(s.paso) : '—'}</td>
                              <td>
                                {/* El valor tachado en el papel se muestra
                                    tachado. Guardarlo y no mostrarlo hacia
                                    imposible entender una correccion; darle
                                    una columna propia lo hacia parecer otro
                                    dato del bobinado. */}
                                {hay(s.vueltas_tachadas) && (
                                  <s className="tabla-paso__tachado">{num(s.vueltas_tachadas)}</s>
                                )}
                                {hay(s.vueltas) ? num(s.vueltas) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {total !== null && secciones.length > 1 && (
                        <p className="circuito__total">
                          <span>Total</span>
                          <strong>{total} vueltas</strong>
                        </p>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </Seccion>
      )}

      {aislacionesReales.length > 0 && (
        <Seccion icono={Ruler} titulo="Aislaciones">
          <ul className="aislaciones">
            {aislacionesReales.map((a, i) => (
              <li key={i} className="aislacion">
                <span className="aislacion__que">{a.descripcion || `Aislación ${i + 1}`}</span>
                <span className="aislacion__medida">
                  {hay(a.largo_mm) && hay(a.ancho_mm)
                    ? `${num(a.largo_mm)} × ${num(a.ancho_mm)} mm`
                    : [a.largo_mm, a.ancho_mm].filter(hay).map((v) => `${num(v)} mm`).join(' ') || '—'}
                </span>
                {hay(a.cantidad) && <span className="aislacion__cant">×{a.cantidad}</span>}
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {medidas.length > 0 && (
        <Seccion icono={Ruler} titulo="Medidas de carcasa">
          <dl className="ficha__datos">
            {medidas.map(([et, val]) => <Dato key={et} etiqueta={et} valor={val} />)}
          </dl>
        </Seccion>
      )}

      {hay(motor.observaciones) && (
        <Seccion icono={StickyNote} titulo="Observaciones">
          <p className="ficha__obs">{motor.observaciones}</p>
        </Seccion>
      )}

      {fotos.length > 0 && (
        <Seccion icono={Images} titulo={fotos.length === 1 ? 'Foto' : `Fotos (${fotos.length})`}>
          <div className="ficha__fotos">
            {fotos.map((f) => (
              <button key={f.id} type="button" className="ficha__foto"
                onClick={() => f.url && setAmpliada(f)}
                aria-label={f.es_ficha ? 'Ampliar la ficha de papel' : 'Ampliar la foto'}>
                {f.url
                  ? <img src={f.url} alt={f.es_ficha ? 'Ficha de papel' : 'Motor'} loading="lazy" />
                  : <span className="ficha__foto-sin">sin vista</span>}
                {f.es_ficha && (
                  <span className="ficha__foto-tag"><FileText size={12} /> Ficha de papel</span>
                )}
              </button>
            ))}
          </div>
        </Seccion>
      )}

      {/* Visor a pantalla completa. Mirar la foto del papel para verificar
          un numero es el motivo por el que la foto existe, y en una
          miniatura de 120px no se lee nada. */}
      {ampliada && (
        <div className="visor" role="dialog" aria-modal="true" aria-label="Foto ampliada">
          <button type="button" className="visor__fondo" aria-label="Cerrar"
            onClick={() => setAmpliada(null)} />
          <button type="button" className="visor__cerrar" onClick={() => setAmpliada(null)}
            aria-label="Cerrar">
            <X size={22} />
          </button>
          <img src={ampliada.url} alt={ampliada.es_ficha ? 'Ficha de papel' : 'Motor'} />
        </div>
      )}
    </div>
  );
};

export default FichaMotor;
