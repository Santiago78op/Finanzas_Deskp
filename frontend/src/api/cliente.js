// api/cliente.js — wrapper fetch de bajo nivel (antes vivía en src/api.js).
// Mismo comportamiento que el api() de la app vanilla original: setea
// Content-Type/JSON.stringify salvo que el body ya sea FormData (import de
// CSV), y lanza Error con el detail de FastAPI en respuestas no-2xx.
// Nadie fuera de api/*.js debería importar esto directo — los componentes
// piden datos a través de los módulos por recurso (cuentas.js, tarjetas.js,
// etc.), no arman URLs a mano.

// `detail` de FastAPI es un string en los HTTPException a mano de la app
// ("Nombre e institución son obligatorios"), pero cuando Pydantic rechaza el
// body (422 — ej. un campo requerido llega vacío/null) es un ARRAY de
// {loc, msg, type}. `new Error(array)` lo pasa por toString() y termina
// mostrando "[object Object],[object Object]" en el toast — acá se arma un
// mensaje legible en cualquiera de los dos casos.
function formatearDetail(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(e => {
      const campo = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : '';
      return campo ? `${campo}: ${e.msg}` : e.msg;
    }).join(' · ');
  }
  return null;
}

export async function api(ruta, opciones = {}) {
  if (opciones.body && !(opciones.body instanceof FormData)) {
    opciones = {
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...opciones.headers },
      body: JSON.stringify(opciones.body),
    };
  }
  const r = await fetch(ruta, opciones);
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(formatearDetail(datos.detail) || `Error ${r.status}`);
  return datos;
}
