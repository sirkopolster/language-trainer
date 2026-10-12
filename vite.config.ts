import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SnapLearn',
        short_name: 'SnapLearn',
        description: 'Vokabeln fotografieren, lernen, Test bestehen',
        lang: 'de',
        theme_color: '#5b5bd6',
        background_color: '#f6f6fb',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
} as ReturnType<typeof defineConfig> & { test: unknown });
