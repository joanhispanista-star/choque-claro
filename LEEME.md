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
- `npm test` → 114 pruebas en Node, sin internet.
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

## Lo que hay (13-nov-2026)

Los pasos 1 a 4 de 8:

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
     con un choque inventado ayer a las 5:15 p. m. La pantalla lo dice. Desde
     el 13-nov usa la respuesta real del mapa guardada el 12-nov
     (`datos/ejemplo-verjones-patios.json`) y lo avisa: frente a un cliente no
     puede depender de un servidor público que se cae. El clima sí es en vivo.
   - **Ver en Google Maps / Ver en Street View** (13-nov): con las URL de Maps
     de Google, sin clave ni facturación; Street View mira a lo largo de la
     vía. La pantalla avisa que esas imágenes no son del día del choque.
   - **Ver la zona en 3D** (13-nov, la opción B que eligió Joan): otra página,
     `zona-3d.html`, con MapLibre 4.7.1. Muestra el relieve y su sombreado
     (mosaicos de AWS) y los edificios levantados (OpenFreeMap, OpenStreetMap).
     Encima van el punto, el tramo analizado, las señales, el rayo del sol a esa
     hora (también ilumina los edificios desde ahí) y los conos de las fotos de
     la escena de este teléfono. Botones Vista 3D, Desde arriba y Dar la vuelta.
     Los carros y sus trayectorias salen SOLO en el ejemplo, marcados como
     inventados, hasta que exista el croquis (paso 7): cuando exista, que le pase
     sus carros a `capasDeLaZona`. Sin clave ni tarjeta. Es una maqueta, no del
     día, y la página lo dice. Nada espera al análisis de la vía: con los
     servidores públicos lentos (hasta 75 s) la página se quedaba en blanco; el
     tramo y la cámara a lo largo de la vía llegan después.
   - **La escena en 360°** (13-nov, la opción C), en la misma página: las 8
     fotos de la vuelta del paso 4 de este teléfono, en círculo según su rumbo,
     en un cilindro de CSS 3D sin librerías. Se gira con el dedo o con
     Izquierda, Norte y Derecha, y abajo dice qué foto está de frente (hora,
     rumbo, GPS y huella corta). No están cosidas, y la página lo dice; sin
     brújula van una cada 45°. El ejemplo no muestra fotos: su choque es
     inventado y las de un reporte de verdad no se le pegan.
4. **La escena, en una vuelta** (13-nov). Antes de mover los carros, parada en
   el punto del golpe, la persona gira sobre sí misma y toma 8 fotos:
   - **El anillo de 8 tomas** gira con la brújula: lo que la cámara tiene al
     frente queda arriba, bajo la flecha. Las tomas se cuentan desde la
     primera foto (la de los carros), no desde el norte. La guía dice «Gira
     despacio a tu derecha», «Sigue girando…», «Quieto… y toma la foto» o «a
     tu izquierda: falta una de ese lado».
   - **Pastillas en vivo**: «Nítida» (o «Movida», «Oscura»), «GPS ±6 m» y
     «Brújula ±12°». La raya blanca del horizonte se pone ámbar si el celular
     está torcido. Si la persona está a más de 30 m del punto que marcó en el
     mapa, se le dice.
   - **Brújula**: en iPhone, un toque pide el permiso
     (`DeviceOrientationEvent.requestPermission`) y el rumbo sale de
     `webkitCompassHeading`; en Android, de `deviceorientationabsolute` con la
     fórmula de la norma W3C. **Sin brújula se dice**, y la vuelta se hace en
     orden («gira un octavo de vuelta»), con las fotos marcadas sin rumbo.
   - **Solo cámara en vivo** (`getUserMedia`): no hay botón de galería.
   - **Revisión antes de aceptar**: borrosa, oscura, torcida o mirando al piso
     o al cielo → «Repetir la foto». A la segunda vez en la misma toma también
     se ofrece «Usarla así» (de noche puede que ninguna pase), y la foto queda
     marcada.
   - **Cada foto guarda** la hora, el GPS con su precisión y su edad, el rumbo
     (con su fuente: iphone o android), la inclinación, los números de la
     revisión y la huella SHA-256 de sus bytes; el registro se sella con otra
     huella encadenada con la anterior. Una toma se puede repetir tocándola en
     la tira: la nueva entra a la cadena con `reemplaza`, la vieja no se borra.
   - Las fotos se reducen a 1280 px (`fotos.js`) y se guardan en el teléfono
     (IndexedDB, `conexion-bd.js`): los dos, COPIADOS del Taller. Al completar
     la vuelta, la cámara se apaga y la lista revisa la cadena entera.
   - «Saltar: no es seguro» lleva al paso 5. «Empezar un reporte nuevo» deja
     el anterior guardado; un reporte sin tocar en 6 horas también empieza otro.

