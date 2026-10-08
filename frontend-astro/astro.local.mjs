// Config TEMPORAL para desarrollo local (pruebas de escritorio), evita el
// adapter de Netlify. NO usar en produccion; se borra al terminar.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  integrations: [react()],
});