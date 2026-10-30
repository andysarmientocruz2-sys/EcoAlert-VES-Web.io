# Sincronización 1.3 — 29 de octubre de 2026

La web, el paquete Windows y el nuevo proyecto Android usan Firebase **ecoalert-ves** y el mismo UID de Google. Cada dispositivo inicia su propia sesión. No se copian tokens entre dispositivos.

| Información | Registro compartido | Comportamiento en esta versión |
| --- | --- | --- |
| Nombre y foto | users/{uid} | Se actualizan en vivo; volver a entrar no reemplaza el perfil personalizado con el de Google. |
| Puntos, nivel, insignias, cantidad de reportes | users/{uid} | Listener en vivo; reporte y recompensa de 50 puntos en una transacción. |
| Reportes | reports/{id} | Historial personal completo y últimos 100 reportes de la comunidad. Reintentar el mismo envío no duplica los puntos. |
| Preferencias de cuenta | webProfiles/{uid}.prefs | Listener en vivo y escritura de una sola preferencia para conservar cambios de otro dispositivo. |
| Cuestionario ambiental | webProfiles/{uid}.practiceQuizV1 | Guarda respuestas, pregunta y finalización. No otorga puntos. |
| Lecturas marcadas | webProfiles/{uid}.readArticles | Añade identificadores sin borrar lecturas de otro dispositivo. |
| Comentarios | webReports/{id}/comments | Compartidos por el servicio existente; requieren permisos de Firebase. |

El aviso superior distingue datos confirmados por el servidor, copia local, guardado pendiente y errores de puntos/perfil. Una sesión Google por sí sola no confirma que las reglas permitan escribir. El tema visual sigue siendo una preferencia de cada dispositivo.

## Pruebas y alcance

- Tres clientes independientes contra los emuladores oficiales Auth y Firestore: mismo UID, concurrencia de reportes, reintentos, preferencias simultáneas, lecturas y quiz en vivo, reingreso y aislamiento de otra cuenta. No fue un login Google real: las cuentas de prueba usan correo/contraseña solo dentro del emulador.
- La compilación web pasa TypeScript. El mismo dist se copia a Windows y Android.
- Se conservan las pruebas de HTTP, puente Google e IPC simulado de Windows.
- La interfaz de aprendizaje se comprobó en navegador: respuesta, siguiente pregunta, recarga, marcado de lectura y otra recarga.

## Pendiente en producción

No se han validado escrituras con una cuenta real ni se han modificado las reglas desplegadas. El fixture tests/firestore.test.rules solo se usa en el proyecto demo-ecoalert-sync; **no debe desplegarse**.

Para Android faltan google-services.json, registrar SHA-1/SHA-256 de la firma y compilar/probar con Android SDK y JDK 21. Lee README-ANDROID.md. No se generó una APK nueva ni un EXE firmado. Las apps antiguas instaladas no se actualizan con este ZIP.

Eventos, rankings de ejemplo, minijuegos y módulos de cursos/misiones de la APK original no tienen una migración completa. Las selecciones de votos siguen guardándose por dispositivo; el contador se comparte, pero falta garantizar voto único en servidor. Las recompensas son de cliente: para premios reales se necesita validación de servidor. El avance de invitado o demo no se incorpora automáticamente a una cuenta. El contenido educativo previo está señalado como demostración y requiere revisión editorial.
