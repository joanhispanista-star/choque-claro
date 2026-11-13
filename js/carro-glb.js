// El carro 3D del paso 6 (carro.js) como archivo .glb, el único formato que acepta el modelo 3D del
// mapa de Google (Model3DElement: «At this time, only models in the .glb format are supported»). Se
// arma en el teléfono al abrir la zona: con la carrocería y las medidas de la línea si la persona la
// eligió en el paso 5, y si no con el largo y el ancho del croquis (carrocerias.js acepta metros o
// milímetros), pintado con el color de su letra para que nadie lo tome por un carro de la foto.
//
// Corre en el navegador (el exportador de Three.js usa Blob y FileReader). El exportador está
// copiado sin cambios en js/vendor/three/exporters, con su ayudante de utils: ver el LEEME de allí.
import { construirCarro } from './carro.js';
import { GLTFExporter } from './vendor/three/exporters/GLTFExporter.js';

export async function glbDelCarro({ color, carroceria = 'sedan', medidas = {} }) {
  const { grupo } = construirCarro({ colorBase: color, carroceria, medidas });
  return new GLTFExporter().parseAsync(grupo, { binary: true });
}
