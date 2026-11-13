# Choque Claro

El choque documentado con el celular, para aseguradoras. El cliente reporta
desde la escena (ubicación, escena, carros, daños y croquis) y la aseguradora
recibe un expediente con el análisis de la vía y fotos que valen como prueba.

El nombre lo eligió Joan el 13-nov-2026; la carpeta en su PC sigue siendo
`Desktop\Siniestros`, el nombre de trabajo. El plan de negocio (`PLAN.md`:
fechas, decisiones, a quién se le vende) está en esa carpeta pero **no entra al
repositorio**, que es público: ver `.gitignore`.

## Cómo se abre

- `npm run dev` → <http://127.0.0.1:8320/>. Desde una sesión de Claude: la
  entrada `siniestros` de `PLAZA/.claude/launch.json`.
- `npm test` → 43 pruebas en Node, sin internet.
- **En el celular hace falta https**: por la IP del Wi-Fi (`npm run celular`,
  `http://192.168…`) se ve la app, pero el navegador no da ubicación, cámara
  en vivo ni brújula. Para probar de verdad se publica en GitHub Pages:
  repositorio público `joanhispanista-star/choque-claro` (el remoto `origin` ya
  apunta ahí), y quedará en <https://joanhispanista-star.github.io/choque-claro/>.
  El repositorio lo crea Joan (aquí no hay `gh` ni token). El orden importa:
  (1) Joan lo crea vacío, (2) `git push -u origin master`, (3) Joan enciende
  Pages en Settings › Pages › "Deploy from a branch" › `master` / `(root)`:
  con el repositorio vacío esa opción todavía no aparece.
- `npm run ejemplos-via` vuelve a bajar los dos ejemplos reales de las pruebas
  (ver `pruebas/datos/LEEME.md`).

## Lo que hay (12-nov-2026)

Los pasos 1 a 3 de 8:

1. **¿Hay alguien herido?** Con heridos, el botón llama al 123 y la app no pide
   nada más hasta que estén atendidos.
2. **Ponte a salvo**: luces, chaleco, señales y fotos antes de mover los carros
   (en un choque simple, después hay que retirarlos de la vía: Ley 2251 de
   2022, art. 16).
3. **¿Dónde fue?** Mapa con el GPS y su círculo de precisión (se escucha hasta
   15 s y se queda la mejor lectura), un toque en el mapa o el pin arrastrado,
   y la hora del choque. Con el punto sale:
   - **La vía**: nombre y tipo; si es recta o curva y el radio (calculado de
     la línea del mapa, no escrito por nadie); sentido (y si es una calzada de
     una avenida con separador); carriles; velocidad máxima; doble línea;
     cruces a menos de 40 m; semáforos, pares, pasos peatonales y fotomultas a
     menos de 60 m; superficie y alumbrado.
   - **La luz**: de día, sol bajo, anochecer o noche, y si el sol estaba de
     frente para alguno de los dos sentidos de la vía (con el cielo cubierto
     se dice que es menos probable que encandilara).
   - **El clima** en la hora del choque: lluvia, cielo y visibilidad.
   - **Ver un ejemplo**: la curva de radio 13 m de la vía Los Verjones–Patios,
     con un choque inventado ayer a las 5:15 p. m. La pantalla lo dice.

Del paso 4 en adelante solo hay una pantalla que dice que todavía no está y
cuándo llega (martes 17-nov).

**Verificado** en el panel del navegador del PC a 375 px de ancho: el
recorrido, el ejemplo (análisis en 0,8 a 1,5 s), el toque en el mapa, el
servicio caído (lo dice y ofrece reintentar) y el reintento. **NO probado en un
celular**: sin repositorio no hay https.

## Lo que la pantalla nunca afirma

- Lo que el mapa no trae dice "Sin dato en el mapa", nunca "no había". La
  **doble línea** casi nunca está: 0 de 1.074 tramos medidos en Bogotá. Sale de
  las fotos.
