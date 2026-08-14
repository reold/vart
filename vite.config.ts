import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const apiTarget = process.env.VITE_API_TARGET || 'https://vart.reold.workers.dev';
const basePath = (process.env.BASE_PATH || '') as '' | `/${string}`;
const apiPrefixes = [
  '/auth',
  '/me',
  '/app',
  '/classes',
  '/attendance',
  '/admin',
  '/reports',
  '/setup',
];

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for project components, except third-party libraries.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
      },
      adapter: adapter({
        pages: 'build',
        assets: 'build',
        fallback: undefined,
        precompress: false,
        strict: true,
      }),
      paths: {
        base: basePath,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: Object.fromEntries(
      apiPrefixes.map((prefix) => [
        prefix,
        {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      ]),
    ),
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
