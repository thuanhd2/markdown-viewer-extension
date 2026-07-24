import { loadImageAsBuffer, loadImageAsDataUrl } from '../utils/image-loader';
import { isNetworkUrl } from '../utils/document-url';
import type { ImageBufferResult } from '../types/docx';
import type { DocumentService } from '../types/platform';

export interface ResourceEmbedderOptions {
  documentService?: DocumentService;
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path);
}

function isImageElementLoadableUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return isNetworkUrl(lower)
    || lower.startsWith('blob:')
    || lower.startsWith('vscode-webview-resource:')
    || lower.startsWith('vscode-resource:')
    || lower.startsWith('chrome-extension:')
    || lower.startsWith('moz-extension:')
    || lower.startsWith('file://');
}

function guessContentType(url: string): string {
  const clean = url.split('?')[0]?.split('#')[0] || '';
  const ext = clean.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    avif: 'image/avif',
  };
  return map[ext] || 'image/png';
}

function decodeDataUrl(url: string): ImageBufferResult {
  const match = url.match(/^data:([^;,]+)((?:;[^,]+)*?),(.*)$/s);
  if (!match) {
    throw new Error('Invalid data URL format');
  }

  const contentType = match[1] || 'application/octet-stream';
  const metadata = match[2] || '';
  const payload = match[3] || '';
  const isBase64 = /;base64/i.test(metadata);

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { buffer: bytes, contentType };
  }

  const decoded = decodeURIComponent(payload);
  return { buffer: new TextEncoder().encode(decoded), contentType };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function normalizeContentType(contentType: string | null | undefined, fallbackUrl: string): string {
  return contentType && contentType.trim() ? contentType : guessContentType(fallbackUrl);
}

export class ResourceEmbedder {
  private documentService?: DocumentService;
  private bufferCache = new Map<string, ImageBufferResult>();

  constructor(options: ResourceEmbedderOptions = {}) {
    this.documentService = options.documentService;
  }

  setDocumentService(documentService: DocumentService | undefined): void {
    this.documentService = documentService;
  }

  async fetchImageAsBuffer(url: string): Promise<ImageBufferResult> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }

    if (url.startsWith('data:')) {
      const decoded = decodeDataUrl(url);
      this.bufferCache.set(url, decoded);
      return decoded;
    }

    if (isImageElementLoadableUrl(url)) {
      const imgResult = await loadImageAsBuffer(url);
      if (imgResult) {
        const result: ImageBufferResult = {
          buffer: imgResult.buffer,
          contentType: 'image/png',
        };
        this.bufferCache.set(url, result);
        return result;
      }
    }

    if (!this.documentService) {
      throw new Error('DocumentService not available');
    }

    const content = url.startsWith('file://') || isAbsolutePath(url)
      ? await this.documentService.readFile(url, { binary: true })
      : await this.documentService.readRelativeFile(url, { binary: true });

    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const result: ImageBufferResult = {
      buffer: bytes,
      contentType: guessContentType(url),
    };
    this.bufferCache.set(url, result);
    return result;
  }

  async toDataUrl(url: string): Promise<string> {
    if (url.startsWith('data:')) {
      return url;
    }

    if (isImageElementLoadableUrl(url)) {
      const dataUrl = await loadImageAsDataUrl(url);
      if (dataUrl) {
        return dataUrl;
      }
    }

    const { buffer, contentType } = await this.fetchImageAsBuffer(url);
    const mimeType = normalizeContentType(contentType, url);
    return `data:${mimeType};base64,${bytesToBase64(buffer)}`;
  }

  clearCache(): void {
    this.bufferCache.clear();
  }
}

export { guessContentType };
