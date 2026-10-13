# Verificación de CarimarShow

Fecha de trabajo: 13 de octubre de 2026. Pruebas con Chromium/Playwright sobre la web pública HTTPS y el servidor local.

| Prueba | Resultado observado |
|---|---|
| Catálogo online TMDB | Proxy HTTP 200, 20 resultados en tendencias; 15 tarjetas en inicio |
| Mi lista | Guardar un título, navegar, recuperar el mismo título |
| Ficha | Sinopsis y reparto; 3 personas en la primera ficha de la prueba |
| Filmografía desde reparto | 64 títulos para la persona consultada |
| Buscar personas: Tom Hanks | Un perfil correcto; corregida normalización del tipo person |
| Ajustes | Contadores coinciden con la lista; contacto y borrado de caché visibles |
| Recarga web totalmente offline | Inicio con 15 tarjetas y aviso de información guardada |
| Lista offline | El título guardado continúa disponible |
| Primer arranque local offline, sin caché previa | 15 tarjetas, imagen destacada incluida y ficha con reparto |
| Vista móvil 390 px | No hay desbordamiento horizontal |
| Errores JavaScript | Ninguno durante el recorrido |
| Compilación Android | Release 1.0.1: APK/AAB firmados, firma verificada con apksigner y assets incluidos comprobados |
| Compilación Windows | EXE/instalador compilados con Actions, runtime offline con firma Microsoft verificada |

La prueba de primer arranque nativo **simula en Chromium los archivos empaquetados bajo el origen WebViewAssetLoader** y bloquea la red. No sustituye una prueba en Android físico. La compilación Windows no sustituye una instalación limpia real. Quedan pendientes: instalación/desinstalación, botones Atrás en Android, apertura de enlaces externos desde ambos contenedores y modo avión en dispositivos reales.

Para repetir las pruebas: instalar Playwright y Chromium como herramientas de desarrollo y ejecutar `node tests/browser.cjs`. Variable opcional `BASE=http://localhost:8080` para el servidor local; `TEST_OUTPUT` para elegir dónde guardar capturas. No se requieren tokens para el navegador; se consulta el proxy público.

## Verificación final de entrega

- Release `v1.0.1`: ambos jobs de Android y Windows completados con éxito.
- APK inspeccionado: 50 títulos, 65 imágenes, versión 1.0.1, sin tokens en assets y SHA256 coincidente con el publicado.
- Proxy CORS: Android y Windows HTTP 200 con origen permitido; origen no permitido HTTP 403. Respuestas `private, no-store` para evitar reutilización incorrecta por CDN.
- Simulación online bajo ambos orígenes nativos: tendencias HTTP 200, sin fallback; búsqueda de Tom Hanks correcta.
- Windows full installer: 256,6 MiB por incluir runtimes; APK: 4,48 MiB.
