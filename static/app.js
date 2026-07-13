/* app.js — Lógica del frontend. Habla con la API local de FastAPI. */

// ---------- Utilidades ----------

// Formato de moneda: Q 1,234.56
const fmtQ = n => 'Q ' + Number(n).toLocaleString('en-US',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Fecha ISO (aaaa-mm-dd) -> dd/mm/aaaa para mostrar
const fmtFecha = iso => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };

// Fecha de hoy en ISO (en hora local, no UTC)
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

// Escapa texto para insertarlo en HTML sin romper la página
const esc = s => s == null ? '' : String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// Llamada a la API con manejo de errores uniforme
async function api(ruta, opciones = {}) {
  if (opciones.body && !(opciones.body instanceof FormData)) {
    opciones.headers = { 'Content-Type': 'application/json' };
    opciones.body = JSON.stringify(opciones.body);
  }
  const r = await fetch(ruta, opciones);
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.detail || `Error ${r.status}`);
  return datos;
}

// Aviso breve en pantalla
let toastTimer;
function toast(msg, esError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (esError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('oculto'), 2500);
}

// ---------- Estado global ----------
const estado = {
  catGasto: [], catIngreso: [], metodos: [], tarjetas: [], cuentas: [],
  dashAnio: new Date().getFullYear(),
  dashMes: new Date().getMonth() + 1,
  graficaBarras: null, graficaPastel: null,
};

// ---------- Navegación entre vistas ----------
$$('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  $$('.vista').forEach(v => v.classList.remove('activa'));
  $(`#vista-${btn.dataset.vista}`).classList.add('activa');
  $('#titulo-vista').textContent = btn.dataset.titulo || btn.textContent.trim();
  // Refrescar datos al entrar a cada vista
  if (btn.dataset.vista === 'dashboard') cargarDashboard();
  if (btn.dataset.vista === 'movimientos') cargarMovimientos();
  if (btn.dataset.vista === 'tarjetas') cargarTarjetasAdmin();
  if (btn.dataset.vista === 'ajustes') cargarAjustes();
}));

// ---------- Chips (botones de selección única) ----------
function pintarChips(contenedor, items, obtenerTexto) {
  const cont = typeof contenedor === 'string' ? $(contenedor) : contenedor;
  cont.innerHTML = '';
  items.forEach((item, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (i === 0 ? ' sel' : '');
    b.textContent = obtenerTexto(item);
    b.dataset.valor = JSON.stringify(item);
    b.addEventListener('click', () => {
      cont.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
      b.classList.add('sel');
    });
    cont.appendChild(b);
  });
}

function chipSeleccionado(contenedor) {
  const sel = $(contenedor).querySelector('.chip.sel');
  return sel ? JSON.parse(sel.dataset.valor) : null;
}

// ---------- Carga de catálogos ----------
async function cargarCatalogos() {
  [estado.catGasto, estado.catIngreso, estado.metodos, estado.tarjetas, estado.cuentas] =
    await Promise.all([
      api('/api/categorias?tipo=gasto'),
      api('/api/categorias?tipo=ingreso'),
      api('/api/metodos_pago'),
      api('/api/tarjetas'),
      api('/api/cuentas'),
    ]);
  pintarChips('#chips-cat-gasto', estado.catGasto, c => c.nombre);
  pintarChips('#chips-cat-ingreso', estado.catIngreso, c => c.nombre);
  pintarChips('#chips-metodo', estado.metodos, m => m.etiqueta);
  pintarChips('#chips-tarjeta-pago', estado.tarjetas, t => t.nombre);

  // Chips de cuenta (opcionales: la primera opción es "ninguna")
  const conNinguna = [{ id: null, nombre: 'Sin cuenta' }, ...estado.cuentas];
  pintarChips('#chips-cuenta-gasto', estado.cuentas.length ? [...estado.cuentas, { id: null, nombre: 'Sin cuenta' }] : [], c => c.nombre);
  pintarChips('#chips-cuenta-pago', conNinguna, c => c.nombre);
  pintarChips('#chips-cuenta-ingreso', conNinguna, c => c.nombre);
  actualizarFilaCuentaGasto();
}

// Mostrar los chips de cuenta en el gasto solo si el método es Débito/Transferencia
function actualizarFilaCuentaGasto() {
  const met = chipSeleccionado('#chips-metodo');
  const visible = met && (met.metodo === 'Débito' || met.metodo === 'Transferencia')
    && estado.cuentas.length > 0;
  $('#fila-cuenta-gasto').classList.toggle('oculto', !visible);
}
$('#chips-metodo').addEventListener('click', actualizarFilaCuentaGasto);

// ============================================================
// REGISTRO RÁPIDO
// ============================================================

// Cambiar entre formularios (+Gasto / +Pago tarjeta / +Ingreso)
$$('.tipo-btn').forEach(btn => btn.addEventListener('click', () => {
  $$('.tipo-btn').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
  $$('.form-registro').forEach(f => f.classList.add('oculto'));
  const form = $(`#form-${btn.dataset.form}`);
  form.classList.remove('oculto');
  form.querySelector('[name="monto"]').focus();
}));

// Precargar la fecha de hoy en todos los formularios
function precargarFechas() {
  $$('input[type="date"]').forEach(i => { if (!i.value) i.value = hoyISO(); });
}

// Deja el formulario listo para el siguiente registro (conserva fecha y selección)
function resetearForm(form) {
  form.querySelector('[name="monto"]').value = '';
  const desc = form.querySelector('[name="descripcion"]');
  if (desc) desc.value = '';
  form.querySelector('[name="monto"]').focus();
}

// --- Guardar gasto ---
$('#form-gasto').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const cat = chipSeleccionado('#chips-cat-gasto');
  const met = chipSeleccionado('#chips-metodo');
  if (!cat) return toast('Elegí una categoría', true);
  if (!met) return toast('Elegí un método de pago', true);
  // Cuenta de la que salió el dinero (solo aplica a Débito/Transferencia)
  const ctaG = (met.metodo === 'Débito' || met.metodo === 'Transferencia')
    ? chipSeleccionado('#chips-cuenta-gasto') : null;
  try {
    await api('/api/gastos', { method: 'POST', body: {
      fecha: f.fecha.value, descripcion: f.descripcion.value,
      categoria_id: cat.id, metodo: met.metodo, tarjeta_id: met.tarjeta_id,
      cuenta_id: ctaG ? ctaG.id : null,
      monto: parseFloat(f.monto.value),
    }});
    toast(`Gasto de ${fmtQ(f.monto.value)} guardado ✓`);
    resetearForm(f);
  } catch (err) { toast(err.message, true); }
});

