#!/usr/bin/env node

/**
 * md-to-docx CLI
 *
 * Convert a Markdown file to DOCX by driving the existing DocxExporter
 * inside a headless Chromium (via Playwright). The reusable browser
 * pipeline handles Markdown parsing, syntax highlighting, LaTeX, tables,
 * and theming.
 *
 * Usage:
 *   md-to-docx <input.md> [-o <output.docx>] [--theme <id>] [--verbose]
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const USAGE = `Usage: md-to-docx <input.md> [-o <output.docx>] [--theme <id>] [--verbose]

Options:
  -o, --output <path>   Output .docx path (default: <input basename>.docx)
      --theme <id>      Theme id (default: 'default'; e.g. 'github-dark')
      --verbose         Print progress and diagnostic messages to stderr
  -h, --help            Show this message`;

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function parseArgs(argv) {
  const args = { input: null, output: null, theme: null, verbose: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '-h' || arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg === '-o' || arg === '--output') {
      args.output = rest[++i];
    } else if (arg === '--theme') {
      args.theme = rest[++i];
    } else if (arg === '--verbose') {
      args.verbose = true;
    } else if (arg.startsWith('-')) {
      die(`Unknown option: ${arg}\n\n${USAGE}`);
    } else if (!args.input) {
      args.input = arg;
    } else {
      die(`Unexpected extra argument: ${arg}\n\n${USAGE}`);
    }
  }
  if (!args.input) die(`Missing input file.\n\n${USAGE}`);
  return args;
}

function die(msg) {
  console.error(`md-to-docx: ${msg}`);
  process.exit(1);
}

function log(verbose, msg) {
  if (verbose) console.error(`md-to-docx: ${msg}`);
}

/**
 * Serve `distDir` (bundle) at `/` and `documentDir` (input dir) at `/doc/`.
 * The exporter fetches theme JSON via `./themes/…` (bundle dir) and images
 * via `./doc/<relative-path>` after the platform stub rewrites paths.
 */
function startServer(distDir, documentDir) {
  const server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (urlPath === '/') urlPath = '/headless.html';

      let filePath;
      if (urlPath.startsWith('/doc/')) {
        filePath = path.join(documentDir, urlPath.slice('/doc/'.length));
        if (!filePath.startsWith(path.resolve(documentDir))) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
      } else {
        filePath = path.join(distDir, urlPath);
        if (!filePath.startsWith(path.resolve(distDir))) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404); res.end('Not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream' });
        res.end(data);
      });
    } catch (err) {
      res.writeHead(500); res.end(String(err));
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);

  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    die(`Input file not found: ${inputPath}`);
  }
  if (!/\.(md|markdown)$/i.test(inputPath)) {
    die(`Input must end in .md or .markdown: ${inputPath}`);
  }

  const outputPath = path.resolve(
    args.output ?? path.join(path.dirname(inputPath), `${path.basename(inputPath, path.extname(inputPath))}.docx`)
  );

  const distDir = path.join(projectRoot, 'cli/dist');
  if (!fs.existsSync(path.join(distDir, 'headless.html'))) {
    die(`Bundle missing: ${distDir}/headless.html\n         Run: npm run build:cli`);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    die(
      'Playwright is not installed.\n' +
      "         Run: npm install (installs devDependencies) and then: npx playwright install chromium"
    );
  }

  const markdown = fs.readFileSync(inputPath, 'utf8');
  const filename = path.basename(outputPath);
  const documentDir = path.dirname(inputPath);

  log(args.verbose, `input:  ${inputPath}`);
  log(args.verbose, `output: ${outputPath}`);
  if (args.theme) log(args.verbose, `theme:  ${args.theme}`);

  const { server, port } = await startServer(distDir, documentDir);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    if (args.verbose) {
      page.on('console', (msg) => console.error(`[browser:${msg.type()}] ${msg.text()}`));
      page.on('pageerror', (err) => console.error(`[browser:error] ${err.message}`));
    }

    await page.goto(`http://127.0.0.1:${port}/headless.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__headlessReady === true, null, { timeout: 30000 });

    const result = await page.evaluate(
      async ({ markdown, filename, themeId, verbose }) => {
        try {
          // The exporter's ResourceEmbedder reads relative images via
          // documentDir. Under the CLI it points at "/doc/" which the local
          // server maps to the input file's directory.
          const { base64, filename: fname } = await window.__convertMarkdownToDocx(markdown, {
            documentDir: '/doc/',
            filename,
            themeId: themeId ?? undefined,
            verbose,
          });
          return { ok: true, base64, filename: fname };
        } catch (err) {
          return {
            ok: false,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          };
        }
      },
      { markdown, filename, themeId: args.theme, verbose: args.verbose }
    );

    if (!result.ok) {
      if (args.verbose && result.stack) console.error(result.stack);
      die(`Conversion failed: ${result.message}`);
    }

    const buffer = Buffer.from(result.base64, 'base64');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    log(args.verbose, `wrote ${buffer.length} bytes`);
    console.error(`✅ ${outputPath}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('md-to-docx: unexpected error');
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
