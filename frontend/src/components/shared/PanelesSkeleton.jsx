import Card from '@mui/material/Card';

// Esqueleto de carga para las vistas que se arman con la grilla de 12
// columnas (Dashboard, Análisis).
//
// Existe por un bug concreto: con <AnimatePresence mode="wait"> la vista
// anterior se desmonta ANTES de montar la nueva, y estas dos vistas devolvían
// `null` hasta que llegaban los datos. Resultado: al cambiar de pestaña la
// pantalla quedaba EN BLANCO durante todo el viaje a la API. Antes no se
// notaba porque no había animación de salida — la vista vieja seguía puesta
// hasta que la nueva estaba lista.
//
// `paneles` es la lista de anchos (los mismos dash-span-N de la vista real),
// para que al llegar los datos nada salte de lugar.
function Bloque({ ancho = '100%', alto = 14 }) {
  return <div className="skeleton-bloque" style={{ width: ancho, height: alto, borderRadius: 4 }} />;
}

export default function PanelesSkeleton({ paneles, id, etiqueta = 'Cargando' }) {
  return (
    <div id={id} className="vista" aria-busy="true" aria-label={etiqueta}>
      <div className="dash-grid">
        {paneles.map(({ span, lineas = 3 }, i) => (
          <Card key={i} component="section" className={`p-5 dash-span-${span} flex flex-col gap-3`}>
            <Bloque ancho="40%" alto={10} />
            <Bloque ancho="65%" alto={26} />
            {Array.from({ length: lineas }, (_, j) => (
              <Bloque key={j} ancho={`${88 - j * 14}%`} />
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
