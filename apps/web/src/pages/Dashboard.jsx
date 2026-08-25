import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageCheck, Clock, Wallet, ChevronRight, Check, BarChart3,
} from 'lucide-react';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import AccesosDirectos from '../components/AccesosDirectos';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { pesos } from '../lib/presupuestos';

/**
 * Panel.
 *
 * Es lo primero que se abre a la mañana, casi siempre de pie y con el
 * celular en una mano. La pregunta de ese momento no es como viene el
 * mes: es que hay que hacer hoy.
 *
 * Por eso quedaron solo dos cosas: la cola de pendientes y los accesos
 * directos. El promedio de dias, el grafico por estado y las ultimas
 * fichas se fueron a Informes --son buenos numeros, pero son de mirar
 * sentado, y ocupaban las dos primeras pantallas del telefono todos los
 * dias para que alguien los leyera una vez por mes--.
 *
 * La cola muestra unicamente lo que pide una accion, y en cero cada
 * renglon desaparece en vez de mostrar un cero: un taller sin nada
 * pendiente tiene que verse vacio, no lleno de ceros. Cuando no queda
 * ninguno, lo que se ve es que esta todo al dia, que tambien es
 * informacion.
 */

const saludo = () => {
  const h = new Date().getHours();
  if (h < 13) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

/**
 * Cada renglon lleva a SU lista, ya filtrada.
 *
 * `tono` define el color del borde: verde lo que esta listo, ambar lo
 * que espera, rojo la plata que se fue sin cobrar. Es el mismo codigo
 * de color que la pantalla de reparaciones, para que el rojo signifique
 * lo mismo en los dos lados.
 */
const tareasDe = (d) => [
  {
    id: 'listos',
    valor: d.listas_para_retirar,
    titulo: 'listos para entregar',
    pista: 'Avisale al cliente que puede pasar a buscarlo',
    a: '/sistema/reparaciones?vista=entregar',
    icono: PackageCheck,
    tono: 'listo',
  },
  {
    id: 'repuesto',
    valor: d.esperando_repuesto,
    titulo: 'esperando repuesto',
    pista: 'Frenados hasta que llegue lo que falta',
    a: '/sistema/reparaciones?estado=esperando_repuesto',
    icono: Clock,
    tono: 'espera',
  },
  {
    id: 'deuda',
    valor: d.deudores,
    titulo: 'entregados sin cobrar',
    // El monto en la pista y no el numero de ordenes: dos ordenes que
    // deben mil pesos y dos que deben medio millon no son lo mismo.
    pista: `${pesos(d.deuda)} pendientes de cobro`,
    a: '/sistema/reparaciones?vista=deudores',
    icono: Wallet,
    tono: 'deuda',
  },
];

const Dashboard = () => {
  const { perfil } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    supabase.rpc('metricas_panel')
      .then(({ data, error: e }) => {
        if (!vigente) return;
        if (e) setError(e.message);
        else setDatos(data);
      });
    return () => { vigente = false; };
  }, []);

  const tareas = datos ? tareasDe(datos).filter((t) => t.valor > 0) : [];
  const abiertas = datos?.reparaciones_abiertas ?? 0;

  return (
    <div className="panel">
      <div className="panel__saludo">
        <h2>{saludo()}{perfil?.nombre ? `, ${perfil.nombre.split(' ')[0]}` : ''}</h2>
        {datos && (
          <p>
            {abiertas === 0
              ? 'No hay motores en el taller.'
              : `${abiertas} ${abiertas === 1 ? 'motor' : 'motores'} en el taller.`}
          </p>
        )}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {!datos && !error ? (
        <div className="ui-card" style={{ padding: '38px' }}>
          <Spinner label="Cargando..." centered />
        </div>
      ) : datos && (
        <section className="tareas" aria-label="Pendientes de hoy">
          {tareas.length === 0 ? (
            <div className="tareas__vacio">
              <Check size={20} aria-hidden="true" />
              <div>
                <strong>No hay nada pendiente.</strong>
                <span>Ningún motor esperando repuesto, ninguna entrega sin cobrar.</span>
              </div>
            </div>
          ) : tareas.map((t) => {
            const Icono = t.icono;
            return (
              <Link key={t.id} to={t.a} className={`tarea tarea--${t.tono}`}>
                <span className="tarea__icono"><Icono size={19} aria-hidden="true" /></span>
                <span className="tarea__cuerpo">
                  <strong className="tarea__titulo">
                    <span className="tarea__n">{t.valor}</span> {t.titulo}
                  </strong>
                  <span className="tarea__pista">{t.pista}</span>
                </span>
                <ChevronRight size={18} className="tarea__flecha" aria-hidden="true" />
              </Link>
            );
          })}
        </section>
      )}

      <AccesosDirectos />

      {datos && (
        <Link to="/sistema/informes" className="panel__informes">
          <BarChart3 size={16} aria-hidden="true" />
          Cómo viene el mes
          <ChevronRight size={16} style={{ marginLeft: 'auto' }} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
};

export default Dashboard;
