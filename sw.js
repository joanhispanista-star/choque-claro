// Que Choque Claro abra sin señal. En carretera, sin internet, es el caso normal de un choque: hasta
// el 25-nov-2026 la página no abría (no había service worker).
//
// Cómo funciona:
//  - La lista de abajo (LISTA) dice, archivo por archivo, el SHA-256 del contenido. La escribe
//    `npm run sellar` y una prueba falla si quedó vieja: publicar es un `git push` a secas, sin un
//    paso que la arme, y una lista vieja dejaría a la gente con la app de ayer para siempre.
//  - «nucleo»: lo que hace falta para los 8 pasos. Se baja entero al instalar. O quedan todos, o no
//    se instala (y sigue sirviendo la versión anterior, completa).
//  - «despues»: lo pesado (el lector de placas, 18 MB; la zona en 3D; las fotos del ejemplo). Se
//    guarda la primera vez que se usa, y desde ahí también abre sin señal.
//  - Cada archivo se guarda con su SHA en la llave: dos versiones conviven sin mezclarse, y al
//    actualizar solo baja lo que cambió.
//  - Ningún archivo se guarda sin comprobar su SHA. GitHub Pages reparte lo nuevo en unos minutos y,
//    mientras tanto, puede mandar un módulo nuevo con uno viejo: juntos darían una página rota que
//    quedaría guardada. Si no cuadra, no se instala y el navegador vuelve a intentar más tarde.
//
// Lo que NO toca: los reportes y las fotos (IndexedDB), nada de otro dominio (el mapa, el clima,
// Google), el video (Safari lo pide por pedazos) ni las demás páginas de este mismo dominio, que son
// otros proyectos (joanhispanista-star.github.io/…): el almacén de cachés es de todos, así que aquí
// solo se borra lo que empieza por PREFIJO.
//
// Es un script clásico y no un módulo: los service worker de tipo módulo todavía no están en todos
// los navegadores.

const PREFIJO = 'choque-claro-';
const CACHE = PREFIJO + 'archivos';

