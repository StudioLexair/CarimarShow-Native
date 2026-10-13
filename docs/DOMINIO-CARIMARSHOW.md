# CarimarShow: limpieza y dominio principal

Fecha: 13 de octubre de 2026. Cambio de infraestructura; las aplicaciones firmadas 2.2.0 y el tag original no se reconstruyen ni modifican.

## Resultado

- Principal: https://carimarshow.vercel.app/
- Aplicación: https://carimarshow.vercel.app/app/
- Perfil: https://carimarshow.vercel.app/app/?v=2.2.0#profile
- Géneros: https://carimarshow.vercel.app/app/?v=2.2.0#genres/all
- Proyecto actual renombrado de `carimarshow-native` a `carimarshow`, conservando **prj_nRw7mvaLAhU6zSPUllGVpf9SIqjX**, su configuración, credencial TMDB y plan Hobby. Sin contratación, cambios de plan ni pagos.
- Alias `carimarshow-native.vercel.app` conservado en el **mismo proyecto**, sin redirección, para el API de Android/Windows 2.2.0 y el almacenamiento web existente.
- Eliminado el proyecto viejo `carimarshow` (prj_aOacF8XjeGsDP1hOOOcoYK2ORYJh).
- Eliminado `_site` (prj_F8Dkh0HoWRKAYPKigeirnAe3aVZL), identificado mediante sus despliegues como copia del repositorio antiguo CarimarShow.
- Los otros **9 proyectos** de Vercel conservan los mismos IDs y nombres; no se enviaron mutaciones a ellos.
- GitHub: eliminados los repositorios antiguos `StudioLexair/CarimarShow` y `StudioLexair/CarimarShow-releases`; conservado `StudioLexair/CarimarShow-Native` y release 2.2.0.

## Compatibilidad y datos

El servidor permite el dominio corto, el alias de compatibilidad y los orígenes Android/Windows conocidos; rechaza orígenes ajenos. No se cambió la aplicación empaquetada ni su firma. Los próximos despliegues asignan ambos dominios al mismo despliegue. No se incluye `.vercel/` en `public/`.

**El almacenamiento web depende del origen:** el perfil y Mi Lista guardados en `carimarshow-native.vercel.app` siguen allí; no se copian automáticamente al dominio corto. El alias permite seguir usándolos sin borrarlos. No se afirma migración de datos de la aplicación antigua Flutter.

## Verificaciones realizadas

- Sintaxis: 47 archivos JavaScript PASS; unitarias: 15/15 PASS.
- Despliegue de infraestructura y asignación explícita de ambos alias SUCCESS: https://github.com/StudioLexair/CarimarShow-Native/actions/runs/38443851863
- En ambos dominios: landing, `/app/`, entrada `.mjs` y CSS responden 200.
- API TMDB real: 16 géneros TV; solicitudes desde ambos dominios y los orígenes nativos devuelven 200 y CORS correcto. Origen ajeno devuelve 403.
- Perfil/Ayuda/géneros mixtos, filtros, paginación, detalles/Atrás y offline: 8 grupos PASS en el dominio corto (`domain-switch/profile-genres.txt`).
- Proyecto actual y release 2.2.0 conservados; proyectos antiguos devuelven 404 autenticado.
- Copia local del código de la rama principal y metadatos antiguos en `/home/user/Respaldo-CarimarShow-antiguo/`; no es copia completa de historial, incidencias, binarios ni secretos.
- No se realizaron nuevas pruebas físicas de Android/Windows, reproducción YouTube ni envíos WhatsApp.

## Seguridad de cierre

El token temporal compartido **fue revocado**, verificado mediante fallo de autenticación del token antiguo. Se creó un reemplazo limitado al proyecto actual, con la misma fecha de vencimiento anterior, y se guardó cifrado en el secret `VERCEL_TOKEN` de GitHub Actions. No se guardó el valor nuevo en archivos ni se mostró en el chat/repo.

La CLI anterior 48.10.0 falló al intentar leer la configuración del equipo con el token limitado (run 38444287692). Se actualizó a **63.1.2**, compatible con permisos de proyecto, y se asignan los alias mediante API sólo del proyecto/deployment verificado, sin depender de lectura de proyectos ajenos. Verificación de despliegue con la credencial rotada **SUCCESS**: https://github.com/StudioLexair/CarimarShow-Native/actions/runs/38444606672. Las comprobaciones web se repitieron después de ese despliegue.

No se escriben credenciales en este informe ni en el repositorio.
