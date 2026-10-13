# CarimarShow 2.1.0 — informe de mejora

Fecha: 13 de octubre de 2026. Repositorio: StudioLexair/CarimarShow-Native. Mejora de la versión actual 2.0, no sustitución. Web 2.1 desplegada y probada en producción; APK/AAB e instalador Windows compilados. Primer QA Android 16 completado con éxito; segunda ejecución detectó una transición de red del emulador: el driver se refuerza esperando desconexión real antes del arranque. Instaladores mantenidos en borrador hasta terminar esta repetición.

## 1. Auditoría previa y funciones conservadas

Se ejecutaron primero `npm run check`, `tests/browser.cjs` y `tests/downloads.cjs` contra la 2.0 publicada: PASS. Inicio/carrusel, búsqueda, actores, categorías paginadas, cuatro pestañas de ficha, perfil real local, historial, Mi Lista y descarga offline ya funcionaban; no se atribuyen defectos de otros proyectos a esta versión. Evidencia: `baseline-browser.txt`, `baseline-downloads.txt`. Primer refactor modular probado sin cambios funcionales: `after-split.txt`, PASS.

Referencia funcional consultada: https://play.google.com/store/apps/details?id=com.buntupana.tmdb.app. Se contrastan búsqueda, reparto, filmografía y lista; no se copian sus recursos ni se afirma haber instalado esa app.

## 2. Deficiencias actuales corregidas / mejoras verificadas

Se completaron: pedido comercial con dos contactos ordenados; configuración/marcas/contactos/créditos; caducidad y límites en bytes; validación cliente/servidor; diferenciación error/vacío; navegación de vuelta con contexto; deduplicación/migración/organización; filmografía no disponible sin falso cero; ausencia y error del tráiler separados; protección WAF efectiva. La caché SW anterior no tenía caducidad de contenido: ahora se separa del shell. No había bloque visible de palabras clave que retirar.

## 3. Arquitectura

Stack conservado. 30 módulos con separación core/storage/services/ui/views, dependencias comprobadas sin ciclos. El bootstrap ya no concentra las pantallas y servicios. Ver `ARQUITECTURA.md`. Código formateado, sin duplicar contactos.

## 4. Archivos principales

`public/app/app.js`, `modules/*.mjs`, `settings.css`, `index.html`, `config.js`, `sw.js`, `brand/`; `api/tmdb.js`, `lib/tmdb-policy.cjs`; `scripts/check.mjs`, `dev.mjs`; `tests/unit.mjs`, `improvements.cjs`, `native-origins.cjs`; versiones/MIME de Android/Windows; workflows site/QA. Logos originales proporcionados y logo oficial TMDB incorporados sin deformar. No se añaden secretos.

## 5. Pruebas automáticas ejecutadas

- Sintaxis de todos los JS/mjs/cjs: PASS.
- Unitarias: **11/11 PASS** (`unit-results.txt`). Incluyen dedupe/agrupación/URL/TTL/LRU/tipo/tráiler/allowlist/método/origen/429/payload/grafo. Datos unitarios son fixtures claramente de prueba, no catálogo simulado de producción.
- Regresión browser móvil/escritorio: PASS (`qa-browser-2.1.txt`), búsquedas/reparto/fichas, guardar/seguir/editar, categorías/paginación, descargas sobrevivientes a limpieza, lista/ficha offline, sin overflow ni errores JS.
- Descarga nueva fuera del snapshot: PASS (`qa-downloads-2.1.txt`), The Batman offline/reparto/Blob y eliminación conservando selección.
- Aserciones nuevas: PASS (`qa-improvements-2.1.txt`): cadena completa de navegación/restauración, mensaje/orden/persistencia, organización, contactos/logos/cifras, IDB TTL/LRU/límite, migración v2→v3, metadatos vencidos renovables sin perder selección, fecha original del fallback y caducidad real de CacheStorage del SW.
- Fallos inyectados para pruebas: respuesta vacía válida y respuesta inválida; la UI distingue éxito vacío de respaldo local. No son resultados ficticios ofrecidos al usuario.
- Producción web: regresión PASS sin errores JS ni overflow (`qa-production-browser-2.1.txt`). Orígenes de Android/Windows: API real 200 y búsquedas Tom Hanks, sin aviso de fallback (`qa-native-origins-2.1.txt`); esta prueba Chromium verifica CORS/rutas, no reemplaza un equipo Windows.
- WAF real: **125 solicitudes a ruta inválida → 120 HTTP 400 + 5 HTTP 429**, sin llamadas TMDB (`waf-verification.json`).

## 6. Pruebas manuales y plataformas

