// Configuración pública: la URL no es una credencial.
window.CARIMAR_CONFIG = {
  apiOrigin: /^(appassets\.androidplatform\.net|carimarshow\.local)$/.test(location.hostname) ? 'https://carimarshow-native.vercel.app' : '',
  version: '1.0.0'
};
