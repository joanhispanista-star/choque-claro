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
- `npm test` → 315 pruebas en Node, sin internet (51 vienen del Taller con lo
  que se copió de allá; 16 corren la base de las cuentas en un Postgres dentro
  de Node, con PGlite).
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

## Lo que hay (14-nov-2026)

Los 8 pasos:

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
     muestra uno inventado y marcado así: un choque de frente armado con el
     mismo `armarCaso` del paso 7, con cada carro en su carril
     (`croquisGuardadoDeEjemplo`). Sin clave ni tarjeta. Es una maqueta, no del
     día, y la página lo dice. Nada espera al análisis de la vía: con los
     servidores públicos lentos (hasta 75 s) la página se quedaba en blanco; el
     tramo y la cámara a lo largo de la vía llegan después.
     - **Cómo se ve desde el 14-nov** (Joan: «se ve muy pobre»): el tramo
       analizado va como asfalto del ancho que da el mapa (3,3 m por carril, 7 m
       si no lo dice) con sus bordes en verde, en vez de una raya verde; hay
       cielo y neblina en el horizonte; y los carros son el carro 3D del paso 6
       sobre el relieve, inclinados con la pendiente, en vez de dos cajas
       oscuras. Sin líneas pintadas en la vía, a propósito: el mapa no sabe si
       la del día era doble o punteada.
   - **La recreación** (14-nov; Joan pidió «recrear con videos interactivos
     cómo fue el accidente»). En la misma página, sobre la maqueta abierta: el
     croquis del paso 7 en movimiento. Un botón **«Ver cómo fue»** encima del
     mapa, una línea de tiempo con la marca del golpe, «Lento» (4 veces más
     despacio) y tres cámaras: **«Los carros»** (los encuadra a todos y se va
     cerrando sola sobre el golpe, porque el círculo donde caben se achica) y
     **«Seguir a A / B»** (12 m detrás de la cola y 4,5 m arriba, en la línea
     del golpe). Si la persona mueve el mapa, la película le suelta la cámara.
     - **Lo que es y lo que no** (`recreacion.js`, puro): cada carro recorre su
       flecha a ritmo parejo y todos llegan al golpe a la vez; nadie declaró
       velocidades, así que no dice quién iba más rápido ni si alguien frenó.
       El golpe es el primer instante en que se tocan los contornos; si las
       flechas no los juntan (un poste), para donde termina la flecha. Después
       del golpe se queda quieta: cómo quedaron lo cuentan las fotos, no una
       física inventada. Donde la persona puso el carro en el croquis, pasa tal
       cual (posición y rumbo).
     - **En el golpe se encienden las piezas dañadas** del paso 6, cada una con
       el color de su daño (en el ejemplo, unas inventadas).
     - **La advertencia va en el mapa mismo** («Recreación de lo declarado · no
       es una medición»), para que ningún pantallazo salga sin ella.
     - **No hay cámara «desde los ojos del conductor», a propósito.** Se
       construyó y se quitó el mismo día: la maqueta no tiene árboles, barrancos
       ni carros parqueados, mostraba una vía despejada y daba a entender que el
       conductor veía al otro. Además, un teléfono en vertical solo abre 26° a
       lo ancho. Esa vista solo tendría sentido sobre un 3D con lo que había.
     - **Solo en la maqueta abierta, no en el 3D de Google**: sus condiciones no
       dejan guardar ni sacar su 3D, y la recreación es lo que más adelante debe
       salir en el expediente como video.
     - **Lo que falta**: sacarla como video para el expediente; probarla en el
       iPhone (ver abajo); velocidades declaradas, si algún día se piden.
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
     - **Probado con la clave de demostración de Joan, el 14-nov** (la «Maps
       Demo Key» de su cuenta, en el Edge oculto; la clave se metía al vuelo y
       nunca entró al repositorio). Sale el 3D de Los Verjones con los dos
       carros sobre la vía de la foto. Lo que se ajustó con él está en
       «Trampas»: el carro parado sobre la cola, el .glb por `blob:`, la
       pintura negra, la cámara a 397 m y el texto del pin dos veces.
     - **La clave de demostración no se puede restringir** a los sitios de
       Choque Claro, y sus términos no la dejan para producción. En el
       repositorio (que es público) cualquiera la puede copiar: no cuesta
       plata (no tiene facturación), pero le pueden gastar el cupo. Por eso
       `js/clave-de-google.js` sigue vacía hasta que Joan decida.
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
8. **Enviar el reporte** (14-nov). Una sola pantalla:
   - **Lo que va en el reporte**: dónde y cuándo, la escena, cada carro, los
     daños y el croquis, cada uno con ✓ o «!» y un botón para ir a
     completarlo. **No bloquea**: en la vía no siempre se puede todo (llegó
     la grúa, empezó a llover), y el expediente dice lo que faltó. Solo
     impiden sellar no tener ni una foto y la cadena rota. Si el punto de
     «¿Dónde fue?» está a más de 30 m del croquis, lo avisa: el expediente
     diría una vía y dibujaría otra.
   - **Sellar**: el SHA-256 del texto canónico de lo declarado (el lugar
     como lo mostró el paso 3, los carros, los daños y el croquis) junto con
     la última huella de la cadena de fotos (`sello.js`). El número es
     `CC-AAMMDD-XXXXXX`: el día del sello en Colombia y las 6 primeras de la
     huella. No es el número del siniestro (ese lo da la aseguradora), y la
     pantalla lo dice.
   - **Después de sellar se puede corregir.** Si algo cambia, la pantalla
     dice qué («cambiaron los carros»), tacha el número viejo y pide sellar
     otra vez: el número cambia.
   - **Compartir el expediente (PDF)**: la hoja de compartir del teléfono
     (WhatsApp, correo, Archivos) con el PDF; en un computador se descarga.
     El PDF se arma al entrar, ANTES del toque (ver «Trampas»).
   - **Enviar el número por WhatsApp**: el número y la huella entera. Quien
     lo recibe queda con la huella en su chat, con la fecha de WhatsApp: si
     el reporte cambia después, ya no cuadra.

