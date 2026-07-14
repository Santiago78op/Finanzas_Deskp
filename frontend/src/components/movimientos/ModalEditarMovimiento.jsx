import { useState } from 'react';
import Modal from '../shared/Modal.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../shared/Toast.jsx';
import { api } from '../../api.js';

const RUTAS_TIPO = { ingreso: 'ingresos', gasto: 'gastos', pago: 'pagos_tarjetas' };

export default function ModalEditarMovimiento({ mov, onCerrar, onGuardado }) {
  const { catGasto, catIngreso, metodos, tarjetas, cuentas } = useCatalog();
  const toast = useToast();

  const [fecha, setFecha] = useState(mov.fecha);
  const [monto, setMonto] = useState(String(mov.monto));
  const [descripcion, setDescripcion] = useState(mov.descripcion || '');
  const [categoriaId, setCategoriaId] = useState(mov.categoria_id);
  const [metodoVal, setMetodoVal] = useState(
    mov.tarjeta_id ? `Tarjeta:${mov.tarjeta_id}` : mov.metodo
  );
  const [tarjetaId, setTarjetaId] = useState(mov.tarjeta_id);
  const [cuentaId, setCuentaId] = useState(mov.cuenta_id ?? '');

  const cats = mov.tipo === 'gasto' ? catGasto : catIngreso;

  const guardar = async () => {
    try {
      const cuentaSel = cuentaId ? parseInt(cuentaId) : null;
      let body;
      if (mov.tipo === 'gasto') {
        const esTarjeta = metodoVal.startsWith('Tarjeta:');
        body = {
          fecha, descripcion, categoria_id: parseInt(categoriaId),
          metodo: esTarjeta ? 'Tarjeta' : metodoVal,
          tarjeta_id: esTarjeta ? parseInt(metodoVal.split(':')[1]) : null,
          cuenta_id: cuentaSel, monto: parseFloat(monto),
        };
      } else if (mov.tipo === 'ingreso') {
        body = { fecha, descripcion, categoria_id: parseInt(categoriaId), cuenta_id: cuentaSel, monto: parseFloat(monto) };
      } else {
        body = { fecha, tarjeta_id: parseInt(tarjetaId), cuenta_id: cuentaSel, monto: parseFloat(monto) };
      }
      await api(`/api/${RUTAS_TIPO[mov.tipo]}/${mov.id}`, { method: 'PUT', body });
      toast('Registro actualizado ✓');
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Modal titulo={`Editar ${mov.tipo}`} onCerrar={onCerrar} onGuardar={guardar}>
      <label>Fecha</label>
      <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      <label>Monto (Q)</label>
      <input type="number" step="0.01" min="0.01" value={monto} onChange={e => setMonto(e.target.value)} />

      {mov.tipo !== 'pago' && (
        <>
          <label>Descripción</label>
          <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          <label>Categoría</label>
          <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
            {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </>
      )}

      {mov.tipo === 'gasto' && (
        <>
          <label>Método</label>
          <select value={metodoVal} onChange={e => setMetodoVal(e.target.value)}>
            {metodos.map(x => {
              const val = x.tarjeta_id ? `Tarjeta:${x.tarjeta_id}` : x.metodo;
              return <option key={val} value={val}>{x.etiqueta}</option>;
            })}
          </select>
        </>
      )}

      {mov.tipo === 'pago' && (
        <>
          <label>Tarjeta</label>
          <select value={tarjetaId} onChange={e => setTarjetaId(e.target.value)}>
            {tarjetas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </>
      )}

      <label>Cuenta</label>
      <select value={cuentaId ?? ''} onChange={e => setCuentaId(e.target.value)}>
        <option value="">Sin cuenta</option>
        {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
    </Modal>
  );
}
