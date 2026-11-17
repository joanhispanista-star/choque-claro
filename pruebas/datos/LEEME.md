# Datos de prueba

Respuestas reales de Overpass guardadas con `npm run ejemplos-via`
(`herramientas/guardar-ejemplo-via.mjs`), para que las pruebas no dependan de
internet ni de un servidor público que se llena.

Los datos son © colaboradores de OpenStreetMap, con licencia ODbL
(<https://www.openstreetmap.org/copyright>). Si se vuelven a bajar, las cifras
de las pruebas pueden cambiar porque el mapa cambia: hay que revisarlas a mano
y no ajustarlas a ciegas.

- `curva-verjones-patios.json`: la curva más cerrada de la medición del
  12-nov-2026 en los cerros orientales de Bogotá (radio 13 m).
- `semaforo-chapinero.json`: un cruce con semáforo en Chapinero, que se busca
  en el mapa y no se adivina.
- `ejemplo-verjones-patios.json`: la respuesta que usó el botón «Ver un
  ejemplo» del 13 al 17-nov-2026, cuando el ejemplo era esa misma curva (se
  guardó el 12-nov y no se vuelve a bajar). Desde el 17-nov el ejemplo es una
  esquina de Teusaquillo (`datos/ejemplo-teusaquillo.json`); la curva se queda
  aquí porque las pruebas del caso «de frente» y de la recreación la usan.