Las fotos de la escena, de los carros y de los daños van en **una sola cadena
de huellas** por reporte (`reporte-en-curso.js`): la lista de la escena revisa
la cadena entera. Lo declarado que no es foto (los carros con su placa y su
línea, las marcas de daño) se guarda en el reporte y se sella al enviar (paso 8).

**El expediente** (`expediente.js` decide qué dice; `expediente-pdf.js` lo
pone en hojas carta; `pdf.js` escribe el PDF a mano, sin librerías):
portada con el número, la huella y lo que el expediente NO afirma; dónde y
cuándo (la vía y la luz como las mostró el paso 3, con enlaces a Maps y
Street View); el croquis dibujado a escala, con el norte y una regla; la
escena y cada carro en rejillas de 4, con lo que se selló con cada foto
(hora, GPS, rumbo y la revisión); los daños con y sin foto de cerca; un
anexo con las fotos repetidas, y la tabla de la cadena con el SHA-256 de
cada foto. Lo que falta se dice («Faltan la 6 y la 7») y la placa que nadie
revisó va como «SIN revisar». Con el ejemplo, cada hoja dice EJEMPLO.

**Cómo se comprueba un expediente sin la app** (lo dice su última hoja):

- Las fotos van dentro del PDF con sus bytes intactos (el JPEG tal cual,
  sin volver a comprimir): `pdfimages -all expediente.pdf foto` y
  `sha256sum foto-*` dan los SHA-256 de la tabla.
- El PDF lleva dos adjuntos: `contenido-sellado-<número>.json`, el texto
  exacto que se selló (su SHA-256 es la huella de la portada), y
  `cadena-de-fotos-<número>.json`, el registro de cada foto.
- Comprobado el 14-nov fuera de la app, con PyMuPDF y pypdf: las 25 fotos
  sacadas del PDF de la app tienen el SHA-256 de la cadena, y el adjunto
  sellado, la huella del sello.

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

**Verificado (paso 8, 14-nov)** en el mismo Edge sin ventana a 390×844: 25
fotos de muestra entraron por la puerta de la app (`agregarFoto`: se
reducen, se sellan y van a la base del teléfono), y 17 de 17: la revisión
con lo que falta, sellar, el PDF listo antes del toque (5,3 MB, 8 hojas), la
hoja de compartir con el archivo, WhatsApp con el número y la huella
entera, cambiar la placa de B después de sellar (lo nota y tacha el número)
y sellar otra vez (otro número, otro PDF). Sin errores en la página ni en la
consola.

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

