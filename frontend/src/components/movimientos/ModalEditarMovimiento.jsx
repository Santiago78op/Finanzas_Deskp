import { useState } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Modal from '../shared/Modal.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useToast } from '../shared/Toast.jsx';
import { actualizarMovimiento } from '../../api/movimientos.js';

const SIN_CATEGORIA = ['pago', 'pago_prestamo', 'pago_visacuota'];

export default function ModalEditarMovimiento({ mov, onCerrar, onGuardado }) {
  const { catGasto, catIngreso, metodos, tarjetas, cuentas, prestamos, visacuotas } = useCatalog();
  const toast = useToast();

  const [fecha, setFecha] = useState(mov.fecha);
  const [monto, setMonto] = useState(String(mov.monto));
  const [descripcion, setDescripcion] = useState(mov.descripcion || '');
  const [categoriaId, setCategoriaId] = useState(mov.categoria_id);
  const [metodoVal, setMetodoVal] = useState(
    mov.tarjeta_id ? `Tarjeta:${mov.tarjeta_id}` : mov.metodo
  );
  const [tarjetaId, setTarjetaId] = useState(mov.tarjeta_id);
  const [prestamoId, setPrestamoId] = useState(mov.prestamo_id);
  const [visacuotaId, setVisacuotaId] = useState(mov.visacuota_id);
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
      } else if (mov.tipo === 'pago_prestamo') {
        body = { fecha, prestamo_id: parseInt(prestamoId), cuenta_id: cuentaSel, monto: parseFloat(monto) };
      } else if (mov.tipo === 'pago_visacuota') {
        body = { fecha, visacuota_id: parseInt(visacuotaId), cuenta_id: cuentaSel, monto: parseFloat(monto) };
      } else {
        body = { fecha, tarjeta_id: parseInt(tarjetaId), cuenta_id: cuentaSel, monto: parseFloat(monto) };
      }
      await actualizarMovimiento(mov.tipo, mov.id, body);
      toast('Registro actualizado ✓');
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Modal titulo={`Editar ${mov.tipo}`} onCerrar={onCerrar} onGuardar={guardar}>
      <TextField label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label="Monto (Q)" type="number" inputProps={{ step: 0.01, min: 0.01 }}
        value={monto} onChange={e => setMonto(e.target.value)} />

      {!SIN_CATEGORIA.includes(mov.tipo) && (
        <>
          <TextField label="Descripción" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          <TextField select label="Categoría" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
            {cats.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
          </TextField>
        </>
      )}

      {mov.tipo === 'gasto' && (
        <TextField select label="Método" value={metodoVal} onChange={e => setMetodoVal(e.target.value)}>
          {metodos.map(x => {
            const val = x.tarjeta_id ? `Tarjeta:${x.tarjeta_id}` : x.metodo;
            return <MenuItem key={val} value={val}>{x.etiqueta}</MenuItem>;
          })}
        </TextField>
      )}

      {mov.tipo === 'pago' && (
        <TextField select label="Tarjeta" value={tarjetaId} onChange={e => setTarjetaId(e.target.value)}>
          {tarjetas.map(t => <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>)}
        </TextField>
      )}

      {mov.tipo === 'pago_prestamo' && (
        <TextField select label="Préstamo" value={prestamoId} onChange={e => setPrestamoId(e.target.value)}>
          {prestamos.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
        </TextField>
      )}

      {mov.tipo === 'pago_visacuota' && (
        <TextField select label="Visa Cuotas" value={visacuotaId} onChange={e => setVisacuotaId(e.target.value)}>
          {visacuotas.map(v => <MenuItem key={v.id} value={v.id}>{v.descripcion}</MenuItem>)}
        </TextField>
      )}

      <TextField select label="Cuenta" value={cuentaId ?? ''} onChange={e => setCuentaId(e.target.value)}>
        <MenuItem value="">Sin cuenta</MenuItem>
        {cuentas.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
      </TextField>
    </Modal>
  );
}
