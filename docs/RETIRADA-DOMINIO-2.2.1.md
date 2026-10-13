# CarimarShow 2.2.1 — retiro del dominio con -native

## Solicitud confirmada

El usuario eligió desactivar completamente `carimarshow-native.vercel.app`, sin redirección, después de actualizar Android y Windows. Única dirección principal: https://carimarshow.vercel.app/; app: https://carimarshow.vercel.app/app/.

## Implementación

- Android/Windows y `config.js` pasan su proxy y allowlists al dominio corto.
- Versiones web, Android y Windows: 2.2.1; nueva caché shell 2.2.1, caché de contenido conservada.
- Se retira el antiguo origen de la allowlist CORS. Los orígenes nativos locales permanecen autorizados.
- El despliegue deja de asignar el alias antiguo. Workflow de retiro manual limitado al ID del proyecto actual y al hostname exacto; exige release 2.2.1 pública, builds/QA SUCCESS del mismo commit y API real nativo funcionando antes de eliminar alias/dominio.
- Nueva prueba en Android 16: petición real desde el WebView nativo al proxy del dominio corto y 16 géneros de TV. La prueba offline existente comprueba además el origen nuevo.
- No se cambian contactos, logos, Perfil/Ayuda, géneros, pedidos ni personales; ID de aplicación Android y directorio de datos Windows permanecen iguales. Se conserva el certificado de firma.

## Actualización necesaria

Instalar APK/Windows 2.2.1 **encima de la versión anterior**, sin desinstalar ni restablecer datos. Las versiones anteriores que apuntan al dominio retirado dejarán de consultar el catálogo online cuando se elimine ese dominio. No se afirma que los dispositivos de los usuarios se hayan actualizado automáticamente.

Los datos web guardados en el dominio con `-native` no se copian al dominio corto. No se borra almacenamiento de los navegadores ni se afirma migración automática entre orígenes.

## Verificación inicial

- Sintaxis: 47 archivos JS PASS.
- Unitarias: 16/16 PASS.
- Suite Perfil/Ayuda/géneros: 8 grupos PASS en el checkout local.
- Resultados: `docs/2.2.1/`.

## Cierre

**COMPLETADO:** release 2.2.1 pública y latest: https://github.com/StudioLexair/CarimarShow-Native/releases/tag/v2.2.1

- Runtime/tag: `31d22a6` / `v2.2.1`, sin cambios posteriores del código empaquetado.
- Build Android/Windows SUCCESS: https://github.com/StudioLexair/CarimarShow-Native/actions/runs/38446633894
- Deploy SUCCESS: https://github.com/StudioLexair/CarimarShow-Native/actions/runs/38446633737
- QA web + Android 16 SUCCESS: https://github.com/StudioLexair/CarimarShow-Native/actions/runs/38446633557
- Android 16 XML: **2 pruebas, cero fallos/errores/omitidos**, incluida petición real del WebView al dominio corto; `docs/2.2.1/android16.xml`.
- APK 2.2.1, versionCode **8**, SHA256 `2213e8663218d895223cbb062a11961d764ff0876d62d7bbff011ae18531e307`.
- Certificado Android SHA256 `1c684c5a0f5f6a7a348bd55c3f2ba9ce9dfc6beec1fdaae68a2a888a178ade2e`, igual al anterior. HTML 2.2.1 y config del proxy corto comprobados dentro del APK.
- Retiro SUCCESS: https://github.com/StudioLexair/CarimarShow-Native/actions/runs/38447215235
- Comprobaciones HTTP posteriores: hostname antiguo `/`, `/app/` y `/api/tmdb` **404, sin Location/redirección**; dominio corto `/` y `/app/` **200**, app 2.2.1. Resultados `domain-retirement.json`.
- API real corto: orígenes web/Android/Windows conocidos 200 y 16 géneros; origen antiguo 403.
- Suite de Perfil/Ayuda/géneros repetida tras retirar el dominio: **8 grupos PASS** en producción (`production-profile-genres.txt`).
- Los workflows futuros sólo asignan el dominio corto. No se tocó ningún otro proyecto ni se eliminó el proyecto activo.

No se cambió el plan de Vercel ni se contrató ningún servicio. No se afirma instalación física Windows/Android, reproducción YouTube ni envío WhatsApp real. Las aplicaciones ya instaladas no se actualizan mágicamente: instalar 2.2.1 encima de la anterior. Una pestaña/PWA offline puede conservar un shell local antiguo; las comprobaciones 404 corresponden al servidor, no al borrado remoto de datos del navegador.
