# TMDB: atribución, autorización y almacenamiento

Revisión: 13 de octubre de 2026. Esta documentación no sustituye el acuerdo ni asesoramiento jurídico.

## Autorización declarada

El titular respondió **«Sí, tengo autorización»** al consultar por acuerdo escrito para uso comercial y offline. No aportó el documento ni sus límites: esta implementación **no certifica** el alcance, duración, distribución en APK/Windows, almacenamiento de imágenes ni cumplimiento contractual. Mantener el acuerdo y verificar esas cláusulas antes de distribuir comercialmente. Una credencial gratuita por sí sola no demuestra permiso comercial.

Fuentes oficiales consultadas:
- https://developer.themoviedb.org/docs/faq — autorización comercial/atribución.
- https://www.themoviedb.org/api-terms-of-use — acuerdo comercial separado; caché hasta seis meses; purga al terminar autorización.
- https://www.themoviedb.org/about/logos-attribution — uso de logos originales y avisos.

Créditos visibles en Configuración y en el pie de Inicio. Logo oficial **Blue Short**, descargado de TMDB sin redibujar, recolorear ni deformar. Avisos oficiales en inglés y explicación española. No se presenta TMDB como patrocinador.

## Política técnica aplicada

| Contenido | Vigencia | Límite | Limpieza |
|---|---:|---|---|
| Consultas automáticas IDB | 30 días | 250 / 12 MiB JSON | LRU y expiración |
| Imágenes automáticas IDB | 30 días | 100 / 30 MiB | LRU y expiración |
| Fichas explícitas | 150 días | 100 / 8 MiB JSON | Expiración; gestión explícita; no LRU silencioso |
| Imágenes de fichas | 150 días máximo desde origen | 400 / 80 MiB | Expiración; eliminación sin huérfanas |
| Snapshot e imágenes incluidos | 150 días desde generatedAt | Paquete acotado | App/SW dejan de utilizarlos vencidos |
| Mi Lista, historial, personas seguidas | IDs/tipo permanecen; metadatos 150 días | Historial 60 | Metadatos vencidos se retiran; identidad/selección permanece |
| Perfil, avatar, búsquedas propias | Sin TTL de TMDB | Cuota local | Solo restablecimiento/acciones propias |

El margen de 150 días es inferior a seis meses naturales; condiciones particulares del acuerdo podrían ser más estrictas. Los datos reciclados no reciben una fecha nueva de origen. Las consultas frescas sí adquieren fecha real. Caché automática puede borrarse por metadatos/imágenes/toda, con confirmación, sin tocar descargas o personales.

**Limitación importante:** el vencimiento lógico no puede borrar bytes de los assets inmutables de un APK/instalador ya distribuido. El SW sí elimina su copia de contenido fechado al vencer, pero el archivo de origen/paquete sigue existiendo. No se afirma una purga física completa. Planificar actualizaciones/reconstrucciones antes de 150 días y verificar expresamente que el acuerdo cubre esta distribución. Para revocación se necesita retirar contenido del servidor y redistribuir paquetes; un dispositivo offline no puede recibir una orden remota inmediata.

La cuota depende del dispositivo/navegador. Ante escritura rechazada se informa, y la descarga no se declara completada. Los valores JSON son bytes de contenido estimados (sin índices); Blob usa size; la estimación de origen incluye shell y otras categorías. No se ofrece streaming ni descargas audiovisuales.
