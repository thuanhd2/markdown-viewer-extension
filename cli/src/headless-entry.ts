/**
 * Headless page entry.
 *
 * Bundled by esbuild into `cli/dist/headless.js` and loaded by the Playwright
 * page in `cli/bin/md-to-docx.js`. Exposes a single global function that
 * converts markdown to a DOCX and returns it as base64.
 */

import DocxExporter from '../../src/exporters/docx-exporter';
import { installCliPlatform } from './platform-cli';
import { MermaidRenderer } from '../../src/renderers/mermaid-renderer';
import type { PluginRenderer } from '../../src/types/plugin';

interface ConvertOptions {
  themeId?: string;
  filename?: string;
  /** Directory of the source .md file (for resolving relative images). */
  documentDir: string;
  verbose?: boolean;
}

interface ConvertResult {
  base64: string;
  filename: string;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, Math.min(i + chunk, buffer.length)));
  }
  return btoa(binary);
}

// Create a PluginRenderer that uses MermaidRenderer to render diagrams in the
// headless Chromium (full DOM available). This replaces the null renderer
// that previously caused "Renderer not available" errors for mermaid diagrams.
function createCliPluginRenderer(): PluginRenderer {
  const mermaidRenderer = new MermaidRenderer();
  let initialized = false;

  return {
    async render(type: string, content: string | object) {
      if (type !== 'mermaid') {
        // Other diagram types (vega, plantuml, etc.) are not yet supported in
        // the CLI — they can be added later when needed.
        console.warn(`[cli] Renderer for "${type}" is not implemented in the CLI`);
        return null;
      }

      const code = typeof content === 'string' ? content : JSON.stringify(content);

      // Initialize mermaid renderer once
      if (!initialized) {
        try {
          await mermaidRenderer.initialize(null);
          initialized = true;
        } catch (err) {
          console.error('[cli] Failed to initialize mermaid renderer:', err);
          return null;
        }
      }

      try {
        const result = await mermaidRenderer.render(code, null);
        if (!result) return null;

        return {
          base64: result.base64,
          width: result.width,
          height: result.height,
          format: result.format,
          svg: result.svg,
        };
      } catch (err) {
        console.warn(`[cli] Mermaid render failed:`, err);
        return null;
      }
    },
  };
}

async function convertMarkdownToDocx(
  markdown: string,
  options: ConvertOptions
): Promise<ConvertResult> {
  installCliPlatform({
    documentDir: options.documentDir,
    settingsOverrides: options.themeId ? { themeId: options.themeId } : undefined,
  });

  const pluginRenderer = createCliPluginRenderer();
  const exporter = new DocxExporter(pluginRenderer);
  const filename = options.filename ?? 'document.docx';

  const onProgress = options.verbose
    ? (current: number, total: number) => {
        // Progress lands in the Playwright console; the CLI mirrors it to stderr.
        console.log(`[progress] ${current}/${total}`);
      }
    : null;

  // Use a stable synthetic "document URL" whose directory matches the CLI
  // platform's documentDir (the HTTP server mount for the input file's
  // directory). Relative image references then resolve against it.
  const dir = options.documentDir.endsWith('/') ? options.documentDir : `${options.documentDir}/`;
  const baseUrl = `${new URL(dir, window.location.href).href}document.md`;

  const { blob, filename: fname } = await exporter.exportToDocxBlob(
    markdown,
    filename,
    onProgress,
    baseUrl
  );

  const base64 = await blobToBase64(blob);
  return { base64, filename: fname };
}

declare global {
  interface Window {
    __convertMarkdownToDocx: typeof convertMarkdownToDocx;
    __headlessReady: boolean;
  }
}

window.__convertMarkdownToDocx = convertMarkdownToDocx;
window.__headlessReady = true;
