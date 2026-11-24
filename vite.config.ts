import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Defina DISABLE_HMR=true para desligar o recarregamento automático.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Com DISABLE_HMR=true, também desliga o monitoramento de arquivos.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
