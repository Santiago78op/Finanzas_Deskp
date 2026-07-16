import { useState } from 'react';
import Button from '@mui/material/Button';
import CheckIcon from '@mui/icons-material/Check';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { useToast } from '../shared/Toast.jsx';
import { api } from '../../api.js';
import { fmtQ, hoyISO } from '../../utils.js';
import { campoLabel, campoBase } from './campoStyles.js';

export default function FormPago({ inputRef, onGuardado }) {
  const { tarjetas, cuentas } = useCatalog();
  const { bump } = useDataVersion();
  const toast = useToast();

  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [tarjetaId, setTarjetaId] = useState('');
  const [cuentaId, setCuentaId] = useState('');

  const tarjeta = tarjetas.find(t => String(t.id) === tarjetaId);
  const cuenta = cuentas.find(c => String(c.id) === cuentaId);

  const submit = async (e) => {
    e.preventDefault();
    if (!tarjeta) return toast('Elegí la tarjeta', true);
    try {
      await api('/api/pagos_tarjetas', {
        method: 'POST',
        body: { fecha, tarjeta_id: tarjeta.id, cuenta_id: cuenta ? cuenta.id : null, monto: parseFloat(monto) },
      });
      toast(`Pago de ${fmtQ(monto)} a ${tarjeta.nombre} guardado ✓`);
      onGuardado?.({ tipo: 'pago', cat: tarjeta.nombre, cuenta: cuenta ? cuenta.nombre : 'Sin cuenta', monto: parseFloat(monto) });
      setMonto('');
      inputRef?.current?.focus();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <form aria-label="Registrar pago de tarjeta" className="flex flex-col gap-3" autoComplete="off" onSubmit={submit}>
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
          <label style={campoLabel}>Tarjeta</label>
          <select required value={tarjetaId} onChange={e => setTarjetaId(e.target.value)} style={{ ...campoBase, cursor: 'pointer' }}>
            <option value="" disabled>Elegí una</option>
            {tarjetas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
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

      <div className="flex flex-col gap-1.5">
        <label style={campoLabel}>Fecha</label>
        <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} style={campoBase} />
      </div>

      <Button type="submit" variant="contained" color="warning" size="large" fullWidth startIcon={<CheckIcon />}>Guardar pago</Button>
    </form>
  );
}
