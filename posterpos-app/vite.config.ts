import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        // Single JS file for PosterPOS embedding
        rollupOptions: {
            output: {
                entryFileNames: 'mpesa-widget.js',
                chunkFileNames: 'mpesa-widget-[hash].js',
                assetFileNames: 'mpesa-widget.[ext]',
            },
        },
    },
    define: {
        // Your Railway backend URL
        'import.meta.env.VITE_API_URL': JSON.stringify(
            process.env.VITE_API_URL || 'https://postergram-juice-production.up.railway.app'
        ),
    },
});
