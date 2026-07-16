import { useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chips from '../shared/Chips.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { useToast } from '../shared/Toast.jsx';
import { api } from '../../api.js';
import { fmtQ, hoyISO } from '../../utils.js';

export default function FormPago({ inputRef, onGuardado }) {
  const { tarjetas, cuentas } = useCatalog();
  const { bump } = useDataVersion();
  const toast = useToast();

  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [tarjeta, setTarjeta] = useState();
  const [cuenta, setCuenta] = useState();

  const cuentasConNinguna = [{ id: null, nombre: 'Sin cuenta' }, ...cuentas];

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
    <Card className="p-4">
      <form aria-label="Registrar pago de tarjeta" className="flex flex-col gap-3" autoComplete="off" onSubmit={submit}>
        <TextField label="Monto (Q)" type="number" inputProps={{ step: 0.01, min: 0.01, inputMode: 'decimal' }}
          inputRef={inputRef} required placeholder="0.00"
          value={monto} onChange={e => setMonto(e.target.value)} />
        <Typography variant="body2" color="text.secondary">Tarjeta</Typography>
        <Chips items={tarjetas} getLabel={t => t.nombre} value={tarjeta} onChange={setTarjeta} />
        <Typography variant="body2" color="text.secondary">¿Desde qué cuenta? (opcional)</Typography>
        <Chips items={cuentasConNinguna} getLabel={c => c.nombre} value={cuenta} onChange={setCuenta} permitirNinguno />
        <TextField label="Fecha" type="date" required InputLabelProps={{ shrink: true }}
          value={fecha} onChange={e => setFecha(e.target.value)} />
        <Button type="submit" variant="contained" color="warning" size="large">Guardar pago</Button>
      </form>
    </Card>
  );
}
