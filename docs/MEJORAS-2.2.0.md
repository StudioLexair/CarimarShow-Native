# CarimarShow 2.2.0 — Perfil, Ayuda y géneros mixtos

## Pedido atendido

Rediseñar Perfil y pantallas relacionadas al nivel de las demás; permitir películas/series juntas o una sola clase de contenido en Géneros y dentro de cada género. Se mantienen las funciones existentes, contactos, logos, lista, historial, personas seguidas y descargas. Sin contratación ni cambio del plan de Vercel.

## Diseño implementado

- **Perfil:** tarjeta principal con avatar editable, nombre y distintivo de perfil local; tres tarjetas de estadísticas reales; colección, actividad y preferencias agrupadas; vista de los títulos guardados cuando existen; restablecimiento separado y con confirmación.
- **Ayuda:** dos contactos de WhatsApp en el orden original, llamadas/correo y seis preguntas desplegables. No se confirman pedidos ni se inventan disponibilidad/precios.
- **Pantallas relacionadas:** Historial/Personas seguidas y fondo/navegación de pantallas personales coherentes con el nuevo lenguaje visual.
- CSS independiente `personal.css`, responsive y sin cambiar el diseño de fichas o Inicio. Logo original de negocio/desarrollador en Configuración sin alteraciones. El avatar por defecto son iniciales del perfil, no un rediseño de marca.

## Géneros

- Tres opciones visibles: **Películas y series / Solo películas / Solo series**.
- Misma elección dentro de cada género; URL conserva el tipo y Atrás desde una ficha lo recupera.
- Resultados mixtos intercalados con tipo correcto, IDs deduplicados por tipo e incremento de páginas independiente para cine/TV. Si una fuente falla, no se presenta como ausencia remota ni se oculta la otra.
- Dos diccionarios oficiales: `genre/movie/list` y `genre/tv/list`. Incluidos para offline; sin reiniciar la fecha original del snapshot.
- Correspondencias reales: cine Acción=28 / Aventura=12 → TV 10759; cine Ciencia ficción=878 / Fantasía=14 → TV 10765; cine Bélica=10752 → TV 10768. Las agrupaciones oficiales se explican en la pantalla.
- Géneros exclusivos de TV, como Infantil, Noticias o Reality, también aparecen. No se inventa un ID de Terror para series: si la taxonomía oficial no ofrece esa categoría, se indica el tipo soportado y se permite cambiar la selección.

## Corrección de actualización

Las capturas mostraban pie “2.0.0” y ayuda antigua. Nuevo arranque `startup.mjs` usa la versión del HTML, retira solo shells UI obsoletos y carga los módulos actuales. **No limpia IndexedDB, Mi Lista, perfil ni fichas explícitas.** Se agregó Actualizar CarimarShow al perfil, para recargar la web o abrir la descarga nativa más reciente. Si la página antigua sigue abierta, entrar de nuevo al enlace publicado; no se pide restablecer datos.

## Validación

- Sintaxis 47 archivos JS/mjs/cjs: PASS.
- Unitarias 14/14: PASS, incluidos equivalencias oficiales y mezcla conservando tipo para IDs coincidentes.
- Regresión existente: PASS; edición de perfil, fichas, lista, géneros, descargas, offline; sin errores JS/overflow.
- Nueva prueba `tests/profile-genres.cjs`: Perfil/Ayuda/contactos, resultado mixto real, paginación, filtro exclusivo por tipo, Atrás, TV exclusivo, taxonomía offline, actualización de shell manteniendo personales. PASS.
- 360, 390, 584 y 1440 px comprobados. Capturas son de la app real; no reemplazan las aserciones.
- Windows MIME ampliado para el nuevo arranque `.mjs`; Android mantiene el tratamiento explícito ya existente.

Resultados en `docs/2.2.0/`. Validación física de vídeo/WhatsApp/instalación Windows no se afirma nueva. No cambian los límites y condiciones ya documentados.

## Publicación

Se completa tras Actions y revisión final. El código nuevo se entrega en web y en los paquetes Android/Windows, conservando el certificado Android anterior.
