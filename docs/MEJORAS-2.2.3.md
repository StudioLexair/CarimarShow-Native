# CarimarShow 2.2.3 — navegación Android adaptable

## Corrección preparada

- El contenedor Android adopta explícitamente el mismo diseño edge-to-edge en Android 10–16.
- Las barras del sistema y los recortes se aplican una sola vez al contenedor raíz; el WebView no vuelve a recibir esos insets. Los insets del teclado se conservan.
- La suite de Android se configura para comprobar el área segura con navegación clásica de tres botones en API 29 y navegación por gestos en API 36.

El objetivo es eliminar el espacio vertical duplicado observado con la navegación de tres botones, manteniendo el contenido fuera del área real de navegación del sistema.

## Límites de verificación

La comprobación automatizada en emuladores no sustituye la revisión visual en el teléfono concreto. No se afirma verificado el resultado físico hasta que se pruebe en ambos modos de navegación en dispositivos reales.