La recreación (14-nov; solo se ha visto en el Edge oculto del PC):

17. **¿Sale en Safari?** Dibuja los carros con Three.js dentro del mismo WebGL
    del mapa (necesita WebGL 2). Si no puede, quedan las cajas de siempre y no
    aparece el botón «Ver cómo fue»: anotar cuál de las dos pasó.
18. **¿Corre pareja?** Con «Los carros» y con «Seguir a A»: si va a tirones en
    el iPhone, anotarlo (el mapa se redibuja entero en cada cuadro).
19. Arrastrar el mapa con la película andando: la película sigue y la cámara
    queda en el dedo. «Desde arriba» y después «Ver cómo fue»: se queda arriba.

El envío (paso 8):

14. **Compartir el PDF en Safari**: ¿abre la hoja de compartir con el PDF y
    llega entero a WhatsApp y a Archivos? Con 25 fotos pesa unos 5 MB:
    medir cuánto tarda en armarse y si Safari aguanta la memoria.
15. **«Enviar el número por WhatsApp»**: ¿abre WhatsApp con el texto
    completo, huella incluida?
16. Abrir en otro teléfono el PDF que llegó por WhatsApp: ¿se ven las fotos y
    los enlaces a Maps abren?

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
  huella tiene que salir del teléfono en el momento: el paso 8 la manda por
  WhatsApp, donde queda con la fecha del chat, y el expediente lo dice.
  Guardarla en un servidor llega con el piloto. Y la hora es la del reloj del
  celular.
- **El rumbo es magnético** y lo da la brújula del celular, que se desvía al
  lado de un carro. Cada foto dice de dónde salió (`rumboFuente`).
- **La placa leída es una propuesta** hasta que la persona la ve. Nunca se da
  por buena sola: el lector confunde la X con la K a 30°.
- **Las marcas de daño son lo que dice la persona**, no un peritaje. La pantalla
  lo dice; las fotos de cerca son la prueba.
- **El croquis es lo que declara la persona**, no una medición ni una
  reconstrucción: lo dicen su pantalla y la leyenda de la zona 3D. Lo que la
  app puso por defecto se lee en el relato antes de «Listo».
- **La recreación es el croquis en movimiento**, no una reconstrucción: sin
  velocidades, sin frenadas, sin lo que pasó después del golpe y sin «qué
  alcanzaba a ver» cada conductor. Lo dicen el mapa y la nota de abajo.
- **El expediente no decide la culpa** ni la insinúa: ni velocidades, ni
  «responsable», ni colores de culpa (A y B llevan el color de su letra). Su
  primera hoja dice lo que NO afirma, y lo declarado va como declarado:
  «según la persona», «SIN revisar».

## Cuentas y roles (fase 2, en construcción desde el sáb 14-nov)

Joan lo decidió el 14-nov: cuentas de verdad ya, sin esperar al piloto. **Nada
de esto está todavía en el sitio ni en un servidor.** La demo del vie 20-nov
sigue entera en el teléfono, y no se toca hasta que la fase 2 esté completa y
probada.

| Rol | Quién es | Cuenta |
|---|---|---|
| conductor | el que reporta el choque | no: sesión anónima en su teléfono |
| analista | el de siniestros de la aseguradora | correo y clave |
| jefe | el jefe de siniestros: arma su equipo, asigna y ve la bitácora | correo y clave |
| abogado | el de la aseguradora: solo lo que le asignan | correo y clave |
| abogado del conductor | el que el conductor elija | no: un enlace que vence a 30 días |
| super_admin | Joan: ve todo, y cada apertura queda en la bitácora | correo y clave |

**Hecho (pieza 1, 14-nov):** la tabla de quién puede qué (`js/permisos.js`) y
la base con RLS (`supabase/migrations/20261114150000_fase2_roles.sql`).
`pruebas/roles-postgres.test.js` corre la migración en PGlite y le hace probar
a cada persona cada acción sobre cada reclamo: 976 casos, y lo que la base deja
hacer tiene que ser exactamente lo que dice la tabla. Cómo está armada:
- El equipo **solo lee** de las tablas. Lo que cambia algo pasa por una
  función que escribe en la bitácora, y la bitácora no tiene política de
  insert.
- Lo declarado no tiene permiso de select para nadie: solo sale por
  `abrir_reclamo()`, que deja el rastro antes. Las fotos del almacenamiento
  solo se bajan con un «abrió» propio de las últimas 2 horas.
