// GitBook Navigation Panel Manager
// Handles GitBook SUMMARY.md discovery and navigation panel functionality

interface FileState {
  gitbookPanelVisible?: boolean;
  [key: string]: unknown;
}

type SaveFileStateFunction = (state: FileState) => void;
type GetFileStateFunction = () => Promise<FileState>;

interface GitbookPanelOptions {
  currentUrl?: string;
  readRelativeFile?: (relativePath: string) => Promise<string>;
  onNavigateFile?: (url: string, content: string) => Promise<void>;
}

interface GitbookNavItem {
  title: string;
  href: string;
  depth: number;
}

interface GitbookPanel {
  generateGitbookPanel(): Promise<void>;
  setupGitbookPanelToggle(): () => void;
  setupResponsivePanel(): Promise<void>;
}

const gitbookDebugPrefix = '[GitBookNav]';

function logDebug(message: string, ...args: unknown[]): void {
  console.debug(gitbookDebugPrefix, message, ...args);
}

function isMarkdownDocumentUrl(url: string): boolean {
  try {
    const pathname = new URL(url, window.location.href).pathname.toLowerCase();
    return pathname.endsWith('.md') || pathname.endsWith('.markdown');
  } catch {
    return false;
  }
}

function normalizeSummaryLinkTarget(rawLink: string): string {
  const trimmed = rawLink.trim();
  const angleWrapped = trimmed.startsWith('<') && trimmed.endsWith('>')
    ? trimmed.slice(1, -1)
    : trimmed;
  return angleWrapped.split('#')[0].split('?')[0].trim();
}

function parseGitbookSummary(summaryContent: string, summaryUrl: string): GitbookNavItem[] {
  const items: GitbookNavItem[] = [];
  const lines = summaryContent.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^(\s*)(?:[-*+]|\d+\.)\s+\[([^\]]+)\]\(([^)]+)\)\s*$/);
    if (!match) {
      continue;
    }

    const indent = match[1] || '';
    const title = match[2].trim();
    const target = normalizeSummaryLinkTarget(match[3]);
    if (!target || /^(?:mailto:|javascript:|#)/i.test(target)) {
      continue;
    }

    let href = '';
    try {
      href = new URL(target, summaryUrl).href;
    } catch {
      continue;
    }

    const depth = Math.floor(indent.replace(/\t/g, '  ').length / 2);
    items.push({ title, href, depth });
  }

  return items;
}

async function readSummaryByRelativePath(
  relativePath: string,
  currentUrl: string,
  readRelativeFile?: (relativePath: string) => Promise<string>
): Promise<{ summaryUrl: string; content: string } | null> {
  try {
    const summaryUrl = new URL(relativePath, currentUrl).href;
    logDebug('Trying summary candidate', { relativePath, summaryUrl });

    if (readRelativeFile) {
      try {
        const content = await readRelativeFile(relativePath);
        logDebug('Summary loaded via readRelativeFile', { summaryUrl, length: content.length });
        return { summaryUrl, content };
      } catch (error) {
        logDebug('readRelativeFile failed, fallback to fetch', {
          summaryUrl,
          error: (error as Error).message,
        });
      }
    }

    const response = await fetch(summaryUrl);
    if (!response.ok) {
      logDebug('Summary fetch not ok', { summaryUrl, status: response.status });
      return null;
    }

    const content = await response.text();
    logDebug('Summary loaded via fetch', { summaryUrl, length: content.length });
    return { summaryUrl, content };
  } catch (error) {
    logDebug('Summary candidate failed', { relativePath, error: (error as Error).message });
    return null;
  }
}

async function loadGitbookNavigation(
  currentUrl: string,
  readRelativeFile?: (relativePath: string) => Promise<string>
): Promise<GitbookNavItem[] | null> {
  if (!isMarkdownDocumentUrl(currentUrl)) {
    logDebug('Skip GitBook discovery for non-markdown URL', { currentUrl });
    return null;
  }

  let depth = 0;
  while (depth <= 20) {
    const relativePath = `${'../'.repeat(depth)}SUMMARY.md`;
    const loaded = await readSummaryByRelativePath(relativePath, currentUrl, readRelativeFile);
    if (loaded) {
      const navItems = parseGitbookSummary(loaded.content, loaded.summaryUrl);
      logDebug('Summary parsed', {
        summaryUrl: loaded.summaryUrl,
        itemCount: navItems.length,
      });
      if (navItems.length > 0) {
        return navItems;
      }
    }

    depth += 1;
  }

  logDebug('No SUMMARY.md found while walking upward', { currentUrl });
  return null;
}

