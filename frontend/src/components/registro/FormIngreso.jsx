import { useState } from 'react';
import Button from '@mui/material/Button';
import CheckIcon from '@mui/icons-material/Check';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { useToast } from '../shared/Toast.jsx';
import { api } from '../../api.js';
import { fmtQ, hoyISO } from '../../utils.js';
import { campoLabel, campoBase } from './campoStyles.js';

export default function FormIngreso({ inputRef, onGuardado }) {
  const { catIngreso, cuentas } = useCatalog();
  const { bump } = useDataVersion();
  const toast = useToast();

  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [categoriaId, setCategoriaId] = useState('');
  const [cuentaId, setCuentaId] = useState('');

  const categoria = catIngreso.find(c => String(c.id) === categoriaId);
  const cuenta = cuentas.find(c => String(c.id) === cuentaId);

  const submit = async (e) => {
    e.preventDefault();
    if (!categoria) return toast('Elegí una categoría', true);
    try {
      await api('/api/ingresos', {
        method: 'POST',
        body: { fecha, descripcion, categoria_id: categoria.id, cuenta_id: cuenta ? cuenta.id : null, monto: parseFloat(monto) },
      });
      toast(`Ingreso de ${fmtQ(monto)} guardado ✓`);
      onGuardado?.({ tipo: 'ingreso', cat: categoria.nombre, cuenta: cuenta ? cuenta.nombre : 'Sin cuenta', monto: parseFloat(monto) });
      setMonto(''); setDescripcion('');
      inputRef?.current?.focus();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <form aria-label="Registrar ingreso" className="flex flex-col gap-3" autoComplete="off" onSubmit={submit}>
      <div className="flex flex-col gap-1.5">
        <label style={campoLabel}>Monto</label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 16, fontWeight: 700, color: 'var(--suave)', fontSize: 18, pointerEvents: 'none' }}>Q</span>
          <input
            ref={inputRef} type="text" inputMode="decimal" placeholder="0.00" required autoFocus
            value={monto} onChange={e => setMonto(e.target.value)}
            style={{ ...campoBase, padding: '15px 16px 15px 42px', fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label style={campoLabel}>Categoría</label>
          <select required value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={{ ...campoBase, cursor: 'pointer' }}>
            <option value="" disabled>Elegí una</option>
            {catIngreso.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label style={campoLabel}>Cuenta (opcional)</label>
          <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={{ ...campoBase, cursor: 'pointer' }}>
            <option value="">Sin cuenta</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'end' }}>
        <div className="flex flex-col gap-1.5">
          <label style={campoLabel}>Fecha</label>
          <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...campoBase, width: 'auto' }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label style={campoLabel}>Nota (opcional)</label>
          <input type="text" placeholder="Ej. venta" value={descripcion} onChange={e => setDescripcion(e.target.value)} style={campoBase} />
        </div>
      </div>

      <Button type="submit" variant="contained" color="success" size="large" fullWidth startIcon={<CheckIcon />}>Guardar ingreso</Button>
    </form>
  );
}
