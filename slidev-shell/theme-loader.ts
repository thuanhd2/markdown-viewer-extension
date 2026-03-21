/**
 * Theme loader — eval-based dynamic loading
 *
 * Themes are built as separate IIFE bundles (see build-themes.ts).
 * Each IIFE assigns { layouts, css, fonts } to window.__SLIDEV_THEME__.
 * The theme code is embedded in the HTML as a map and eval'd on demand.
 */
import type { Component } from 'vue'

export interface ThemeModule {
  layouts: Record<string, Component>
  css?: string
  fonts?: {
    mono?: string
    sans?: string
    serif?: string
    local?: string
  }
  colorSchema?: string
}

let _injectedStyle: HTMLStyleElement | null = null

/**
 * Load a theme by eval'ing its IIFE code.
 * The code must set window.__SLIDEV_THEME__ = { layouts, css, fonts }.
 */
export function loadThemeFromCode(code: string): ThemeModule | undefined {
  // Clean previous theme state
  ;(window as any).__SLIDEV_THEME__ = undefined

  try {
    // Theme IIFE references window.Vue — must be exposed before eval
    // eslint-disable-next-line no-eval
    ;(0, eval)(code)
  } catch (err) {
    console.error('[slidev-shell] Failed to eval theme code:', err)
    return undefined
  }

  return _applyTheme()
}

/**
 * Load a theme by injecting a <script src> tag.
 * Works under strict CSP (e.g. Chrome extension pages) where eval is blocked.
 */
export function loadThemeFromUrl(url: string): Promise<ThemeModule | undefined> {
  ;(window as any).__SLIDEV_THEME__ = undefined

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = url
    script.onload = () => {
      script.remove()
      resolve(_applyTheme())
    }
    script.onerror = () => {
      console.error('[slidev-shell] Failed to load theme script:', url)
      script.remove()
      resolve(undefined)
    }
    document.head.appendChild(script)
  })
}

function _applyTheme(): ThemeModule | undefined {
  const theme = (window as any).__SLIDEV_THEME__ as ThemeModule | undefined
  if (!theme) {
    console.warn('[slidev-shell] Theme code did not set window.__SLIDEV_THEME__')
    return undefined
  }

  // Build combined CSS: theme styles + font-family overrides
  let css = theme.css || ''

  // Inject :root font-family overrides so the shell's UnoCSS utilities
  // (font-sans, font-serif, font-mono) and body text use theme fonts.
  // Fallback stacks match the official Slidev defaults used in build-themes.ts.
  if (theme.fonts) {
    const FALLBACK_SANS = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    const FALLBACK_SERIF = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
    const FALLBACK_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

    const quote = (s: string) => s.split(',').map(f => f.trim().includes(' ') && !f.trim().startsWith('"') ? `"${f.trim()}"` : f.trim()).join(', ')
    const decls: string[] = []
    const { sans, serif, mono } = theme.fonts
    if (sans) {
      decls.push(`font-family: ${quote(sans)}, ${FALLBACK_SANS}`)
    }
    if (decls.length) {
      css += `\n:root, .slidev-layout { ${decls.join('; ')} }`
    }
    // Override utility classes for serif/mono when theme specifies them
    if (serif) {
      css += `\n.font-serif, .slidev-layout h1, .slidev-layout h2, .slidev-layout h3 { font-family: ${quote(serif)}, ${FALLBACK_SERIF} }`
    }
    if (mono) {
      css += `\n.font-mono, code, pre { font-family: ${quote(mono)}, ${FALLBACK_MONO} }`
    }
  }

  // Inject theme CSS (replace previous theme's styles)
  if (css) {
    if (_injectedStyle) {
      _injectedStyle.textContent = css
    } else {
      _injectedStyle = document.createElement('style')
      _injectedStyle.setAttribute('data-slidev-theme', 'active')
      _injectedStyle.textContent = css
      document.head.appendChild(_injectedStyle)
    }
  } else if (_injectedStyle) {
    _injectedStyle.textContent = ''
  }

  return theme
}


