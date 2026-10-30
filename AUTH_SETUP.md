# Acceso Google — versión 1.3

Todos los clientes usan el proyecto Firebase ecoalert-ves. La misma cuenta Google debe producir el mismo UID. Cada dispositivo mantiene su propia sesión.

La web se publica en https://andysarmientocruz2-sys.github.io/EcoAlert-VES-Web.io/. Firebase debe autorizar andysarmientocruz2-sys.github.io; el puente Windows usa localhost. La comprobación pública previa devolvió ambos dominios autorizados. El usuario confirmó el login web anteriormente; la revisión 1.3 todavía requiere la prueba real de escrituras y permisos.

Android tiene un flujo nativo, no un popup web. Consulta README-ANDROID.md para google-services.json, huellas y compilación. No publiques ni compartas una clave de cuenta de servicio o de firma.

users/{uid} conserva puntos, insignias y perfil; reports contiene los reportes; webProfiles guarda preferencias y aprendizaje. SYNC_STATUS.md describe el alcance y las pruebas. No se modificaron reglas de producción ni se migraron datos del proyecto histórico accessacount.
