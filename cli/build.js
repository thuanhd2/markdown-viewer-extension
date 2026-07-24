#!/usr/bin/env node

/**
 * CLI Build Script
 *
 * Bundles the headless page entry (which contains the DocxExporter and the
 * CLI platform stub) and copies the static HTML + theme assets to
 * `cli/dist/`. The Playwright entry (`cli/bin/md-to-docx.js`) then loads
 * `cli/dist/headless.html` in a headless Chromium.
 */

import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const src = path.join(sourceDir, entry.name);
    const dest = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

async function main() {
  console.log('🔨 Building md-to-docx CLI...\n');

  process.chdir(projectRoot);

  const outdir = path.join(projectRoot, 'cli/dist');
  if (fs.existsSync(outdir)) {
    fs.rmSync(outdir, { recursive: true, force: true });
  }
  fs.mkdirSync(outdir, { recursive: true });

  await build({
    entryPoints: ['cli/src/headless-entry.ts'],
    bundle: true,
    outfile: 'cli/dist/headless.js',
    format: 'iife',
    platform: 'browser',
    target: ['chrome110'],
    sourcemap: true,
    minify: false,
    define: {
      'process.env.NODE_ENV': '"production"',
      'MV_PLATFORM': '"chrome"',
      'MV_RUNTIME': '"cli"',
      'global': 'globalThis',
    },
    inject: ['./scripts/buffer-shim.js'],
    loader: {
      '.css': 'empty',
      '.woff2': 'empty',
      '.woff': 'empty',
      '.ttf': 'empty',
      '.eot': 'empty',
    },
  });
  console.log('  • cli/dist/headless.js');

  fs.copyFileSync(
    path.join(projectRoot, 'cli/src/headless.html'),
    path.join(outdir, 'headless.html'),
  );
  console.log('  • cli/dist/headless.html');

  copyDirectory(path.join(projectRoot, 'src/themes'), path.join(outdir, 'themes'));
  console.log('  • cli/dist/themes/');

  // Copy mermaid library (loaded separately via script tag)
  const mermaidSrc = path.join(projectRoot, 'node_modules/mermaid/dist/mermaid.min.js');
  if (fs.existsSync(mermaidSrc)) {
    const libDir = path.join(outdir, 'libs');
    fs.mkdirSync(libDir, { recursive: true });
    fs.copyFileSync(mermaidSrc, path.join(libDir, 'mermaid.min.js'));
    console.log('  • cli/dist/libs/mermaid.min.js');
  } else {
    console.warn('  ⚠ mermaid.min.js not found at node_modules/mermaid/dist/mermaid.min.js');
  }

  console.log('\n✅ CLI build complete!\n   Run: node cli/bin/md-to-docx.js <input.md>');
}

main().catch((err) => {
  console.error('❌ CLI build failed:', err);
  process.exit(1);
});
