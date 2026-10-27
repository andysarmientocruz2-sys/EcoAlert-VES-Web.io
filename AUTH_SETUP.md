# Inicio de sesión compartido — EcoAlert VES

## Hechos verificados (27 de octubre de 2026)

- El APK adjunto tiene `appId: com.ecoalert.ves` y usa Capacitor.
- El JavaScript incluido en el APK usa Firebase `ecoalert-ves` (proyecto numérico `190726486094`).
- La web usaba `accessacount`; ahora usa la configuración pública del mismo proyecto que el APK.
- La consulta de configuración pública de Firebase devolvió solo `localhost`, `ecoalert-ves.firebaseapp.com` y `ecoalert-ves.web.app` como dominios autorizados. Falta el dominio de Sites.
- El APK implementa login de Google mediante el SDK web y popup; su lista de plugins Capacitor contiene Filesystem y Geolocation, sin plugin de autenticación nativa.
- El EXE es un instalador NSIS con Electron. Se inspeccionó app.asar sin ejecutarlo: usa Firebase ecoalert-ves. main.cjs carga http://127.0.0.1:4180 y abre todas las ventanas externas con shell.openExternal, denegando la ventana Electron; no se encontró un mecanismo de retorno de autenticación. 127.0.0.1 tampoco figura en los dominios autorizados. No se ejecutó ni recompiló el EXE.

## Paso requerido en la consola de Firebase

En el proyecto `ecoalert-ves`:

1. Authentication → Settings/Configuración → Authorized domains/Dominios autorizados.
2. Agregar exactamente `ecoalert-ves-andy.wigglydill7.chatgpt.site` (sin https, ruta ni barra final).
3. Authentication → Sign-in method → Google: comprobar que está habilitado y que tiene un correo de soporte.
4. Abrir la web sin `?demo=1`, pulsar Iniciar sesión y Continuar con Google. Permitir ventanas emergentes para el sitio si se bloquean.

No se cambió esta configuración: la consola requiere iniciar sesión con una cuenta administradora del proyecto. No se necesitan contraseñas ni claves privadas en el código.

## Identidad y datos

Firebase Authentication proporciona el mismo UID al usar la misma identidad Google dentro del mismo proyecto. Esto no comparte automáticamente una sesión entre dispositivos: se inicia sesión en cada uno.

La web crea `users/{uid}` con los campos de la app (`displayName`, `photoURL`, `ecoPoints`, `level`, `achievements`, `reportsCount`) solo con valores iniciales cuando no existe. No reinicia los puntos existentes. La autenticación se mantiene aunque fallen los permisos de escritura del perfil.

Por ahora los datos propios de la web están en `webProfiles` y `webReports`, para no mezclar formatos de reportes y puntos que todavía no se han migrado. Sus permisos deben configurarse explícitamente; no abrir globalmente Firestore. No se migraron los datos históricos de `accessacount`. La sincronización completa de reportes/puntos no está implementada. La web no debe usarse como panel administrativo de producción sin autorización de servidor.

## Siguiente trabajo sobre las apps

Se necesitan los proyectos fuente exactos de Android y Windows y la configuración de compilación. El repositorio `EcoAlert-VES` tiene código web de referencia, pero no se ha acreditado que reproduzca ambos binarios.

Android: integrar Google mediante el flujo nativo compatible con Capacitor y pasar la credencial a Firebase Auth del proyecto `ecoalert-ves`; registrar la aplicación Android y sus certificados SHA-1/SHA-256. No intentar evadir el bloqueo de Google en WebViews. No compartir la clave de firma.

Windows (Electron): utilizar un flujo admitido mediante navegador del sistema con retorno seguro a la aplicación. No insertar tokens en enlaces, logs o mensajes entre ventanas sin validar origen, estado y destinatario.

## Validación

El cambio web se revisa con TypeScript y compilación Vite. El acceso Google completo y el UID compartido deben verificarse después de autorizar el dominio. No se realizaron escrituras de prueba en los datos reales ni se modificaron los binarios adjuntos.

Referencias: https://firebase.google.com/docs/auth/web/google-signin y https://firebase.google.com/docs/auth/web/redirect-best-practices
