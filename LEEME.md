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
- `npm test` → 213 pruebas en Node, sin internet (51 vienen del Taller con lo
  que se copió de allá).
- **En el celular hace falta https**: por la IP del Wi-Fi (`npm run celular`,
  `http://192.168…`) se ve la app, pero el navegador no da ubicación, cámara
  en vivo ni brújula. Para probar de verdad está en GitHub Pages, encendido el
  13-nov: <https://joanhispanista-star.github.io/choque-claro/> (repositorio
  público `joanhispanista-star/choque-claro`; el remoto `origin` apunta ahí).
- **Pages publica la rama `gh-pages`, no `master`.** Desde aquí no hay `gh` ni
  token, y en Settings el guardado no le funcionó a Joan. GitHub enciende Pages
  solo cuando aparece una rama `gh-pages`, así que se creó con un push. Por eso
  `.git/config` de este PC tiene dos `remote.origin.push` (master → master y
  master → gh-pages): **publicar es `git push` a secas** (con
  `GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never`), y empuja las dos ramas. Ojo:
  `git push origin master` NO actualiza el sitio. En otro PC, o si alguien
  cambia la fuente de Pages a `master`, esto deja de hacer falta.
- `npm run ejemplos-via` vuelve a bajar los dos ejemplos reales de las pruebas
  (ver `pruebas/datos/LEEME.md`).

## Lo que hay (13-nov-2026)

Los pasos 1 a 7 de 8:

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
     Los carros, sus flechas y el golpe salen del croquis del paso 7 de este
     teléfono, si es de este lugar (a menos de 150 m) y del mismo tipo (del
     ejemplo o de verdad): entonces la cámara se acerca al golpe y la leyenda
     dice si ya se dio por hecho o es un borrador. Sin croquis, el ejemplo
     muestra unos inventados y marcados así. Sin clave ni tarjeta. Es una maqueta, no del
     día, y la página lo dice. Nada espera al análisis de la vía: con los
     servidores públicos lentos (hasta 75 s) la página se quedaba en blanco; el
     tramo y la cámara a lo largo de la vía llegan después.
   - **El 3D fotorrealista de Google** (opción A: Joan la eligió el vie 13-nov
     después de ver la hoja con Google Earth). Es la misma página, pero con el
     `Map3DElement` de Maps JavaScript en vez de MapLibre, y **solo cuando hay
     clave** en `js/clave-de-google.js`. Hoy la clave está vacía, así que sale
     la maqueta de siempre.
     - **Lo que va encima:** lo mismo que en la maqueta (punto, tramo, señales,
       sol, conos y croquis). Los carros del croquis son el carro 3D del paso 6,
       exportado a .glb en el teléfono por `carro-glb.js`, a su tamaño y del
       color de su letra.
     - **Si Google falla** (sin conexión, clave que no acepta, cupo del día), su
       mapa se quita entero y sale la maqueta con el motivo en rojo. Se quita
       entero porque Google no deja su 3D junto a un mapa ajeno.
     - **Precio** (SKU «Immersive Maps»): 5.000 aperturas gratis al mes y
       luego US$7 por 1.000. Con la «Maps Demo Key» no hay cobros posibles.
     - **Verificado sin clave, el 13-nov**, en el Edge oculto: sin clave, la
       maqueta sale igual que antes y no se le pide nada a Google. Con una
       clave falsa vuelve a la maqueta y dice «Google no aceptó la clave del
       3D (InvalidKeyMapError)». El carro sale como .glb (595 KB). La altura
       del suelo cuadra: 2.919 m en Los Verjones y 2.582 m en Chapinero.
     - **Falta probarlo con la clave de Joan:** el giro del carro
       (`GIRO_DEL_MODELO`), la altura de las flechas sobre la vía de la foto, y
       si Google acepta el .glb desde un `blob:`.
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
5. **Los carros** (13-nov, prometido para el mié 18). Una tarjeta por carro: A
   (el tuyo) y B (el otro) de entrada; «Agregar otro carro» hasta la F (uno
   agregado sin fotos se puede quitar). Por cada carro:
   - **La vuelta de 8 fotos alrededor del carro**, con la misma cuenta, el
     mismo anillo, la misma revisión y la misma huella de la escena: quien
     camina alrededor de un carro apuntándole también le da la vuelta entera
     al rumbo de la cámara. La primera foto es el frente, con la placa; la guía
     dice «Camina hacia tu izquierda alrededor del carro», y el lado derecho
     del carro es el que aparece primero (el carro te mira de frente).
   - **La silueta guía** encima del visor: el contorno del carro visto desde
     la toma donde está la persona, con «Foto 3 de 8 · Lado derecho». Sale del
     mismo carro 3D de los daños, dibujado una vez desde las 8 tomas
     (`siluetas-3d.js`), con la carrocería de la línea si se eligió.
   - **«Terminar con las que hay»**: si un lado da a la vía, no se toma. El
     carro dice «Faltan: la 4 (atrás y lado derecho)…» y que el reporte dirá
     cuáles faltan; «Seguir la vuelta» sigue donde iba.
   - **La placa se lee sola** de la foto del frente, y si ahí no sale, de la de
     atrás, después de guardarla y sin detener la vuelta. Lo leído queda como
     propuesta («Revísala: el lector puede confundir una letra») hasta que la
     persona toca «Sí, es esa» o «Corregir». Si lo escribe ella, queda «Escrita
     por ti. La app había leído…». También «No tiene placa». Lo leído a medias
     («JRK24») va al campo para completarlo. La primera lectura baja el lector
     (17 MB) y la pantalla lo dice.
   - **Marca y línea, opcionales**, del catálogo del Taller (1.137 líneas):
     con la línea, el carro de los daños sale con su carrocería y sus medidas.