/* LISTA: la escribe `npm run sellar` (herramientas/sellar-sw.mjs). No se edita a mano. */
const LISTA = {"version":"6a67d7b60967","nucleo":{"css/app.css":"16a997d0446c35261b52cffdd40e55cfed4bc61f7d3af8de485abaac185e7798","datos/ejemplo-teusaquillo.json":"cf8f6db4b9ff7df23ee0599696679038ac5a36e0537fd349cf45973554d051bf","img/icono-180.png":"96b1399ac59eb18e9ea835a77e0ef37be37e042210e60e889b685c4ecf8e54d1","img/icono-192.png":"4795c4abb1ebc9e2f9a91907ca8b828033bafff3043aaa8d51da801901bb3fac","img/icono-512-recortable.png":"0c784323f60ed68e68e1d6d27f1d06df4dc816f608dafefdd6340aea6c672ceb","img/icono-512.png":"80ee9ca15c32d0149e5587f843ec107cded72e33aa19321726866971f91a9afb","img/icono.svg":"aed4b912545641758db23412423acd606dc0e942cada3f3dcb38a04d97a142b8","index.html":"21a44e0ae9ab20299c1526d797fd6d54c855302ff205dca40b5e8ec3569c1697","js/antes.js":"abb3fe707b90d1af22fe3c73678d3ed27a5efb1f4e94594b783b6006aef46e8d","js/app.js":"c878960acf45fa778a183789682121bd9b0785ba7eb85709b6fbc004f5a1bc5a","js/brujula.js":"c694344db38a6e80f966ef242fd2f84a9bf9f240e230535d95e8affc02c75f02","js/calidad.js":"14ef5213bc1d62af098fe5aadc617ffb86dd6971dc6773d8c2e444a34f61898f","js/camara.js":"8f135f8ec5a0411b58944316781744b426d784a7ea876e9fa5ad9567432882bb","js/carro.js":"ce632ee174f807a295298bf139f3b081fb769d2db73dbf9eb219f79e9a0afd34","js/carrocerias.js":"5248fdba82e2c5e12bf25d16461bbf373b31558f977e0918dfd8426b24562ecf","js/carros.js":"0985de92b2a2df4cb398eaee69e110004195138e5d1912ab49616ce585e1dd86","js/catalogo-carros.js":"456973da15aa1d4c764fb9ec6de46b2163dfd6b911d5e7763c29e0c0503c1447","js/catalogo.js":"28b8ec1d666d24983abf017876f6873d3b49a051d9c3713b07bf38d820e510e1","js/clima.js":"4b722e570c27dee35ca2e21ca0e61a0af833f5a6f1b92d20fc407ad381590b59","js/conexion-bd.js":"7aa20ecab83630f163d50e678a0b35e982cf91ec5470f2409f3942f49460386f","js/croquis.js":"fb6615a70011b6805dc0ceceee719a5bf5573c53d182e73e033c1635b3199219","js/danos.js":"402b8bdb39012ff0d5ad313f32874f97c9f80ec091b51c7b1121d61e80e35bab","js/ejemplo.js":"3730cf4788d569d8eaabb72bfe4f993506d3070ae0aa2a3d1ccde466d0ef9c28","js/encuadre.js":"842abe0fb5119db8d4a24bcca08d8c0e1de8c1514f32030bca6de0ef3b2b1236","js/enlaces-google.js":"84805b1b2d8659b67073e7deafc9d9dc521b5626b49b25557b394cc591a1445a","js/enviar.js":"6ae9198a37eb9beff25217f7e6123039b5319121e15718e49a7a3b131732b1d3","js/escena.js":"88c673a87aac091e5113e4008d2c71fafa2d487a8ea0a85244c63c538305204d","js/evidencia.js":"e451408ec9e664dee9833deddd9590e6c35a360d4e532b117179b91ff30e299d","js/expediente-pdf.js":"6943ef57d019ca71521f827297716eac5a4e153628493db74c1953e72b74ef87","js/expediente.js":"f19c3b932af260e311db46190f0f7d2bf686c46ea0b0d3c07dec4cd5f33d3f25","js/fechas.js":"a9a8cd4ba3ca295c9657eb1878a91a45f6ce80242a2c1d9347801edf28f817c3","js/fotos.js":"b6dde01810331816acbd1fd28526f4a85b8fc4278564a077fc7618f3ca9dab68","js/geo.js":"75f439e5d9316dd0720d187d70eebb6c136eaf9fcde2f61d75e5daf0749a96b8","js/instalacion.js":"ad1a9c8a9b78c237a8df76b544a195fc0efd4196f2158c9e6c6082f9708015ed","js/lector-de-placa.js":"0af5adb2730cef7526b16a57a26ba5331df618e10fc1932d9122999f974db200","js/mapa.js":"6a472f183ea2774b07d6ccf6fe80c68887600dd3fd647d32f999a00807760c82","js/orientacion.js":"01ccfd12efe4254ccb6ac663721e30bc6335b19b9871b90e620a8e5134491a8e","js/pantalla-agregar.js":"12eb46022358537ee102117c4c36c397557a94411eda8b8eca8a11c62adc2fa5","js/pantalla-antes.js":"ed54cab46996dc48d4949256bedee36deaac018aa93b3fbe5931842039dda044","js/pantalla-carros.js":"4f7e2ef8b0c9dafd526e14c299ca7f530208e0bc336bfb6d331860c26bcdd7b3","js/pantalla-croquis.js":"00c1d1f79527a87f226e5b32b6717e5ee9daba292904572dd4acc4c80de1a28e","js/pantalla-danos.js":"13a905dd173f625c97a75d71fc0938b165293d758063c81b8be2dd5531671744","js/pantalla-donde.js":"de9688cc01a61a0e6ae1e9b5115a78fabd191dcb67c5b5eab27614fe579ed996","js/pantalla-enviar.js":"6739fe69fb6bcf4ef7d18c137161ef1a1054a421e342a22af3fd5e8f4fe65c3b","js/pantalla-escena.js":"3bcc491013d2d0772f37f2617ae4d2033de0f4c419aa16e172d4835d5e4df9d6","js/pantalla-inicio.js":"039b62a8320288abecaf07d8d55c47e38459bd5c74516c4c4dc915f5c45fd2d1","js/pantalla-pruebas.js":"a2df6f6825b5c66b6a7b295fcee12ba06cab29ad4468d37bc0d87ea945cc6c10","js/pantalla-reportes.js":"ab382d899d011906bfb13e1deae3ffcfd83929c9a83dcd474992a748ef6c078a","js/pdf.js":"3a7652cc91dda93a7e2af296906a8e18514bf9b7b73febcf2cd9ee16ec224983","js/piezas.js":"26fd4391a6c4ab05a8e32d714919309b2d726a6b8c2fde72295ab80e4ec86317","js/placa-foto.js":"f2fde9c4b87899c22351eb9b661f5f3c15ef6197a9411f0204abff044488b67c","js/placa-ocr.js":"f5bfb0a2276e5ce4eb02d0ecd0140018603022a9b9c6da842ed231a0d61f6119","js/pruebas.js":"21f763041c636d350a98202337a57201cd37cc65051f82893b75defa0159745c","js/reporte-bd.js":"edf32df01f59dbb15be9582a336c7fd38a3974f6c2f951ed568901c7c894065a","js/reporte-en-curso.js":"134ade9829813383e7e2f6a3b385ac14e2f2c460ca778aa13ce234bc69b8700f","js/reportes.js":"37a6f36382a1b6cc57361074fde6d138019dc8984d61dec456d50a50d6be488d","js/sello.js":"ee471f98bba44dcb2a8dc324f64685cb90368c7ece4a520a15ceb69ee6a2a9ac","js/servicios.js":"c4391672452c931df92539f5f5c45e51bb580dd9a0e22e85f63dda24ee9faaa7","js/sesion-de-camara.js":"b6679d98ed987024958c6017c061e587c733ccef51abfed704f9aae8dde9f260","js/silueta.js":"d911f0411e644a5b14b7ff1c835af3264cbb0187fd1b1e2598bc6cadce452629","js/siluetas-3d.js":"026ad41ccc18788ca28caaec2ba2f1381f64b5a05a2749ae6ba293f4af526c21","js/sin-senal.js":"333604b149b841be6296c05655c17fdb495aacf27388f6f7db007e1a844a3cae","js/sol.js":"56735b4c19cf8fc946456c2ea72fe7a5c5b479d287f110d6ed9ac05a35efbb08","js/toque.js":"0e84d1088cab30957f756dee1ccf4b7bd2df25df5ab12999a712d1bde33697ee","js/ubicacion.js":"717c2ecc8c33a4df68216c18ab6dbb2eddab2f2aba5166b8bc0da8f89b408c96","js/vendor/leaflet/leaflet.css":"337bfca5cabd03b39815b2700febe2b3b7edf55921c59cd49f88ecb328212303","js/vendor/leaflet/leaflet.js":"db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a","js/vendor/three/OrbitControls.js":"80efaadea4f8a636a65fb0bd08bfef62f3d93a0bb94e2e7500f23176c5c07f4e","js/vendor/three/RoomEnvironment.js":"85869bdd22f7cf0b22e68dcefe6cb710480af0f5c901a76f7a7764fd07fc8014","js/vendor/three/three.module.min.js":"f7cee3c7533449a1505cc12cb5128b89e3d4fd3d7ea62b05f9f5464a217472ee","js/via.js":"88cfe9915e35ed5d29f1f81a3dec32b80d9758930d94f3bb83de2f3ae6d44593","js/visor-danos.js":"87d547c5bf38c33a8377f1815cddd95fd9a03e65d942356ed64b03f0b912e9c1","js/voz.js":"0c9734e3633a91a9cbcd69a7517f964151711457e84be7d7ae117482087125f0","js/vuelta-en-pantalla.js":"8d531b756366787b19ad86c69fc3e831e8e0ce82af226ae1b367bfdf6903ad68","js/zona-3d.js":"e53d97bf8209fd5c4427c87ba697fc1322cec9f89b9fac22ac3db4bbdec5d8ab","manifest.webmanifest":"be6189ee2d10ddd28e39ef6c7b02c5d54900d52b8076c999af1f5956a259680f"},"despues":{"css/zona-3d.css":"5ad0f0b544f2e279c7bd8482acb207f00db65d9d7ad2c41fc92f1db87e8746f2","datos/ejemplo-fotos/choque-1.jpg":"3cd38b8bf7de31407fdbc0f021104dd10ad727d76fce25e5194b811d9119b248","datos/ejemplo-fotos/choque-2.jpg":"a8d41c0b46aadbea6a5a67220e27f3d99e0643d547078555ff1a59df47acdf4c","datos/ejemplo-fotos/choque-3.jpg":"e2d4689d3e06b39f0ec4b7c320046e3a993f87aeb0c0b2676cc35203c8df990f","datos/ejemplo-fotos/choque-4.jpg":"5855b75f77c4fe98d6255861a6e86c05f0713fa3b00e5ca4f9f56ead29fcbe4a","datos/ejemplo-fotos/choque-5.jpg":"b6c7b5a0d5c3a5a3d046dd4bb71560adbca6a9d0bd628df69a6bccb300c4c2ae","datos/ejemplo-teusaquillo-ciudad.json":"c683815d5558520063a57b520c7555bb766bee00ede4b9757582f7b09ee24abc","img/realista/apto.webp":"4103fff1cfeca50a9900dfeb28e1fd7a1878629cac7fad707e2b75856d47c507","img/realista/arboles.webp":"e3b771c1b2fc8af32205929ca83171e1025356f3da7f2606c964b002e06b77bb","img/realista/cielo.webp":"d073cacbd9e30dd15284a8dc53da7ca8a4a084500a052e3713b26f39c79fb31f","img/realista/culata.webp":"55f2b00b23773ce8934286f10c740eed768d10d801d124b009addc15ec7666f6","img/realista/ejemplo/suelo-100-m.webp":"c8d87f0bcb71b89ce51fdb4ae82eedb08e3547b41e93d6149cb2348867931c4e","img/realista/ejemplo/suelo-100.webp":"4660b940940fa28b741dda85a551b2d97bac7aed98cf5f695f5bef7ef5abd01d","img/realista/ejemplo/suelo-2000.webp":"edac80ea8db7b784455357358ea419e7b26d2587fb05bebca3b08c6eb2cdb585","img/realista/ejemplo/suelo-400-m.webp":"9d1d13239378d137b8ae99e39a2fe3f38b48efc6357736c232d9fee0a02a5bcb","img/realista/ejemplo/suelo-400.webp":"cc36b81e03f7c8370baf02b6e1ac2102e64e981569a31ce40492141ed6e925bd","img/realista/estuco.webp":"483e427aed384145cc08db03d41911a6f54a2296d5ef1b865b2a7cf1a5b8fc06","img/realista/ladrillo.webp":"db8d1f891b627b99b8cb5c2142f9dd6499e4f890f54e4ab5229473e950825de0","img/realista/tejas.webp":"37b1fb0a80765d3d245345840649b57f76ee071924c91664ce413d2d46aca06d","js/carro-glb.js":"f3d17f371aa09d2de5fd7210fea8a6b9553ebb0dd31ac65bef8c0809ea2bd276","js/ciudad.js":"dc4ee0a6728280dcd0cbd1a10f4a3211808e1ecf914824eb4e7c1de82eb916e8","js/clave-de-google.js":"2bf62e7ed0524a2357132b48632bedc3c5a2c3b3d06ecab8c63e296eb17941a8","js/diferencia-de-color.js":"779cd1f7551acf58cfede9824b98ab53ccede85066623a8ba92be01eb70bb933","js/escena-360.js":"4101e5e52e0b76c897a4b927b912adcb59f208bfd881147d60f4afc601c8dcdc","js/foto-aerea.js":"0f27fc5f37814773c60e6e648f78d21f9df5a2ac56ca0598bac01f3a909aef62","js/generico/adentro.js":"10e4d07ec0352e7e58c1b4f68e84a9f7fd134e8fc0ef33b49ab46270ef28c452","js/generico/carro-nuevo.js":"e6958adb4f852c1a262f1d4f432d3813824794b451f4ae35a8f5872d1f81ee5d","js/generico/detalle.js":"f5f702189a99af4d43f83d24bb92c616fa72442240c500078c66257759eea411","js/generico/jaula.js":"fa543cc9b9011702f64a795c654270509ac511fc308e309f3df05a86e16661c4","js/generico/luces.js":"30266c7046e2966ae1e5a97ba0f4241a8ddb4986b4548200cccf486b2d781dbd","js/generico/pintura.js":"c128521e93324291ab5ffdb35b2ef4f1f440a963534614bfcd0eda14c1c66c15","js/generico/rueda.js":"c911074173ec9eaed20660f2812f72735dbf6b90a4fa755551233bc5cbe45935","js/generico/subdivision.js":"bd7145b0de231b80d65ee666f7195cc19adf93f75c7517b05a5acc9b301c0c29","js/maqueta-carros.js":"6442286d7666a1e7a56c3b2775926318154dbef044d31697ac3034bb824884c5","js/maqueta-ciudad.js":"4d78cdb93bf59636d57bffa352661638e1caacf950f8a7569f328654b0f2c4c4","js/muestra-de-la-vuelta.js":"8c550c851548ed271c9809acf6344cbcfc35856502984445f18dec3d52117702","js/pantalla-escena-360.js":"7ad6ba56edced39461870e2cd52858b27806f4aa3ab1cebb5f531b191fee9d46","js/pantalla-recreacion.js":"44e9f8659883d802a6d860cce911bed87f842adc12fe0b3d3bfea6d0b45a258c","js/pantalla-vista-realista.js":"26bf5bc6b2974b13c1d4c1285cc558dc0ca631681c41e4fe3c73f6094cbab778","js/pantalla-zona-3d.js":"c1e25b3231e2e46d3e3a87930c44b574786ffb7ec5377b1d3b639934755a9fe8","js/pantalla-zona-google.js":"3e66a5038e8bdc042f3655ed1b5e35dc5ea43ec7a6684c218dac263109afbe29","js/permisos.js":"434ebae57cdae6f458fb8ab3542f7285f14c9138c8ec61da4f9f27a3f0a8261a","js/piso-realista.js":"b57a00cfd03138e4a365a7a1529ddcae7a2089551bc8fd2517a40eb94ef22503","js/recreacion.js":"8b8de065046be7246dade789cee424249ed86f731c4cd14eb994307e9bbd9c99","js/vendor/leaflet/images/layers-2x.png":"066daca850d8ffbef007af00b06eac0015728dee279c51f3cb6c716df7c42edf","js/vendor/leaflet/images/layers.png":"1dbbe9d028e292f36fcba8f8b3a28d5e8932754fc2215b9ac69e4cdecf5107c6","js/vendor/leaflet/images/marker-icon-2x.png":"00179c4c1ee830d3a108412ae0d294f55776cfeb085c60129a39aa6fc4ae2528","js/vendor/leaflet/images/marker-icon.png":"574c3a5cca85f4114085b6841596d62f00d7c892c7b03f28cbfa301deb1dc437","js/vendor/leaflet/images/marker-shadow.png":"264f5c640339f042dd729062cfc04c17f8ea0f29882b538e3848ed8f10edb4da","js/vendor/maplibre/maplibre-gl.css":"576b085fdd9487a65a19215328c1e086c07ce5bf6da09b666b3806d3d008dae9","js/vendor/maplibre/maplibre-gl.js":"be9633c4d870e26fb37f1cfe5c5a77181667114003ea16207ac7850d8da8add1","js/vendor/placa/cct_xs_v2_global.onnx":"8031afb5fdc6b4d80462c9d542f1284ebd2cfddf5dbacd62609848d7e2855f44","js/vendor/placa/ort-wasm-simd-threaded.mjs":"c57ca56328877353a575e51bbca6f18450027d6c9bf2307a2cb2c41363b4de9f","js/vendor/placa/ort-wasm-simd-threaded.wasm":"06ba057753da3847e4c24f02d91ab133455b0817c69a44993a9a53a2146df9e3","js/vendor/placa/ort.wasm.min.mjs":"1617c813ada08592706d29a9963ab6258864dce4299bd402d2196bd648b63bfe","js/vendor/three/exporters/GLTFExporter.js":"43044a7af5c1f8c30c6960126d5abe2f8f580d3372abf3cdcf6811249d477e79","js/vendor/three/utils/TextureUtils.js":"d9a427b2255891ac9f2bfa9c10e1eb2305abe79aaafb831583fc4a410307151c","js/vista-realista.js":"62f530651a379c2d55663cf115ea491bf8bfcf80fd6cca8fb8339b9a8ba2b482","js/zona-google.js":"0bb194cb86472d3a38482b6c31827794c09a5b89c75e769c62894d281c3628c6","zona-3d.html":"2230fccb23a296ee25329b2a9f729240e899496253fe24d7d5a90c269ed4a450"}};
/* FIN DE LA LISTA */

