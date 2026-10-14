# CarimarShow 2.2.2 — notas de versión

## Cambios preparados

- Inicio apila todas sus secciones también en escritorio, incluidas «Nuevos lanzamientos» y «Series para descubrir». Muestra hasta seis destacados únicos con arte real de TMDB: tendencias de hoy primero y, si faltan, esta semana. El carrusel avanza aproximadamente cada seis segundos y respeta la preferencia de movimiento reducido, la pestaña oculta y la pausa al pasar el puntero.
- La lista compartida conserva sus títulos, pero ya no añade una frase fija de disponibilidad. El mensaje se puede editar; los enlaces de WhatsApp, Copiar y Compartir usan el texto editado.
- Los enlaces de fichas y personas usan `https://carimarshow.vercel.app/`.
- Se conserva lo ya preparado para 2.2.2: título original cuando difiere, tendencias de hoy y semana apiladas, insets seguros en Android y smoke test del instalador Windows.
- El botón «Descargar APK» de la web principal apunta al archivo de la última release en la pestaña actual, sin abrir la página de releases.

## Verificación local

- `npm test`: 18/18.
- `npm run check`: sintaxis correcta en 48 archivos JavaScript.
- Suites Playwright locales: `client-feedback`, `improvements`, `polish`, `profile-genres`, `browser` y `downloads` aprobadas en la sesión de preparación.
- El carrusel mostró seis títulos únicos y avanzó automáticamente; se comprobó una descarga de arte real desde TMDB y que sus enlaces de contenido compartido usen el dominio corto.

## Estado de distribución

Estas notas describen el candidato local. A fecha de preparación, la última release pública sigue siendo `v2.2.1`; aún no se ha generado ni publicado un APK firmado `v2.2.2`. El flujo de construcción requiere Java 17, Android SDK y los secretos de firma de GitHub Actions. La descarga y finalización en teléfonos Android reales aún requiere prueba física; no se afirma que ese fallo esté corregido.
