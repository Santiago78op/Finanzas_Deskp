// api.js — wrapper fetch con el mismo comportamiento que el api() de la app
// vanilla original: setea Content-Type/JSON.stringify salvo que el body ya
// sea FormData (import de CSV), y lanza Error con el detail de FastAPI en
// respuestas no-2xx.
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
  if (!r.ok) throw new Error(datos.detail || `Error ${r.status}`);
  return datos;
}
