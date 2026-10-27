
# EcoAlert VES Web · 1.1

Interfaz basada en el estilo de `andysarmientocruz2-sys/EcoAlert-VES`: fondo oscuro, verde y celeste, portada con teléfono, navegación adaptable y tarjetas. Conserva las pantallas y la configuración de Firebase del ZIP original.

## Abrir en Windows

1. Descarga y extrae el repositorio (Code → Download ZIP) o el paquete compilado en una carpeta.
2. Necesitas Node.js 22 o superior instalado.
3. Abre `INICIAR-ECOALERT.bat` con doble clic.

El paquete compilado incluye `dist/`. La descarga desde GitHub contiene el código fuente: el iniciador instala las dependencias y compila la primera vez (requiere conexión a Internet). El iniciador sirve la web en `http://localhost:4173` y abre el navegador. No descarga dependencias mientras exista `dist/`. Deja abierta la ventana de comandos; Ctrl+C la detiene. No abras directamente `dist/index.html`.

## Editar el código

```sh
npm install
npm run dev
```

Después de editar, ejecuta `npm run build` para actualizar la versión que abre el iniciador. `npm start` sirve la compilación en cualquier sistema con Node.js.

## Probar sin Firebase

Abre `http://localhost:4173/?demo=1`. Los reportes se guardan solo en este navegador y permanecen al recargar. No se envían a Firebase ni se sincronizan con otras apps.

## GitHub y publicación

Repositorio: [EcoAlert-VES-Web](https://github.com/andysarmientocruz2-sys/EcoAlert-VES-Web). Esta versión es independiente del repositorio de referencia `EcoAlert-VES`.

El repositorio contiene el código fuente y excluye `node_modules/`, `dist/` y tus `.env`. Incluye los archivos de configuración que empiezan por punto. Tener el código en GitHub no publica automáticamente el sitio web. `pnpm-lock.yaml` fija las dependencias para instalaciones con pnpm. Para alojamiento estático, ejecuta `npm run build` y publica el contenido de `dist/`. Las rutas son relativas y la navegación usa `#/pantalla`.

## Firebase y las apps

Se conserva la configuración pública de Firebase del proyecto original. Puedes sobrescribirla desde `.env.local` usando `.env.example` como referencia. Autoriza el dominio de publicación en Firebase Authentication para usar Google.

No se han verificado la base de datos real, sus reglas ni la sincronización con APK/EXE: no se recibieron los proyectos de esas apps. Compartir un proyecto Firebase no basta; también deben coincidir colecciones, campos y permisos.

## Mejoras y límites

- Portada ampliada, pasos de uso, accesos a educación/retos/comunidad y pie de página.
- Menú adaptable a tablets y móviles, etiquetas de accesibilidad, foco y contraste.
- Navegación que conserva la pantalla al recargar y permite Atrás/Adelante.
- Iniciador para Windows y servidor local limitado a la carpeta compilada.
- Aviso visible si falla un reporte; los puntos se conceden después del guardado.
- Pruebas locales persistidas en el navegador y texto escapado en popups del mapa.
- React declarado como dependencia y retirada de React Leaflet 5, sin uso e incompatible con React 18.
- Compilación separada en archivos para Firebase, mapas y gráficos.
- La revisión usa reglas locales, no Gemini; no mide áreas ni diagnostica riesgos sanitarios.
- Noticias, actividades, reportes de ejemplo y parte del panel Admin siguen siendo demostrativos. Admin conserva la lógica previa y no incorpora permisos de producción.

Validado con compilación Vite, revisión TypeScript y navegación en el navegador. El `.bat` no se ejecutó en Windows y no se probó el inicio de sesión real con Google desde este entorno.
  

Prueba de extremo a extremo en modo local: foto, dirección manual, descripción, revisión, confirmación y persistencia del reporte tras recargar: correcta. Ningún reporte de prueba se envió a Firebase.