6. **Los daños** (13-nov, prometido para el mié 18). El carro en 3D del Taller,
   uno por carro (pestañas arriba), gris claro y con su placa:
   - Se gira con un dedo y se acerca con dos; botones Frente, Izquierdo,
     Derecho, Atrás y Arriba. **Un toque marca la pieza** (con el anillo de
     rayos del taller: el estribo y el espejo se marcan con un dedo gordo).
     Tocar la placa, la parrilla o un faro marca lo que los sostiene.
   - La hoja de la pieza pregunta **qué le pasó**: rayón, abolladura, roto o
     suelto (el más grave, si tiene varios). La pieza se pinta del color de
     su tipo, que es el de la leyenda.
   - Después pide **la foto de cerca**: la misma cámara, sin anillo, y con una
     revisión que solo mira borrosa u oscura (de cerca se apunta hacia abajo y
     está bien). La foto se sella con el carro, la pieza y el tipo de ese
     momento. Si después se cambia el tipo, la lista dice «La foto se tomó
     cuando decía «Abolladura»». Quitar una marca no borra su foto.
   - **«Elegir la pieza de una lista»**: las 17 piezas de afuera en botones.
     Sirve sin 3D (si el navegador no puede, la pantalla lo dice y la abre) y a
     quien no puede tocar un 3D.
   - Por ahora **solo las piezas de lata**: los vidrios, los faros y las
     llantas no se marcan (el carro del taller es de lo que se pinta), y la
     pantalla lo dice: se ven en las fotos de la vuelta.
