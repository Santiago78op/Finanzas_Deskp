import { useState } from 'react';
import Button from '@mui/material/Button';
import CheckIcon from '@mui/icons-material/Check';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { useToast } from '../shared/Toast.jsx';
import { crearGasto } from '../../api/movimientos.js';
import { fmtQ, hoyISO } from '../../utils.js';
import { campoLabel, campoBase } from './campoStyles.js';
import { tabularNums } from '../shared/estilos.js';

export default function FormGasto({ inputRef, onGuardado }) {
  const { catGasto, metodos, cuentas } = useCatalog();
  const { bump } = useDataVersion();
  const toast = useToast();

  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [categoriaId, setCategoriaId] = useState('');
  const [metodoVal, setMetodoVal] = useState('');
  const [cuentaId, setCuentaId] = useState('');

  const categoria = catGasto.find(c => String(c.id) === categoriaId);
  const metodo = metodos.find(m => (m.tarjeta_id ? `t:${m.tarjeta_id}` : m.metodo) === metodoVal);
  const metodoRequiereCuenta = metodo && (metodo.metodo === 'Débito' || metodo.metodo === 'Transferencia');

  const submit = async (e) => {
    e.preventDefault();
    if (!categoria) return toast('Elegí una categoría', true);
    if (!metodo) return toast('Elegí un método de pago', true);
    try {
      await crearGasto({
        fecha, descripcion,
        categoria_id: categoria.id, metodo: metodo.metodo, tarjeta_id: metodo.tarjeta_id,
        cuenta_id: metodoRequiereCuenta && cuentaId ? parseInt(cuentaId) : null,
        monto: parseFloat(monto),
      });
      toast(`Gasto de ${fmtQ(monto)} guardado ✓`);
      onGuardado?.({ tipo: 'gasto', cat: categoria.nombre, cuenta: metodo.etiqueta, monto: parseFloat(monto) });
      setMonto(''); setDescripcion('');
      inputRef?.current?.focus();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <form aria-label="Registrar gasto" className="flex flex-col gap-3" autoComplete="off" onSubmit={submit}>
      <div className="flex flex-col gap-1.5">
        <label style={campoLabel}>Monto</label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 16, fontWeight: 700, color: 'var(--suave)', fontSize: 18, pointerEvents: 'none' }}>Q</span>
          <input
            ref={inputRef} type="text" inputMode="decimal" placeholder="0.00" required autoFocus
            value={monto} onChange={e => setMonto(e.target.value)}
            style={{ ...campoBase, ...tabularNums, padding: '15px 16px 15px 42px', fontSize: 20, fontWeight: 700 }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label style={campoLabel}>Categoría</label>
          <select required value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={{ ...campoBase, cursor: 'pointer' }}>
            <option value="" disabled>Elegí una</option>
            {catGasto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label style={campoLabel}>Método</label>
          <select required value={metodoVal} onChange={e => setMetodoVal(e.target.value)} style={{ ...campoBase, cursor: 'pointer' }}>
            <option value="" disabled>Elegí uno</option>
            {metodos.map(m => {
              const val = m.tarjeta_id ? `t:${m.tarjeta_id}` : m.metodo;
              return <option key={val} value={val}>{m.etiqueta}</option>;
            })}
          </select>
        </div>
      </div>

      {metodoRequiereCuenta && cuentas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label style={campoLabel}>¿De qué cuenta salió? (opcional)</label>
          <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={{ ...campoBase, cursor: 'pointer' }}>
            <option value="">Sin cuenta</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'end' }}>
        <div className="flex flex-col gap-1.5">
          <label style={campoLabel}>Fecha</label>
          <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...campoBase, width: 'auto' }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label style={campoLabel}>Nota (opcional)</label>
          <input type="text" placeholder="Ej. almuerzo" value={descripcion} onChange={e => setDescripcion(e.target.value)} style={campoBase} />
        </div>
      </div>

      <Button type="submit" variant="contained" color="error" size="large" fullWidth startIcon={<CheckIcon />}>Guardar gasto</Button>
    </form>
  );
}
