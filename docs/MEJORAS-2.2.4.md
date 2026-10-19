# CarimarShow 2.2.4 — banner y póster en fichas

## Cambio preparado

- Las fichas de películas y series muestran el fondo panorámico de TMDB y, por separado, el póster vertical del título.
- El póster se superpone en la parte inferior del banner, con adaptación para móvil y escritorio.
- Si TMDB no entrega un fondo panorámico, se usa el póster difuminado como fondo; no se inventa otra imagen.
- Las imágenes remotas conservan una carga directa como alternativa mientras se intenta guardarlas en la caché local, para evitar el placeholder si falla la petición de caché.

## Validación pendiente

- La prueba de navegador comprueba ambas imágenes en fichas reales de películas y series y mide que el diseño no desborde el ancho.
- La comprobación visual en el dispositivo del cliente queda pendiente; no se afirma realizada hasta probarla allí.
