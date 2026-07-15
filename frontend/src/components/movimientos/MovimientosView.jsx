import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import FiltrosMovimientos from './FiltrosMovimientos.jsx';
import TablaMovimientos from './TablaMovimientos.jsx';
import ModalEditarMovimiento from './ModalEditarMovimiento.jsx';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { fmtQ } from '../../utils.js';

const RUTAS_TIPO = { ingreso: 'ingresos', gasto: 'gastos', pago: 'pagos_tarjetas' };

export default function MovimientosView() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { bump } = useDataVersion();
  const [filtros, setFiltros] = useState({});
  const [movs, setMovs] = useState([]);
  const [editandoIdx, setEditandoIdx] = useState(null);

  const cargar = useCallback(async (params) => {
    const qs = new URLSearchParams(params).toString();
    const data = await api('/api/movimientos' + (qs ? `?${qs}` : ''));
    setMovs(data);
  }, []);

  useEffect(() => { cargar(filtros); }, [filtros, cargar]);

  const eliminar = async (idx) => {
    const m = movs[idx];
    if (!(await confirmar(`¿Eliminar este ${m.tipo} de ${fmtQ(m.monto)}?`, { peligro: true }))) return;
    try {
      await api(`/api/${RUTAS_TIPO[m.tipo]}/${m.id}`, { method: 'DELETE' });
      toast('Registro eliminado ✓');
      cargar(filtros);
      bump();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <div id="vista-movimientos" className="vista">
      <FiltrosMovimientos onFiltrar={setFiltros} />
      <Card className="p-2">
        <TablaMovimientos movs={movs} onEditar={setEditandoIdx} onEliminar={eliminar} />
      </Card>
      {editandoIdx != null && (
        <ModalEditarMovimiento
          mov={movs[editandoIdx]}
          onCerrar={() => setEditandoIdx(null)}
          onGuardado={() => { setEditandoIdx(null); cargar(filtros); bump(); }}
        />
      )}
    </div>
  );
}
