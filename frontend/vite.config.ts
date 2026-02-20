import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {tanstackRouter} from "@tanstack/router-plugin/vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
    }),
        tailwindcss(),
        react(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
    },
})
