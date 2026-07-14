import { useState } from 'react';
import Chips from '../shared/Chips.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { useToast } from '../shared/Toast.jsx';
import { api } from '../../api.js';
import { fmtQ, hoyISO } from '../../utils.js';

export default function FormPago({ inputRef }) {
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
      setMonto('');
      inputRef?.current?.focus();
      bump();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <form className="form-registro" autoComplete="off" onSubmit={submit}>
      <label>Monto (Q)</label>
      <input ref={inputRef} type="number" step="0.01" min="0.01" name="monto" inputMode="decimal"
             placeholder="0.00" required value={monto} onChange={e => setMonto(e.target.value)} />
      <label>Tarjeta</label>
      <Chips items={tarjetas} getLabel={t => t.nombre} value={tarjeta} onChange={setTarjeta} />
      <label>¿Desde qué cuenta? <span className="opcional">(opcional)</span></label>
      <Chips items={cuentasConNinguna} getLabel={c => c.nombre} value={cuenta} onChange={setCuenta} permitirNinguno />
      <label>Fecha</label>
      <input type="date" name="fecha" required value={fecha} onChange={e => setFecha(e.target.value)} />
      <button type="submit" className="guardar pago">Guardar pago</button>
    </form>
  );
}
