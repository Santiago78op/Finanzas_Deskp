# 💰 Finanzas Personales (Q)

App web **local** de finanzas personales en quetzales. Corre en tu computadora,
guarda todo en un archivo SQLite (`finanzas.db`) y sincroniza un resumen,
tus tarjetas y alertas hacia **Notion** para que puedas consultarlos desde el celular.

- Registro rápido de gastos (menos de 10 segundos por gasto)
- Interfaz moderna con **modo oscuro y claro** (botón ☀️/🌙 en la barra; se
  recuerda tu preferencia) — diseño inspirado en shadcn/ui y Magic UI, en CSS puro
- Dashboard con gráficas (ingresos vs gastos por mes, gastos por categoría,
  con paleta validada para daltonismo en ambos temas)
- Control de tarjetas de crédito: saldo, disponible, % de uso, corte y pago
  (con **saldo pendiente inicial** opcional si la tarjeta ya traía deuda)
- **Cuentas Monetaria/Ahorro** por banco: cuánto dinero tenés en total y por cuenta,
  patrimonio (cuentas − deuda) y alerta si tu deuda rebasa tus ingresos
- **Análisis del mes**: en qué gastás más (% y variación vs mes anterior) y tus
  gastos más grandes
- Salario recurrente con confirmación mensual
- Exportar/importar CSV para respaldos y carga de históricos
- Sincronización con Notion (la fuente de verdad **sigue siendo** tu base local):
  - **App → Notion**: Resumen del mes, Tarjetas y Alertas, siempre actualizados
  - **Notion → App**: la **Bandeja de gastos** — anotás un gasto desde el celular
    cuando no tenés la app a mano, y se importa solo a tu base local

## Instalación y arranque

Requisitos: **Python 3.10 o superior** (probado en 3.14). Todo lo demás lo
instala el script de arranque la primera vez, dentro de un entorno virtual
(`.venv`) que no toca tu Python del sistema.

### Windows

```bat
start.bat
```

(o doble clic al archivo). Manual, si preferís: `python -m pip install -r requirements.txt`
y luego `python app.py`.

### macOS (incluye Apple Silicon M1–M5)

```bash
# Si no tenés Python 3: brew install python
chmod +x start.sh   # solo la primera vez
./start.sh
```