7. **El croquis** (13-nov, la opción 1, «guiada», que eligió Joan). Sobre la
   vía que analizó el paso 3, en Leaflet:
   - **Seis casos dibujados**: por detrás, de frente, en un cruce, al cambiar
     de carril, en reversa y contra algo quieto. Al tocar uno, la app pone A
     (tu carro) y B en su carril de la vía real, con la flecha de cada uno
     siguiendo la curva hasta el golpe (`armarCaso`). En el cruce, B llega en
     ángulo recto: el análisis no trae la geometría de la otra vía.
   - **Se acomoda con el dedo**: arrastrar el carro (la manija mide 44 px
     aunque el carro mida menos), girarlo con la manija ⟳ o de a 15°, decir si
     iba adelante, en reversa o quieto, mover la estrella del golpe, cambiar A
     y B, quitar un carro y volver a ponerlo desde su ficha. Cada carro tiene
     el largo y el ancho de su línea del paso 5.
   - **«Ninguno se parece: lo dibujo yo»** abre el modo a mano: los carros se
     ponen desde sus fichas y, con «Flecha», el dedo traza por dónde venía
     cada uno. Si ya había un croquis guiado, se queda y sus flechas pasan a
     ser editables.
   - **«Listo: así fue»** muestra el relato en palabras («A, tu carro, iba
     hacia el oeste…») antes de seguir: lo que la app puso por defecto (B
     quieto en «Por detrás») se vuelve una declaración si nadie lo cambia.
   - Se guarda solo en el reporte del teléfono a los 0,7 s de cada cambio,
     **con su propia copia de la vía**: el paso 3 no se guarda y se pierde al
     recargar. Si después se marca otro punto a más de 30 m, el croquis lo
     avisa. No va en la cadena de huellas (no es una foto): se sella al enviar.
   - **«Ver el croquis en la zona 3D»** lo lleva a la maqueta (ver el paso 3).

Las fotos de la escena, de los carros y de los daños van en **una sola cadena
de huellas** por reporte (`reporte-en-curso.js`): la lista de la escena revisa
la cadena entera. Lo declarado que no es foto (los carros con su placa y su
línea, las marcas de daño) se guarda en el reporte y se sella al enviar (paso 8).

El paso 8 (enviar) todavía no está, y la pantalla del croquis lo dice.

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

**Verificado (pasos 5 y 6, 13-nov)** en el mismo Edge sin ventana a 375×667,
con la foto de la Captiva de Joan como cámara de mentira (1600×1080), GPS
fijado y una brújula de iPhone de mentira: 46 de 46. La vuelta al carro A con
la silueta del frente y la del lado derecho; la placa leída de la foto del
frente (JRK248, confianza 0,988, 0,8 s; la de verdad es JRX248) y confirmada;
la línea del catálogo; el carro B a medias con «Terminar con las que hay», lo
que falta y la placa corregida a mano; agregar y quitar un carro; el 3D, el
toque en el bómper, el tipo, la foto de cerca sellada con carro, pieza y tipo;
marcar desde la lista; cambiar el tipo después de la foto; y la escena
completa después, con la cadena de 19 huellas íntegra. Sin errores en la
página. El arnés y los pantallazos viven fuera del repo.

**Verificado (paso 7, 13-nov)** en el mismo Edge sin ventana a 390×844, con
toques de dedo de verdad (eventos táctiles, no clics), sobre el ejemplo: 51 de
51. Las seis tarjetas; «De frente» armado con sus dos manijas, la de girar, la
estrella y dos flechas; lo que de verdad hay bajo el dedo en el centro de cada
carro (`elementFromPoint`) y su letra a la izquierda; arrastrar B y girarlo
90° con ⟳; cambiar A y B dos veces; quieto, adelante y ±15°; «Listo» con el
relato; recargar y encontrarlo igual, sin el paso 3; «Otro caso» y «Ninguno se
parece» con una flecha a dedo que no movió ni el carro ni el mapa; la zona 3D
con el croquis en la leyenda y en la maqueta; y, sin lugar, la pantalla que
pide marcarlo. Sin errores en la página.

**NO probado en un celular todavía.** GitHub Pages está encendido desde el
13-nov (todos los archivos llegan, el motor del lector con `application/wasm`).
Ver «Lo que falta probar en el iPhone».

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

Los carros y los daños (pasos 5 y 6):

7. **La vuelta al carro con la brújula**: caminando alrededor, ¿el anillo
   avanza y la silueta cambia de lado? Al lado de un carro la brújula del
   celular se desvía (el hierro): anotar si alguna foto cae en la toma
   equivocada. ¿La silueta se ve sobre el carro de verdad, de día y de noche?
8. **La placa en un celular**: nunca se ha leído una en un teléfono. Medir
   cuánto tarda la primera (baja 17 MB) y si acierta con dos o tres placas
   reales, de frente y de tres cuartos. Los márgenes de la segunda pasada
   (`lector-de-placa.js`) salen de UNA foto medida.