- A la aseguradora no le llega un reclamo «subiendo». Solo el servidor lo pasa
  a «recibido», cuando recalcula la huella de cada foto, y le pone **su** hora.
  Eso es lo que hace valer el sello contra el dueño del teléfono.
- Las visitas del abogado del conductor las ven el conductor y Joan, **no la
  aseguradora**: que el conductor contrató abogado es asunto suyo.
- Ningún error de la base llega en inglés: cada función revisa lo que recibe y
  contesta en español antes de que un `check` de la tabla diga «violates check
  constraint». Una prueba lo barre función por función.
- Reenviar el mismo reclamo (se cayó la señal) sigue donde iba. Reenviarlo a
  OTRA aseguradora no devuelve el viejo: avisa.

**Falta:** crear el proyecto de Supabase (solo Joan puede), aplicar la
migración y correr la consulta de verificación de su pie; las funciones del
servidor (`recibir-reclamo`, `crear-miembro`, `abrir-enlace`); el envío desde
el paso 8; y las páginas del equipo. Para la bandeja: hoy el analista ve el
`user_id` de quien tiene asignado un reclamo, pero no su nombre (los nombres
del equipo solo los lee el jefe); hace falta una función que le dé los nombres
de su aseguradora. Las fechas están en `PLAN-ROLES.md` (fuera
de git, como `PLAN.md`). Ningún reclamo real entra al servidor sin que un
abogado revise el texto de la autorización y sin contrato con la aseguradora.

