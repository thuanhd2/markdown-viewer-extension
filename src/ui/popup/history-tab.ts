/**
 * History tab management for popup
 */

import { isPlatform } from '../../utils/platform-info';
import { translate, getUiLocale } from './i18n-helpers';
import { storageGet, storageSet } from './storage-helper';

/**
 * History item interface
 */
interface HistoryItem {
  url: string;
  title: string;
  lastAccess?: number;
}

interface WorkspaceHistoryTarget {
  workspaceName: string;
  filePath: string;
}

const WORKSPACE_HISTORY_PROTOCOL = 'mdv-workspace:';
const PENDING_WORKSPACE_OPEN_KEY = 'markdownViewerPendingWorkspaceOpen';

/**
 * History tab manager options
 */
interface HistoryTabManagerOptions {
  showMessage: (text: string, type: 'success' | 'error' | 'info') => void;
  showConfirm: (title: string, message: string) => Promise<boolean>;
}

/**
 * History tab manager interface
 */
export interface HistoryTabManager {
  loadHistoryData: () => Promise<void>;
  clearHistory: () => Promise<void>;
  extractFileName: (url: string) => string;
}

/**
 * Create a history tab manager
 * @param options - Configuration options
 * @returns History tab manager instance
 */
export function createHistoryTabManager({ showMessage, showConfirm }: HistoryTabManagerOptions): HistoryTabManager {
  function parseWorkspaceHistoryUrl(url: string): WorkspaceHistoryTarget | null {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== WORKSPACE_HISTORY_PROTOCOL) {
        return null;
      }

      const workspaceName = parsed.searchParams.get('name') || '';
      const filePath = parsed.searchParams.get('path') || '';
      if (!workspaceName || !filePath) {
        return null;
      }

      return { workspaceName, filePath };
    } catch {
      return null;
    }
  }

  function getHistorySubtitle(url: string): string {
    const workspaceTarget = parseWorkspaceHistoryUrl(url);
    if (workspaceTarget) {
      return `${workspaceTarget.workspaceName}/${workspaceTarget.filePath}`;
    }

    return url;
  }

  async function removeHistoryItem(url: string): Promise<void> {
    const result = await storageGet(['markdownHistory']);
    const history = (result.markdownHistory || []) as HistoryItem[];
    const nextHistory = history.filter((item) => item.url !== url);

    await storageSet({ markdownHistory: nextHistory });
  }

  /**
   * Extract filename from URL
   * @param url - URL to extract filename from
   * @returns Extracted filename
   */
  function extractFileName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = pathname.split('/').pop() || '';
      return decodeURIComponent(fileName);
    } catch {
      return url;
    }
  }

  /**
   * Load history data from storage
   */
  async function loadHistoryData(): Promise<void> {
    const itemsEl = document.getElementById('history-items') as HTMLElement | null;
    if (!itemsEl) {
      return;
    }

    // Clear existing items
    itemsEl.querySelectorAll('[data-cache-item="dynamic"]').forEach((element) => {
      element.remove();
    });
    itemsEl.dataset.empty = 'false';

    try {
      const result = await storageGet(['markdownHistory']);
      const history = (result.markdownHistory || []) as HistoryItem[];

      renderHistoryItems(history);
    } catch (error) {
      console.error('Failed to load history data:', error);
      showMessage(translate('history_loading_failed'), 'error');
    }
  }

  /**
   * Render history items list
   * @param items - History items array
   */
  function renderHistoryItems(items: HistoryItem[]): void {
    const itemsEl = document.getElementById('history-items') as HTMLElement | null;
    const template = document.getElementById('history-item-template') as HTMLTemplateElement | null;

    if (!itemsEl || !template) {
      return;
    }

    if (items.length === 0) {
      itemsEl.dataset.empty = 'true';
      return;
    }

    itemsEl.dataset.empty = 'false';

    const accessedLabel = translate('cache_item_accessed_label');
    const removeLabel = translate('remove_from_list');
    const locale = getUiLocale();
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const historyItemEl = (template.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
      historyItemEl.dataset.cacheItem = 'dynamic';
      historyItemEl.dataset.url = item.url;

      const urlEl = historyItemEl.querySelector('.history-item-url');
      const titleEl = historyItemEl.querySelector('.history-item-title');
      const accessedEl = historyItemEl.querySelector('.history-item-accessed');
      const removeBtn = historyItemEl.querySelector('.history-item-remove') as HTMLButtonElement | null;

      if (urlEl) {
        urlEl.textContent = item.title;
      }

      if (titleEl) {
        titleEl.textContent = getHistorySubtitle(item.url);
      }

      if (accessedEl && item.lastAccess) {
        accessedEl.textContent = `${accessedLabel}: ${new Date(item.lastAccess).toLocaleString(locale)}`;
      }

      if (removeBtn) {
        removeBtn.title = removeLabel;
        removeBtn.setAttribute('aria-label', removeLabel);
        removeBtn.addEventListener('click', async (event) => {
          event.stopPropagation();

          try {
            await removeHistoryItem(item.url);
            await loadHistoryData();
          } catch (error) {
            console.error('Failed to remove history item:', error);
            showMessage(translate('history_clear_failed'), 'error');
          }
        });
      }

      // Add click handler to open the document
      historyItemEl.addEventListener('click', async () => {
        try {
          const workspaceTarget = parseWorkspaceHistoryUrl(item.url);
          if (workspaceTarget) {
            await storageSet({
              [PENDING_WORKSPACE_OPEN_KEY]: {
                workspaceName: workspaceTarget.workspaceName,
                filePath: workspaceTarget.filePath,
                requestedAt: Date.now(),
              },
            });
            chrome.tabs.create({ url: chrome.runtime.getURL('ui/workspace/workspace.html') });
            window.close();
            return;
          }

          const isFileUrl = item.url.startsWith('file://');
          
          // Firefox cannot open file:// URLs from extension context due to security restrictions
          if (isPlatform('firefox') && isFileUrl) {
            // Copy URL to clipboard and show message
            await navigator.clipboard.writeText(item.url);
            showMessage(translate('file_url_copied') || 'URL copied. Paste in address bar to open.', 'info');
            return;
          }
          
          // For http/https URLs or Chrome, open normally
          window.open(item.url, '_blank');
          window.close();
        } catch (error) {
          console.error('Failed to open document:', error);
          showMessage(translate('history_open_failed'), 'error');
        }
      });

      fragment.appendChild(historyItemEl);
    });

    itemsEl.appendChild(fragment);
  }

  /**
   * Clear all history with confirmation
   */
  async function clearHistory(): Promise<void> {
    const confirmMessage = translate('history_clear_confirm');
    const confirmed = await showConfirm(translate('history_clear'), confirmMessage);

    if (!confirmed) {
      return;
    }

    try {
      await storageSet({ markdownHistory: [] });
      await loadHistoryData();
      showMessage(translate('history_clear_success'), 'success');
    } catch (error) {
      console.error('Failed to clear history:', error);
      showMessage(translate('history_clear_failed'), 'error');
    }
  }

  return {
    loadHistoryData,
    clearHistory,
    extractFileName
  };
}
