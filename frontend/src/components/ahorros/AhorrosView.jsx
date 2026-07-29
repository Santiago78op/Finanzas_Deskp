import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/AddOutlined';
import AhorroCard from './AhorroCard.jsx';
import FormAhorro from './FormAhorro.jsx';
import FormAporte from './FormAporte.jsx';
import PanelCapacidad from './PanelCapacidad.jsx';
import PanelPlan from './PanelPlan.jsx';
import MontoAnimado from '../shared/MontoAnimado.jsx';
import PanelesSkeleton from '../shared/PanelesSkeleton.jsx';
import { getAhorros } from '../../api/ahorros.js';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { fmtQ } from '../../utils.js';
import { varsItem, varsLista } from '../../motion.js';
import { tabularNums } from '../shared/estilos.js';

// Ahorros = fondo de emergencia + metas de compra.
//
// El encabezado es lo más importante de la vista: muestra que el dinero
// apartado NO es plata extra, sino una porción de lo que ya está en las
// cuentas. Total − apartado = libre. Si `libre` sale negativo es que hay más
// comprometido que dinero, y se dice con todas las letras en vez de recortar
// el número a cero.
export default function AhorrosView() {
  const [datos, setDatos] = useState(null);
  const [editando, setEditando] = useState(null);
  const [modalAhorro, setModalAhorro] = useState(false);
  const [aportando, setAportando] = useState(null);
  // Preselecciona el tipo según desde qué sección se abrió el formulario:
  // tocar "Crear fondo de emergencia" y que aparezca en "Meta de compra"
  // obliga a corregir a mano algo que ya dijiste al hacer click.
  //
  // Va acá arriba y NO junto a abrirNuevo(): abajo quedaría después del
  // `return` del esqueleto, y un hook que a veces se ejecuta y a veces no
  // rompe el orden de hooks de React (error #310).
  const [tipoNuevo, setTipoNuevo] = useState('meta');
  const { bump } = useDataVersion();

  const cargar = useCallback(async () => setDatos(await getAhorros()), []);
  useEffect(() => { cargar(); }, [cargar]);

  // El dashboard muestra "libre para gastar", así que cualquier cambio acá lo
  // deja desactualizado si no se avisa.
  const recargar = async () => { await cargar(); bump?.(); };

  if (!datos) {
    return (
      <PanelesSkeleton
        id="vista-ahorros" etiqueta="Cargando los ahorros"
        paneles={[{ span: 7, lineas: 2 }, { span: 5, lineas: 4 }, { span: 4 }, { span: 4 }]}
      />
    );
  }

  const { ahorros, dinero_total, total_apartado, libre, capacidad,
          requerido_mensual_total, plan } = datos;
  const emergencia = ahorros.filter(a => a.tipo === 'emergencia');
  const metas = ahorros.filter(a => a.tipo === 'meta');
  const sobregirado = libre < 0;

  const abrirNuevo = (tipo) => { setEditando(null); setTipoNuevo(tipo); setModalAhorro(true); };
  const abrirEditar = (a) => { setEditando(a); setModalAhorro(true); };
  const cerrarAhorro = () => { setEditando(null); setModalAhorro(false); };

  return (
    <div id="vista-ahorros" className="vista flex flex-col">
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <Card component="section" aria-label="Reparto de tu dinero" className="p-5 dash-span-7 flex flex-col gap-3">
          <Typography variant="caption" className="antetitulo">Dónde está tu dinero</Typography>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="antetitulo">Disponible total</div>
              <Typography variant="h4" fontWeight={400}><MontoAnimado valor={dinero_total} /></Typography>
            </div>
            <div>
              <div className="antetitulo">Apartado en ahorros</div>
              <div style={{ fontSize: 20, fontWeight: 500, ...tabularNums }}>{fmtQ(total_apartado)}</div>
            </div>
            <div>
              <div className="antetitulo">Libre para gastar</div>
              <div style={{ fontSize: 20, fontWeight: 500, ...tabularNums,
                            color: sobregirado ? 'var(--baja)' : 'var(--alza)' }}>
                {sobregirado ? '−' : ''}{fmtQ(Math.abs(libre))}
              </div>
            </div>
          </div>
          <Typography variant="body2" className="text-[var(--suave)] medida">
            {sobregirado
              ? 'Tenés más dinero apartado del que hay en tus cuentas. Bajá algún objetivo o sacá de un sobre.'
              : 'Apartar no mueve plata: el dinero sigue en tus cuentas, solo queda marcado como comprometido.'}
          </Typography>
        </Card>

        <div className="dash-span-5">
          <PanelCapacidad capacidad={capacidad} requeridoTotal={requerido_mensual_total} />
        </div>

        <div className="dash-span-12">
          <PanelPlan plan={plan} onAplicado={recargar} />
        </div>
      </div>

      <Divider sx={{ mt: 5, mb: 2 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>Fondo de emergencia</Typography>
      {!emergencia.length && (
        <Typography variant="body2" className="text-[var(--suave)] medida" sx={{ mb: 2 }}>
          Un fondo de emergencia es plata que apartás para un imprevisto — perder el
          trabajo, una reparación, una urgencia médica. Se mide en meses de gastos, no
          en un monto suelto: la idea es aguantar ese tiempo sin ingresos.
        </Typography>
      )}
      <motion.div className="cuentas-grid" variants={varsLista} initial="oculto" animate="visible">
        {emergencia.map(a => (
          <AhorroCard key={a.id} ahorro={a}
            onEditar={() => abrirEditar(a)} onAportar={() => setAportando(a)} />
        ))}
        {!emergencia.length && (
          <motion.button type="button" onClick={() => abrirNuevo('emergencia')} className="tile-agregar" variants={varsItem}>
            <AddIcon fontSize="small" /> Crear fondo de emergencia
          </motion.button>
        )}
      </motion.div>

      <Divider sx={{ mt: 5, mb: 2 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>Metas</Typography>
      <motion.div className="cuentas-grid" variants={varsLista} initial="oculto" animate="visible">
        {metas.map(a => (
          <AhorroCard key={a.id} ahorro={a}
            onEditar={() => abrirEditar(a)} onAportar={() => setAportando(a)} />
        ))}
        <motion.button type="button" onClick={() => abrirNuevo('meta')} className="tile-agregar" variants={varsItem}>
          <AddIcon fontSize="small" /> Agregar meta
        </motion.button>
      </motion.div>

      {modalAhorro && (
        <FormAhorro editando={editando} tipoInicial={tipoNuevo}
          onGuardado={() => { cerrarAhorro(); recargar(); }} onCerrar={cerrarAhorro} />
      )}
      {aportando && (
        <FormAporte ahorro={aportando}
          onGuardado={() => { setAportando(null); recargar(); }}
          onCerrar={() => setAportando(null)} />
      )}
    </div>
  );
}
