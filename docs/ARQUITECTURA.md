# Arquitectura 2.1.0

Se conservan JavaScript sin framework, HTML/CSS, proxy Node/Vercel, Kotlin/WebViewAssetLoader y WPF/WebView2. No se migra el stack ni se retiran el perfil, géneros, historial o descargas. Primero se separaron las funciones existentes por responsabilidad y se ejecutó el mismo recorrido de regresión; después se añadieron mejoras.

- `public/app/app.js`: bootstrap, eventos globales, mantenimiento y carga del paquete.
- `modules/core-{config,state,model,validation,router}.mjs`: contactos centralizados, estado, modelos/escape/tipo, validación y contexto de navegación.
- `modules/storage-{local,policy,cache}.mjs`: personales, TTL/límites/bytes/LRU e IndexedDB v3/migración.
- `modules/services-{api,fallback,details,library,downloads,orders,platform}.mjs`: online-first, respaldo local, fichas/personas, selección/historial/organización, imágenes explícitas, texto/WhatsApp, copia/compartir.
- `modules/ui-{dom,icons,images,components,sheet,orders}.mjs`: utilidades, iconos, hidratación/revocación de Blob URLs, componentes y diálogos.
- `modules/views-*.mjs`: Inicio, búsqueda, categorías, ficha, persona/filmografía, lista, perfil, descargas, configuración/contactos/créditos.
- `styles.css`: lenguaje visual existente. `settings.css`: configuración y pedido, sin sobrescribir globalmente el diseño anterior.
- `public/app/sw.js`: shell versionado y contenido incluido con fecha; no una segunda caché API sin TTL.
- `lib/tmdb-policy.cjs` + `api/tmdb.js`: allowlist/validación/límite acotado por instancia y transporte privado al proveedor.
- `tests`: regresión existente, unitarias, nuevas aserciones en navegador y orígenes nativos. Android tiene instrumentación adicional API 36.

Hay 30 módulos cohesivos, formateados y legibles. El límite de ~200 líneas es orientativo: Configuración agrupa contenido de sus tarjetas y enlaces; los componentes comunes mantienen una sola fuente, no duplicación para cumplir un número artificial. Test del grafo verifica imports y ausencia de ciclos.

## Decisiones

1. Dedupe de selección por `tipo:id`, no solo id: una película y una serie con igual ID son distintas.
2. Ningún envío se presume completado; WhatsApp/copy/share no limpian la selección.
3. Error/no conexión y respuesta exitosa vacía son estados diferentes.
4. El router conserva contexto en sesión; un enlace profundo/recarga nueva usa un destino de vuelta seguro. No promete reproducir historial entre sesiones.
5. Datos automáticos son descartables; selección y perfil no lo son. Borrar automático no equivale a restablecer.
6. El catálogo público no tiene login; una credencial embebida en clientes no sería seguridad. WAF y validación complementan CORS.
