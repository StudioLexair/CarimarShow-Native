# CarimarShow Native · 2.2.0

Interfaz cinematográfica basada en las ocho pantallas de referencia del cliente. **Funciones reales, no un mockup interactivo.** Datos y pósteres de TMDB; sin registro obligatorio ni reproducción de películas.

## Dos páginas, un mismo proyecto

- **Principal:** https://carimarshow-native.vercel.app/ — presentación, descargas y contacto.
- **Aplicación:** https://carimarshow-native.vercel.app/app/ — catálogo completo y perfil local.

La app instalable inicia en `/app/`, nunca en la presentación. Ambos sitios se despliegan juntos en Vercel. Los instaladores Android/Windows incluyen todos los archivos locales y abren `/app/index.html#home`.

## Pantallas y funciones

1. **Arranque:** arte cinematográfico decorativo, monograma CS y progreso por fases reales de carga (catálogo, almacenamiento, consultas).
2. **Inicio:** destacados reales de John Wick, Dune: Parte dos y Deadpool & Wolverine; carrusel por indicadores, tendencias y estrenos actuales de TMDB, filas horizontales y lista personal.
3. **Explorar:** búsqueda de películas/series/personas, filtro por tipo, búsquedas recientes eliminables, accesos a categorías y tendencias del día.
4. **Ficha:** información y votos reales, guardar, compartir, descarga de ficha, pestañas de descripción/reparto/tráileres/similares y actores enlazados.
5. **Categorías:** géneros reales de TMDB y resultados de discover paginados; tarjetas con imágenes del catálogo.
6. **Actor:** biografía, fecha/lugar de nacimiento, seguir, filmografía con créditos reales y reparto navegable.
7. **Mi Lista:** películas/series separadas, deduplicación, orden manual/alfabético/por año persistente; pedido agrupado con dos botones WhatsApp propios en orden +53 5332 4928 y +53 7866 0658, copiar/compartir sin borrar la selección.
9. **Configuración:** estadísticas reales de lista/almacenamiento, limpieza por tipo, contactos originales de CarimarShow/Studio Lexair y créditos TMDB.
8. **Perfil:** nombre y foto editables, estadísticas calculadas, personas seguidas, historial, descargas, ajustes, ayuda y restablecimiento de datos.

**«Ver tráiler» abre YouTube** cuando existe un vídeo válido de TMDB. Si no hay vídeo, la ficha lo informa. Sin cuentas no existe «Cerrar sesión»: se muestra «Restablecer mis datos». «Actores seguidos» no son seguidores sociales inventados. La hora, batería y cobertura las proporciona el dispositivo; no están dibujadas en el HTML.

## Plataformas

- **Android 7+:** Kotlin + WebViewAssetLoader, APK firmado y AAB; firma estable propia. Package ID `com.studiolexair.carimarshow`.
- **Windows 10/11 x64:** .NET 8 WPF + WebView2. Instalador incluye .NET autocontenido y el instalador standalone offline WebView2, cuya firma Microsoft se verifica en CI. Requiere administrador. Sin certificado comercial Windows; SmartScreen puede advertir.
- **iPhone/macOS/Linux:** PWA en navegador compatible; Safari → Compartir → Añadir a pantalla de inicio en iPhone. No hay instaladores nativos de esas tres plataformas en esta entrega.

## Offline real y límites

El paquete incluye **50 títulos con fichas, 10 personas con filmografía y 76 imágenes**, además del arte decorativo del arranque. No es todo TMDB y no contiene películas ni capítulos.

- La interfaz y el contenido incluido abren desde el primer arranque Android/Windows, sin descargar una web remota.
- Consultas **network-first**, con respaldo en IndexedDB y snapshot.
- Caché automática: 30 días; máximo 250 consultas / 12 MiB y 100 imágenes / 30 MiB; LRU por acceso.
- Descargas explícitas: vigencia máxima 150 días, 100 fichas / 8 MiB y 400 imágenes / 80 MiB; al llegar al límite se rechaza la nueva descarga, no se borra otra silenciosamente.
- Las fechas originales no se reinician al reutilizar datos incluidos. Metadatos personales vencidos se sustituyen por IDs/tipo; la selección se conserva y se actualiza al abrir la ficha online.
- El SW separa el shell sin datos TMDB de snapshot/imágenes fechados; IndexedDB v3 migra descargas válidas anteriores.
- Los bytes JSON son estimados, los Blob usan su tamaño real; `navigator.storage.estimate()` informa una estimación del origen, no espacio libre exacto del dispositivo.
- Descarga explícita de una ficha: guarda información, pósteres, backdrop y hasta ocho retratos del reparto en almacenes separados. Solo se informa completada si se han guardado los archivos. No descarga vídeo.
- Borrar caché automática **conserva descargas, lista, perfil e historial**. Eliminar una descarga conserva Mi Lista. Restablecer datos sí elimina todo lo personal.
- La PWA requiere primera visita online y que termine de instalarse el service worker. Las imágenes de filmografías no incluidas necesitan una primera descarga.
- Datos por dispositivo: no se suben ni sincronizan. El sistema/navegador puede borrar almacenamiento; desinstalar puede borrar tus datos.

La versión nueva preserva la lista local `cs_list_v1`. Si otra pestaña antigua bloquea la actualización de IndexedDB, cerrarla y volver a abrir la app. No cambiar la clave Android para una actualización.

## Desarrollo

Node 20+, frontend sin dependencias externas. Credenciales únicamente en variables de entorno.

```sh
export TMDB_READ_TOKEN='tu token privado'
npm run dev          # 0.0.0.0:8080; / y /app/
npm run check
npm run snapshot     # renueva contenido incluido desde TMDB
```