// --- Guardar pago de tarjeta ---
$('#form-pago').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const tarjeta = chipSeleccionado('#chips-tarjeta-pago');
  if (!tarjeta) return toast('Elegí la tarjeta', true);
  const ctaP = chipSeleccionado('#chips-cuenta-pago');
  try {
    await api('/api/pagos_tarjetas', { method: 'POST', body: {
      fecha: f.fecha.value, tarjeta_id: tarjeta.id,
      cuenta_id: ctaP ? ctaP.id : null,
      monto: parseFloat(f.monto.value),
    }});
    toast(`Pago de ${fmtQ(f.monto.value)} a ${tarjeta.nombre} guardado ✓`);
    resetearForm(f);
  } catch (err) { toast(err.message, true); }
});

// --- Guardar ingreso ---
$('#form-ingreso').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const cat = chipSeleccionado('#chips-cat-ingreso');
  if (!cat) return toast('Elegí una categoría', true);
  const ctaI = chipSeleccionado('#chips-cuenta-ingreso');
  try {
    await api('/api/ingresos', { method: 'POST', body: {
      fecha: f.fecha.value, descripcion: f.descripcion.value,
      categoria_id: cat.id, cuenta_id: ctaI ? ctaI.id : null,
      monto: parseFloat(f.monto.value),
    }});
    toast(`Ingreso de ${fmtQ(f.monto.value)} guardado ✓`);
    resetearForm(f);
  } catch (err) { toast(err.message, true); }
});

// --- Aviso de ingresos recurrentes y pagos frecuentes pendientes ---
async function revisarSalarioPendiente() {
  const aviso = $('#aviso-salario');
  try {
    const [pendIng, pendGas] = await Promise.all([
      api('/api/recurrentes/pendientes'),
      api('/api/gastos_recurrentes/pendientes'),
    ]);
    estado.pendientes = pendIng;
    estado.pendientesGastos = pendGas;
    if (!pendIng.length && !pendGas.length) { aviso.classList.add('oculto'); return; }
    // Se muestran TODOS los pendientes, cada uno con Confirmar y Omitir
    let html = pendIng.map((p, i) => `
      <span>💵 Confirmar ingreso <b>${esc(p.etiqueta)}</b> de <b>${p.mes_nombre}</b>:</span>
      <input type="number" step="0.01" min="0.01" id="monto-pend-${i}" value="${p.monto}">
      <button onclick="confirmarPendiente(${i})">Confirmar</button>
      <button class="mini-btn" onclick="omitirPendiente(${i})"
              title="No lo recibiste este mes: descarta el aviso sin crear el ingreso">Omitir</button>
      <br>`).join('');
    html += pendGas.map((p, i) => `
      <span>💸 Confirmar pago <b>${esc(p.etiqueta)}</b> de <b>${p.mes_nombre}</b>
        <small>(${esc(p.metodo === 'Tarjeta' ? p.tarjeta : p.metodo)})</small>:</span>
      <input type="number" step="0.01" min="0.01" id="monto-pendg-${i}" value="${p.monto}">
      <button onclick="confirmarPendienteGasto(${i})">Confirmar</button>
      <button class="mini-btn" onclick="omitirPendienteGasto(${i})"
              title="No lo pagaste este mes: descarta el aviso sin crear el gasto">Omitir</button>
      <br>`).join('');
    aviso.innerHTML = html;
    aviso.classList.remove('oculto');
  } catch { aviso.classList.add('oculto'); }
}

async function confirmarPendiente(i) {
  const p = estado.pendientes[i];
  try {
    await api(`/api/recurrentes/${p.id}/confirmar`, { method: 'POST',
      body: { monto: parseFloat($(`#monto-pend-${i}`).value), quincena: p.quincena } });
    toast(`${p.etiqueta} confirmado ✓`);
    revisarSalarioPendiente();
  } catch (err) { toast(err.message, true); }
}

async function omitirPendiente(i) {
  const p = estado.pendientes[i];
  if (!confirm(`¿Omitir "${p.etiqueta}" este mes? No se creará el ingreso y el aviso desaparecerá.`)) return;
  try {
    await api(`/api/recurrentes/${p.id}/omitir?quincena=${p.quincena}`, { method: 'POST' });
    toast(`${p.etiqueta} omitido este mes`);
    revisarSalarioPendiente();
  } catch (err) { toast(err.message, true); }
}

async function confirmarPendienteGasto(i) {
  const p = estado.pendientesGastos[i];
  try {
    await api(`/api/gastos_recurrentes/${p.id}/confirmar`, { method: 'POST',
      body: { monto: parseFloat($(`#monto-pendg-${i}`).value), quincena: p.quincena } });
    toast(`Pago ${p.etiqueta} registrado ✓`);
    revisarSalarioPendiente();
  } catch (err) { toast(err.message, true); }
}

async function omitirPendienteGasto(i) {
  const p = estado.pendientesGastos[i];
  if (!confirm(`¿Omitir el pago "${p.etiqueta}" este mes? No se creará el gasto.`)) return;
  try {
    await api(`/api/gastos_recurrentes/${p.id}/omitir?quincena=${p.quincena}`, { method: 'POST' });
    toast(`Pago ${p.etiqueta} omitido este mes`);
    revisarSalarioPendiente();
  } catch (err) { toast(err.message, true); }
}

// ============================================================
// TEMA (claro / oscuro) Y PALETA DE GRÁFICAS
// ============================================================

// Paleta categórica validada (CVD-safe) por tema; ver README de diseño.
const PALETA = {
  dark: {
    ingresos: '#3987e5', gastos: '#e66767',
    pie: ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'],
    tinta: '#a1a1aa', grid: 'rgba(255,255,255,.07)', superficie: '#131316',
  },
  light: {
    ingresos: '#2a78d6', gastos: '#e34948',
    pie: ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'],
    tinta: '#52514e', grid: '#e7e6e1', superficie: '#ffffff',
  },
};

const temaActual = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  localStorage.setItem('tema', tema);
  // El ícono sol/luna del botón lo resuelve el CSS según :root[data-theme]
  if ($('#vista-dashboard').classList.contains('activa')) cargarDashboard();
}
$('#btn-tema').addEventListener('click', () =>
  aplicarTema(temaActual() === 'dark' ? 'light' : 'dark'));