function markActiveGitbookItem(panelDiv: HTMLElement): void {
  const currentHref = window.location.href;
  const currentWithoutHash = currentHref.split('#')[0];

  panelDiv.querySelectorAll('a').forEach((link) => {
    const href = (link as HTMLAnchorElement).getAttribute('data-href') || '';
    const hrefWithoutHash = href.split('#')[0];
    if (href === currentHref || hrefWithoutHash === currentWithoutHash) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Creates a GitBook panel manager for handling GitBook SUMMARY.md navigation.
 * @param saveFileState - Function to save file state
 * @param getFileState - Function to get file state
 * @param isMobile - Whether the client is mobile
 * @param options - Configuration options
 * @returns GitBook panel manager instance
 */
export function createGitbookPanel(
  saveFileState: SaveFileStateFunction,
  getFileState: GetFileStateFunction,
  isMobile: boolean,
  options: GitbookPanelOptions = {}
): GitbookPanel {
  async function applySavedPanelVisibilityState(panelDiv: HTMLElement): Promise<void> {
    const savedState = await getFileState();

    let shouldBeVisible: boolean;
    if (savedState.gitbookPanelVisible !== undefined) {
      shouldBeVisible = savedState.gitbookPanelVisible;
    } else {
      shouldBeVisible = !isMobile;
    }

    const currentlyVisible = !panelDiv.classList.contains('hidden');
    if (shouldBeVisible === currentlyVisible) {
      return;
    }

    if (!shouldBeVisible) {
      panelDiv.classList.add('hidden');
      return;
    }

    panelDiv.classList.remove('hidden');
  }

  async function renderGitbookPanelIfAvailable(panelDiv: HTMLElement): Promise<boolean> {
    const currentUrl = options.currentUrl || window.location.href;
    const navItems = await loadGitbookNavigation(currentUrl, options.readRelativeFile);
    if (!navItems || navItems.length === 0) {
      logDebug('No GitBook items found, keeping panel hidden');
      panelDiv.classList.add('hidden');
      return false;
    }

    // Build TOC style list structure
    let panelHTML = '<ul class="gitbook-nav-list">';
    for (const item of navItems) {
      const escapedTitle = item.title
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const escapedHref = item.href.replace(/"/g, '&quot;');
      const indent = item.depth * 20;
      panelHTML += `<li style="margin-left: ${indent}px"><a href="${escapedHref}" data-href="${escapedHref}" data-title="${escapedTitle}">${escapedTitle}</a></li>`;
    }
    panelHTML += '</ul>';
    panelDiv.innerHTML = panelHTML;
    panelDiv.classList.remove('hidden');

    // Setup click handlers for file navigation (no page refresh)
    panelDiv.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        const href = (link as HTMLElement).getAttribute('data-href');
        const title = (link as HTMLElement).getAttribute('data-title');
        if (!href) {
          return;
        }
        logDebug('Navigate via GitBook panel', { href, title });
        
        try {
          // Fetch file content
          const response = await fetch(href);
          if (!response.ok) {
            console.error('Failed to fetch file:', response.status);
            return;
          }
          const content = await response.text();
          
          // Update browser history
          history.pushState({ url: href }, title || '', href);
          
          // Call navigation callback if provided
          if (options.onNavigateFile) {
            await options.onNavigateFile(href, content);
          }
          
          // Mark active item
          panelDiv.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
        } catch (error) {
          console.error('Navigation failed:', error);
        }
      });
    });

    markActiveGitbookItem(panelDiv);
    await applySavedPanelVisibilityState(panelDiv);
    logDebug('Rendered GitBook panel', { itemCount: navItems.length });
    return true;
  }

  function setupGitbookPanelToggle(): () => void {
    return async () => {
      const panelDiv = document.getElementById('gitbook-panel');
      if (!panelDiv) {
        return;
      }

      const isHidden = panelDiv.classList.contains('hidden');
      if (isHidden) {
        panelDiv.classList.remove('hidden');
        saveFileState({ gitbookPanelVisible: true });
      } else {
        panelDiv.classList.add('hidden');
        saveFileState({ gitbookPanelVisible: false });
      }
    };
  }

  async function generateGitbookPanel(): Promise<void> {
    const panelDiv = document.getElementById('gitbook-panel');
    if (!panelDiv) {
      logDebug('GitBook panel container not found');
      return;
    }

    await renderGitbookPanelIfAvailable(panelDiv);
  }

  async function setupResponsivePanel(): Promise<void> {
    const panelDiv = document.getElementById('gitbook-panel');
    if (!panelDiv) {
      return;
    }

    // On mobile, hide by default unless explicitly shown
    if (isMobile) {
      const savedState = await getFileState();
      if (savedState.gitbookPanelVisible !== true) {
        panelDiv.classList.add('hidden');
      }
    }
  }

  return {
    generateGitbookPanel,
    setupGitbookPanelToggle,
    setupResponsivePanel,
  };
}