Del paso 5 en adelante solo hay una pantalla que dice que todavía no está y
cuándo llega (miércoles 18-nov).

**Verificado (pasos 1 a 3)** en el panel del navegador del PC a 375 px: el
recorrido, el ejemplo (análisis en 0,8 a 1,5 s), el toque en el mapa, el
servicio caído (lo dice y ofrece reintentar) y el reintento.

**Verificado (paso 4, 13-nov)** en un Edge sin ventana y mudo a 375×667, con
cámara, GPS y brújula de mentira (el panel no cargaba páginas porque la sesión
no estaba abierta en ninguna ventana): 43 de 43 comprobaciones. La vuelta
completa con la brújula de Android y la de iPhone; borrosa, torcida y oscura
rechazadas; «Usarla así» a la segunda; repetir una toma desde la tira (la guía
se devuelve por la izquierda); la cadena de 9 huellas íntegra; recargar y
encontrar la vuelta; sin brújula; sin GPS; la cámara apagada al salir; sin
errores en la consola. El arnés vive fuera del repo (copia de
`TallerPintura/pruebas/datos-externos/diseno-escaneo/edge.mjs`).

**NO probado en un celular**: sin repositorio no hay https. Ver «Lo que falta
probar en el iPhone».

## Lo que falta probar en el iPhone

La brújula, la cámara y el GPS de verdad solo se prueban en el teléfono, con
https (GitHub Pages). En el iPhone de Joan, con Safari:

1. Al tocar «Empezar la vuelta», ¿pide los dos permisos (cámara y
   movimiento)? Si niega la brújula, ¿la pastilla dice «Brújula sin permiso» y
   la vuelta sigue en orden?
2. **La brújula con el celular parado**: girando sobre sí mismo, ¿el anillo
   gira parejo y la toma que falta llega por la derecha? Que alguien con una
   brújula de verdad (la app Brújula del iPhone) compare un rumbo: deben
   coincidir con unos pocos grados. Y de lado (la pantalla girada), el rumbo
   no debe cambiar.
3. **El umbral de «borrosa» no está calibrado** con fotos de un iPhone (ver
   `js/calidad.js`). Abrir con `?medir` (`…/choque-claro/?medir#escena`): la
   pastilla muestra la nitidez y el brillo. Anotar los números de una foto
   quieta, una movida al girar y una de noche, para ajustar `UMBRALES`.
4. Torcer el celular: ¿la raya se pone ámbar y la foto se rechaza?
5. Cambiar de app a mitad de la vuelta y volver: la cámara se apaga y el botón
   dice «Seguir la vuelta (n de 8 tomas)».
6. Al completar: las 8 fotos y «Revisada en este teléfono la cadena de…».

## Lo que la pantalla nunca afirma

- Lo que el mapa no trae dice "Sin dato en el mapa", nunca "no había". La
  **doble línea** casi nunca está: 0 de 1.074 tramos medidos en Bogotá. Sale de
  las fotos.
- **La app no decide quién tuvo la culpa.** Lo dice al pie del análisis.
- El clima es de un **modelo**, no de una estación al lado de la vía.
- Para analizar, el punto se consulta en Overpass y Open-Meteo y el mapa se
  descarga de OpenStreetMap: la pantalla lo dice. Nada más sale del teléfono.
- **La huella no lo prueba todo.** Deja ver si una foto o un dato cambió
  después de tomarse, pero mientras la cadena viva solo en el teléfono, alguien
  con el teléfono podría rehacerla entera. Para que valga contra eso, la última
  huella tiene que salir del teléfono en el momento (paso 8 o fase 2). La lista
  lo dice. Y la hora es la del reloj del celular.