// Number ticker (Magic UI): anima los montos de 0 a su valor
function animarTickers(raiz) {
  raiz.querySelectorAll('[data-ticker]').forEach(el => {
    const valor = parseFloat(el.dataset.ticker);
    const inicio = performance.now(), dur = 650;
    const ease = t => 1 - Math.pow(1 - t, 3);
    function paso(ahora) {
      const p = Math.min(1, (ahora - inicio) / dur);
      el.textContent = fmtQ(valor * ease(p));
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  });
}

// ============================================================
// DASHBOARD
// ============================================================

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

$('#mes-prev').addEventListener('click', () => cambiarMes(-1));
$('#mes-next').addEventListener('click', () => cambiarMes(1));

function cambiarMes(delta) {
  estado.dashMes += delta;
  if (estado.dashMes < 1) { estado.dashMes = 12; estado.dashAnio--; }
  if (estado.dashMes > 12) { estado.dashMes = 1; estado.dashAnio++; }
  cargarDashboard();
}

function claseUso(pct) {
  return pct < 30 ? 'uso-verde' : pct <= 70 ? 'uso-amarillo' : 'uso-rojo';
}

async function cargarDashboard() {
  const d = await api(`/api/dashboard?anio=${estado.dashAnio}&mes=${estado.dashMes}`);
  $('#titulo-mes').textContent = `${MESES[d.mes]} ${d.anio}`;
  $('#anio-barras').textContent = d.anio;

  // Alerta de salud financiera: la deuda rebasa los ingresos del mes
  const banner = $('#banner-deuda');
  if (d.deuda_supera_ingresos) {
    banner.textContent = `⚠️ Tu deuda en tarjetas (${fmtQ(d.deuda_total)}) rebasa tus ingresos del mes (${fmtQ(d.ingresos)})`;
    banner.classList.remove('oculto');
  } else banner.classList.add('oculto');

  // Métricas principales: stat tiles estilo Dsign (ícono en chip pastel + número animado)
  const claseBalance = d.balance >= 0 ? 'positivo' : 'negativo';
  const clasePatri = d.patrimonio >= 0 ? 'positivo' : 'negativo';
  const tiles = [
    { t: 'Ingresos del mes', v: d.ingresos, cls: 'positivo', icono: '💰', tinte: '#0e8a2f' },
    { t: 'Gastos del mes', v: d.gastos, cls: 'negativo', icono: '💸', tinte: '#d03b3b' },
    { t: 'Balance', v: d.balance, cls: claseBalance, icono: '⚖️', tinte: '#2563eb' },
    { t: 'Dinero en cuentas', v: d.dinero_total, cls: '', icono: '🏦', tinte: '#0891b2' },
    { t: 'Deuda en tarjetas', v: d.deuda_total, cls: '', icono: '💳', tinte: '#eda100' },
    { t: 'Patrimonio', v: d.patrimonio, cls: clasePatri, icono: '📈', tinte: '#7c6cf0' },
  ];
  $('#metricas').innerHTML = tiles.map(m => `
    <div class="metrica">
      <div class="icono-metrica" style="--tinte:${m.tinte}">${m.icono}</div>
      <div class="metrica-info">
        <div class="valor ${m.cls}" data-ticker="${m.v}">Q 0.00</div>
        <div class="titulo">${m.t}</div>
      </div>
    </div>`).join('');
  animarTickers($('#metricas'));

  // Panel del salario (métrica clave del asalariado)
  const dias = d.dias_proximo_salario;
  $('#panel-salario').innerHTML = `
    <div>
      <div class="chico">Disponible del salario este mes</div>
      <div class="grande" data-ticker="${d.disponible_salario}">Q 0.00</div>
    </div>
    <div>
      <div class="chico">Próximo salario</div>
      <div class="grande">${dias === null ? '—' : dias === 0 ? '¡HOY!' : `en ${dias} días`}</div>
    </div>
    <div>
      <div class="chico">Ritmo diario disponible</div>
      <div class="grande">${dias ? fmtQ(Math.max(0, d.disponible_salario) / dias) + '/día' : '—'}</div>
    </div>`;
  animarTickers($('#panel-salario'));

  // Gráficas con la paleta del tema activo (validada para daltonismo)
  const pal = PALETA[temaActual()];

  // Barras: ingresos vs gastos por mes (par azul/rojo del tema, leyenda siempre)
  if (estado.graficaBarras) { estado.graficaBarras.destroy(); estado.graficaBarras = null; }
  const hayBarras = d.barras.ingresos.some(v => v) || d.barras.gastos.some(v => v);
  $('#grafica-barras').classList.toggle('oculto', !hayBarras);
  $('#vacio-barras').classList.toggle('oculto', hayBarras);
  if (hayBarras) estado.graficaBarras = new Chart($('#grafica-barras'), {
    type: 'bar',
    data: {
      labels: d.barras.labels,
      datasets: [
        { label: 'Ingresos', data: d.barras.ingresos, backgroundColor: pal.ingresos,
          borderRadius: 4, borderSkipped: 'bottom' },
        { label: 'Gastos', data: d.barras.gastos, backgroundColor: pal.gastos,
          borderRadius: 4, borderSkipped: 'bottom' },
      ],
    },
    options: {
      responsive: true,
      color: pal.tinta,
      plugins: {
        legend: { labels: { color: pal.tinta, boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtQ(c.raw)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: pal.tinta },
             border: { color: pal.grid } },
        y: { grid: { color: pal.grid }, border: { display: false },
             ticks: { color: pal.tinta, callback: v => 'Q ' + v.toLocaleString() } },
      },
    },
  });

  // Pastel: gastos por categoría. Máximo 8 porciones (el resto se pliega en
  // "Otras"), con separador de 2px color superficie entre porciones.
  if (estado.graficaPastel) { estado.graficaPastel.destroy(); estado.graficaPastel = null; }
  let pieLabels = [...d.pastel.labels], pieDatos = [...d.pastel.datos];
  if (pieLabels.length > 8) {
    const resto = pieDatos.slice(7).reduce((a, b) => a + b, 0);
    pieLabels = [...pieLabels.slice(0, 7), 'Otras'];
    pieDatos = [...pieDatos.slice(0, 7), Math.round(resto * 100) / 100];
  }
  $('#grafica-pastel').classList.toggle('oculto', pieDatos.length > 0 ? false : true);
  $('#vacio-pastel').classList.toggle('oculto', pieDatos.length > 0);
  if (pieDatos.length) estado.graficaPastel = new Chart($('#grafica-pastel'), {
    type: 'pie',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieDatos, backgroundColor: pal.pie,
        borderColor: pal.superficie, borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom',
                  labels: { color: pal.tinta, boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: c => `${c.label}: ${fmtQ(c.raw)}` } },
      },
    },
  });

  // Cuentas: cuánto dinero hay en cada una
  const contC = $('#lista-cuentas-dash');
  if (!d.cuentas.length) {
    contC.innerHTML = '<p class="texto-suave">Sin cuentas registradas. Agregalas en la pestaña Bancos para saber cuánto dinero tenés.</p>';
  } else {
    contC.innerHTML = d.cuentas.map(c => `
      <div class="analisis-fila">
        <span><b>${esc(c.nombre)}</b> <small>(${esc(c.banco)} · ${c.tipo})</small></span>
        <span class="${c.saldo >= 0 ? 'delta-baja' : 'delta-sube'}">${fmtQ(c.saldo)}</span>
      </div>`).join('') +
      `<div class="analisis-fila"><span><b>Total</b></span><b>${fmtQ(d.dinero_total)}</b></div>`;
  }

  // Análisis: en qué gastás más, cómo cambió vs el mes pasado y tus gastos más grandes
  const a = d.analisis;
  let htmlA = '';
  if (!a.top_categorias.length) {
    htmlA = '<p class="texto-suave">Sin gastos este mes todavía.</p>';
  } else {
    htmlA += '<div class="analisis-sub">Top categorías (% del gasto del mes · vs mes anterior)</div>';
    htmlA += a.top_categorias.map(c => {
      let delta;
      if (c.variacion_pct === null) delta = '<span class="delta-nuevo">nuevo</span>';
      else if (c.variacion_pct > 0) delta = `<span class="delta-sube">▲ ${c.variacion_pct}%</span>`;
      else delta = `<span class="delta-baja">▼ ${Math.abs(c.variacion_pct)}%</span>`;
      return `<div class="analisis-fila">
        <span><b>${esc(c.nombre)}</b> <small>${c.pct}% del mes</small></span>
        <span>${fmtQ(c.total)} ${delta}</span></div>`;
    }).join('');
    htmlA += '<div class="analisis-sub">Tus 5 gastos más grandes del mes (el "porqué")</div>';
    htmlA += a.top_gastos.map(g => `
      <div class="analisis-fila">
        <span>${fmtFecha(g.fecha)} — ${esc(g.descripcion) || '(sin descripción)'} <small>(${esc(g.categoria)})</small></span>
        <b>${fmtQ(g.monto)}</b></div>`).join('');
    if (a.gastos_mes_anterior > 0) {
      const varTotal = ((d.gastos - a.gastos_mes_anterior) / a.gastos_mes_anterior * 100).toFixed(1);
      htmlA += `<p class="texto-suave" style="margin-top:10px">Gasto total vs mes anterior: ${fmtQ(a.gastos_mes_anterior)} → ${fmtQ(d.gastos)} (${varTotal > 0 ? '+' : ''}${varTotal}%)</p>`;
    }
  }
  $('#panel-analisis').innerHTML = htmlA;

  // Lista de tarjetas con barra de uso y días a corte/pago
  const cont = $('#lista-tarjetas-dash');
  if (!d.tarjetas.length) {
    cont.innerHTML = '<p class="texto-suave">Sin tarjetas registradas. Agregalas en la pestaña Tarjetas.</p>';
  } else {
    cont.innerHTML = d.tarjetas.map(t => `
      <div class="tarjeta-fila">
        <div class="tarjeta-cab">
          <b>${t.nombre}</b>
          <span>Saldo: <b>${fmtQ(t.saldo)}</b> · Disponible: ${fmtQ(t.disponible)}</span>
        </div>
        <div class="barra-uso">
          <div class="${claseUso(t.pct_uso)}" style="width:${Math.min(100, Math.max(0, t.pct_uso))}%"></div>
        </div>
        <div class="tarjeta-datos">
          ${t.pct_uso}% de uso · Corte en ${t.dias_corte} días (${fmtFecha(t.proximo_corte)})
          · Pago en ${t.dias_pago} días (${fmtFecha(t.proximo_pago)})
        </div>
      </div>`).join('');
  }
}

