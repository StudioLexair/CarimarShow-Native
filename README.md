# CarimarShow Native

Aplicación híbrida con **archivos web incluidos en el instalador**, no un acceso directo a una web remota. Desarrollada por Studio Lexair.

- **Android 7+**: Kotlin + WebViewAssetLoader, APK firmado y AAB.
- **Windows 10/11 x64**: .NET 8 WPF + WebView2, instalador con .NET autocontenido y el runtime WebView2 offline incluido. El instalador requiere permisos de administrador. No tiene certificado comercial de firma de Windows: SmartScreen puede advertir.
- **Web / iPhone / macOS / Linux**: PWA en https://carimarshow-native.vercel.app. En iPhone: Safari → Compartir → Añadir a pantalla de inicio. No hay instaladores nativos de iOS/macOS/Linux en esta versión.

## Qué funciona

Catálogo real de TMDB, búsqueda de películas/series/personas, fichas sin palabras clave, tráiler externo de YouTube cuando existe, reparto enlazado a filmografía, lista personal sin registro, gráfica de la lista, borrado de caché, contacto del negocio y créditos del desarrollador.

## Offline, sin promesas falsas

El paquete contiene **50 títulos, sus fichas, 10 perfiles con filmografía y 65 imágenes** obtenidos en la fecha de generación indicada en Ajustes. No incluye el catálogo entero de TMDB, vídeos ni películas.

La interfaz, el catálogo incluido y tu lista se abren sin internet desde el primer arranque del APK/EXE. Las consultas son **network-first**, con respaldo en IndexedDB o en el catálogo incluido. Se guardan hasta 250 consultas y 100 imágenes adicionales. Las filmografías incluidas pueden tener pósteres que requieren una primera descarga. Tráileres, WhatsApp y sitios externos necesitan conexión.

Cuando cambien los archivos del shell web, cambiar también la revisión `SHELL` en `public/sw.js` para que las instalaciones PWA reciban la actualización.

La PWA necesita una primera visita con internet y que el service worker termine de descargar los archivos. Datos locales y lista son por dispositivo; no hay sincronización ni copia en la nube. No se elimina la lista al borrar caché.

## Desarrollo

```sh
# Node 20+, sin dependencias frontend
export TMDB_READ_TOKEN='tu token privado'
npm run dev                 # 0.0.0.0:8080
npm run check
npm run snapshot            # renueva datos y pósteres incluidos
```

`public/config.js` contiene únicamente la URL pública del proxy. En los contenedores locales usa el proxy HTTPS de Vercel; la web usa `/api/tmdb`. **Nunca poner tokens en public/, config.js, APK o EXE.** El proxy permite únicamente rutas concretas de lectura TMDB, valida parámetros y admite los orígenes locales Android/Windows. CORS no es autenticación ni protección contra bots; antes de tráfico elevado se debe activar rate limiting/WAF en el alojamiento y revisar cuotas.

## Android

JDK 17, Android SDK 35, Gradle 8.10.2 (instalado en Actions con setup-gradle).

```sh
cd android
gradle assembleDebug
# Release usa las variables de firma documentadas abajo
gradle assembleRelease bundleRelease
```

`preBuild` copia `public/` a assets. El shell usa `https://appassets.androidplatform.net/`. No hay JavaScriptInterface, permisos sensibles, HTTP claro ni aceptación de errores SSL. Solo se cargan recursos locales, el proxy y el CDN de TMDB. Los enlaces externos se abren fuera del contenedor. Android necesita que el WebView del sistema esté disponible; no se descarga la interfaz desde internet.

**Nueva identidad de paquete y firma:** `com.studiolexair.carimarshow`. Es una app independiente del proyecto anterior. No se puede prometer que sustituya una APK anterior con otro package ID o certificado. Conservar siempre la misma clave y aumentar versionCode para actualizaciones.

## Windows

```powershell
dotnet publish windows/CarimarShow.csproj -c Release -r win-x64 --self-contained true -o artifacts/windows
# Descargar WebView2 Standalone Installer x64 a artifacts/ y compilar windows/installer.iss con Inno Setup 6.
```

Actions descarga el instalador **standalone**, comprueba su firma Microsoft y lo incluye. No es el bootstrapper que descarga el motor durante la instalación. Los archivos se sirven desde `https://carimarshow.local/`, mapeado a la carpeta web junto al EXE. WebView2 guarda datos en `%LOCALAPPDATA%/StudioLexair/CarimarShow/WebView2`. El instalador completo puede ser grande por incluir los runtimes. El comportamiento final debe probarse en Windows real limpio y Android físico antes de distribuir a clientes.

## CI y despliegue

- `.github/workflows/site.yml`: push a main → Vercel producción.
- `.github/workflows/build.yml`: workflow_dispatch o tag `v*` → APK/AAB + instalador Windows. Con tag, publica en Releases.
- [Descargas](https://github.com/StudioLexair/CarimarShow-Native/releases)

Los secretos del repositorio anterior **no se heredan** al crear uno nuevo. Este repositorio utiliza:

| Secret | Uso |
|---|---|
| ANDROID_KEYSTORE_BASE64 | PKCS12 de firma de esta app, base64 |
| ANDROID_KEYSTORE_PASSWORD | Contraseña de almacén |
| ANDROID_KEY_ALIAS | Alias de firma |
| ANDROID_KEY_PASSWORD | Contraseña de la clave |
| VERCEL_TOKEN | Despliegues CI |
| VERCEL_PROJECT_ID | ID del proyecto nuevo |
| VERCEL_ORG_ID | ID real de la cuenta/team del proyecto nuevo |
| TMDB_READ_TOKEN | Renovación opcional del snapshot en CI |

Además, `TMDB_READ_TOKEN` debe estar como variable **encrypted** del servidor Vercel en producción. El despliegue sube el proyecto raíz con `api/` y `public/`, no una carpeta estática que excluya la API. No se debe incluir `.vercel/` en `public/`.

## Seguridad y entrega

Los PAT y tokens compartidos en el chat deben rotarse y sustituirse en los secretos/entornos después de la entrega. La clave Android es nueva, privada y estable; **no rotarla al rotar los tokens de acceso**, pues se necesita para actualizar instalaciones. Su respaldo se entrega por separado y nunca está en el repositorio público.

Código con todos los derechos reservados. Datos e imágenes sujetos a los términos de TMDB y titulares correspondientes. Debe revisarse la licencia comercial de TMDB si el uso del negocio lo requiere. Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.
