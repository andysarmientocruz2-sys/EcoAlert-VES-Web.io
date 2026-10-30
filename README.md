# EcoAlert VES 1.3

Web pública, fuente compartida con Windows y proyecto Android Capacitor.

Web: https://andysarmientocruz2-sys.github.io/EcoAlert-VES-Web.io/

## Desarrollo

Node.js 22 o posterior. Desde esta carpeta:

```sh
npm ci
npm run build
npm start
```

La compilación comprueba TypeScript. npm start sirve dist en http://localhost:4173.
?demo=1 activa datos locales, sin autenticación Firebase.

## Pruebas

```sh
npm test
```

El test de integración se omite si no están activos los emuladores. Para ejecutarlo con datos aislados, usa Firebase CLI y Java compatibles:

```sh
firebase emulators:exec --project demo-ecoalert-sync --config tests/firebase.json --only auth,firestore "npm test"
```

No despliegues tests/firestore.test.rules: es un fixture simplificado de pruebas. No representa ni valida las reglas del proyecto real.

Lee SYNC_STATUS.md para el alcance de la sincronización y README-ANDROID.md para compilar Android. El paquete descargable incluye el escritorio Electron y sus pruebas.
