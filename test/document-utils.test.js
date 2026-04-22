import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import { getCurrentDocumentUrl } from '../src/core/document-utils.ts';

function createDocumentStub() {
  return {
    documentElement: {
      dataset: {},
    },
    location: {
      href: 'https://example.com/viewer.html#section',
    },
  };
}

describe('document-utils', () => {
  beforeEach(() => {
    globalThis.document = createDocumentStub();
  });

  it('should prefer embedded workspace file path over filename-only URL', () => {
    document.documentElement.dataset.viewerFilename = 'demo.slides.md';
    document.documentElement.dataset.viewerFilePath = 'demo/demo.slides.md';

    assert.strictEqual(getCurrentDocumentUrl(), 'file:///demo/demo.slides.md');
  });

  it('should fall back to embedded filename when full path is unavailable', () => {
    document.documentElement.dataset.viewerFilename = 'demo.slides.md';

    assert.strictEqual(getCurrentDocumentUrl(), 'file:///demo.slides.md');
  });

  it('should strip hash from real document location', () => {
    assert.strictEqual(getCurrentDocumentUrl(), 'https://example.com/viewer.html');
  });
});