Recorridos ejecutados en Chromium móvil 390×844 y escritorio 1440 px; no se usan screenshots como sustituto de aserciones. Prueba Android API 36 añadida: APK/assets reales, módulos MIME, arranque sin red, ficha/tráiler externo/pedido/lista. **PASS real en emulador Android 16/API 36**: 1 test, 0 fallos/errores/omitidos, 15,722 s; XML y resumen `qa-android16.xml/txt`. Run https://github.com/StudioLexair/CarimarShow-Native/actions/runs/38426329914. El Intent se intercepta: no se reproduce vídeo ni se envía WhatsApp. Ninguna prueba en un teléfono físico ni instalación interactiva Windows se presume realizada.

## 7. Caché y persistencia

Online-first validado; respaldo solo tras fallo, fuente/fecha local visibles. Consulta timeout 8 s, proveedor 7 s. IDB v3: sobres fechado, 30 días automático/150 explícito, límites de cantidad/bytes, LRU automático, límites explícitos sin borrar otra descarga. Descargas anteriores fechadas e imágenes asociadas conservadas; automático sin fecha descartado. Mi Lista conserva identidad aunque caduque metadata. Limpiezas por tipo con confirmación/resultado y estadísticas reales/estimadas correctamente etiquetadas. Ver política y limitación de assets inmutables en `TMDB-Y-ALMACENAMIENTO.md`.

## 8. Pedidos

«Compartir mi lista» abre primero UI propia con **+53 5332 4928**, después **+53 7866 0658**. Texto real agrupado en películas/series, título/año disponible/total/consulta disponibilidad y condiciones; URL codificada. Copiar y compartir alternativos. No borra lista ni confirma envío/aceptación/disponibilidad/precios.

## 9. Marcas y contactos

CarimarShow: Lealtad 559 entre Salud y Dragones, Centro Habana, Cuba; L–V 13–22; los dos teléfonos; **carimarshowapk@qmail.com** respetado literalmente, no cambiado a gmail. Studio Lexair secundario: **+53 52678747**, **studio.lexair@gmail.com**, logo original proporcional y promoción discreta de desarrollo Android/web/escritorio. Llamar/mail/WhatsApp/copiar dirección. No GPS, redes ni servicios inventados.

## 10. Seguridad

Credencial solo entorno Vercel, rutas/IDs/parámetros permitidos, bloqueo de URLs arbitrarias/duplicados/expansiones, validación JSON/ID, sin redirecciones del proveedor, timeout, errores neutros, protección de método/origen y headers/CSP. Límite acotado por instancia complementario, no descrito como distribuido. **WAF activo v1**, Hobby, ventana fija 60 s/120 GET a `/api/tmdb` por IP; contadores por región. No se cambia facturación. CORS no autentica: proxy público restringido con credencial privada. Monitorizar NATs compartidos y abuso; no es protección absoluta contra DDoS.

## 11. TMDB y compatibilidad

Avisos/logo autorizados visibles en créditos. El titular declaró autorización escrita; no se revisó el contrato ni se certifica alcance comercial/offline. Términos oficiales enlazados. Android Kotlin y Windows WPF/WebView2 son implementaciones reales; web/PWA para navegador. No se afirman apps nativas iPhone/macOS. Windows sin certificado comercial; SmartScreen puede advertir.

## 12. Pendientes y límites honestos

Prueba en teléfono físico con YouTube/WhatsApp instalados y no instalados; vídeo reproducible/red real y retorno a app; instalación Windows en equipo limpio; Safari/iPhone real; revisión del acuerdo TMDB y actualización periódica del contenido empaquetado; certificado Windows si se desea eliminar avisos reputacionales. **El plan Vercel actual es Hobby, que sus condiciones reservan para uso personal no comercial: antes del uso comercial elegir un plan/hosting compatible. No se ha autorizado ni realizado una contratación de pago.** Fuente oficial: https://vercel.com/docs/plans/hobby. Un enlace válido de TMDB no garantiza que YouTube no retire/restrinja el vídeo. No se presenta hardware ni envío externo no ejecutado como probado.

## 13. Comandos y entrega

```bash
npm run check
npm test
PORT=8083 npm run dev
# Otra terminal, Playwright instalado:
BASE=http://localhost:8083 node tests/browser.cjs
BASE=http://localhost:8083 node tests/downloads.cjs
BASE=http://localhost:8083 node tests/improvements.cjs
node tests/native-origins.cjs
# Android: Java 17, SDK 35, Gradle 8.10.2, emulador API 36
cd android && gradle connectedDebugAndroidTest
# Firma mediante secretos/entorno existentes, nunca contraseñas en código:
gradle assembleRelease bundleRelease
# Windows en Windows con .NET SDK 8:
dotnet publish windows/CarimarShow.csproj -c Release -r win-x64 --self-contained true
```

Ver README para instalación de Playwright y secretos requeridos. Web: `/` presentación y `/app/` app completa. Los instaladores incluyen web local. La publicación y artefactos 2.1.0 se informan únicamente cuando la ejecución real termine.