9. **El 3D en el iPhone**: girar con un dedo, acercar con dos, tocar el estribo
   y el espejo. Después de los daños, volver a la cámara: dos 3D (las siluetas
   y el carro) y la cámara a la vez no deben tumbar Safari.
10. **La foto de cerca**: con el celular a un paso de la lata, ¿la revisión la
    deja pasar? El umbral de borrosa no está calibrado para fotos de cerca.

El croquis (paso 7):

11. **Arrastrar y girar con el dedo**: ¿el carro se agarra a la primera?
    ¿La manija ⟳ gira sin mover el mapa? ¿Acercan los dos dedos?
12. **Dibujar con «Flecha»**: el dedo tiene que dibujar, no correr la página
    (si algo falla con `touch-action`, Safari se queda el gesto). Volver a
    «Mover» y comprobar que el mapa se arrastra otra vez.

La zona en el 3D de Google (cuando esté la clave):

13. ¿Carga en Safari y se mueve con el dedo sin trabarse? ¿Aguanta la memoria
    del iPhone con los dos carros encima, o Safari recarga la página?

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
- **La placa leída es una propuesta** hasta que la persona la ve. Nunca se da
  por buena sola: el lector confunde la X con la K a 30°.
- **Las marcas de daño son lo que dice la persona**, no un peritaje. La pantalla
  lo dice; las fotos de cerca son la prueba.
