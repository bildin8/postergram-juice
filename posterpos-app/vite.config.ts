import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
    plugins: [
        react(),
        // Injects CSS into the JS bundle (required for PosterPOS single-file deploy)
        cssInjectedByJsPlugin(),
    ],
    build: {
        outDir: '.',
        // Output single bundle.js file for PosterPOS
        rollupOptions: {
            output: {
                entryFileNames: 'bundle.js',
                // Ensure all code is in one file
                manualChunks: undefined,
            },
        },
        // Inline all assets
        assetsInlineLimit: 100000,
    },
    define: {
        'import.meta.env.VITE_API_URL': JSON.stringify(
            process.env.VITE_API_URL || 'https://postergram-juice-production.up.railway.app'
        ),
    },
});
