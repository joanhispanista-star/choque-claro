# Las fotos de muestra del ejemplo

Cinco fotos reales de **otro** choque, no del ejemplo. Salen en la zona en 3D
(`zona-3d.html`, «La escena en 360°») cuando se abre el ejemplo, para mostrar
cómo se ve una vuelta alrededor de dos carros chocados. La página las rotula
como muestra en cuatro lugares: el párrafo de arriba, el sello sobre el visor,
el texto de cada foto y la lista de créditos (`js/muestra-de-la-vuelta.js`).

## De dónde son

- Choque en Belgrano, Buenos Aires (Argentina), el 28 de octubre de 2006: un
  Daewoo Lanos rojo y un Renault 19 oscuro.
- Fotos de **Ernesto (etagwerker)** en Flickr:
  <https://www.flickr.com/photos/93433156@N00/>
- Licencia **CC BY-SA 2.0**: <https://creativecommons.org/licenses/by-sa/2.0/deed.es>

| Archivo | Título original | Página de la original |
| --- | --- | --- |
| `choque-1.jpg` | choque #1 | <https://www.flickr.com/photos/93433156@N00/282653457/> |
| `choque-2.jpg` | choque #2 | <https://www.flickr.com/photos/93433156@N00/282653467/> |
| `choque-3.jpg` | choque #3 | <https://www.flickr.com/photos/93433156@N00/282653474/> |
| `choque-4.jpg` | choque #4 | <https://www.flickr.com/photos/93433156@N00/282653489/> |
| `choque-5.jpg` | choque #5 | <https://www.flickr.com/photos/93433156@N00/282653497/> |

## Qué se les cambió (17-nov-2026)

Se bajaron en 1024 × 768 (la copia mediana de Flickr), y se les quitaron los
datos EXIF. Esas copias no traían autor ni aviso de copyright en sus datos
(revisado el 17-nov-2026: solo un enlace de rastreo de Flickr); el aviso de la
licencia está en la página de cada original, que se enlaza arriba y en la app.

Además se difuminaron, pixelando y desenfocando cada zona:

- las placas de los dos carros y de los carros parqueados;
- las caras de los peatones, de dos señores y de un policía;
- los avisos y toldos de Marlboro: la Ley 1335 de 2009 prohíbe la publicidad
  de cigarrillo en Colombia;
- los avisos con teléfonos de locales, y en la foto 4 dos textos chicos de
  avisos (un correo y un número a medias).

Estas versiones modificadas también tienen licencia **CC BY-SA 2.0**, como
exige la original. Cualquiera puede usarlas con el mismo crédito y la misma
licencia.

## Por qué el crédito no se puede quitar

La licencia 2.0 no da plazo para corregir un crédito que falte: si falta, el
permiso de usar las fotos se termina. Por eso el crédito sale del código
(`creditosDeLaMuestra`), y `pruebas/muestra-de-la-vuelta.test.js` exige que
cada foto tenga título, autor, enlace a la original, licencia con su enlace y
la nota de que se modificó. **Si se cambia una foto, se cambia aquí también.**