- **El croquis es lo que declara la persona**, no una medición ni una
  reconstrucción: lo dicen su pantalla y la leyenda de la zona 3D. Lo que la
  app puso por defecto se lee en el relato antes de «Listo».

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
| `js/zona-3d.js` | **Puro.** Los GeoJSON de lo que va encima (punto, precisión, tramo, señales, sol, conos, carros del croquis o del ejemplo, golpe), la cámara a lo largo de la vía o sobre el croquis, la luz del sol y la leyenda que dice lo que falta. |
| `js/pantalla-zona-3d.js` | La página: lee el punto de la dirección, analiza la vía (el ejemplo, guardado) y lee las fotos de la escena, el croquis y la línea de cada carro. Arma el 3D de Google si hay clave. Si no hay clave, o si Google falla, arma la maqueta abierta con relieve, sombreado y capas. |
| `js/zona-google.js` | **Puro.** El 3D de Google: la cámara convertida desde la de la maqueta (el croquis queda del mismo tamaño), el píxel y la altura del mosaico terrarium, la lista de lo que va encima en lat/lng, y el motivo en palabras cuando Google no acepta la clave. |
| `js/pantalla-zona-google.js` | Carga Maps JavaScript con la clave, pide la altura del suelo, monta el `gmp-map-3d` con carros, flechas y marcas, y avisa si Google falla. |
| `js/carro-glb.js` | El carro del paso 6 como .glb, hecho con el exportador de Three.js, para el 3D de Google. |
| `js/clave-de-google.js` | La clave de navegador de Google Maps. Vacía = maqueta abierta. No es un secreto: la protege la restricción a los sitios de Choque Claro. |
| `js/croquis.js` | **Puro.** El croquis del paso 7: la vía en metros (tangentes promediadas, para que la curva cerrada no quiebre los carriles), los seis casos, poner, mover, girar y cambiar carros, las flechas automáticas y a mano, el relato, guardar y reabrir. |
| `js/pantalla-croquis.js` | "El croquis": las tarjetas, el mapa con las manijas, la de girar y la estrella, el dibujo a dedo, los botones y el guardado. |
| `js/vendor/maplibre/` | MapLibre GL JS 4.7.1 (BSD-3), copiado: sin CDN. |
| `js/escena-360.js` | **Puro.** Dónde va cada foto en el círculo, las medidas del cilindro (70° de visor, 50° por foto), la foto de frente y su texto. |
| `js/pantalla-escena-360.js` | El visor 360°: paneles de CSS 3D, arrastre con el dedo, botones, y esconde los paneles de atrás (Safari los pinta al revés). |
| `js/pantalla-escena.js` | "La escena": el inicio, la lista con la revisión de la cadena y el aviso de que la persona está lejos del punto. La cámara y la vuelta son las comunes. |
| `js/escena.js` | **Puro.** La vuelta: en qué toma cae cada rumbo, la guía, el dibujo del anillo y los textos de las pastillas. Recibe qué fotos cuentan (`filtro`) y qué decir (`textos`): sirve a la escena y a cada carro. |
| `js/sesion-de-camara.js` | La cámara en vivo con la brújula y el GPS, las pastillas, la revisión («Repetir» / «Usarla así») y el guardado. La comparten la escena, los carros y los daños. Se apaga sola en segundo plano. |
| `js/vuelta-en-pantalla.js` | La vuelta de 8 en pantalla: el anillo, la guía, la tira y la silueta. La usan la escena y los carros. |
| `js/reporte-en-curso.js` | El reporte que comparten las tres pantallas de fotos: una sola copia de la cadena, `agregarFoto` (reduce, sella y guarda), `revisarCadena` y `guardarDatos` (carros y daños). |
| `js/pantalla-carros.js` | "Los carros": la lista, un carro (sus fotos, la placa y la línea) y la cámara con la silueta. Lee la placa por detrás después de la foto. |
| `js/carros.js` | **Puro.** Los carros del reporte, los nombres de las 8 tomas, los textos de la vuelta al carro, la placa (formato, propuesta, escrita, sin placa) y la tarjeta de cada carro. |
| `js/lector-de-placa.js` | La placa de una foto del video: el lector del taller y, si no está seguro, una segunda pasada con más margen alrededor de la placa (ver «Trampas»). |
| `js/silueta.js`, `js/siluetas-3d.js` | La silueta guía: dónde se para la cámara en cada toma y el contorno de la mancha (puro); y las 8 imágenes dibujadas una vez con Three.js. |
| `js/pantalla-danos.js` | "Los daños": el carro 3D, la hoja de la pieza, la lista de lo marcado, la lista de piezas y la cámara de la foto de cerca. |
| `js/danos.js` | **Puro.** Los 4 tipos con su color, las piezas que se marcan (las 17 de afuera), marcar y quitar, la foto vigente de cada pieza, las filas de la lista y la revisión de la foto de cerca. |
| `js/visor-danos.js` | El carro en 3D mínimo: Three.js, giro con un dedo, el toque (toque.js), la tinta de cada daño y las vistas. Se dibuja solo cuando algo cambia. |
| `js/carro.js`, `js/piezas.js`, `js/carrocerias.js`, `js/toque.js`, `js/encuadre.js` | **Copiados del Taller** (commit 4502d41) sin más cambio que el encabezado: el carro por piezas en cuatro carrocerías, los nombres del gremio, el toque y el encuadre. `visor.js` NO se copió (arrastra los escaneos y los modelos del catálogo). |
| `js/placa-foto.js`, `js/placa-ocr.js` | **Copiados del Taller** (4502d41): encontrar la placa amarilla, enderezarla y leerla con fast-plate-ocr. `placa-ocr.js` solo cambia la carpeta del motor. |
| `js/catalogo.js`, `js/catalogo-carros.js` | **Copiados del Taller** (4502d41): el buscador y las 1.137 líneas de Colombia (se baja solo al buscar). |
| `js/vendor/three/` | Three.js 0.169.0 con OrbitControls y RoomEnvironment (MIT), copiado del Taller; `index.html` lo conecta con un import map. |
| `js/vendor/placa/` | El modelo de placas (3,3 MB) y el motor ONNX Runtime Web (14 MB), copiados del Taller (ver su `LEEME.txt`). |
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

- **La zona 3D salía gris en cualquier navegador** (13-nov-2026, ya
  publicada). El mapa nacía con la cámara inclinada (zoom 17,3 y 62°) y el
  relieve se encendía después: así MapLibre 4.7 nunca pide la tesela del
  relieve que hay debajo del punto, calcula el suelo a 0 m, la cámara queda
  dentro de la montaña (en Los Verjones el suelo está a 2.921 m) y el mapa
  termina en zoom 14,35 y 7°, sin dibujar nada; la caja gris es su fondo CSS.
  No era el Edge oculto: con la tarjeta gráfica del PC salía igual, y sin
  relieve se dibujaba bien. Ahora arranca desde arriba (`camaraDeArranque`) y
  entra al 3D en el primer `idle` después de encender el relieve. Para
  medirlo: `__zona3d.mapa.transform.elevation` tiene que dar la altura real,
  no 0.
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
- **La placa de una foto del VIDEO pierde el último carácter** (13-nov): el
  video llega en YUV 4:2:0, con el color a media resolución, y la mancha
  amarilla sale un poco más chica. Con las esquinas justas el lector del taller
  leyó «JRK24»; con las esquinas 1,25 × 1,12 más afuera, «JRK248» (0,988).
  `lector-de-placa.js` prueba márgenes solo si la primera lectura no es segura.
