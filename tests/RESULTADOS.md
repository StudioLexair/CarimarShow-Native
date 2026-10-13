# QA · CarimarShow 2.0.0

Pruebas sobre servidor Node real conectado a TMDB, Chromium/Playwright. Los datos mostrados son de TMDB; la lista, perfil y actores seguidos usados en las capturas se crearon mediante acciones reales de la UI dentro de un navegador de prueba. No se prellenan en producción.

| Prueba | Resultado |
|---|---|
| Página principal `/` + app `/app/` | Páginas distintas, conectadas; sin desplazamiento horizontal |
| Arranque | Snapshot → IndexedDB → consultas; progreso por fases reales |
| Carrusel | John Wick → Dune: Parte dos al pulsar indicador |
| Búsqueda de personas | Tom Hardy encontrado; filtro real y búsquedas recientes |
| Seguir persona | Botón pasa a Siguiendo; contador del perfil refleja 1 |
| Ficha Dune | Sinopsis, valoración real, reparto, tráiler de YouTube |
| Pestañas | Reparto, tráileres y similares cargan datos reales |
| Géneros | Géneros TMDB y resultados discover |
| Paginación | 20 → 40 títulos al cargar más |
| Mi Lista | 4 películas guardadas mediante botones reales |
| Perfil | Contadores 4 películas / 0 series / 1 actor seguido; nombre editable |
| Historial | Fichas visitadas, no títulos inventados |
| Descargar ficha | Dune guardada con imágenes y tamaño real |
| Borrar caché | Descarga conservada |
| Offline | Ficha y lista después de recarga sin red |
| Descarga fuera del snapshot | The Batman: ficha completa y 8 actores offline tras borrar caché |
| Imágenes offline explícitas | Retratos cargan desde blobs guardados en IndexedDB |
| Eliminar descarga | Se elimina la ficha de Descargas |
| Vista móvil / escritorio | Sin desbordamiento horizontal; rails internos desplazables |
| JavaScript | Sin errores durante los recorridos |

Compilaciones y pruebas de producción se completan en la entrega. **Pendiente de QA físico:** instalación/desinstalación y modo avión en Android/Windows limpios; botón Atrás, apertura externa de tráileres y selector de avatar desde el contenedor Android. Compilar y simular orígenes nativos en Chromium no demuestra esos comportamientos de sistema operativo.
