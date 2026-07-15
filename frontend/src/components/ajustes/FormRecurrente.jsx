import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { fmtQ } from '../../utils.js';

const VACIO = { descripcion: '', categoria_id: '', frecuencia: 'Mensual', monto: '', dia_mes: '', dia_mes_2: '', activo: true };

export default function FormRecurrente({ onCambio }) {
  const { catIngreso } = useCatalog();
  const toast = useToast();
  const confirmar = useConfirm();
  const [recs, setRecs] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);

  const cargar = useCallback(async () => setRecs(await api('/api/recurrentes')), []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    setForm(editando ? {
      descripcion: editando.descripcion, categoria_id: String(editando.categoria_id),
      frecuencia: editando.frecuencia || 'Mensual', monto: String(editando.monto),
      dia_mes: String(editando.dia_mes), dia_mes_2: editando.dia_mes_2 ? String(editando.dia_mes_2) : '',
      activo: !!editando.activo,
    } : { ...VACIO, categoria_id: catIngreso[0] ? String(catIngreso[0].id) : '' });
  }, [editando, catIngreso]);

  const esQuincenal = form.frecuencia === 'Quincenal';

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      descripcion: form.descripcion, categoria_id: parseInt(form.categoria_id),
      monto: parseFloat(form.monto), dia_mes: parseInt(form.dia_mes),
      frecuencia: form.frecuencia,
      dia_mes_2: esQuincenal ? parseInt(form.dia_mes_2) : null,
      activo: form.activo,
    };
    try {
      if (editando) await api(`/api/recurrentes/${editando.id}`, { method: 'PUT', body });
      else await api('/api/recurrentes', { method: 'POST', body });
      toast('Ingreso recurrente guardado ✓');
      setEditando(null);
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  const borrar = async (r) => {
    const ok = await confirmar(
      `¿Eliminar "${r.descripcion}" definitivamente?\nLos ingresos ya registrados en Movimientos NO se borran.`,
      { peligro: true },
    );
    if (!ok) return;
    try {
      await api(`/api/recurrentes/${r.id}`, { method: 'DELETE' });
      toast('Ingreso recurrente eliminado ✓');
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <div className="panel">
      <h3>{editando ? `Editar: ${editando.descripcion}` : 'Ingresos recurrentes (salario)'}</h3>
      <form className="form-grid" autoComplete="off" onSubmit={submit}>
        <label>Descripción
          <input type="text" placeholder="ej. Salario" required
                 value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
        </label>
        <label>Categoría
          <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
            {catIngreso.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>Frecuencia
          <select value={form.frecuencia} onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))}>
            <option value="Mensual">Mensual (una vez al mes)</option>
            <option value="Quincenal">Quincenal (dos veces al mes)</option>
          </select>
        </label>
        <label>{esQuincenal ? 'Monto por quincena (Q)' : 'Monto (Q)'}
          <input type="number" step="0.01" min="0.01" required
                 value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
        </label>
        <label>Día de pago
          <input type="number" min="1" max="31" required
                 value={form.dia_mes} onChange={e => setForm(f => ({ ...f, dia_mes: e.target.value }))} />
        </label>
        {esQuincenal && (
          <label title="El primer día de pago ya lo pusiste arriba — acá va la segunda fecha del mes (ej. si cobrás los 15 y los 30, acá va 30).">
            Segundo día de pago
            <input type="number" min="1" max="31" required={esQuincenal}
                   value={form.dia_mes_2} onChange={e => setForm(f => ({ ...f, dia_mes_2: e.target.value }))} />
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} /> Activo
        </label>
        <button type="submit" className="guardar">Guardar</button>
        {editando && <button type="button" className="mini-btn" onClick={() => setEditando(null)}>Cancelar edición</button>}
      </form>

      {!recs.length && <p className="texto-suave">Configurá tu salario acá para que la app lo registre cada mes.</p>}
      {recs.map(r => (
        <div className="item-lista" key={r.id}>
          <span className={r.activo ? '' : 'inactivo'}>
            <b>{r.descripcion}</b> ({r.categoria}) —{' '}
            {r.frecuencia === 'Quincenal'
              ? `${fmtQ(r.monto)} por quincena, los días ${r.dia_mes} y ${r.dia_mes_2}`
              : `${fmtQ(r.monto)} el día ${r.dia_mes}`}
          </span>
          <span>
            <button className="mini-btn" onClick={() => setEditando(r)}>Editar</button>
            <button className="mini-btn peligro" onClick={() => borrar(r)}>Eliminar</button>
          </span>
        </div>
      ))}
    </div>
  );
}
