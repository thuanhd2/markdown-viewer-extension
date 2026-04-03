// File tree SVG icons
// UI chevrons: Lucide Icons (ISC License) — https://lucide.dev
// File/folder icons: material-icon-theme (MIT License) — https://github.com/material-extensions/vscode-material-icon-theme

import * as mi from './file-icons-data';

// ─── UI icons (Lucide, stroke-based, follows currentColor) ───
const A = 'xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
export const chevronRight = `<svg ${A}><path d="m9 18 6-6-6-6"/></svg>`;
export const chevronDown = `<svg ${A}><path d="m6 9 6 6 6-6"/></svg>`;

// ─── Folder / file icons (material-icon-theme, colorful) ───
export const folderClosed = mi.folder;
export const folderOpen = mi.folderOpen;
export const folderPlus = mi.folderOpen;

// ─── Extension → icon mapping ───
const extMap: Record<string, string> = {
  // Markdown
  'md': mi.markdown, 'markdown': mi.markdown,
  // Diagrams
  'mermaid': mi.mermaid, 'mmd': mi.mermaid,
  'plantuml': mi.mermaid, 'puml': mi.mermaid,
  'gv': mi.settings, 'dot': mi.settings,
  'drawio': mi.settings,
  // Charts
  'vega': mi.table, 'vl': mi.table, 'vega-lite': mi.table,
  // Slides
  'slides.md': mi.powerpoint,
  // Design / Canvas
  'infographic': mi.image, 'canvas': mi.image,
  // JavaScript / TypeScript
  'js': mi.javascript, 'mjs': mi.javascript, 'cjs': mi.javascript,
  'ts': mi.typescript, 'mts': mi.typescript, 'cts': mi.typescript,
  'jsx': mi.react, 'tsx': mi.reactTs,
  // Frameworks
  'vue': mi.vue, 'svelte': mi.javascript,
  // Systems / Backend
  'py': mi.python, 'rb': mi.ruby, 'go': mi.go, 'rs': mi.rust,
  'java': mi.java, 'kt': mi.kotlin, 'swift': mi.swift, 'dart': mi.dart,
  'c': mi.c, 'cpp': mi.cpp, 'h': mi.c, 'hpp': mi.cpp,
  'cs': mi.java, 'php': mi.php, 'lua': mi.lua, 'r': mi.r,
  'scala': mi.scala, 'zig': mi.zig, 'perl': mi.perl, 'pl': mi.perl,
  // Web
  'html': mi.html, 'htm': mi.html,
  'css': mi.css, 'scss': mi.css, 'less': mi.css, 'sass': mi.css,
  'xml': mi.xml, 'xsl': mi.xml, 'xslt': mi.xml, 'svg': mi.svg,
  // Data / Config
  'json': mi.json, 'jsonc': mi.json, 'json5': mi.json,
  'yaml': mi.yaml, 'yml': mi.yaml, 'toml': mi.toml, 'ini': mi.settings,
  'env': mi.settings, 'properties': mi.settings,
  // Shell / Terminal
  'sh': mi.console, 'bash': mi.console, 'zsh': mi.console,
  'fish': mi.console, 'ps1': mi.console, 'bat': mi.console, 'cmd': mi.console,
  // Text / Docs
  'txt': mi.file, 'log': mi.log, 'rtf': mi.word,
  'tex': mi.tex, 'bib': mi.tex,
  'csv': mi.table, 'tsv': mi.table,
  // Images
  'png': mi.image, 'jpg': mi.image, 'jpeg': mi.image,
  'gif': mi.image, 'webp': mi.image, 'bmp': mi.image, 'ico': mi.image,
  'tiff': mi.image, 'tif': mi.image, 'avif': mi.image,
  // Audio / Video
  'mp3': mi.audio, 'wav': mi.audio, 'ogg': mi.audio,
  'flac': mi.audio, 'aac': mi.audio, 'm4a': mi.audio,
  'mp4': mi.video, 'webm': mi.video, 'mkv': mi.video,
  'avi': mi.video, 'mov': mi.video, 'wmv': mi.video,
  // Archives
  'zip': mi.zip, 'tar': mi.zip, 'gz': mi.zip,
  'bz2': mi.zip, 'xz': mi.zip, '7z': mi.zip,
  'rar': mi.zip, 'tgz': mi.zip,
  // Spreadsheet
  'xls': mi.table, 'xlsx': mi.table, 'ods': mi.table,
  // Lock / Security
  'lock': mi.lock,
  // PDF / Font
  'pdf': mi.pdf, 'woff': mi.font, 'woff2': mi.font, 'ttf': mi.font, 'otf': mi.font, 'eot': mi.font,
  // DB
  'sql': mi.database, 'sqlite': mi.database, 'db': mi.database,
  // Doc files
  'doc': mi.word, 'docx': mi.word, 'odt': mi.word,
  'ppt': mi.powerpoint, 'pptx': mi.powerpoint, 'odp': mi.powerpoint,
};

// Compound extensions checked before simple dot-extension
const compoundExts: [string, string][] = [
  ['.slides.md', mi.powerpoint],
  ['.d.ts', mi.typescriptDef],
  ['.test.ts', mi.typescript],
  ['.test.js', mi.javascript],
  ['.spec.ts', mi.typescript],
  ['.spec.js', mi.javascript],
  ['.config.js', mi.settings],
  ['.config.ts', mi.settings],
  ['.config.mjs', mi.settings],
];

export function getFileIcon(name: string): string {
  const lower = name.toLowerCase();

  // Check compound extensions first
  for (const [suffix, icon] of compoundExts) {
    if (lower.endsWith(suffix)) return icon;
  }

  // Simple extension lookup
  const dot = lower.lastIndexOf('.');
  if (dot >= 0) {
    const ext = lower.slice(dot + 1);
    if (ext in extMap) return extMap[ext];
  }

  // Known config filenames
  const baseName = lower.split('/').pop() || lower;
  if (['dockerfile', 'makefile', 'cmakelists.txt', 'gemfile', 'rakefile'].includes(baseName)) return mi.docker;
  if (['.gitignore', '.gitattributes'].includes(baseName)) return mi.git;
  if (['.editorconfig', '.eslintrc', '.prettierrc'].includes(baseName)) return mi.settings;
  if (baseName === 'readme.md' || baseName === 'readme.txt' || baseName === 'readme') return mi.readme;
  if (baseName === 'license' || baseName === 'license.md' || baseName === 'license.txt') return mi.license;
  if (baseName === 'changelog.md' || baseName === 'changelog') return mi.changelog;
  if (baseName === 'todo.md' || baseName === 'todo' || baseName === 'todo.txt') return mi.todo;
  if (baseName === 'dockerfile') return mi.docker;
  if (baseName === 'package.json' || baseName === 'package-lock.json') return mi.json;
  if (baseName === 'tsconfig.json') return mi.typescript;

  return mi.file;
}