Manual, si preferís:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 app.py
```

En ambos casos, abrí **http://localhost:8000** en el navegador. Listo.

> **Nota macOS**: en Mac el comando es `python3` (no `python`). Todas las
> dependencias tienen binarios nativos para Apple Silicon, así que no hay nada
> especial que hacer en una M5.

> **Seguridad**: la app escucha solo en `localhost` (127.0.0.1) — nadie más en
> la red (por ejemplo el wifi del trabajo) puede acceder a tus datos. Para
> consultar desde el celular se usa la sincronización con Notion (ver abajo).

## Configurar la sincronización con Notion

1. **Crear la integración**: entrá a <https://www.notion.so/my-integrations>,
   clic en **"New integration"**, dale un nombre (ej. "Finanzas"), elegí tu
   workspace y guardá. Copiá el **Internal Integration Secret** (el token).
2. **Crear una página en Notion** donde vivirán los datos (ej. una página "Finanzas").
3. **Compartir la página con la integración**: en la página, menú `···` →
   **Connections** (Conexiones) → buscá tu integración "Finanzas" y agregala.
   Sin este paso la API no puede escribir en la página.
4. **Copiar el ID de la página**: es la parte final de la URL de la página
   (32 caracteres hexadecimales, con o sin guiones).
5. En la carpeta de la app, **copiá `.env.example` como `.env`** y llená:

   ```
   NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxx
   NOTION_PARENT_PAGE_ID=1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c
   ```

6. **Validá que quedó bien** antes de sincronizar de verdad: reiniciá la app y
   en **Ajustes → Notion → "Probar conexión"** (o `python sync_notion.py --check`
   desde la terminal). Esto solo valida el token y el acceso a la página —
   **no crea nada todavía**. Si falla, te dice exactamente qué revisar:
   - *"Token inválido (401)"* → el `NOTION_TOKEN` está mal copiado o vencido.
   - *"la página no aparece (404)"* → te olvidaste el paso 3 (compartir la
     página con la integración) o el `NOTION_PARENT_PAGE_ID` está mal.
7. Una vez que "Probar conexión" diga ✓, tocá **Sincronizar con Notion** — ahí
   sí se crean automáticamente cuatro bases de datos dentro de tu página, cada
   una con su ícono, y la primera vez le pone una portada (una de las de
   degradado oficiales de Notion, azul marino → celeste → crema) tanto a tu
   página "Finanzas" como a cada base. **Es solo la primera vez**: si después
   le cambiás la portada a mano en Notion —tu propio GIF, una foto, lo que
   quieras—, la sincronización nunca te la pisa.

   | Base | Sentido | Contenido |
   |---|---|---|
   | 📊 **Resumen del mes** | App → Notion | Ingresos, gastos, balance, deuda en tarjetas, dinero en cuentas, patrimonio y top 5 categorías (se actualizan las mismas filas, sin duplicar) |
   | 💳 **Tarjetas** | App → Notion | Una fila por tarjeta: banco, saldo, disponible, % uso (con ícono 🟢🟡🔴 según qué tan alto esté), próximo corte y pago |
   | 🔔 **Alertas** | App → Notion | Avisos con fecha, tipo y estado (Pendiente/Vista) — el estado que marqués desde el celular se respeta |
   | 📥 **Bandeja de gastos** | **Notion → App** | La única vía de entrada: anotás un gasto desde el celular y la app lo importa solo (ver abajo) |

**Cuándo sincroniza:** al tocar el botón en Ajustes, automáticamente después de
cada registro nuevo (si hay conexión), **al abrir la app** (revisa la Bandeja
en segundo plano, sin interrumpir el arranque), o corriendo `python sync_notion.py`
(que también podés programar con el Programador de tareas de Windows).
Si Notion no responde, **la app sigue funcionando normal**: el cambio queda
marcado como pendiente y se sube en el próximo intento.

`python sync_notion.py --reset` hace que la app "olvide" las bases creadas
(útil si las borraste en Notion; se recrean en la próxima sincronización).

### Anotar un gasto desde el celular (Bandeja de gastos)

Es el único canal de **entrada**: normalmente Notion es solo para consultar,
pero cuando estás en un comercio y no tenés la computadora a mano, podés
anotar el gasto ahí mismo y la app lo toma como propio la próxima vez que
sincronice.

1. Desde Notion en el celular, abrí tu página → base **"Bandeja de gastos"**
2. Tocá **"+ Nueva"** y llená:
   - **Gasto** (título): qué compraste, ej. "Almuerzo"
   - **Monto**: el número, sin `Q`
   - **Categoría**: elegí de la lista desplegable (ya trae tus categorías)
   - **Método**: `Efectivo`, `Débito`, `Transferencia`, o el nombre de una tarjeta
   - **Fecha** (opcional): solo si es de un día anterior — si la dejás vacía,
     usa el día en que creaste la fila en Notion
3. Cuando abrís la app en la computadora (o corre cualquier sincronización), esa
   fila se convierte en un gasto real y **desaparece de la Bandeja** (se archiva).
4. Si algo está mal — categoría con typo, monto vacío — la fila **se queda en
   la Bandeja** sin tocar (nunca se pierde ni se inventa un dato) y te avisa
   con un mensaje explicando qué corregir.

La Bandeja siempre tiene las categorías/tarjetas activas como opciones —
si agregás una categoría nueva en la app, aparece ahí en la próxima sincronización.

### Personalizar la portada (poner tu propio GIF)

La sincronización pone una portada por defecto solo la primera vez. Para
cambiarla por tu propio GIF (ej. de [Giphy](https://giphy.com) o cualquier
imagen que tengas):

1. Abrí la página o base en Notion → pasá el mouse arriba → **"Cambiar portada"**
2. Pegá el link directo a la imagen/GIF, o subí un archivo tuyo
3. Listo — la app nunca vuelve a tocarla, porque solo la pone si detecta que
   la base o página **no tiene ninguna** portada todavía.

## Uso diario

- **Registro** (pantalla principal): botón grande **+ Gasto**; monto, categoría
  y método como botones, fecha de hoy precargada. `+ Pago tarjeta` y `+ Ingreso`
  son secundarios. Si hay salario pendiente de confirmar, aparece un aviso amarillo.
- **Dashboard**: selector de mes, totales, deuda en tarjetas, gráficas, estado
  de cada tarjeta (barra verde <30%, amarilla 30–70%, roja >70% de uso) y la
  métrica de asalariado: *cuánto queda del salario y cuántos días faltan para el próximo*.
- **Movimientos**: filtrá por mes/categoría/método; editá o eliminá cualquier registro.
- **Bancos**: administrá tus **cuentas** (Monetaria/Ahorro, con el saldo que tenés hoy)
  y tus **tarjetas** (con el saldo pendiente que ya traés, opcional — puede ser 0).
  Saldo de cuenta = saldo inicial + ingresos que entraron − gastos que salieron −
  pagos de tarjeta hechos desde ella. Saldo de tarjeta = deuda inicial + gastos − pagos.
- **Ajustes**: salario recurrente, categorías, Notion y respaldos CSV.

Al registrar un gasto con **Débito o Transferencia** podés indicar de qué cuenta
salió (opcional); igual en pagos de tarjeta e ingresos. Así el dashboard sabe
cuánto dinero te queda en cada cuenta.

### Ingresos recurrentes y pagos frecuentes

En **Ajustes** podés configurar:

- **Ingresos recurrentes** (salario, rentas que cobrás...): con frecuencia
  **Mensual** (un día del mes) o **Quincenal** (dos días, ej. 13 y 27; el monto
  es por quincena).
- **Pagos frecuentes** (renta, internet, colegio, streaming...): igual que los
  ingresos pero generan un **gasto**, con el método de pago preconfigurado
  (efectivo, débito/transferencia desde una cuenta, o una tarjeta).

Cuando llega la fecha (o al abrir la app si ya pasó), la pantalla de Registro
muestra un aviso por cada pendiente con dos botones: **Confirmar** (ajustando
el monto si varió) u **Omitir** (ese mes no aplicó; no crea nada). Cada
confirmación u omisión se recuerda por mes y quincena: si después borrás el
ingreso o gasto generado, el aviso **no** vuelve a aparecer.

## Respaldos

### La base de datos

Todo vive en el archivo **`finanzas.db`** (en esta misma carpeta). Para
respaldar, **copiá ese archivo** a donde quieras (USB, Drive, etc.), idealmente
con la app cerrada. Para restaurar, volvé a poner el archivo en la carpeta.

### CSV

- **Exportar**: Ajustes → *Exportar todo (ZIP)* descarga un ZIP con un CSV por
  tabla (`gastos.csv`, `ingresos.csv`, `tarjetas.csv`, etc.).
- **Importar**: Ajustes → elegí la tabla, seleccioná el CSV y tocá *Importar CSV*.
  El formato es el mismo de la exportación. Las filas con errores se rechazan
  y se muestra el motivo de cada una (las buenas sí entran).

Formatos esperados (primera fila = encabezado):

| Tabla | Columnas |
|---|---|
| `gastos` | `fecha,descripcion,categoria,metodo,monto,cuenta` — método: `Efectivo`, `Débito`, `Transferencia` o el nombre de una tarjeta (ej. `Visa BI`); `cuenta` opcional (nombre de una cuenta tuya) |
| `ingresos` | `fecha,descripcion,categoria,monto,cuenta` (`cuenta` opcional) |
| `pagos_tarjetas` | `fecha,tarjeta,monto,cuenta` (`cuenta` opcional) |
| `tarjetas` | `banco,nombre,limite,dia_corte,dia_pago,saldo_inicial,activa` (`saldo_inicial` = deuda que ya traía, opcional) |
| `cuentas` | `banco,nombre,tipo,saldo_inicial,activa` (tipo: `Monetaria` o `Ahorro`) |
| `categorias` | `nombre,tipo,activa` (tipo: `ingreso` o `gasto`) |
| `ingresos_recurrentes` | `descripcion,categoria,monto,dia_mes,frecuencia,dia_mes_2,activo` (frecuencia: `Mensual` o `Quincenal`; `dia_mes_2` solo para quincenal) |
| `gastos_recurrentes` | `descripcion,categoria,monto,dia_mes,frecuencia,dia_mes_2,metodo,cuenta,activo` (método: `Efectivo`, `Débito`, `Transferencia` o nombre de tarjeta) |

Las fechas se aceptan como `dd/mm/aaaa` o `aaaa-mm-dd`. Los montos sin símbolo: `1234.56`.

> **Tip para tu Excel**: exportá cada hoja como CSV con esas columnas y cargalas
> empezando por `tarjetas` y `categorias` (si usás categorías propias), y luego
> `gastos` / `ingresos`.

## Llevarla a otra computadora (repo Git)

El proyecto está pensado para vivir en un repo y clonarse en cualquier
sistema (Windows, macOS, Linux):

1. **Lo que viaja en el repo**: el código (`app.py`, `db.py`, `notion_sync.py`,
   `sync_notion.py`, `static/`), los scripts de arranque y este README.
2. **Lo que NO viaja** (está en `.gitignore`): `finanzas.db` (tus datos),
   `.env` (tu token de Notion), `.venv/` y los Excel. **Tus datos y secretos
   nunca deben subir al repo.**
3. Para **migrar tus datos** a la otra máquina, copiá `finanzas.db` por un
   medio privado (AirDrop, USB, tu Drive personal) a la carpeta clonada,
   o usá Exportar/Importar CSV. Igual con el `.env` (o volvé a crear el archivo
   a mano con el mismo token).

```bash
# En la Mac
git clone <url-de-tu-repo> finanzas && cd finanzas
./start.sh                    # crea .venv, instala e inicia
# (copiar finanzas.db y .env a esta carpeta si querés tus datos y Notion)
```

Detalles de compatibilidad ya resueltos en el código:

- Rutas construidas con `os.path` (funcionan igual en Windows y macOS).
- `.gitattributes` fuerza `LF` en `start.sh` para que no se rompa al clonarlo
  desde Windows.
- SQLite viene incluido con Python; el archivo `finanzas.db` es portable
  entre sistemas y arquitecturas sin conversión.
- Sin dependencias con compilación problemática: todas tienen wheels
  para Apple Silicon.

## Estructura del proyecto

```
Dedun/
├── app.py            ← backend FastAPI + arranque (python app.py)
├── db.py             ← esquema SQLite y helpers
├── notion_sync.py    ← lógica de sincronización con Notion
├── sync_notion.py    ← script manual/programable de sincronización
├── static/           ← frontend (HTML/CSS/JS + Chart.js)
├── start.bat         ← arranque en Windows (crea .venv la primera vez)
├── start.sh          ← arranque en macOS/Linux (crea .venv la primera vez)
├── finanzas.db       ← TU BASE DE DATOS (respaldá este archivo; no va al repo)
├── .env              ← token de Notion (NO compartir; no va al repo)
└── requirements.txt
```