- **El rumbo es magnético** y lo da la brújula del celular, que se desvía al
  lado de un carro. Cada foto dice de dónde salió (`rumboFuente`).

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
| `js/enlaces-google.js` | **Puro.** Los enlaces a Google Maps y Street View (URL de Maps, sin clave) y la fecha corta en hora de Colombia. |
| `datos/ejemplo-verjones-patios.json` | La respuesta real de Overpass del ejemplo (ODbL), para que "Ver un ejemplo" no falle nunca. |
| `zona-3d.html`, `css/zona-3d.css` | La página de la zona en 3D (aparte: carga MapLibre, 800 KB, solo si se pide). |
| `js/zona-3d.js` | **Puro.** Los GeoJSON de lo que va encima (punto, precisión, tramo, señales, sol, conos, carros del ejemplo), la cámara a lo largo de la vía, la luz del sol y la leyenda que dice lo que falta. |
| `js/pantalla-zona-3d.js` | La página: lee el punto de la dirección, analiza la vía (el ejemplo, guardado), lee las fotos de la escena y arma el mapa con relieve, sombreado y capas. |
| `js/vendor/maplibre/` | MapLibre GL JS 4.7.1 (BSD-3), copiado: sin CDN. |
| `js/escena-360.js` | **Puro.** Dónde va cada foto en el círculo, las medidas del cilindro (70° de visor, 50° por foto), la foto de frente y su texto. |
| `js/pantalla-escena-360.js` | El visor 360°: paneles de CSS 3D, arrastre con el dedo, botones, y esconde los paneles de atrás (Safari los pinta al revés). |
| `js/pantalla-escena.js` | "La escena": une la cámara, los sensores y la base; tres vistas (inicio, cámara, lista). Apaga la cámara al salir, al terminar y en segundo plano. |
| `js/escena.js` | **Puro.** La vuelta: en qué toma cae cada rumbo, la guía, el dibujo del anillo y los textos de las pastillas. |
| `js/calidad.js` | **Puro.** Borrosa (varianza del laplaciano por ejes), oscura y torcida; los umbrales, sin calibrar. |
| `js/orientacion.js` | **Puro.** El rumbo de la cámara (W3C o `webkitCompassHeading`), la elevación y el giro del horizonte. |
| `js/evidencia.js` | **Puro.** El registro de cada foto, el texto canónico, la huella SHA-256 encadenada y su revisión. |
| `js/reporte-bd.js` | La base del reporte en IndexedDB: el reporte en curso y sus fotos; revisa la cadena dentro de la transacción. |
| `js/brujula.js`, `js/camara.js` | Los sensores del navegador: el permiso del iPhone, los eventos de orientación, `getUserMedia` y sacar el cuadro. |
| `js/fotos.js`, `js/conexion-bd.js` | **Copiados del Taller** (commit 2c44f30) sin más cambio que el encabezado. Lo que se arregle en uno se pasa al otro a mano. |
| `js/vendor/leaflet/` | Leaflet 1.9.4 (BSD-2), copiado: sin CDN. |
| `herramientas/servidor.js` | El servidor del taller, sin COOP/COEP (COEP bloquearía las teselas). |
| `herramientas/guardar-ejemplo-via.mjs` | Baja los ejemplos reales de las pruebas. |
| `pruebas/` | `node --test`; `datos/` tiene dos respuestas reales de Overpass (ODbL). La base del teléfono se simula con `fake-indexeddb` (solo para pruebas). |

## Trampas que ya mordieron

- **overpass.openstreetmap.fr le responde 403 a los navegadores ocultos**
  ("HeadlessEdg", medido el 13-nov-2026) y a un navegador que no manda
  Referer. A un iPhone que abre la app desde GitHub Pages le responde 200. Por
  eso el análisis en vivo no sale en las capturas con Edge oculto, aunque en el
  teléfono sí sale; el ejemplo usa datos guardados y sale en las dos.
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
- **El laplaciano completo no ve una foto movida al girar** (13-nov): las rayas
  horizontales siguen nítidas y lo sostienen. Con una textura medida: nítida
  4.188, movida 17 px todavía 581, que pasaba por buena. Por ejes, la misma
  foto da 7 en horizontal: `calidad.js` usa el eje más borroso.
- **El permiso de la brújula del iPhone se pide dentro del toque y antes de
  cualquier `await`**; después, Safari lo niega sin preguntar. Por eso
  `pedirPermisoBrujula()` es lo primero que corre cada botón que enciende la
  cámara.
- **El panel del navegador no carga páginas si la sesión no está abierta en
  una ventana** (13-nov): se queda «cargando» para siempre, aunque el servidor
  responda. Ahí se verifica con el Edge sin ventana del Taller (no abre nada ni
  suena), y se matan sus procesos `captura-*` al terminar.

## Licencias de terceros

Datos de vías © colaboradores de OpenStreetMap (ODbL), con el crédito visible
en el mapa y en el análisis. Las teselas de tile.openstreetmap.org sirven para
el demo, no para una app con tráfico. Open-Meteo es gratis solo para uso no
comercial. Leaflet: BSD-2 (`js/vendor/leaflet/LICENSE`).
