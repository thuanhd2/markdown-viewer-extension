/**
 * CLI platform stub.
 *
 * Runs inside the headless Playwright page so DocxExporter and its
 * dependencies (theme-manager, resource-embedder) can access
 * `globalThis.platform.*` without needing a browser extension host.
 *
 * The DOCX export path only reads from:
 *   - platform.settings.get()          (export options + themeId)
 *   - platform.resource.fetch()        (theme JSON files)
 *   - platform.resource.getURL()       (theme JSON paths)
 *   - platform.document                (relative file reads for images)
 *
 * Everything else on PlatformAPI is stubbed to satisfy the type.
 */

import type {
  PlatformAPI,
  ReadFileOptions,
} from '../../src/types/platform';
import type {
  ISettingsService,
  SettingKey,
  SettingTypes,
  SetSettingOptions,
} from '../../src/types/settings';
import { DEFAULT_SETTINGS } from '../../src/types/settings';
import { BaseDocumentService } from '../../src/services/document-service';

interface CliPlatformOptions {
  /** Directory containing the input .md file (used to resolve relative paths). */
  documentDir: string;
  /** Overrides for DEFAULT_SETTINGS — e.g. `{ themeId: 'github-dark' }`. */
  settingsOverrides?: Partial<SettingTypes>;
}

class CliSettingsService implements ISettingsService {
  private values: SettingTypes;

  constructor(overrides: Partial<SettingTypes> = {}) {
    this.values = { ...DEFAULT_SETTINGS, ...overrides };
  }

  async get<K extends SettingKey>(key: K): Promise<SettingTypes[K]> {
    return this.values[key];
  }

  async set<K extends SettingKey>(
    key: K,
    value: SettingTypes[K],
    _options?: SetSettingOptions
  ): Promise<void> {
    this.values[key] = value;
  }

  async getAll(): Promise<SettingTypes> {
    return { ...this.values };
  }
}

class CliResourceService {
  getURL(path: string): string {
    // Themes are copied next to the headless.html page — a relative path is
    // enough for fetch() over file://.
    return `./${path}`;
  }

  async fetch(path: string): Promise<string> {
    const url = this.getURL(path);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: HTTP ${response.status}`);
    }
    return response.text();
  }
}

class CliDocumentService extends BaseDocumentService {
  /**
   * The CLI serves the input file's directory over HTTP under `documentDir`
   * (e.g. `/doc/`), so both "absolute" and "relative" paths are resolved via
   * plain fetch() against that same origin.
   */
  async readFile(absolutePath: string, options?: ReadFileOptions): Promise<string> {
    return this.fetchAsContent(absolutePath, options?.binary === true);
  }

  async readRelativeFile(relativePath: string, options?: ReadFileOptions): Promise<string> {
    const absolute = this.resolvePath(relativePath);
    return this.readFile(absolute, options);
  }

  private async fetchAsContent(url: string, binary: boolean): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to read ${url}: HTTP ${response.status}`);
    }
    if (!binary) {
      return response.text();
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < buffer.length; i += chunk) {
      bin += String.fromCharCode(...buffer.subarray(i, Math.min(i + chunk, buffer.length)));
    }
    return btoa(bin);
  }
}

/**
 * Install a stub PlatformAPI onto globalThis so DocxExporter can run.
 */
export function installCliPlatform(options: CliPlatformOptions): void {
  const settings = new CliSettingsService(options.settingsOverrides);
  const resource = new CliResourceService();
  const document = new CliDocumentService();
  document.setDocumentPath(options.documentDir.endsWith('/')
    ? `${options.documentDir}document.md`
    : `${options.documentDir}/document.md`);

  const notAvailable = (name: string) => () => {
    throw new Error(`platform.${name} is not implemented in the CLI stub`);
  };

  const stub: PlatformAPI = {
    platform: 'chrome',
    settings,
    resource,
    document,
    // The following services are not exercised by exportToDocxBlob; they exist
    // solely to satisfy the PlatformAPI shape.
    cache: {
      init: async () => {},
      calculateHash: notAvailable('cache.calculateHash'),
      generateKey: notAvailable('cache.generateKey'),
      get: async () => null,
      set: async () => false,
      clear: async () => true,
      getStats: async () => null,
    },
    renderer: {
      init: async () => {},
      setThemeConfig: () => {},
      getThemeConfig: () => null,
      render: notAvailable('renderer.render'),
    },
    storage: {
      get: async () => ({}),
      set: async () => {},
      remove: async () => {},
    },
    file: {
      download: notAvailable('file.download'),
    },
    fileState: {
      get: async () => ({}),
      set: () => {},
      clear: async () => {},
    },
    i18n: {
      translate: (key: string) => key,
      getUILanguage: () => 'en',
    },
    message: {
      send: notAvailable('message.send'),
      addListener: () => {},
    },
  };

  (globalThis as unknown as { platform: PlatformAPI }).platform = stub;
}