**Trampa que cazó la prueba el mismo día:** en PL/pgSQL, un `if not (v_rol =
'super_admin' or …)` con `v_rol` en null da null, y un `if` con null **no
frena**. Así un conductor sin rol podía asignar reclamos y apagar cuentas del
equipo. Toda condición con un rol que puede faltar va con `coalesce(…, false)`.
Por eso la prueba solo cuenta como «no» el código 42501: cualquier otro error
sale como defecto. Si no, una función rota se leería como «no tiene permiso».

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
| `js/zona-3d.js` | **Puro.** Los GeoJSON de lo que va encima (punto, precisión, tramo, señales, sol, conos, carros del croquis o del ejemplo, golpe), el croquis inventado del ejemplo y sus daños, el ancho de la vía, la cámara a lo largo de la vía o sobre el croquis, la luz del sol y la leyenda que dice lo que falta. |
| `js/pantalla-zona-3d.js` | La página: lee el punto de la dirección, analiza la vía (el ejemplo, guardado) y lee las fotos de la escena, el croquis, la línea y los daños de cada carro. Arma el 3D de Google si hay clave. Si no hay clave, o si Google falla, arma la maqueta abierta con relieve, sombreado, cielo, el asfalto del tramo y las capas; y con croquis, monta la recreación. |
| `js/recreacion.js` | **Puro.** La recreación: cada carro por su flecha a ritmo parejo, el primer toque de los contornos (el golpe), el fotograma de cualquier momento, y las dos cámaras (la que sigue a un carro y el encuadre de todos). |
| `js/maqueta-carros.js` | Los carros 3D del paso 6 dentro del mapa de MapLibre (una capa propia con Three.js, en su mismo WebGL): sobre el relieve, inclinados con la pendiente, con su sombra y las piezas dañadas encendidas en el golpe. |
| `js/pantalla-recreacion.js` | Los controles de la recreación: reproducir (también encima del mapa), la línea de tiempo, lento, las cámaras con su entrada suave, las letras de los carros y quién manda en la cámara (la película, los botones de la zona o el dedo). |
| `js/zona-google.js` | **Puro.** El 3D de Google: la cámara convertida desde la de la maqueta (el croquis queda del mismo tamaño), el píxel y la altura del mosaico terrarium, la lista de lo que va encima en lat/lng, y el motivo en palabras cuando Google no acepta la clave. |
| `js/pantalla-zona-google.js` | Carga Maps JavaScript con la clave, pide la altura del suelo, monta el `gmp-map-3d` con carros, flechas y marcas, y avisa si Google falla. |
| `js/carro-glb.js` | El carro del paso 6 como .glb, hecho con el exportador de Three.js, para el 3D de Google. |
| `js/clave-de-google.js` | La clave de navegador de Google Maps. Vacía = maqueta abierta. Una clave de pago se restringe a los sitios de Choque Claro y así no es un secreto; la de demostración no se puede restringir y no va aquí. |
| `js/croquis.js` | **Puro.** El croquis del paso 7: la vía en metros (tangentes promediadas, para que la curva cerrada no quiebre los carriles), los seis casos, poner, mover, girar y cambiar carros, las flechas automáticas y a mano, el relato, guardar y reabrir. |
| `js/pantalla-croquis.js` | "El croquis": las tarjetas, el mapa con las manijas, la de girar y la estrella, el dibujo a dedo, los botones y el guardado. |
| `js/pantalla-enviar.js` | "Enviar el reporte" (paso 8): la revisión, sellar, el PDF armado antes del toque, compartir y WhatsApp. |
| `js/enviar.js` | **Puro.** Qué tiene y qué le falta al reporte, lo que impide sellar, el mensaje de WhatsApp y el nombre del PDF. |
| `js/sello.js` | **Puro.** El sello: el lugar del paso 3 para el reporte, lo que se sella, la huella, el número y qué parte cambió después. |
| `js/expediente.js` | **Puro.** Qué dice el expediente y en qué orden: el resumen, cada foto con lo que se selló con ella, lo que falta, el anexo, la cadena y el plano del croquis. |
| `js/expediente-pdf.js` | El expediente en hojas carta: portada, dónde y cuándo, croquis, escena, carros, anexo y cadena, con el pie de cada hoja. |
| `js/pdf.js` | **Puro.** Un PDF escrito a mano: texto en WinAnsi con los anchos de Helvetica, JPEG sin recomprimir, enlaces, transparencia, recortes y adjuntos. |
| `js/fechas.js` | **Puro.** Fechas y horas en la hora de Colombia (UTC−5), sin depender de la zona del teléfono. |
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
| `js/carro.js`, `js/piezas.js`, `js/carrocerias.js`, `js/toque.js`, `js/encuadre.js` | **Copiados del Taller** (commit 4502d41) sin más cambio que el encabezado (y, en `carro.js`, el nombre `pintura` del material de la pintura, que busca la maqueta de la zona): el carro por piezas en cuatro carrocerías, los nombres del gremio, el toque y el encuadre. `visor.js` NO se copió (arrastra los escaneos y los modelos del catálogo). |
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
| `js/permisos.js` | **Puro.** Quién puede qué cuando haya cuentas (fase 2): seis roles, doce acciones y el motivo del no en español. No protege nada: la pantalla lo usa para mostrar solo los botones que la base va a aceptar. |
| `supabase/migrations/20261114150000_fase2_roles.sql` | La base de las cuentas: tablas, RLS, las funciones que dejan rastro y el almacenamiento de las fotos. Idempotente. Al pie, la consulta para verificar que se aplicó (las seis en true). **Sin aplicar todavía.** |
| `pruebas/roles-postgres.test.js`, `pruebas/supabase-de-mentira.sql` | La migración corrida en PGlite (Postgres dentro de Node, solo para pruebas) sobre un Supabase de mentira que imita sus roles, `auth.uid()`, el almacenamiento y sus permisos por defecto abiertos. |
| `pruebas/` | `node --test`; `datos/` tiene dos respuestas reales de Overpass (ODbL). La base del teléfono se simula con `fake-indexeddb` (solo para pruebas). `reporte-de-prueba.js` arma un reporte entero para el paso 8 (la curva del ejemplo, 26 fotos, una repetida, B a medias) y `jpeg-de-prueba.js`, JPEG mínimos válidos. |

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
- **Un carro de Three.js dentro del mapa de MapLibre** (14-nov, la
  recreación; todo medido en MapLibre 4.7.1):
  - *La altura.* La matriz que recibe una capa propia no resta la altura del
    terreno en el centro de la pantalla (la de los mosaicos sí), y
    `queryTerrainElevation` devuelve la altura del punto **menos** la del
    centro: justo lo que le falta a esa matriz. Sin eso el carro queda a
    2.921 m, la altura del cerro, o enterrado.
  - *El relieve pide `maxzoom` 14*, el tope de las teselas de calles: con 15,
    de zoom 15 para arriba MapLibre avisaba «cannot calculate elevation if
    elevation maxzoom > source.maxzoom».
  - *Los puntos de la zona se pintaban encima de los carros*: la capa de los
    carros va justo debajo de las letras, encima de todo lo demás.
  - *Las letras A y B se quedaban atrás con la película andando*: una capa de
    letreros se rehace en otro hilo. Ahora son marcadores (HTML), que se
    mueven en el mismo cuadro.
  - *La pintura salía lavada*: la del paso 6 es metálica y refleja su cuarto;
    a cielo abierto el naranja de B quedaba rosado. En la maqueta va casi mate
    (`maqueta-carros.js` la busca por el nombre `pintura` del material).
  - *La cámara que sigue, en curva*: mirando al frente no salía nunca el otro
    carro, y detrás de la cola mirando al golpe se salía el propio. Va en la
    línea golpe–carro, y cerca del golpe vuelve detrás de la cola.
  - *Los bordes en escalera*: el mapa nace con `antialias`, salvo en pantallas
    de 3 píxeles por punto (los iPhone), donde no se nota y sí cuesta.
