import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getRecurrentes, crearRecurrente, actualizarRecurrente, eliminarRecurrente } from '../../api/recurrentes.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { fmtQ } from '../../utils.js';
import { filaAcciones, filaItem } from './ajustes.styles.js';

const VACIO = { descripcion: '', categoria_id: '', frecuencia: 'Mensual', monto: '', dia_mes: '', dia_mes_2: '', mes_1: '', mes_2: '', activo: true };

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Las dos prestaciones anuales obligatorias en Guatemala. Se ofrecen como
// atajos porque sus fechas las fija la ley y no tiene sentido que el usuario
// las recuerde:
//   · Bono 14 (Decreto 42-92): un pago en la primera quincena de JULIO.
//   · Aguinaldo (Decreto 76-78): 50% en la primera quincena de DICIEMBRE y
//     50% en la segunda quincena de ENERO.
// El monto queda vacío a propósito: depende del sueldo y del tiempo trabajado
// en el año de servicio, y no se adivina.
const PRESETS = [
  {
    clave: 'bono14', boton: 'Bono 14',
    ayuda: 'Un pago en julio. El monto es un sueldo completo si trabajaste el año de servicio entero (1 de julio a 30 de junio); si no, la parte proporcional.',
    valores: { descripcion: 'Bono 14', frecuencia: 'Anual', dia_mes: '15', mes_1: '7', mes_2: '', dia_mes_2: '' },
    categoria: 'Bono 14',
  },
  {
    clave: 'aguinaldo', boton: 'Aguinaldo',
    ayuda: 'Dos pagos: la mitad en diciembre y la mitad en enero. Poné en "Monto" lo de CADA pago, o sea la mitad del aguinaldo.',
    valores: { descripcion: 'Aguinaldo', frecuencia: 'Anual', dia_mes: '15', mes_1: '12', dia_mes_2: '20', mes_2: '1' },
    categoria: 'Aguinaldo',
  },
];

// Frase legible de cuándo y cuánto cobra cada recurrente.
function describir(r) {
  if (r.frecuencia === 'Quincenal') {
    return `${fmtQ(r.monto)} por quincena, los días ${r.dia_mes} y ${r.dia_mes_2}`;
  }
  if (r.frecuencia === 'Anual') {
    const primero = `${MESES[r.mes_1 - 1]} ${r.dia_mes}`;
    if (!r.mes_2) return `${fmtQ(r.monto)} una vez al año, el ${primero}`;
    return `${fmtQ(r.monto)} por pago, el ${primero} y el ${MESES[r.mes_2 - 1]} ${r.dia_mes_2 || r.dia_mes}`;
  }
  return `${fmtQ(r.monto)} el día ${r.dia_mes}`;
}

