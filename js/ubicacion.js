// La ubicación del celular, con su precisión.
//
// El primer dato suele venir de la red (Wi-Fi o antenas: ±100 m o más) y el
// GPS lo afina en 5 a 15 s. Por eso se escucha un rato y se queda la lectura
// MÁS precisa, avisando cada mejora para que la persona vea el círculo
// achicarse. Se para sola al llegar a `suficiente` metros o al `limiteMs`.
//
// El navegador solo entrega la ubicación en https (o en 127.0.0.1): por la IP
// del Wi-Fi (http://192.168…) falla siempre, y se dice.
export const SUFICIENTE = 10;

export const MENSAJES = {
  sinHttps: 'La ubicación solo funciona si la app se abre con https. Marca el punto tocando el mapa.',
  sinGeo: 'Este navegador no da la ubicación. Marca el punto tocando el mapa.',
  1: 'La app no tiene permiso para saber tu ubicación. En iPhone: Ajustes › Privacidad y seguridad › Localización › Sitios web de Safari. En Android: toca el candado junto a la dirección › Permisos › Ubicación. O marca el punto tocando el mapa.',
  2: 'El celular no pudo saber dónde está. Sal a cielo abierto o marca el punto tocando el mapa.',
  3: 'El GPS se demoró demasiado. Marca el punto tocando el mapa.',
};

export function buscarUbicacion({ alMejorar = () => {}, limiteMs = 15000, suficiente = SUFICIENTE, geo = globalThis.navigator?.geolocation, seguro = globalThis.isSecureContext } = {}) {
  return new Promise((resolver, rechazar) => {
    if (!seguro) return rechazar(new Error(MENSAJES.sinHttps));
    if (!geo) return rechazar(new Error(MENSAJES.sinGeo));
    let mejor = null;
    let terminado = false;
    let vigilancia = null;
    let reloj = null;
    const terminar = (error) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      if (vigilancia != null) geo.clearWatch(vigilancia);
      if (mejor) resolver(mejor);
      else rechazar(error);
    };
    vigilancia = geo.watchPosition(
      (posicion) => {
        const lectura = { lat: posicion.coords.latitude, lon: posicion.coords.longitude, precision: posicion.coords.accuracy, hora: new Date(posicion.timestamp || Date.now()) };
        if (!mejor || lectura.precision < mejor.precision) {
          mejor = lectura;
          alMejorar(mejor);
        }
        if (mejor.precision <= suficiente) terminar();
      },
      (error) => {
        // Sin permiso no hay nada que esperar. Con otro error y alguna
        // lectura ya en la mano, se queda con esa.
        if (error.code === 1) {
          mejor = null;
          return terminar(new Error(MENSAJES[1]));
        }
        terminar(new Error(MENSAJES[error.code] || MENSAJES[2]));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: limiteMs },
    );
    reloj = setTimeout(() => terminar(new Error(MENSAJES[3])), limiteMs);
  });
}
