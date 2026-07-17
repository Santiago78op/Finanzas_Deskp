import { useState } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Modal from '../shared/Modal.jsx';
import { crearPagoPrestamo } from '../../api/prestamos.js';
import { crearPagoVisacuota } from '../../api/visacuotas.js';
import { useToast } from '../shared/Toast.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { fmtQ, hoyISO } from '../../utils.js';

// Modal chico compartido por préstamo y Visa Cuotas para anotar el pago del
// mes — botón simple, sin el mecanismo de confirmación mensual de
// Ajustes > Recurrentes (decisión tomada con el usuario). Monto prellenado
// con la cuota_mensual, editable si el pago real fue distinto.
export default function FormPagoDeuda({ tipo, entidad, onGuardado, onCerrar }) {
  const { cuentas } = useCatalog();
  const { bump } = useDataVersion();
  const toast = useToast();
  const [fecha, setFecha] = useState(hoyISO());
  const [monto, setMonto] = useState(String(entidad.cuota_mensual));
  const [cuentaId, setCuentaId] = useState('');

  const nombre = tipo === 'prestamo' ? entidad.nombre : entidad.descripcion;

  const guardar = async () => {
    const body = {
      fecha, monto: parseFloat(monto), cuenta_id: cuentaId ? parseInt(cuentaId) : null,
      ...(tipo === 'prestamo' ? { prestamo_id: entidad.id } : { visacuota_id: entidad.id }),
    };
    try {
      if (tipo === 'prestamo') await crearPagoPrestamo(body);
      else await crearPagoVisacuota(body);
      toast(`Pago de ${fmtQ(monto)} guardado ✓`);
      bump();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Modal titulo={`Registrar pago: ${nombre}`} onCerrar={onCerrar} onGuardar={guardar} labelGuardar="Guardar pago">
      <TextField label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label="Monto (Q)" type="number" inputProps={{ step: 0.01, min: 0.01 }} required
        value={monto} onChange={e => setMonto(e.target.value)} />
      <TextField select label="Cuenta (opcional)" value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
        <MenuItem value="">Sin cuenta</MenuItem>
        {cuentas.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
      </TextField>
    </Modal>
  );
}