export default function FormRecurrente({ onCambio }) {
  const { catIngreso } = useCatalog();
  const toast = useToast();
  const confirmar = useConfirm();
  const [recs, setRecs] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);

  const cargar = useCallback(async () => setRecs(await getRecurrentes()), []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    setForm(editando ? {
      descripcion: editando.descripcion, categoria_id: String(editando.categoria_id),
      frecuencia: editando.frecuencia || 'Mensual', monto: String(editando.monto),
      dia_mes: String(editando.dia_mes), dia_mes_2: editando.dia_mes_2 ? String(editando.dia_mes_2) : '',
      mes_1: editando.mes_1 ? String(editando.mes_1) : '',
      mes_2: editando.mes_2 ? String(editando.mes_2) : '',
      activo: !!editando.activo,
    } : { ...VACIO, categoria_id: catIngreso[0] ? String(catIngreso[0].id) : '' });
  }, [editando, catIngreso]);

  const esQuincenal = form.frecuencia === 'Quincenal';
  const esAnual = form.frecuencia === 'Anual';
  const dosPagosAnuales = esAnual && !!form.mes_2;

  // Aplica un preset (Bono 14 / Aguinaldo) sobre el formulario vacío y
  // selecciona su categoría homónima si existe.
  const aplicarPreset = (preset) => {
    const cat = catIngreso.find(c => c.nombre === preset.categoria);
    setEditando(null);
    setForm(f => ({
      ...VACIO,
      ...preset.valores,
      categoria_id: cat ? String(cat.id) : f.categoria_id,
    }));
  };

  const ayudaPreset = PRESETS.find(p => p.valores.descripcion === form.descripcion)?.ayuda;

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      descripcion: form.descripcion, categoria_id: parseInt(form.categoria_id),
      monto: parseFloat(form.monto), dia_mes: parseInt(form.dia_mes),
      frecuencia: form.frecuencia,
      // dia_mes_2 significa cosas distintas según la frecuencia: el segundo
      // día del mes en Quincenal, el día del segundo pago en Anual.
      dia_mes_2: (esQuincenal || dosPagosAnuales) ? parseInt(form.dia_mes_2) : null,
      mes_1: esAnual ? parseInt(form.mes_1) : null,
      mes_2: dosPagosAnuales ? parseInt(form.mes_2) : null,
      activo: form.activo,
    };
    try {
      if (editando) await actualizarRecurrente(editando.id, body);
      else await crearRecurrente(body);
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
      await eliminarRecurrente(r.id);
      toast('Ingreso recurrente eliminado ✓');
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card component="section" aria-labelledby="sec-ingresos-recurrentes" className="p-5 flex flex-col gap-4">
      <Typography id="sec-ingresos-recurrentes" variant="h6">{editando ? `Editar: ${editando.descripcion}` : 'Ingresos recurrentes (salario)'}</Typography>

      {!editando && (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" className="text-[var(--suave)]">Atajos:</Typography>
          {PRESETS.map(p => (
            <Button key={p.clave} size="small" variant="outlined" onClick={() => aplicarPreset(p)}>
              {p.boton}
            </Button>
          ))}
        </Stack>
      )}
      {ayudaPreset && (
        <Typography variant="body2" className="text-[var(--suave)] medida">{ayudaPreset}</Typography>
      )}

      <form className="grid gap-3 sm:grid-cols-2" autoComplete="off" onSubmit={submit}>
        <TextField label="Descripción" placeholder="ej. Salario" required
          value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
        <TextField select label="Categoría" value={form.categoria_id}
          onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
          {catIngreso.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
        </TextField>
        <TextField select label="Frecuencia" value={form.frecuencia}
          onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))}>
          <MenuItem value="Mensual">Mensual (una vez al mes)</MenuItem>
          <MenuItem value="Quincenal">Quincenal (dos veces al mes)</MenuItem>
          <MenuItem value="Anual">Anual (Bono 14, aguinaldo)</MenuItem>
        </TextField>
        <TextField
          label={esQuincenal ? 'Monto por quincena (Q)' : dosPagosAnuales ? 'Monto por pago (Q)' : 'Monto (Q)'}
          type="number" inputProps={{ step: 0.01, min: 0.01 }} required
          helperText={dosPagosAnuales ? 'Lo de cada pago, no el total del año' : undefined}
          value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />

        {esAnual && (
          <TextField select label="Mes del pago" required value={form.mes_1}
            onChange={e => setForm(f => ({ ...f, mes_1: e.target.value }))}>
            {MESES.map((m, i) => <MenuItem key={m} value={String(i + 1)}>{m}</MenuItem>)}
          </TextField>
        )}
        <TextField label={esAnual ? 'Día del pago' : 'Día de pago'} type="number"
          inputProps={{ min: 1, max: 31 }} required
          value={form.dia_mes} onChange={e => setForm(f => ({ ...f, dia_mes: e.target.value }))} />

        {esAnual && (
          <TextField select label="Segundo pago (opcional)" value={form.mes_2}
            helperText="El aguinaldo se paga mitad en diciembre y mitad en enero"
            onChange={e => setForm(f => ({ ...f, mes_2: e.target.value }))}>
            <MenuItem value="">Sin segundo pago</MenuItem>
            {MESES.map((m, i) => <MenuItem key={m} value={String(i + 1)}>{m}</MenuItem>)}
          </TextField>
        )}
        {(esQuincenal || dosPagosAnuales) && (
          <TextField
            label={esQuincenal ? 'Segundo día de pago' : 'Día del segundo pago'}
            type="number" inputProps={{ min: 1, max: 31 }} required
            title={esQuincenal
              ? 'El primer día de pago ya lo pusiste arriba — acá va la segunda fecha del mes (ej. si cobrás los 15 y los 30, acá va 30).'
              : 'Día del mes en que cae el segundo pago anual.'}
            value={form.dia_mes_2} onChange={e => setForm(f => ({ ...f, dia_mes_2: e.target.value }))}
          />
        )}
        <FormControlLabel
          control={<Checkbox checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />}
          label="Activo"
        />
        <Stack direction="row" sx={filaAcciones} className="sm:col-span-2">
          <Button type="submit" variant="contained">Guardar</Button>
          {editando && <Button type="button" variant="outlined" onClick={() => setEditando(null)}>Cancelar edición</Button>}
        </Stack>
      </form>

      {!recs.length && <Typography variant="body2" className="text-[var(--suave)]">Configurá tu salario acá para que la app lo registre cada mes.</Typography>}
      <div className="flex flex-col" style={{ maxHeight: 340, overflowY: 'auto' }}>
        {recs.map(r => (
          <Stack direction="row" sx={filaItem} key={r.id} className="border-t border-[var(--borde)] pt-2 pb-2">
            <span className={r.activo ? '' : 'opacity-50'}>
              <b>{r.descripcion}</b> ({r.categoria}) — {describir(r)}
            </span>
            <Stack direction="row" sx={filaAcciones}>
              <Button size="small" variant="outlined" onClick={() => setEditando(r)}>Editar</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => borrar(r)}>Eliminar</Button>
            </Stack>
          </Stack>
        ))}
      </div>
    </Card>
  );
}
