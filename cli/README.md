# md-to-docx CLI

Convert a Markdown file to a `.docx` document from the terminal.

The CLI drives the same DOCX exporter used by the docu.md browser extension
inside a headless Chromium (via Playwright), so headings, paragraphs, tables,
fenced code with syntax highlighting, blockquotes, lists, LaTeX (via MathJax),
and every built-in theme all work as they do in the extension.

## Install

```
npm install
npx playwright install chromium
npm run build:cli
```

## Usage

```
node cli/bin/md-to-docx.js <input.md> [-o <output.docx>] [--theme <id>] [--verbose]
```

Or, after `npm link` (or a global install), `md-to-docx` is on `PATH`:

```
md-to-docx README.md -o README.docx
md-to-docx notes.md --theme github-dark --verbose
```

Options:

- `-o, --output <path>` — Output path (defaults to `<input>.docx` next to
  the input file).
- `--theme <id>` — Theme id (default: `default`; try `github-dark`,
  `academic`, `minimal`, or any preset under `src/themes/presets/`).
- `--verbose` — Mirror browser console output and progress to stderr.

## Scope

v1 targets the golden Markdown path: headings, paragraphs, inline styles,
links, lists, tables, fenced code, blockquotes, thematic breaks, images,
and LaTeX. Diagram code blocks (Mermaid, PlantUML, Vega, drawio, Graphviz,
canvas, Infographic) are not rendered by the CLI and fall through to plain
fenced-code output.
