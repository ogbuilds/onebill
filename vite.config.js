import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            include: ['crypto', 'stream', 'util'],
            globals: {
                Buffer: true,
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/components'),
            '@pages': path.resolve(__dirname, './src/pages'),
            '@db': path.resolve(__dirname, './src/db'),
            '@hooks': path.resolve(__dirname, './src/hooks'),
            '@logic': path.resolve(__dirname, './src/logic'),
            '@contexts': path.resolve(__dirname, './src/contexts'),
            '@services': path.resolve(__dirname, './src/services'),
            '@utils': path.resolve(__dirname, './src/utils'),
            '@assets': path.resolve(__dirname, './src/assets'),
            '@data': path.resolve(__dirname, './src/data'),
        },
    },
    server: {
        port: 5173,
    },
});