- **El estilo de OpenFreeMap nombra 30 iconos que su hoja no trae** («office»,
  «gate», «atm»…): MapLibre avisaba en la consola por cada uno y con cada
  tesela. `styleimagemissing` les pone un icono vacío de 1 px.
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
- **En el 3D de Google, Z es hacia arriba** (14-nov, con la clave de
  demostración): el carro del paso 6 tiene Y hacia arriba y salía parado
  sobre la cola. Con `tilt` 270 queda sobre sus ruedas (con 90, con el techo
  abajo y enterrado) y el `heading` es el rumbo tal cual
  (`GIRO_DEL_MODELO` = 0).
- **El 3D de Google no dibuja un .glb desde `blob:`** (14-nov): el mismo
  archivo por `data:` o por http sí. Va como `data:`, unos 800 KB de texto
  por carro.
- **La pintura metálica sale negra en el 3D de Google**: allá no hay entorno
  que reflejar, y la A verde no se distinguía de las llantas. `carro-glb.js`
  pasa copias mates de los materiales; el carro del paso 6 no se toca.
- **Con la cámara de la maqueta, en el 3D de Google los carros eran una
  mota**: a 397 m un carro de 4,4 m mide 6 px. `acercarALosCarros` se acerca
  hasta que quepan, nunca a menos de 80 m: más cerca, la foto de Google en el
  campo es una mancha.
- **El pin de Google con `label` escribe el texto dos veces** (encima y al
  lado): los marcadores son SVG propios dentro de un `<template>`.
- **Safari abre la hoja de compartir solo dentro del toque**, y no si antes
  hubo un `await` largo: el PDF se arma al entrar al paso 8 y el botón solo
  comparte. Es la misma regla del permiso de la brújula.
- **Una sección sin cerrar escondió el paso 8** (14-nov): al agregar
  `#p-enviar` se perdió el `</section>` del croquis, y la pantalla nueva
  quedó dentro de una oculta. Ningún error: la página medía 98 px y el
  pantallazo salía en blanco.
- **«5:44 p. m.» ya termina en punto**: armar frases con `+ '.'` daba
  «p. m..». `frase()` en `enviar.js`.

## Licencias de terceros

Datos de vías © colaboradores de OpenStreetMap (ODbL), con el crédito visible
en el mapa y en el análisis. Las teselas de tile.openstreetmap.org sirven para
el demo, no para una app con tráfico. Open-Meteo es gratis solo para uso no
comercial: para vender hace falta su plan comercial. El expediente cita las
dos fuentes («© colaboradores de OpenStreetMap (ODbL)» y «Open-Meteo.com
(CC BY 4.0)»). Leaflet: BSD-2 (`js/vendor/leaflet/LICENSE`). Three.js: MIT
(`js/vendor/three/LICENSE`). El modelo de placas fast-plate-ocr: MIT
(`js/vendor/placa/LICENSE-fast-plate-ocr`); ONNX Runtime Web: MIT (aviso en
la primera línea de `ort.wasm.min.mjs`). Las medidas del catálogo citan su
fuente en cada línea. El exportador glTF de Three.js (MIT) está copiado sin
cambios en `js/vendor/three/exporters`. El 3D fotorrealista es de Google Maps
Platform y va con sus términos: su logo y sus créditos quedan a la vista, su
contenido no se guarda ni se exporta, y no se pone junto a un mapa ajeno.
