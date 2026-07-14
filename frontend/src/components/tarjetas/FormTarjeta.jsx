import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';

const VACIO = { banco: '', nombre: '', limite: '', dia_corte: '', dia_pago: '', saldo_inicial: '0', activa: true };

export default function FormTarjeta({ editando, onGuardado, onCancelar }) {
  const { refetch } = useCatalog();
  const toast = useToast();
  const [form, setForm] = useState(VACIO);

  useEffect(() => {
    setForm(editando ? {
      banco: editando.banco, nombre: editando.nombre, limite: String(editando.limite),
      dia_corte: String(editando.dia_corte), dia_pago: String(editando.dia_pago),
      saldo_inicial: String(editando.saldo_inicial), activa: !!editando.activa,
    } : VACIO);
  }, [editando]);

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      banco: form.banco, nombre: form.nombre, limite: parseFloat(form.limite),
      dia_corte: parseInt(form.dia_corte), dia_pago: parseInt(form.dia_pago),
      saldo_inicial: parseFloat(form.saldo_inicial || 0), activa: form.activa,
    };
    try {
      if (editando) await api(`/api/tarjetas/${editando.id}`, { method: 'PUT', body });
      else await api('/api/tarjetas', { method: 'POST', body });
      toast('Tarjeta guardada ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <div className="panel">
      <h3>{editando ? `Editar: ${editando.nombre}` : 'Nueva tarjeta'}</h3>
      <form className="form-grid" autoComplete="off" onSubmit={submit}>
        <label>Banco
          <input type="text" placeholder="ej. BI" required
                 value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
        </label>
        <label>Nombre único
          <input type="text" placeholder="ej. Visa BI" required
                 value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
        </label>
        <label>Límite (Q)
          <input type="number" step="0.01" min="0.01" required
                 value={form.limite} onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} />
        </label>
        <label>Día de corte
          <input type="number" min="1" max="31" required
                 value={form.dia_corte} onChange={e => setForm(f => ({ ...f, dia_corte: e.target.value }))} />
        </label>
        <label>Día de pago
          <input type="number" min="1" max="31" required
                 value={form.dia_pago} onChange={e => setForm(f => ({ ...f, dia_pago: e.target.value }))} />
        </label>
        <label>Saldo pendiente hoy (Q) <span className="opcional">— opcional, deuda que ya traés (puede ser 0)</span>
          <input type="number" step="0.01" min="0"
                 value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.activa} onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} /> Activa
        </label>
        <button type="submit" className="guardar">Guardar tarjeta</button>
        {editando && <button type="button" className="mini-btn" onClick={onCancelar}>Cancelar edición</button>}
      </form>
    </div>
  );
}
