import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ecoalert.ves',
  appName: 'EcoAlert VES',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};
export default config;