// ============================================================
// MOVIMIENTOS
// ============================================================

function llenarFiltros() {
  const selCat = $('#filtro-categoria');
  selCat.innerHTML = '<option value="">Todas las categorías</option>';
  [...estado.catGasto, ...estado.catIngreso].forEach(c => {
    selCat.innerHTML += `<option value="${c.id}">${c.nombre} (${c.tipo})</option>`;
  });
  const selMet = $('#filtro-metodo');
  selMet.innerHTML = '<option value="">Todos los métodos</option>';
  estado.metodos.forEach(m => {
    const val = m.tarjeta_id ? `Tarjeta:${m.tarjeta_id}` : m.metodo;
    selMet.innerHTML += `<option value="${val}">${m.etiqueta}</option>`;
  });
}

$('#btn-filtrar').addEventListener('click', cargarMovimientos);

async function cargarMovimientos() {
  const params = new URLSearchParams();
  if ($('#filtro-mes').value) params.set('mes', $('#filtro-mes').value);
  if ($('#filtro-categoria').value) params.set('categoria_id', $('#filtro-categoria').value);
  const met = $('#filtro-metodo').value;
  if (met) {
    if (met.startsWith('Tarjeta:')) {
      params.set('metodo', 'Tarjeta');
      params.set('tarjeta_id', met.split(':')[1]);
    } else params.set('metodo', met);
  }
  const movs = await api('/api/movimientos?' + params);
  estado.movs = movs;  // se guardan para editar/eliminar por índice
  const cont = $('#tabla-movimientos');
  if (!movs.length) {
    cont.innerHTML = '<p class="texto-suave">No hay movimientos con esos filtros.</p>';
    return;
  }
  cont.innerHTML = `<div class="tabla-scroll"><table>
    <tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Categoría</th>
        <th>Método</th><th style="text-align:right">Monto</th><th></th></tr>
    ${movs.map((m, i) => `
      <tr class="mov-${m.tipo}">
        <td>${fmtFecha(m.fecha)}</td>
        <td><span class="etq ${m.tipo}">${m.tipo}</span></td>
        <td>${esc(m.descripcion) || '—'}</td>
        <td>${esc(m.categoria) || '—'}</td>
        <td>${esc(m.metodo_etiqueta)}</td>
        <td class="num">${m.tipo === 'ingreso' ? '+' : '−'}${fmtQ(m.monto)}</td>
        <td>
          <button class="accion" title="Editar" onclick="abrirEdicion(${i})">✏️</button>
          <button class="accion" title="Eliminar" onclick="eliminarMovimiento(${i})">🗑️</button>
        </td>
      </tr>`).join('')}
  </table></div>`;
}

