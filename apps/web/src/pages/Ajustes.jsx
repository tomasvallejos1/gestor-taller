import React, { useCallback, useEffect, useState } from 'react';
import { User, Users, ShieldCheck, Copy, Check, Building2 } from 'lucide-react';
import Modal from '../components/Modal';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useEsMobile } from '../lib/useMediaQuery';
import {
  listarUsuarios, actualizarUsuario, crearUsuario,
  actualizarPerfilPropio, cambiarEmail, cambiarClave,
} from '../lib/usuarios';
import { obtenerConfiguracion, guardarConfiguracion } from '../lib/presupuestos';
import { CONDICIONES_FISCALES, revisarDocumento } from '@shared/fiscal.js';

const ROLES = [
  { valor: 'lector', etiqueta: 'Lector', ayuda: 'Ve fichas y clientes. No edita ni ve precios.' },
  { valor: 'editor', etiqueta: 'Editor', ayuda: 'Carga y edita fichas, clientes y presupuestos.' },
  { valor: 'super', etiqueta: 'Administrador', ayuda: 'Todo lo anterior mas la gestion de usuarios.' },
];

const Ajustes = () => {
  const { user, esSuper, perfil } = useAuth();
  const esMobile = useEsMobile();
  const [pestana, setPestana] = useState('perfil');

  // --- Mi perfil ---
  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [clave, setClave] = useState('');
  const [claveRepetida, setClaveRepetida] = useState('');
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [okPerfil, setOkPerfil] = useState('');
  const [errorPerfil, setErrorPerfil] = useState('');

  // --- Usuarios ---
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [errorUsuarios, setErrorUsuarios] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', rol: 'editor' });
  const [creando, setCreando] = useState(false);
  const [reciencreado, setReciencreado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);

  // --- Datos del taller (cabecera de los presupuestos) ---
  const [cfg, setCfg] = useState(null);
  const [cargandoCfg, setCargandoCfg] = useState(false);
  const [guardandoCfg, setGuardandoCfg] = useState(false);
  const [okCfg, setOkCfg] = useState('');
  const [errorCfg, setErrorCfg] = useState('');

  useEffect(() => { setNombre(perfil?.nombre ?? ''); }, [perfil?.nombre]);
  useEffect(() => { setEmail(user?.email ?? ''); }, [user?.email]);

  const cargarUsuarios = useCallback(async () => {
    setCargandoUsuarios(true);
    setErrorUsuarios('');
    try {
      setUsuarios(await listarUsuarios());
    } catch (e) {
      setErrorUsuarios(e.message ?? 'No se pudieron cargar los usuarios.');
    } finally {
      setCargandoUsuarios(false);
    }
  }, []);

  useEffect(() => {
    if (esSuper && pestana === 'usuarios') cargarUsuarios();
  }, [esSuper, pestana, cargarUsuarios]);

  useEffect(() => {
    if (!esSuper || pestana !== 'taller' || cfg) return;
    setCargandoCfg(true);
    obtenerConfiguracion()
      .then(setCfg)
      .catch((e) => setErrorCfg(e.message ?? 'No se pudo cargar la configuracion.'))
      .finally(() => setCargandoCfg(false));
  }, [esSuper, pestana, cfg]);

  const guardarTaller = async (e) => {
    e.preventDefault();
    setErrorCfg('');
    setOkCfg('');

    // El CUIT del taller sale impreso en cada presupuesto: si esta mal
    // se manda mal a todos los clientes, y nadie lo revisa despues.
    const problema = revisarDocumento({
      tipoPersona: 'juridica', tipoDocumento: 'cuit', documento: cfg.cuit,
    });
    if (cfg.cuit && problema) { setErrorCfg(problema); return; }

    setGuardandoCfg(true);
    try {
      const guardada = await guardarConfiguracion({
        razon_social: cfg.razon_social,
        cuit: cfg.cuit || null,
        condicion_fiscal: cfg.condicion_fiscal,
        domicilio: cfg.domicilio || null,
        localidad: cfg.localidad || null,
        telefono: cfg.telefono || null,
        email: cfg.email || null,
        punto_venta: Number(cfg.punto_venta) || 1,
        iva_por_defecto: Number(cfg.iva_por_defecto) || 0,
        vigencia_dias: Number(cfg.vigencia_dias) || 15,
        leyenda_validez: cfg.leyenda_validez,
      });
      setCfg(guardada);
      setOkCfg('Datos del taller guardados.');
    } catch (err) {
      setErrorCfg(err.message ?? 'No se pudo guardar.');
    } finally {
      setGuardandoCfg(false);
    }
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    setErrorPerfil('');
    setOkPerfil('');

    if (clave && clave !== claveRepetida) {
      setErrorPerfil('Las claves no coinciden.');
      return;
    }
    if (clave && clave.length < 8) {
      setErrorPerfil('La clave tiene que tener al menos 8 caracteres.');
      return;
    }

    setGuardandoPerfil(true);
    try {
      const hechos = [];
      if (nombre !== perfil?.nombre) {
        await actualizarPerfilPropio({ nombre });
        hechos.push('nombre');
      }
      if (email !== user?.email) {
        await cambiarEmail(email);
        hechos.push('correo (revisa tu bandeja para confirmarlo)');
      }
      if (clave) {
        await cambiarClave(clave);
        hechos.push('clave');
        setClave('');
        setClaveRepetida('');
      }
      setOkPerfil(hechos.length
        ? `Actualizado: ${hechos.join(', ')}.`
        : 'No habia cambios para guardar.');
    } catch (err) {
      setErrorPerfil(err.message ?? 'No se pudo guardar.');
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const altaUsuario = async (e) => {
    e.preventDefault();
    setErrorUsuarios('');
    setReciencreado(null);
    setCreando(true);
    try {
      const creado = await crearUsuario(nuevo);
      setReciencreado(creado);
      setNuevo({ nombre: '', email: '', rol: 'editor' });
      await cargarUsuarios();
    } catch (err) {
      setErrorUsuarios(err.message ?? 'No se pudo crear el usuario.');
    } finally {
      setCreando(false);
    }
  };

  const aplicarCambio = async (id, cambios) => {
    setErrorUsuarios('');
    try {
      await actualizarUsuario(id, cambios);
      await cargarUsuarios();
    } catch (err) {
      setErrorUsuarios(err.message ?? 'No se pudo actualizar.');
    }
  };

  const copiarClave = async () => {
    await navigator.clipboard.writeText(reciencreado.claveTemporal);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)' };
  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', boxSizing: 'border-box', fontSize: '1rem', fontFamily: 'inherit' };
  const tabStyle = (activa) => ({
    padding: '11px 18px', cursor: 'pointer', background: 'transparent',
    border: 'none', borderBottom: `3px solid ${activa ? 'var(--accent)' : 'transparent'}`,
    color: activa ? 'var(--accent)' : 'var(--text-light)',
    fontWeight: activa ? 700 : 500, fontSize: '0.95rem',
    display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '44px',
  });

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.8rem', marginBottom: '18px' }}>Configuracion</h2>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button type="button" style={tabStyle(pestana === 'perfil')} onClick={() => setPestana('perfil')}>
          <User size={16} /> Mi perfil
        </button>
        {esSuper && (
          <button type="button" style={tabStyle(pestana === 'usuarios')} onClick={() => setPestana('usuarios')}>
            <Users size={16} /> Usuarios
          </button>
        )}
        {esSuper && (
          <button type="button" style={tabStyle(pestana === 'taller')} onClick={() => setPestana('taller')}>
            <Building2 size={16} /> Datos del taller
          </button>
        )}
      </div>

      {pestana === 'perfil' && (
        <form onSubmit={guardarPerfil} className="ui-card" style={{ padding: esMobile ? '18px' : '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <ShieldCheck size={18} />
            <span style={{ fontWeight: 700 }}>
              Tu rol: {ROLES.find((r) => r.valor === perfil?.rol)?.etiqueta ?? perfil?.rol}
            </span>
          </div>

          {errorPerfil ? <Alert variant="error" className="mb-3">{errorPerfil}</Alert> : null}
          {okPerfil ? <Alert variant="success" className="mb-3">{okPerfil}</Alert> : null}

          <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle} htmlFor="p-nombre">Nombre</label>
              <input id="p-nombre" style={inputStyle} value={nombre}
                onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle} htmlFor="p-email">Correo</label>
              <input id="p-email" type="email" style={inputStyle} value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle} htmlFor="p-clave">Clave nueva</label>
              <input id="p-clave" type="password" autoComplete="new-password" style={inputStyle}
                value={clave} onChange={(e) => setClave(e.target.value)}
                placeholder="Dejar vacio para no cambiarla" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="p-clave2">Repetir clave</label>
              <input id="p-clave2" type="password" autoComplete="new-password" style={inputStyle}
                value={claveRepetida} onChange={(e) => setClaveRepetida(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" size="lg" isLoading={guardandoPerfil}>
              Guardar cambios
            </Button>
          </div>
        </form>
      )}

      {pestana === 'taller' && esSuper && (
        cargandoCfg || !cfg ? (
          <div className="ui-card" style={{ padding: '40px' }}>
            {errorCfg ? <Alert variant="error">{errorCfg}</Alert> : <Spinner label="Cargando..." centered />}
          </div>
        ) : (
          <form onSubmit={guardarTaller} className="ui-card" style={{ padding: esMobile ? '18px' : '28px' }}>
            <p style={{ marginTop: 0, color: 'var(--text-light)', fontSize: '0.9rem' }}>
              Esto es lo que sale en la cabecera de cada presupuesto, en el PDF y en el
              link que se le manda al cliente.
            </p>

            {errorCfg ? <Alert variant="error" className="mb-3">{errorCfg}</Alert> : null}
            {okCfg ? <Alert variant="success" className="mb-3">{okCfg}</Alert> : null}

            <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle} htmlFor="cf-rs">Razon social</label>
                <input id="cf-rs" style={inputStyle} required value={cfg.razon_social ?? ''}
                  onChange={(e) => setCfg({ ...cfg, razon_social: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="cf-cuit">CUIT</label>
                <input id="cf-cuit" style={inputStyle} inputMode="numeric" value={cfg.cuit ?? ''}
                  onChange={(e) => setCfg({ ...cfg, cuit: e.target.value })}
                  placeholder="11 digitos, sin guiones" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="cf-cond">Condicion frente al IVA</label>
                <select id="cf-cond" style={inputStyle} value={cfg.condicion_fiscal}
                  onChange={(e) => setCfg({ ...cfg, condicion_fiscal: e.target.value })}>
                  {CONDICIONES_FISCALES.map((c) => (
                    <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="cf-tel">Telefono</label>
                <input id="cf-tel" style={inputStyle} value={cfg.telefono ?? ''}
                  onChange={(e) => setCfg({ ...cfg, telefono: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="cf-dom">Domicilio</label>
                <input id="cf-dom" style={inputStyle} value={cfg.domicilio ?? ''}
                  onChange={(e) => setCfg({ ...cfg, domicilio: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="cf-loc">Localidad</label>
                <input id="cf-loc" style={inputStyle} value={cfg.localidad ?? ''}
                  onChange={(e) => setCfg({ ...cfg, localidad: e.target.value })}
                  placeholder="Venado Tuerto, Santa Fe" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="cf-mail">Email</label>
                <input id="cf-mail" type="email" style={inputStyle} value={cfg.email ?? ''}
                  onChange={(e) => setCfg({ ...cfg, email: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="cf-pv">Punto de venta</label>
                <input id="cf-pv" style={inputStyle} inputMode="numeric" value={cfg.punto_venta ?? 1}
                  onChange={(e) => setCfg({ ...cfg, punto_venta: e.target.value })} />
                <small style={{ color: 'var(--text-light)', fontSize: '0.78rem' }}>
                  Los presupuestos ya emitidos conservan el punto de venta con el que salieron.
                </small>
              </div>
              <div>
                <label style={labelStyle} htmlFor="cf-iva">IVA por defecto (%)</label>
                <input id="cf-iva" style={inputStyle} inputMode="decimal" value={cfg.iva_por_defecto ?? 0}
                  onChange={(e) => setCfg({ ...cfg, iva_por_defecto: e.target.value })} />
                <small style={{ color: 'var(--text-light)', fontSize: '0.78rem' }}>
                  Monotributista no discrimina IVA: dejar en 0.
                </small>
              </div>
              <div>
                <label style={labelStyle} htmlFor="cf-vig">Validez por defecto (dias)</label>
                <input id="cf-vig" style={inputStyle} inputMode="numeric" value={cfg.vigencia_dias ?? 15}
                  onChange={(e) => setCfg({ ...cfg, vigencia_dias: e.target.value })} />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={labelStyle} htmlFor="cf-ley">Leyenda de validez</label>
              <textarea id="cf-ley" rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                value={cfg.leyenda_validez ?? ''}
                onChange={(e) => setCfg({ ...cfg, leyenda_validez: e.target.value })} />
            </div>

            <div style={{ marginTop: '20px' }}>
              <Button type="submit" variant="primary" isLoading={guardandoCfg}>Guardar</Button>
            </div>
          </form>
        )
      )}

      {pestana === 'usuarios' && esSuper && (
        <>
          <form onSubmit={altaUsuario} className="ui-card" style={{ padding: esMobile ? '18px' : '24px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Nuevo usuario</h3>

            {errorUsuarios ? <Alert variant="error" className="mb-3">{errorUsuarios}</Alert> : null}

            {reciencreado && (
              <Alert variant="success" className="mb-3">
                <div>
                  <strong>{reciencreado.nombre}</strong> ya puede entrar con{' '}
                  <strong>{reciencreado.email}</strong>.
                </div>
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <code style={{ padding: '7px 12px', borderRadius: '7px', background: 'rgba(0,0,0,0.08)', fontSize: '1.05rem', letterSpacing: '0.1em', fontWeight: 700 }}>
                    {reciencreado.claveTemporal}
                  </code>
                  <button type="button" onClick={copiarClave} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                    {copiado ? <Check size={14} /> : <Copy size={14} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                  Es una clave temporal y no se vuelve a mostrar. Pasasela y pedile que la
                  cambie desde &quot;Recuperar acceso&quot;.
                </div>
              </Alert>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: esMobile ? '1fr' : '1fr 1fr auto', gap: '14px', alignItems: 'end' }}>
              <div>
                <label style={labelStyle} htmlFor="n-nombre">Nombre</label>
                <input id="n-nombre" style={inputStyle} value={nuevo.nombre} required
                  onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="n-email">Correo</label>
                <input id="n-email" type="email" style={inputStyle} value={nuevo.email} required
                  onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="n-rol">Rol</label>
                <select id="n-rol" style={inputStyle} value={nuevo.rol}
                  onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
                  {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
                </select>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '10px' }}>
              {ROLES.find((r) => r.valor === nuevo.rol)?.ayuda}
            </p>

            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="primary" isLoading={creando}>Crear usuario</Button>
            </div>
          </form>

          <div className="ui-card" style={{ padding: esMobile ? '16px' : '22px' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Usuarios del taller</h3>

            {cargandoUsuarios ? (
              <Spinner label="Cargando usuarios..." centered />
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {usuarios.map((u) => {
                  const soyYo = u.id === user?.id;
                  return (
                    <div key={u.id} style={{
                      border: '1px solid var(--border)', borderRadius: '11px', padding: '14px',
                      display: 'grid',
                      gridTemplateColumns: esMobile ? '1fr' : '1fr auto auto',
                      gap: '12px', alignItems: 'center',
                      opacity: u.activo ? 1 : 0.55,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>
                          {u.nombre}
                          {soyYo && <span style={{ color: 'var(--text-light)', fontWeight: 400 }}> (vos)</span>}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', overflowWrap: 'anywhere' }}>
                          {u.email}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '3px' }}>
                          {u.ultimo_acceso
                            ? `Ultimo acceso: ${new Date(u.ultimo_acceso).toLocaleString('es-AR')}`
                            : 'Nunca entro'}
                          {u.telegram_id ? ' · Telegram vinculado' : ''}
                        </div>
                      </div>

                      <select
                        value={u.rol}
                        onChange={(e) => aplicarCambio(u.id, { rol: e.target.value })}
                        style={{ ...inputStyle, width: esMobile ? '100%' : '175px' }}
                      >
                        {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
                      </select>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ minHeight: '44px', color: u.activo ? 'var(--danger)' : 'inherit' }}
                        onClick={() => setConfirmacion({
                          usuario: u,
                          activar: !u.activo,
                        })}
                      >
                        {u.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={Boolean(confirmacion)}
        type={confirmacion?.activar ? 'info' : 'danger'}
        title={confirmacion?.activar ? 'Reactivar usuario' : 'Desactivar usuario'}
        message={confirmacion?.activar
          ? `${confirmacion?.usuario?.nombre} va a poder volver a entrar.`
          : `${confirmacion?.usuario?.nombre} no va a poder entrar ni operar el bot. La cuenta y su historial se conservan.`}
        onClose={() => setConfirmacion(null)}
        onConfirm={async () => {
          await aplicarCambio(confirmacion.usuario.id, { activo: confirmacion.activar });
          setConfirmacion(null);
        }}
      />
    </div>
  );
};

export default Ajustes;