- **En el carro del taller, la placa, la parrilla y los faros paran el dedo**
  (allá no se pintan): tocar el centro del bómper delantero no marcaba nada.
  `visor-danos.js` los vuelve transparentes al toque; los vidrios no.
- **La tinta del taller (`resaltar`) es suave a propósito**, y el rojo de
  «roto» salía rosado. `visor-danos.js` pinta el color entero de la leyenda.
- **El servidor tiene que mandar `.wasm` como `application/wasm`**: si no, el
  navegador no compila el motor mientras baja y lo avisa como error.
- **Leaflet con el arrastre apagado le devuelve el dedo al navegador**
  (13-nov): `map.dragging.disable()` quita la clase `leaflet-touch-drag`, el
  mapa queda con `touch-action: pan-x pan-y` y el dedo que dibuja una flecha
  corre la página. Con «Flecha» el mapa lleva `.dibujando`
  (`touch-action: none !important`).
- **Un `position` en el ícono de un marcador le gana a Leaflet** (13-nov):
  `.croquis-manija { position: relative }` apilaba las manijas como bloques y
  la de B quedaba 22 px debajo de su carro (la de un C, 44). La prueba que
  tocaba el centro del carro pasaba por el borde de la manija; la que mira con
  `elementFromPoint` y dónde cae la letra lo cazó.
- **`fitBounds` se queda en su tope sin avisar**: con `maxZoom: 20` un carro
  medía 30 px y «Por detrás» no se acercaba más aunque cupiera. El croquis usa
  `zoomSnap: 0.25` y tope 20,5 (unos 42 px por carro).
- **El paso 3 vive solo en la memoria**: el punto y el análisis se pierden al
  recargar. Por eso el croquis guarda su propia copia de la vía.
- **Con el 3D, Google no avisa por `gm_authFailure`** (13-nov-2026, medido con
  una clave que no existe). Tampoco dispara el evento `gmp-error`. Pone su
  tarjeta «¡Vaya! Se ha producido un error» dentro del mapa y escribe «Google
  Maps JavaScript API error: InvalidKeyMapError» en la consola. Por eso la
  página escucha `console.error` para volver a la maqueta.
- **El `center` del 3D de Google se mide sobre el nivel del mar**, no sobre el
  suelo: con altura 0, en Bogotá la cámara mira a un punto 2.600 m bajo tierra.
  La altura sale del píxel del mosaico terrarium de AWS, leído sin corrección
  de color.

## Licencias de terceros

Datos de vías © colaboradores de OpenStreetMap (ODbL), con el crédito visible
en el mapa y en el análisis. Las teselas de tile.openstreetmap.org sirven para
el demo, no para una app con tráfico. Open-Meteo es gratis solo para uso no
comercial. Leaflet: BSD-2 (`js/vendor/leaflet/LICENSE`). Three.js: MIT
(`js/vendor/three/LICENSE`). El modelo de placas fast-plate-ocr: MIT
(`js/vendor/placa/LICENSE-fast-plate-ocr`); ONNX Runtime Web: MIT (aviso en
la primera línea de `ort.wasm.min.mjs`). Las medidas del catálogo citan su
fuente en cada línea. El exportador glTF de Three.js (MIT) está copiado sin
cambios en `js/vendor/three/exporters`. El 3D fotorrealista es de Google Maps
Platform y va con sus términos: su logo y sus créditos quedan a la vista, su
contenido no se guarda ni se exporta, y no se pone junto a un mapa ajeno.
