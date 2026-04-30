/**
 * Vite config for VS Code build.
 *
 * Differences from the Chrome build (vite.config.ts):
 * - inlineDynamicImports: true  → single JS file (no theme chunks)
 * - assetsInlineLimit: Infinity → fonts/images become data-URIs in CSS
 * - cssCodeSplit: false         → single CSS file
 *
 * The vscode/build.js post-process step reads the resulting JS + CSS
 * and creates a self-contained HTML suitable for srcdoc embedding.
 */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url))

const slidevDefines = {
  '__DEV__': 'false',
  '__SLIDEV_HAS_SERVER__': 'false',
  '__SLIDEV_HASH_ROUTE__': 'true',
  '__SLIDEV_FEATURE_PRESENTER__': 'false',
  '__SLIDEV_FEATURE_PRINT__': 'false',
  '__SLIDEV_FEATURE_BROWSER_EXPORTER__': 'false',
  '__SLIDEV_FEATURE_DRAWINGS__': 'false',
  '__SLIDEV_FEATURE_DRAWINGS_PERSIST__': 'false',
  '__SLIDEV_FEATURE_EDITOR__': 'false',
  '__SLIDEV_FEATURE_RECORD__': 'false',
  '__SLIDEV_FEATURE_WAKE_LOCK__': 'false',
  'import.meta.env.DEV': 'false',
  'import.meta.env.PROD': 'true',
  'import.meta.env.SSR': 'false',
  'import.meta.env.BASE_URL': '"/"',
}

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS({
      configFile: resolve('./uno.config.ts'),
    }),
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
    ...slidevDefines,
  },
  base: './',
  resolve: {
    alias: {
      '#slidev/slides':              resolve('./shims/slides.ts'),
      '#slidev/configs':             resolve('./shims/configs.ts'),
      '#slidev/styles':              resolve('./shims/styles.ts'),
      '#slidev/global-layers':       resolve('./shims/global-layers.ts'),
      '#slidev/title-renderer':      resolve('./shims/title-renderer.ts'),
      '#slidev/custom-nav-controls': resolve('./shims/empty-component.ts'),
      '#slidev/shiki':               resolve('./shims/shiki.ts'),

      '#slidev/setups/main':          resolve('./shims/empty-setup.ts'),
      '#slidev/setups/routes':        resolve('./shims/empty-setup.ts'),
      '#slidev/setups/code-runners':  resolve('./shims/empty-setup.ts'),
      '#slidev/setups/monaco':        resolve('./shims/empty-setup.ts'),
      '#slidev/setups/mermaid':       resolve('./shims/empty-setup.ts'),
      '#slidev/setups/shortcuts':     resolve('./shims/empty-setup.ts'),
      '#slidev/setups/context-menu':  resolve('./shims/empty-setup.ts'),
      '#slidev/setups/root':          resolve('./shims/empty-setup.ts'),

      '#slidev/monaco-types':         resolve('./shims/empty.ts'),
      '#slidev/monaco-deps':          resolve('./shims/empty.ts'),
      '#slidev/monaco-run':           resolve('./shims/empty.ts'),

      'server-reactive:nav':              resolve('./shims/server-reactive-nav.ts'),
      'server-reactive:drawings?diff':    resolve('./shims/server-reactive-drawings.ts'),
      'server-reactive:snapshots?diff':   resolve('./shims/server-reactive-snapshot.ts'),
    },
  },
  build: {
    outDir: resolve('../dist/slidev-shell-vscode'),
    emptyOutDir: true,
    // Inline ALL assets (KaTeX fonts, images) as data-URIs
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve('./index.html'),
      output: {
        // Single file — all dynamic imports inlined
        inlineDynamicImports: true,
        entryFileNames: 'slidev-shell.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
