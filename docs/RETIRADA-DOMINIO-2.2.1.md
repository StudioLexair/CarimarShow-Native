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

Pendiente: Actions, comprobación de firma/paquetes y publicación 2.2.1; luego retiro verificado del hostname antiguo. No se cambia el plan de Vercel ni se contrata ningún servicio. No se afirma instalación física Windows/Android, reproducción de YouTube ni envío real de WhatsApp.
