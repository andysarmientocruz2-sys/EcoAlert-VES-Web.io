# Android 1.3 — Google y progreso compartido

Ya existe un proyecto Capacitor en web/android (android/ si descargaste el repositorio web). Usa la misma interfaz y las mismas colecciones de Firebase que la web y Windows.

Implementado: @capacitor-firebase/authentication, Google nativo con skipNativeAuth y canje de idToken mediante signInWithCredential del SDK JavaScript; persistencia IndexedDB. Nunca se inicia Google dentro de un WebView. appId: com.ecoalert.ves. Firebase: ecoalert-ves.

## Lo que falta

1. En Firebase, usa o registra la app Android com.ecoalert.ves del proyecto ecoalert-ves.
2. Registra la SHA-1 y SHA-256 de la firma que realmente usará el APK; para debug, Android Studio puede mostrarla con la tarea signingReport. Para release, conserva tu keystore. No compartas contraseñas ni claves privadas.
3. Habilita Google en Authentication y descarga el google-services.json actualizado de esa app.
4. Colócalo en web/android/app/google-services.json (o android/app/ en el repo web). Se excluye de Git.
5. Instala Android Studio con SDK 36 y JDK 21. Desde web: npm ci; npm run android:sync; npm run android:open.
6. Compila y prueba Google en un dispositivo real con la misma cuenta que en la web. Prueba un reporte, los puntos, el quiz y la lectura desde dos dispositivos.

scripts/check-android.mjs valida proyecto, paquete y clientes OAuth. El build Gradle falla con un mensaje claro si falta google-services.json, evitando entregar una APK que aparente estar configurada. Esta comprobación no verifica la huella de la firma del APK: esa prueba necesita el dispositivo y Firebase.

No se generó ni firmó una APK aquí. No se dispone de la clave de firma de la APK anterior; sin esa clave un APK nuevo no puede actualizarse sobre el anterior. No desinstales la versión anterior hasta confirmar que sus datos están guardados en la nube. Los cursos, misiones y datos locales de la APK anterior no se migraron.

No despliegues las reglas históricas archivadas ni tests/firestore.test.rules. Debe revisarse la configuración real de Firebase sin abrir la base de datos al público.

Referencia de integración: https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/firebase-js-sdk.md
Referencia de SHA-1 y Google: https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md