Sin token local, el servidor de desarrollo consulta el proxy público de producción. El token nunca va a `public/`, config.js, el APK o el EXE.

**API permitida:** tendencias, búsqueda, fichas/credits/videos/similares, personas/filmografías, géneros y discover. Los parámetros se validan y `include_adult=false` se fija para las consultas que lo soportan. CORS admite los orígenes nativos y producción. Respuestas `private, no-store` evitan que la CDN mezcle cabeceras CORS entre orígenes; el cliente conserva los datos en IndexedDB. CORS no es autenticación ni control de cuotas: configurar WAF/rate limits antes de tráfico importante.

El archivo `public/app/sw.js` controla solo `/app/`. Cambiar `SHELL` al modificar los assets; al activar una revisión elimina únicamente caches antiguas del shell CarimarShow. La página principal no utiliza el service worker de la app.

## Compilación

Android: JDK 17, SDK 35, Gradle 8.10.2. `preBuild` copia `public/` a assets. El contenedor no tiene JavaScriptInterface, acceso HTTP claro, aceptación de SSL inválido ni permisos sensibles. Soporta selección de archivo voluntaria para el avatar y abre enlaces externos fuera del shell.

```sh
cd android
gradle assembleDebug
# Firma de release mediante las variables documentadas en CI
gradle assembleRelease bundleRelease
```

Windows:

```powershell
dotnet publish windows/CarimarShow.csproj -c Release -r win-x64 --self-contained true -o artifacts/windows
# Descargar WebView2 Standalone x64 a artifacts/ y compilar windows/installer.iss con Inno Setup 6.
```

Datos Windows en `%LOCALAPPDATA%/StudioLexair/CarimarShow/WebView2`. El instalador es grande por incluir runtimes. Android depende del WebView disponible en el sistema.

## CI y seguridad

- `site.yml`: push a main → despliega juntos `api/` y `public/` a Vercel.
- `build.yml`: workflow_dispatch o tag `v*` → APK/AAB firmados + Windows. Con tag publica en Releases. Verifica firma APK y presencia de `assets/app/index.html` y snapshot.
- [Última release](https://github.com/StudioLexair/CarimarShow-Native/releases/latest)

Secrets Actions: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`, `TMDB_READ_TOKEN`. El token TMDB también está en el entorno encrypted del servidor Vercel. No incluir `.vercel/` en `public/`.

Rotar los PAT/tokens de acceso compartidos en el chat y sustituirlos en los secretos/entornos. **Conservar la clave Android de firma:** es la identidad para futuras actualizaciones, no un token de acceso. Respaldo entregado por separado, nunca en el repositorio público.

## Pruebas

Herramientas opcionales: `npm install --no-save playwright`, `npx playwright install --with-deps chromium`. Con servidor dev abierto:

```sh
BASE=http://localhost:8080 node tests/browser.cjs
BASE=http://localhost:8080 node tests/downloads.cjs
node tests/native-origins.cjs # sobre producción
```

`TEST_OUTPUT` controla la carpeta de capturas. `UPDATE_PREVIEW=1` permite actualizar la captura real de portada. Ver `tests/RESULTADOS.md`. Las simulaciones de origen WebView en Chromium no sustituyen una instalación física: probar APK en Android y EXE en Windows limpio antes de distribución al negocio.

Código reservado a Studio Lexair/Yolexis. Datos e imágenes sujetos a sus titulares y términos de TMDB; revisar licencia comercial según el uso del negocio. Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.

## Mejora 2.1.0 y verificación

[Informe de implementación, auditoría y pruebas](docs/INFORME-2.1.md) · [Permisos TMDB y almacenamiento](docs/TMDB-Y-ALMACENAMIENTO.md) · [Arquitectura](docs/ARQUITECTURA.md).

```bash
npm run check
npm test
PORT=8083 npm run dev
# En otra terminal; instalar Playwright primero:
npm install --no-save playwright
npx playwright install chromium
BASE=http://localhost:8083 node tests/browser.cjs
BASE=http://localhost:8083 node tests/downloads.cjs
BASE=http://localhost:8083 node tests/improvements.cjs
```

El proxy mantiene la credencial solo en Vercel, usa rutas/parámetros permitidos, tiempos de espera y validación. La regla WAF activa aplica 120 GET/minuto/IP a `/api/tmdb`; contador por región según Vercel. CORS no autentica a los clientes: el catálogo es público, la credencial es privada. No se incorpora una supuesta clave secreta a los APK.

El workflow **QA Web and Android 16** comprueba assets reales offline en WebView API 36 y el Intent externo del tráiler. Ese test intercepta el Intent: **no demuestra reproducción de YouTube ni envío por WhatsApp**. Su resultado debe revisarse en Actions antes de una entrega.

**Hosting comercial:** el plan actual confirmado es Vercel Hobby. Sus condiciones lo limitan a uso personal no comercial (https://vercel.com/docs/plans/hobby). La autorización TMDB no sustituye los términos de hosting: antes de operar comercialmente, cambiar a un plan/hosting compatible por decisión del titular. No se ha contratado ni activado un plan de pago.

## Continuación 2.1.1

[Mejoras de integración](docs/MEJORAS-2.1.1.md): orden dentro del grupo visible de Mi Lista, eliminación inmediata en rutas de películas/series, preferencias compatibles, caché con etiquetas/miniaturas/eliminación individual y errores parciales de Inicio aislados. Sin cambios al plan de Vercel ni servicios contratados.

## Perfil y géneros 2.2.0

[Resumen](docs/MEJORAS-2.2.0.md): Perfil/Ayuda rediseñados; selección películas + series o un solo tipo en portada y dentro de cada género; taxonomías oficiales por plataforma; arranque que evita shells antiguos sin borrar personales.
