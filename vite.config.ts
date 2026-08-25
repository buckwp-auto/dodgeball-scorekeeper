import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Production URL path prefix (must end with `/`). */
export function resolveAppBase(): string {
  if (process.env.GITHUB_PAGES === 'true') {
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'dodgeball-score';
    return `/${repo}/`;
  }
  const custom = process.env.VITE_BASE?.trim();
  if (custom) {
    return custom.endsWith('/') ? custom : `${custom}/`;
  }
  return '/';
}

export default defineConfig({
  plugins: [react()],
  base: resolveAppBase(),
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