- **La app no decide quién tuvo la culpa.** Lo dice al pie del análisis.
- El clima es de un **modelo**, no de una estación al lado de la vía.
- Para analizar, el punto se consulta en Overpass y Open-Meteo y el mapa se
  descarga de OpenStreetMap: la pantalla lo dice. Nada más sale del teléfono.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html`, `css/app.css` | Las pantallas. Tema claro y solo claro: se usa a pleno sol. |
| `js/app.js` | El recorrido: una pantalla por paso, el paso en el `#hash` (el "atrás" del celular funciona). |
| `js/pantalla-donde.js` | "¿Dónde fue?": GPS, toque, ejemplo, hora, y el análisis con turnos (una respuesta vieja nunca pinta). |
| `js/via.js` | **Puro.** La consulta a Overpass y el análisis de la vía: la más cercana (las entradas cargan 10 m de castigo), la cadena de tramos, el radio por tres puntos sobre 50 m, la curva cercana, cruces, señales, calzada hermana y las filas de texto. |
| `js/sol.js` | **Puro.** Altura y rumbo del sol (Almanaque Astronómico), el momento del día y el encandilamiento. |
| `js/clima.js` | **Puro.** La URL de Open-Meteo y el clima de la hora del choque. |
| `js/servicios.js` | Overpass con tres servidores y tiempo límite; JSON con errores en español. |
| `js/ubicacion.js` | El GPS: la mejor lectura en 15 s y los mensajes de permisos para iPhone y Android. |
| `js/mapa.js` | Leaflet: pin arrastrable, círculo de precisión, tramo analizado y señales. |
| `js/geo.js` | **Puro.** Plano local en metros, proyecciones, rumbos, puntos cardinales y números con coma. |
| `js/vendor/leaflet/` | Leaflet 1.9.4 (BSD-2), copiado: sin CDN. |
| `herramientas/servidor.js` | El servidor del taller, sin COOP/COEP (COEP bloquearía las teselas). |
| `herramientas/guardar-ejemplo-via.mjs` | Baja los ejemplos reales de las pruebas. |
| `pruebas/` | `node --test`; `datos/` tiene dos respuestas reales de Overpass (ODbL). |

## Trampas que ya mordieron

- **Los Overpass públicos se llenan.** El 12-nov-2026 por la mañana
  overpass-api.de dio 502 y 504; por la tarde, la misma consulta tardó 0,8 s
  en openstreetmap.fr, 17,6 s en mail.ru y 58 s en overpass-api.de, y
  private.coffee y kumi.systems no respondieron en 75 s. El orden de
  `SERVIDORES_OVERPASS` sale de ahí. Además, overpass-api.de responde **406 a
  `curl` con su agente por defecto**: desde Node o curl, hay que mandar un
  User-Agent propio. Para vender hace falta la red vial de Colombia en una base
  propia.
- **Open-Meteo guarda la lluvia de cada hora en la hora siguiente** (la de las
  6:00 p. m. es la de 5 a 6), y con `timezone=auto` las horas vienen en la
  hora del lugar: se cruzan con `utc_offset_seconds`, no con la zona del
  celular.
- **Leaflet mide su caja al crearse**: si la pantalla estaba oculta, mide
  cero. Por eso `app.js` llama `ajustar()` (invalidateSize) al mostrarla.
- **Una constante declarada después de la función que la usa** dejó una
  pantalla muda en el taller: aquí las constantes van arriba.
- `fetch` guardado dentro de un objeto y llamado como método da "Illegal
  invocation" en Chrome: `servicios.js` lo envuelve en una función.

## Licencias de terceros

Datos de vías © colaboradores de OpenStreetMap (ODbL), con el crédito visible
en el mapa y en el análisis. Las teselas de tile.openstreetmap.org sirven para
el demo, no para una app con tráfico. Open-Meteo es gratis solo para uso no
comercial. Leaflet: BSD-2 (`js/vendor/leaflet/LICENSE`).