const RUTAS_TIPO = { ingreso: 'ingresos', gasto: 'gastos', pago: 'pagos_tarjetas' };

async function eliminarMovimiento(idx) {
  const m = estado.movs[idx];
  if (!confirm(`¿Eliminar este ${m.tipo} de ${fmtQ(m.monto)}?`)) return;
  try {
    await api(`/api/${RUTAS_TIPO[m.tipo]}/${m.id}`, { method: 'DELETE' });
    toast('Registro eliminado ✓');
    cargarMovimientos();
  } catch (err) { toast(err.message, true); }
}

// --- Modal de edición de movimientos ---
function abrirEdicion(idx) {
  const m = estado.movs[idx];
  const cuerpo = $('#modal-cuerpo');
  let html = `
    <label>Fecha</label><input type="date" id="ed-fecha" value="${m.fecha}">
    <label>Monto (Q)</label><input type="number" step="0.01" min="0.01" id="ed-monto" value="${m.monto}">`;

  if (m.tipo !== 'pago') {
    const cats = m.tipo === 'gasto' ? estado.catGasto : estado.catIngreso;
    html += `<label>Descripción</label><input type="text" id="ed-desc" value="${esc(m.descripcion)}">`;
    html += `<label>Categoría</label><select id="ed-cat">${cats.map(c =>
      `<option value="${c.id}" ${c.id === m.categoria_id ? 'selected' : ''}>${c.nombre}</option>`).join('')}</select>`;
  }
  // Selector de cuenta (opcional) para todos los tipos
  const selectCuenta = `<label>Cuenta</label><select id="ed-cuenta">
    <option value="">Sin cuenta</option>${estado.cuentas.map(c =>
      `<option value="${c.id}" ${c.id === m.cuenta_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
  </select>`;

  if (m.tipo === 'gasto') {
    html += `<label>Método</label><select id="ed-metodo">${estado.metodos.map(x => {
      const val = x.tarjeta_id ? `Tarjeta:${x.tarjeta_id}` : x.metodo;
      const sel = (x.tarjeta_id ? m.tarjeta_id === x.tarjeta_id : m.metodo === x.metodo) ? 'selected' : '';
      return `<option value="${val}" ${sel}>${x.etiqueta}</option>`;
    }).join('')}</select>`;
    html += selectCuenta;
  }
  if (m.tipo === 'ingreso') html += selectCuenta;
  if (m.tipo === 'pago') {
    html += `<label>Tarjeta</label><select id="ed-tarjeta">${estado.tarjetas.map(t =>
      `<option value="${t.id}" ${t.id === m.tarjeta_id ? 'selected' : ''}>${t.nombre}</option>`).join('')}</select>`;
    html += selectCuenta;
  }

  cuerpo.innerHTML = html;
  $('#modal-titulo').textContent = `Editar ${m.tipo}`;
  $('#modal').classList.remove('oculto');

  $('#modal-guardar').onclick = async () => {
    try {
      const cuentaSel = $('#ed-cuenta') ? (parseInt($('#ed-cuenta').value) || null) : null;
      let body;
      if (m.tipo === 'gasto') {
        const val = $('#ed-metodo').value;
        const esTarjeta = val.startsWith('Tarjeta:');
        body = {
          fecha: $('#ed-fecha').value, descripcion: $('#ed-desc').value,
          categoria_id: parseInt($('#ed-cat').value),
          metodo: esTarjeta ? 'Tarjeta' : val,
          tarjeta_id: esTarjeta ? parseInt(val.split(':')[1]) : null,
          cuenta_id: cuentaSel,
          monto: parseFloat($('#ed-monto').value),
        };
      } else if (m.tipo === 'ingreso') {
        body = {
          fecha: $('#ed-fecha').value, descripcion: $('#ed-desc').value,
          categoria_id: parseInt($('#ed-cat').value),
          cuenta_id: cuentaSel,
          monto: parseFloat($('#ed-monto').value),
        };
      } else {
        body = {
          fecha: $('#ed-fecha').value, tarjeta_id: parseInt($('#ed-tarjeta').value),
          cuenta_id: cuentaSel,
          monto: parseFloat($('#ed-monto').value),
        };
      }
      await api(`/api/${RUTAS_TIPO[m.tipo]}/${m.id}`, { method: 'PUT', body });
      toast('Registro actualizado ✓');
      cerrarModal();
      cargarMovimientos();
    } catch (err) { toast(err.message, true); }
  };
}

function cerrarModal() { $('#modal').classList.add('oculto'); }
$('#modal-cerrar').addEventListener('click', cerrarModal);

// ============================================================
// BANCOS: CUENTAS + TARJETAS (administración)
// ============================================================

async function cargarCuentasAdmin() {
  const cuentas = await api('/api/cuentas?incluir_inactivas=true');
  estado.cuentasAdmin = cuentas;
  const cont = $('#lista-cuentas-admin');
  if (!cuentas.length) {
    cont.innerHTML = '<p class="texto-suave">Registrá tus cuentas Monetaria y de Ahorro para saber cuánto dinero tenés.</p>';
    return;
  }
  cont.innerHTML = cuentas.map((c, i) => `
    <div class="item-lista">
      <span class="${c.activa ? '' : 'inactivo'}">
        <b>${esc(c.nombre)}</b> (${esc(c.banco)} · ${c.tipo}) — saldo <b>${fmtQ(c.saldo)}</b>
      </span>
      <button class="mini-btn" onclick="editarCuenta(${i})">Editar</button>
    </div>`).join('');
}

function editarCuenta(idx) {
  const c = estado.cuentasAdmin[idx];
  const f = $('#form-cuenta');
  f.reg_id.value = c.id; f.banco.value = c.banco; f.nombre.value = c.nombre;
  f.tipo.value = c.tipo; f.saldo_inicial.value = c.saldo_inicial;
  f.activa.checked = !!c.activa;
  $('#titulo-form-cuenta').textContent = `Editar: ${c.nombre}`;
  $('#cancelar-cuenta').classList.remove('oculto');
  f.scrollIntoView({ behavior: 'smooth' });
}

$('#cancelar-cuenta').addEventListener('click', () => {
  const f = $('#form-cuenta');
  f.reset(); f.reg_id.value = '';
  $('#titulo-form-cuenta').textContent = 'Nueva cuenta (Monetaria / Ahorro)';
  $('#cancelar-cuenta').classList.add('oculto');
});

$('#form-cuenta').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const body = {
    banco: f.banco.value, nombre: f.nombre.value, tipo: f.tipo.value,
    saldo_inicial: parseFloat(f.saldo_inicial.value || 0),
    activa: f.activa.checked,
  };
  try {
    if (f.reg_id.value) await api(`/api/cuentas/${f.reg_id.value}`, { method: 'PUT', body });
    else await api('/api/cuentas', { method: 'POST', body });
    toast('Cuenta guardada ✓');
    $('#cancelar-cuenta').click();
    await cargarCatalogos();  // refrescar chips de cuenta
    cargarCuentasAdmin();
  } catch (err) { toast(err.message, true); }
});

async function cargarTarjetasAdmin() {
  cargarCuentasAdmin();  // la vista Bancos muestra cuentas y tarjetas juntas
  const tarjetas = await api('/api/tarjetas?incluir_inactivas=true');
  estado.tarjetasAdmin = tarjetas;
  const cont = $('#lista-tarjetas-admin');
  if (!tarjetas.length) {
    cont.innerHTML = '<p class="texto-suave">Todavía no tenés tarjetas registradas.</p>';
    return;
  }
  cont.innerHTML = tarjetas.map((t, i) => `
    <div class="item-lista">
      <span class="${t.activa ? '' : 'inactivo'}">
        <b>${esc(t.nombre)}</b> (${esc(t.banco)}) — Límite ${fmtQ(t.limite)} ·
        corte día ${t.dia_corte} · pago día ${t.dia_pago} · saldo ${fmtQ(t.saldo)}
        ${t.saldo_inicial ? `<small>(traía ${fmtQ(t.saldo_inicial)})</small>` : ''}
      </span>
      <button class="mini-btn" onclick="editarTarjeta(${i})">Editar</button>
    </div>`).join('');
}

function editarTarjeta(idx) {
  const t = estado.tarjetasAdmin[idx];
  const f = $('#form-tarjeta');
  f.reg_id.value = t.id; f.banco.value = t.banco; f.nombre.value = t.nombre;
  f.limite.value = t.limite; f.dia_corte.value = t.dia_corte;
  f.dia_pago.value = t.dia_pago; f.saldo_inicial.value = t.saldo_inicial;
  f.activa.checked = !!t.activa;
  $('#titulo-form-tarjeta').textContent = `Editar: ${t.nombre}`;
  $('#cancelar-tarjeta').classList.remove('oculto');
  f.scrollIntoView({ behavior: 'smooth' });
}

$('#cancelar-tarjeta').addEventListener('click', () => {
  const f = $('#form-tarjeta');
  f.reset(); f.reg_id.value = '';
  $('#titulo-form-tarjeta').textContent = 'Nueva tarjeta';
  $('#cancelar-tarjeta').classList.add('oculto');
});

$('#form-tarjeta').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const body = {
    banco: f.banco.value, nombre: f.nombre.value,
    limite: parseFloat(f.limite.value),
    dia_corte: parseInt(f.dia_corte.value), dia_pago: parseInt(f.dia_pago.value),
    saldo_inicial: parseFloat(f.saldo_inicial.value || 0),
    activa: f.activa.checked,
  };
  try {
    if (f.reg_id.value) await api(`/api/tarjetas/${f.reg_id.value}`, { method: 'PUT', body });
    else await api('/api/tarjetas', { method: 'POST', body });
    toast('Tarjeta guardada ✓');
    $('#cancelar-tarjeta').click();
    await cargarCatalogos();  // refrescar métodos de pago
    llenarFiltros();
    cargarTarjetasAdmin();
  } catch (err) { toast(err.message, true); }
});

// ============================================================
// AJUSTES: recurrentes, categorías, Notion, CSV
// ============================================================

async function cargarAjustes() {
  // Categorías de ingreso para el selector de recurrentes
  const sel = $('#sel-cat-rec');
  sel.innerHTML = estado.catIngreso.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  // Selectores del formulario de pagos frecuentes
  $('#sel-cat-grec').innerHTML = estado.catGasto.map(c =>
    `<option value="${c.id}">${c.nombre}</option>`).join('');
  $('#sel-metodo-grec').innerHTML = estado.metodos.map(m => {
    const val = m.tarjeta_id ? `Tarjeta:${m.tarjeta_id}` : m.metodo;
    return `<option value="${val}">${esc(m.etiqueta)}</option>`;
  }).join('');
  $('#sel-cuenta-grec').innerHTML = '<option value="">Sin cuenta</option>' +
    estado.cuentas.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  actualizarFormGastoRec();

  await Promise.all([cargarRecurrentes(), cargarGastosRec(),
                     cargarCategoriasAdmin(), cargarEstadoNotion()]);
}

// --- Ingresos recurrentes ---
async function cargarRecurrentes() {
  const recs = await api('/api/recurrentes');
  estado.recurrentes = recs;
  const cont = $('#lista-recurrentes');
  if (!recs.length) {
    cont.innerHTML = '<p class="texto-suave">Configurá tu salario acá para que la app lo registre cada mes.</p>';
    return;
  }
  cont.innerHTML = recs.map((r, i) => `
    <div class="item-lista">
      <span class="${r.activo ? '' : 'inactivo'}">
        <b>${esc(r.descripcion)}</b> (${esc(r.categoria)}) —
        ${r.frecuencia === 'Quincenal'
          ? `${fmtQ(r.monto)} por quincena, los días ${r.dia_mes} y ${r.dia_mes_2}`
          : `${fmtQ(r.monto)} el día ${r.dia_mes}`}
      </span>
      <span>
        <button class="mini-btn" onclick="editarRecurrente(${i})">Editar</button>
        <button class="mini-btn peligro" onclick="borrarRecurrente(${i})">Eliminar</button>
      </span>
    </div>`).join('');
}

async function borrarRecurrente(idx) {
  const r = estado.recurrentes[idx];
  if (!confirm(`¿Eliminar "${r.descripcion}" definitivamente?\n` +
               'Los ingresos ya registrados en Movimientos NO se borran.')) return;
  try {
    await api(`/api/recurrentes/${r.id}`, { method: 'DELETE' });
    toast('Ingreso recurrente eliminado ✓');
    cargarRecurrentes();
    revisarSalarioPendiente();
  } catch (err) { toast(err.message, true); }
}

// Mostrar el campo del segundo día solo si la frecuencia es quincenal
function actualizarFormRecurrente() {
  const f = $('#form-recurrente');
  const esQuincenal = f.frecuencia.value === 'Quincenal';
  $('#lbl-dia2-rec').classList.toggle('oculto', !esQuincenal);
  f.dia_mes_2.required = esQuincenal;
  $('#lbl-monto-rec').firstChild.textContent = esQuincenal ? 'Monto por quincena (Q) ' : 'Monto (Q) ';
}
$('#sel-frec-rec').addEventListener('change', actualizarFormRecurrente);

function editarRecurrente(idx) {
  const r = estado.recurrentes[idx];
  const f = $('#form-recurrente');
  f.reg_id.value = r.id; f.descripcion.value = r.descripcion;
  f.categoria_id.value = r.categoria_id; f.monto.value = r.monto;
  f.dia_mes.value = r.dia_mes; f.activo.checked = !!r.activo;
  f.frecuencia.value = r.frecuencia || 'Mensual';
  f.dia_mes_2.value = r.dia_mes_2 || '';
  actualizarFormRecurrente();
  $('#titulo-form-rec').textContent = `Editar: ${r.descripcion}`;
  $('#cancelar-rec').classList.remove('oculto');
}

$('#cancelar-rec').addEventListener('click', () => {
  const f = $('#form-recurrente');
  f.reset(); f.reg_id.value = '';
  actualizarFormRecurrente();
  $('#titulo-form-rec').textContent = 'Ingresos recurrentes (salario)';
  $('#cancelar-rec').classList.add('oculto');
});

$('#form-recurrente').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const body = {
    descripcion: f.descripcion.value, categoria_id: parseInt(f.categoria_id.value),
    monto: parseFloat(f.monto.value), dia_mes: parseInt(f.dia_mes.value),
    frecuencia: f.frecuencia.value,
    dia_mes_2: f.frecuencia.value === 'Quincenal' ? parseInt(f.dia_mes_2.value) : null,
    activo: f.activo.checked,
  };
  try {
    if (f.reg_id.value) await api(`/api/recurrentes/${f.reg_id.value}`, { method: 'PUT', body });
    else await api('/api/recurrentes', { method: 'POST', body });
    toast('Ingreso recurrente guardado ✓');
    $('#cancelar-rec').click();
    cargarRecurrentes();
    revisarSalarioPendiente();
  } catch (err) { toast(err.message, true); }
});

// --- Pagos frecuentes (gastos recurrentes) ---
async function cargarGastosRec() {
  const recs = await api('/api/gastos_recurrentes');
  estado.gastosRec = recs;
  const cont = $('#lista-gastos-rec');
  if (!recs.length) {
    cont.innerHTML = '<p class="texto-suave">Sin pagos frecuentes configurados todavía.</p>';
    return;
  }
  cont.innerHTML = recs.map((r, i) => `
    <div class="item-lista">
      <span class="${r.activo ? '' : 'inactivo'}">
        <b>${esc(r.descripcion)}</b> (${esc(r.categoria)}) —
        ${r.frecuencia === 'Quincenal'
          ? `${fmtQ(r.monto)} por quincena, los días ${r.dia_mes} y ${r.dia_mes_2}`
          : `${fmtQ(r.monto)} el día ${r.dia_mes}`}
        · ${esc(r.metodo === 'Tarjeta' ? r.tarjeta : r.metodo)}${r.cuenta ? ` (${esc(r.cuenta)})` : ''}
      </span>
      <span>
        <button class="mini-btn" onclick="editarGastoRec(${i})">Editar</button>
        <button class="mini-btn peligro" onclick="borrarGastoRec(${i})">Eliminar</button>
      </span>
    </div>`).join('');
}

async function borrarGastoRec(idx) {
  const r = estado.gastosRec[idx];
  if (!confirm(`¿Eliminar el pago frecuente "${r.descripcion}" definitivamente?\n` +
               'Los gastos ya registrados en Movimientos NO se borran.')) return;
  try {
    await api(`/api/gastos_recurrentes/${r.id}`, { method: 'DELETE' });
    toast('Pago frecuente eliminado ✓');
    cargarGastosRec();
    revisarSalarioPendiente();
  } catch (err) { toast(err.message, true); }
}

// Mostrar segundo día si es quincenal, y cuenta si el método es Débito/Transferencia
function actualizarFormGastoRec() {
  const f = $('#form-gasto-rec');
  const esQuincenal = f.frecuencia.value === 'Quincenal';
  $('#lbl-dia2-grec').classList.toggle('oculto', !esQuincenal);
  f.dia_mes_2.required = esQuincenal;
  $('#lbl-monto-grec').firstChild.textContent = esQuincenal ? 'Monto por quincena (Q) ' : 'Monto (Q) ';
  const met = f.metodo.value;
  const usaCuenta = (met === 'Débito' || met === 'Transferencia') && estado.cuentas.length > 0;
  $('#lbl-cuenta-grec').classList.toggle('oculto', !usaCuenta);
}
$('#sel-frec-grec').addEventListener('change', actualizarFormGastoRec);
$('#sel-metodo-grec').addEventListener('change', actualizarFormGastoRec);

function editarGastoRec(idx) {
  const r = estado.gastosRec[idx];
  const f = $('#form-gasto-rec');
  f.reg_id.value = r.id; f.descripcion.value = r.descripcion;
  f.categoria_id.value = r.categoria_id; f.monto.value = r.monto;
  f.dia_mes.value = r.dia_mes; f.activo.checked = !!r.activo;
  f.frecuencia.value = r.frecuencia || 'Mensual';
  f.dia_mes_2.value = r.dia_mes_2 || '';
  f.metodo.value = r.metodo === 'Tarjeta' ? `Tarjeta:${r.tarjeta_id}` : r.metodo;
  f.cuenta_id.value = r.cuenta_id || '';
  actualizarFormGastoRec();
  $('#titulo-form-grec').textContent = `Editar pago frecuente: ${r.descripcion}`;
  $('#cancelar-grec').classList.remove('oculto');
  f.scrollIntoView({ behavior: 'smooth' });
}

$('#cancelar-grec').addEventListener('click', () => {
  const f = $('#form-gasto-rec');
  f.reset(); f.reg_id.value = '';
  actualizarFormGastoRec();
  $('#titulo-form-grec').textContent = 'Pagos frecuentes (renta, internet, colegio...)';
  $('#cancelar-grec').classList.add('oculto');
});

$('#form-gasto-rec').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const met = f.metodo.value;
  const esTarjeta = met.startsWith('Tarjeta:');
  const body = {
    descripcion: f.descripcion.value, categoria_id: parseInt(f.categoria_id.value),
    monto: parseFloat(f.monto.value), dia_mes: parseInt(f.dia_mes.value),
    frecuencia: f.frecuencia.value,
    dia_mes_2: f.frecuencia.value === 'Quincenal' ? parseInt(f.dia_mes_2.value) : null,
    metodo: esTarjeta ? 'Tarjeta' : met,
    tarjeta_id: esTarjeta ? parseInt(met.split(':')[1]) : null,
    cuenta_id: parseInt(f.cuenta_id.value) || null,
    activo: f.activo.checked,
  };
  try {
    if (f.reg_id.value) await api(`/api/gastos_recurrentes/${f.reg_id.value}`, { method: 'PUT', body });
    else await api('/api/gastos_recurrentes', { method: 'POST', body });
    toast('Pago frecuente guardado ✓');
    $('#cancelar-grec').click();
    cargarGastosRec();
    revisarSalarioPendiente();
  } catch (err) { toast(err.message, true); }
});

// --- Categorías ---
async function cargarCategoriasAdmin() {
  const cats = await api('/api/categorias?incluir_inactivas=true');
  estado.catsAdmin = cats;
  $('#lista-categorias').innerHTML = cats.map((c, i) => `
    <div class="item-lista">
      <span class="${c.activa ? '' : 'inactivo'}">${esc(c.nombre)} <small>(${c.tipo})</small></span>
      <span>
        <button class="mini-btn" onclick="renombrarCategoria(${i})">Renombrar</button>
        <button class="mini-btn" onclick="toggleCategoria(${c.id}, ${c.activa ? 'false' : 'true'})">
          ${c.activa ? 'Desactivar' : 'Activar'}</button>
      </span>
    </div>`).join('');
}

async function renombrarCategoria(idx) {
  const c = estado.catsAdmin[idx];
  const nuevo = prompt('Nuevo nombre de la categoría:', c.nombre);
  if (!nuevo || nuevo === c.nombre) return;
  try {
    await api(`/api/categorias/${c.id}`, { method: 'PUT', body: { nombre: nuevo } });
    toast('Categoría renombrada ✓');
    await cargarCatalogos(); llenarFiltros(); cargarCategoriasAdmin();
  } catch (err) { toast(err.message, true); }
}

async function toggleCategoria(id, activa) {
  try {
    await api(`/api/categorias/${id}`, { method: 'PUT', body: { activa } });
    toast('Categoría actualizada ✓');
    await cargarCatalogos(); llenarFiltros(); cargarCategoriasAdmin();
  } catch (err) { toast(err.message, true); }
}

$('#form-categoria').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/api/categorias', { method: 'POST',
      body: { nombre: f.nombre.value, tipo: f.tipo.value } });
    toast('Categoría agregada ✓');
    f.reset();
    await cargarCatalogos(); llenarFiltros(); cargarCategoriasAdmin();
  } catch (err) { toast(err.message, true); }
});

// --- Notion ---
async function cargarEstadoNotion() {
  try {
    const e = await api('/api/notion/estado');
    let texto;
    if (!e.configurado) {
      texto = 'Notion no está configurado. Copiá .env.example como .env y seguí el README.';
    } else {
      texto = e.ultima_sync ? `Última sincronización: ${e.ultima_sync}` : 'Configurado, aún sin sincronizar.';
      if (e.sync_pendiente) texto += ' · Hay cambios pendientes de subir.';
    }
    $('#estado-notion').textContent = texto;
  } catch { /* sin conexión con la API */ }
}

$('#btn-check-notion').addEventListener('click', async () => {
  const btn = $('#btn-check-notion');
  const p = $('#resultado-check-notion');
  btn.disabled = true; btn.textContent = 'Probando...';
  p.classList.remove('oculto');
  try {
    const r = await api('/api/notion/check', { method: 'POST' });
    p.textContent = '✓ ' + r.mensaje;
    p.style.color = 'var(--ingreso)';
  } catch (err) {
    p.textContent = '✗ ' + err.message;
    p.style.color = 'var(--gasto)';
  }
  btn.disabled = false; btn.textContent = 'Probar conexión';
});

$('#btn-sync-notion').addEventListener('click', async () => {
  const btn = $('#btn-sync-notion');
  btn.disabled = true; btn.textContent = 'Sincronizando...';
  try {
    await api('/api/notion/sync', { method: 'POST' });
    toast('Sincronizado con Notion ✓');
  } catch (err) { toast(err.message, true); }
  btn.disabled = false; btn.textContent = 'Sincronizar con Notion';
  cargarEstadoNotion();
});

// --- Importar CSV ---
$('#btn-import').addEventListener('click', async () => {
  const archivo = $('#archivo-import').files[0];
  if (!archivo) return toast('Elegí un archivo CSV', true);
  const fd = new FormData();
  fd.append('archivo', archivo);
  try {
    const r = await api(`/api/import/${$('#tabla-import').value}`, { method: 'POST', body: fd });
    let html = `<b>${r.importados}</b> filas importadas.`;
    if (r.rechazados.length) {
      html += ` <b>${r.rechazados.length}</b> rechazadas:<ul>` +
        r.rechazados.slice(0, 15).map(x => `<li>Fila ${x.fila}: ${x.motivo}</li>`).join('') +
        (r.rechazados.length > 15 ? '<li>…y más</li>' : '') + '</ul>';
    }
    $('#resultado-import').innerHTML = html;
    toast(`Importación: ${r.importados} filas ✓`);
    await cargarCatalogos(); llenarFiltros();
  } catch (err) { toast(err.message, true); }
});

// ============================================================
// ARRANQUE
// ============================================================

(async function iniciar() {
  // Saludo con la fecha de hoy en el encabezado
  const fechaLarga = new Date().toLocaleDateString('es-GT',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('#saludo').textContent = '👋 Hola — ' + fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);
  try {
    await cargarCatalogos();
    llenarFiltros();
    precargarFechas();
    revisarSalarioPendiente();
    // Deep-link: abrir directamente una vista con #dashboard, #movimientos, etc.
    const hash = location.hash.replace('#', '');
    const btn = hash && document.querySelector(`.nav-btn[data-vista="${hash}"]`);
    if (btn) btn.click();
  } catch (err) {
    toast('No se pudo conectar con la API: ' + err.message, true);
  }
})();
