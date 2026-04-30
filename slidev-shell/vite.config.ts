import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Strip woff/ttf font references from CSS (keep only woff2), and rewrite
// KaTeX font URLs to point to the extension root instead of assets/.
// This avoids duplicating fonts — slidev-shell shares the root-level set.
function deduplicateKaTeXFonts(): Plugin {
  return {
    name: 'deduplicate-katex-fonts',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.css')) return
      const result = code.replace(/,\s*url\([^)]*\.(?:woff|ttf)\)\s*format\("[^"]*"\)/g, '')
      if (result !== code) return result
    },
    generateBundle(_, bundle) {
      // Remove KaTeX font assets from the bundle
      for (const name of Object.keys(bundle)) {
        if (bundle[name].type === 'asset' && /KaTeX_.*\.woff2$/.test(name)) {
          delete bundle[name]
        }
      }
      // Rewrite font URLs in CSS: ./KaTeX_*.woff2 → ../../KaTeX_*.woff2
      // From assets/index.css, ../../ resolves to the extension root
      for (const asset of Object.values(bundle)) {
        if (asset.type === 'asset' && asset.fileName.endsWith('.css') && typeof asset.source === 'string') {
          asset.source = asset.source.replace(
            /url\(\.\/KaTeX_/g,
            'url(../../KaTeX_'
          )
        }
      }
    },
  }
}

// Globals required by @slidev/client internals
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
    deduplicateKaTeXFonts(),
    vue(),
    UnoCSS({
      configFile: resolve('./uno.config.ts'),
    }),
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
    ...slidevDefines,
  },
  // Relative paths so the shell works inside chrome-extension:// iframe
  base: './',
  resolve: {
    alias: {
      // --- Virtual module shims ---
      '#slidev/slides':              resolve('./shims/slides.ts'),
      '#slidev/configs':             resolve('./shims/configs.ts'),
      '#slidev/styles':              resolve('./shims/styles.ts'),
      '#slidev/global-layers':       resolve('./shims/global-layers.ts'),
      '#slidev/title-renderer':      resolve('./shims/title-renderer.ts'),
      '#slidev/custom-nav-controls': resolve('./shims/empty-component.ts'),
      '#slidev/shiki':               resolve('./shims/shiki.ts'),

      // All setups → empty array
      '#slidev/setups/main':          resolve('./shims/empty-setup.ts'),
      '#slidev/setups/routes':        resolve('./shims/empty-setup.ts'),
      '#slidev/setups/code-runners':  resolve('./shims/empty-setup.ts'),
      '#slidev/setups/monaco':        resolve('./shims/empty-setup.ts'),
      '#slidev/setups/mermaid':       resolve('./shims/empty-setup.ts'),
      '#slidev/setups/shortcuts':     resolve('./shims/empty-setup.ts'),
      '#slidev/setups/context-menu':  resolve('./shims/empty-setup.ts'),
      '#slidev/setups/root':          resolve('./shims/empty-setup.ts'),

      // Monaco → stubs
      '#slidev/monaco-types':         resolve('./shims/empty.ts'),
      '#slidev/monaco-deps':          resolve('./shims/empty.ts'),
      '#slidev/monaco-run':           resolve('./shims/empty.ts'),

      // server-reactive → static initial state
      'server-reactive:nav':              resolve('./shims/server-reactive-nav.ts'),
      'server-reactive:drawings?diff':    resolve('./shims/server-reactive-drawings.ts'),
      'server-reactive:snapshots?diff':   resolve('./shims/server-reactive-snapshot.ts'),
    },
  },
  build: {
    outDir: resolve('../dist/slidev-shell'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('./index.html'),
      output: {
        // Single deterministic filename so build scripts can reference it
        entryFileNames: 'slidev-shell.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
