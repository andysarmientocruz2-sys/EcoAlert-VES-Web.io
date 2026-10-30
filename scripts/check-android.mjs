import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const location = fileURLToPath(new URL('../android/app/google-services.json', import.meta.url));
try {
  const data = JSON.parse(readFileSync(location, 'utf8'));
  if (data.project_info?.project_id !== 'ecoalert-ves') throw new Error('El archivo pertenece a otro proyecto de Firebase.');
  const client = data.client?.find(c => c.client_info?.android_client_info?.package_name === 'com.ecoalert.ves');
  if (!client) throw new Error('Falta la app com.ecoalert.ves en el archivo.');
  if (!client.oauth_client?.some(c => c.client_type === 3)) throw new Error('Falta el cliente OAuth web. Habilita Google y descarga de nuevo el archivo.');
  if (!client.oauth_client?.some(c => c.client_type === 1)) throw new Error('Falta el cliente OAuth Android. Registra la huella SHA-1 de la firma y descarga el archivo actualizado.');
  console.log('Configuración Firebase Android válida. La firma y el inicio de sesión deben probarse en un dispositivo.');
} catch (error) {
  console.error('Android todavía no está listo para Google:', error.code === 'ENOENT' ? 'Coloca google-services.json de com.ecoalert.ves en web/android/app/.' : error.message);
  process.exitCode = 1;
}
