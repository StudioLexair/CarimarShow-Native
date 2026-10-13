# CarimarShow 2.1.1 — mejoras de integración

Continuación sobre 2.1.0. Se conservan contactos, logos, flujo de pedido, catálogo real, plataformas y almacenamiento personal. **Sin contratación ni cambio del plan de Vercel.**

## Cambios concretos

1. **Orden visible de Mi Lista.** Mover una película/serie actúa dentro de su grupo, saltando los elementos del tipo oculto. No cambia el orden de las series al mover películas. Acciones de borde deshabilitadas.
2. **Eliminación inmediata.** Quitar un título actualiza también los accesos `/list/movie` y `/list/tv`, el estado vacío y el total del pedido.
3. **Preferencias integradas.** La pestaña elegida tiene URL coherente y preferencia local. Orden alfabético/por año sigue persistente. Se aceptan preferencias antiguas de 2.1.0 y el formato JSON; si el almacenamiento está restringido, la lectura usa una opción segura. Restablecer personales borra también estas preferencias.
4. **Caché útil.** Las consultas muestran títulos/búsquedas/categorías en lugar de «Consulta guardada N». Imágenes guardadas tienen una miniatura desde el Blob local, sin descargar una imagen nueva para verla. Cada elemento automático puede eliminarse con confirmación. Mi Lista, perfil, descargas e imágenes explícitas se conservan. La limpieza general anterior permanece.
5. **Inicio resistente a errores parciales.** Las dos fuentes independientes se resuelven por separado. Si solo una falla y no tiene respaldo, la otra sigue visible, con mensaje y reintento en la fallida. Vacíos legítimos tienen explicación. La fila personal muestra primero los elementos del principio de Mi Lista, no los más antiguos por un slice inverso.
6. **Actor/filmografía.** Las consultas de persona y créditos arrancan en paralelo; se mantiene la distinción entre filmografía no guardada y filmografía realmente vacía.
7. **Actualización compatible.** Versión 2.1.1 y shell PWA nuevo. El contenido incluido conserva su fecha original y su almacén anterior: no se reinicia la caducidad ni se obliga a borrar personales.

## Validación interna

No se solicita repetir pruebas al cliente. Comprobaciones automáticas después de implementar:
- Sintaxis de 44 JS/mjs/cjs: PASS.
- Unitarias 12/12: PASS, incluido movimiento agrupado sin mutar datos originales.
- Regresión móvil/escritorio: PASS; sin errores JS ni overflow.
- Recorrido búsqueda/ficha/actor/filmografía/Atrás, pedido, IDB/migración/TTL: PASS.
- Aserciones específicas de esta mejora: PASS. Eliminación en ambas rutas, grupos intercalados, preferencias antiguas/nuevas, caché individual/miniatura/conservación, fallo parcial real con inyección controlada y reintento, lectura local restringida.

Los resultados están en `docs/2.1.1/`. Las inyecciones se limitan a pruebas aisladas, no al producto desplegado. Se conservan las limitaciones físicas y contractuales ya documentadas en la 2.1.0; no se añaden disponibilidad comercial, precios, GPS, redes, streaming ni servicios inventados.

## Archivos relevantes

`core-model`, `core-state`, `storage-local`, `services-library`, `services-details`, `views-list`, `views-settings`, `views-home`, `views-profile`, `settings.css`, versiones de web/Android/Windows, SW y pruebas. Las funciones puras de orden están en el modelo existente: no se añade otro framework ni fragmentación innecesaria.

## Comandos

```bash
npm run check
npm test
PORT=8083 npm run dev
# Otra terminal, con Playwright instalado:
BASE=http://localhost:8083 node tests/polish.cjs
BASE=http://localhost:8083 node tests/improvements.cjs
BASE=http://localhost:8083 node tests/browser.cjs
```

## Publicación

Resultados de CI/instaladores se incorporan al finalizar. Release preparada en borrador hasta completar el proceso. APK mantiene la firma existente; Windows conserva la limitación de certificado comercial. No se contrata ningún servicio ni se modifica la configuración del plan.