const ALCANCE = new URL(self.registration.scope);
const TODOS = { ...LISTA.despues, ...LISTA.nucleo };
// Cuántos se bajan a la vez al instalar. Pocos: quien acaba de chocar está usando esa misma señal
// para el mapa y el clima.
const A_LA_VEZ = 3;

const llave = (ruta) => new URL(ruta + '?sha=' + TODOS[ruta], ALCANCE).href;

async function sha256(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Lo que se guarda es una respuesta nueva con los mismos bytes: sin la marca de redirección (Safari
// no acepta de un service worker una respuesta que pasó por una) y sin las cabeceras de caché.
function comoRespuesta(bytes, tipo) {
  return new Response(bytes, { status: 200, headers: { 'Content-Type': tipo || 'application/octet-stream', 'Content-Length': String(bytes.byteLength) } });
}

// Baja un archivo y comprueba que sea el de la lista. Primero como el navegador lo tenga (lo que la
// página acaba de cargar no se vuelve a bajar); si no cuadra, otra vez saltándose la caché.
async function bajar(ruta) {
  const url = new URL(ruta, ALCANCE).href;
  for (const cache of ['default', 'reload']) {
    const respuesta = await fetch(url, { cache, credentials: 'same-origin', priority: 'low' });
    if (!respuesta.ok) continue;
    const bytes = await respuesta.arrayBuffer();
    if ((await sha256(bytes)) === TODOS[ruta]) return comoRespuesta(bytes, respuesta.headers.get('Content-Type'));
  }
  throw new Error('No cuadra con la lista: ' + ruta);
}

async function instalar() {
  const cache = await caches.open(CACHE);
  const faltan = [];
  for (const ruta of Object.keys(LISTA.nucleo)) if (!(await cache.match(llave(ruta)))) faltan.push(ruta);
  const trabajar = async () => {
    for (let ruta = faltan.shift(); ruta !== undefined; ruta = faltan.shift()) await cache.put(llave(ruta), await bajar(ruta));
  };
  await Promise.all(Array.from({ length: A_LA_VEZ }, trabajar));
}

// Al empezar a mandar esta versión: fuera lo que ya no es de ella.
async function limpiar() {
  for (const nombre of await caches.keys()) if (nombre.startsWith(PREFIJO) && nombre !== CACHE) await caches.delete(nombre);
  const cache = await caches.open(CACHE);
  const vivas = new Set(Object.keys(TODOS).map(llave));
  for (const peticion of await cache.keys()) if (!vivas.has(peticion.url)) await cache.delete(peticion);
}

// «./» y «./index.html» son la misma página; lo que va después del «?» no cambia el archivo.
function rutaDe(url) {
  if (url.origin !== ALCANCE.origin || !url.pathname.startsWith(ALCANCE.pathname)) return null;
  return decodeURIComponent(url.pathname.slice(ALCANCE.pathname.length)) || 'index.html';
}

// Una página de la app que no está guardada, sin internet (la zona en 3D). Abierta desde la pantalla
// de inicio no hay barra del navegador: sin este enlace, la persona quedaría atrapada ahí.
function sinInternet() {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sin internet</title>
<style>body{margin:0;padding:32px 20px;font:17px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f3f4f6;color:#14181d}main{max-width:520px;margin:0 auto}h1{font-size:26px;line-height:1.2}a{display:flex;align-items:center;justify-content:center;min-height:54px;border-radius:12px;background:#0f6e56;color:#fff;font-weight:600;text-decoration:none}</style></head>
<body><main><h1>Esta parte necesita internet</h1><p>Lo que llevas del reporte está guardado en el teléfono. Vuelve a él y abre esto cuando tengas señal.</p><a href="${ALCANCE.pathname}">Volver a Choque Claro</a></main></body></html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function guardarSiCuadra(ruta, respuesta) {
  try {
    const bytes = await respuesta.arrayBuffer();
    if ((await sha256(bytes)) !== TODOS[ruta]) return;
    const cache = await caches.open(CACHE);
    await cache.put(llave(ruta), comoRespuesta(bytes, respuesta.headers.get('Content-Type')));
  } catch {
    // Sin espacio en el teléfono: la página ya recibió su archivo; solo no queda guardado.
  }
}

async function servir(evento, ruta) {
  const guardada = await caches.open(CACHE).then((cache) => cache.match(llave(ruta))).catch(() => null);
  if (guardada) return guardada;
  let respuesta;
  try {
    respuesta = await fetch(evento.request);
  } catch (error) {
    if (evento.request.mode === 'navigate') return sinInternet();
    throw error;
  }
  if (respuesta.ok && respuesta.status === 200) evento.waitUntil(guardarSiCuadra(ruta, respuesta.clone()));
  return respuesta;
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(instalar());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(limpiar());
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const ruta = rutaDe(new URL(request.url));
  if (ruta === null || !Object.hasOwn(TODOS, ruta)) return;
  evento.respondWith(servir(evento, ruta));
});

// La versión nueva espera a que la persona la pida (js/sin-senal.js, «Actualizar»): cambiarla sola
// a mitad de un reporte mezclaría los módulos viejos que ya están en la memoria con los nuevos.
self.addEventListener('message', (evento) => {
  if (evento.data === 'actualizar') self.skipWaiting();
  if (evento.data === 'version') evento.ports[0]?.postMessage(LISTA.version);
});
