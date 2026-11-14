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
  paraLaLuzDeGoogle(grupo);
  return new GLTFExporter().parseAsync(grupo, { binary: true });
}

// Google ilumina el modelo con su sol y sin un entorno que reflejar. La pintura del paso 6 es
// metálica (metalness 0,5) porque allá refleja el cuarto: sobre la foto de Google salía casi negra,
// y el verde de la A no se distinguía del negro de las llantas (medido el 14-nov-2026). Para el
// mapa, todo lo metálico se vuelve satinado y la pintura brillante, mate. Se cambian copias: el
// carro del paso 6 no se toca aunque compartiera materiales.
//
// De paso se normalizan las normales: el exportador lo hacía solo, pero escribía en la consola
// «Creating normalized normal attribute» una vez por pieza (más de diez por carro). Las que salen en
// cero (triángulos sin área de alguna pieza) no tienen dirección que normalizar: quedan hacia arriba.
function paraLaLuzDeGoogle(grupo) {
  const copias = new Map();
  const copiar = (m) => {
    if (!copias.has(m)) {
      const c = m.clone();
      if (c.metalness > 0.2) c.metalness = 0.1;
      if (!c.transparent && c.roughness < 0.45) c.roughness = 0.45;
      copias.set(m, c);
    }
    return copias.get(m);
  };
  const normalizadas = new Set();
  grupo.traverse((o) => {
    if (o.material) o.material = Array.isArray(o.material) ? o.material.map(copiar) : copiar(o.material);
    const g = o.geometry;
    const n = g?.attributes?.normal;
    if (n && !normalizadas.has(g)) {
      g.normalizeNormals();
      for (let i = 0; i < n.count; i++) if (Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) < 0.5) n.setXYZ(i, 0, 1, 0);
      normalizadas.add(g);
    }
  });
}
