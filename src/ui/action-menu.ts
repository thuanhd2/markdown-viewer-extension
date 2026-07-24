export interface ActionMenuItem {
  label: string;
  onSelect?: () => void | Promise<void>;
  disabled?: boolean;
  title?: string;
  separator?: boolean;
}

export interface ActionMenuHandle {
  hide: () => void;
  isVisible: () => boolean;
}

export interface ShowActionMenuOptions {
  items: ActionMenuItem[];
  anchor?: HTMLElement;
  x?: number;
  y?: number;
  className?: string;
  rightAligned?: boolean;
  rightMargin?: number;
  container?: HTMLElement;
}

let cssInjected = false;
let activeCleanup: (() => void) | null = null;

function injectCSS(): void {
  if (cssInjected) {
    return;
  }
  cssInjected = true;

  const style = document.createElement('style');
  style.textContent = `
.mv-action-menu {
  position: fixed;
  z-index: 10000;
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  width: auto;
  min-width: 0;
  max-width: min(calc(100vw - 16px), 320px);
  padding: 4px 0;
  background: var(--color-bg-surface, #ffffff);
  color: var(--color-text-primary, #1a1a1a);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  box-shadow: var(--shadow-popover, 0 2px 8px rgba(0, 0, 0, 0.15));
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.mv-action-menu button {
  -webkit-appearance: none;
  appearance: none;
  outline: none;
  box-shadow: none;
  text-transform: none;
}

.mv-action-menu-item {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 6px 24px 6px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  white-space: nowrap;
  box-sizing: border-box;
  font: inherit;
  cursor: pointer;
}

.mv-action-menu-item:hover:not(:disabled) {
  background: var(--color-nav-active-bg, #eff6ff);
  color: var(--color-nav-active-text, #2563eb);
}

.mv-action-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mv-action-menu-separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--color-border, #e2e8f0);
}

.mv-action-menu.mv-action-menu-panel {
  width: 240px;
  min-width: 240px;
  max-width: min(calc(100vw - 16px), 320px);
  padding: 6px;
  background: var(--color-bg-surface, #ffffff);
  color: var(--color-text-primary, #0f172a);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  box-shadow: var(--shadow-popover, 0 2px 8px rgba(0, 0, 0, 0.15));
  font-size: 12px;
  font-family: inherit;
}

.mv-action-menu.mv-action-menu-panel .mv-action-menu-item {
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.4;
}

.mv-action-menu.mv-action-menu-panel .mv-action-menu-item:hover:not(:disabled),
.mv-action-menu.mv-action-menu-panel .mv-action-menu-item:focus-visible:not(:disabled) {
  background: var(--gray-100, #f3f4f6);
  color: var(--color-text-primary, #0f172a);
}

.mv-action-menu.mv-action-menu-panel .mv-action-menu-item:active:not(:disabled) {
  border-left-color: var(--color-nav-active-border, #2563eb);
  background: var(--color-nav-active-bg, #eff6ff);
  color: var(--color-nav-active-text, #2563eb);
}

.mv-action-menu.mv-action-menu-panel .mv-action-menu-separator {
  margin: 6px 4px;
  background: var(--color-border, #e2e8f0);
}
`;
  document.head.appendChild(style);
}

function clampPosition(menu: HTMLElement, left: number, top: number): void {
  const rect = menu.getBoundingClientRect();
  const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
  const maxTop = Math.max(8, window.innerHeight - rect.height - 8);

  menu.style.left = `${Math.min(Math.max(8, left), maxLeft)}px`;
  menu.style.top = `${Math.min(Math.max(8, top), maxTop)}px`;
}

export function showActionMenu(options: ShowActionMenuOptions): ActionMenuHandle {
  injectCSS();
  activeCleanup?.();

  const menu = document.createElement('div');
  menu.className = 'mv-action-menu';
  if (options.className) {
    options.className
      .split(/\s+/)
      .filter(Boolean)
      .forEach((className) => menu.classList.add(className));
  }
  menu.setAttribute('role', 'menu');

  const items = options.items.filter((item) => item.separator || item.label);
  for (const item of items) {
    if (item.separator) {
      const separator = document.createElement('div');
      separator.className = 'mv-action-menu-separator';
      menu.appendChild(separator);
      continue;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mv-action-menu-item';
    button.textContent = item.label;
    button.disabled = Boolean(item.disabled);
    button.title = item.title || '';
    button.setAttribute('role', 'menuitem');
    button.addEventListener('click', async () => {
      if (item.disabled) {
        return;
      }
      cleanup();
      await item.onSelect?.();
    });
    menu.appendChild(button);
  }

  (options.container || document.body).appendChild(menu);

  let left = options.x ?? 8;
  let top = options.y ?? 8;
  if (options.rightAligned) {
    const resolvedTop = Number.isFinite(top) ? top : 8;
    const resolvedRight = Math.max(8, options.rightMargin ?? 13);
    menu.style.position = 'fixed';
    menu.style.setProperty('top', `${resolvedTop}px`, 'important');
    menu.style.setProperty('left', 'auto', 'important');
    menu.style.setProperty('right', `${resolvedRight}px`, 'important');
  } else if (options.anchor) {
    const rect = options.anchor.getBoundingClientRect();
    left = rect.right - menu.getBoundingClientRect().width;
    top = rect.bottom + 6;
    clampPosition(menu, left, top);
  } else {
    clampPosition(menu, left, top);
  }

  const onPointerDown = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (target && !menu.contains(target)) {
      cleanup();
    }
  };
  const onScroll = () => cleanup();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      cleanup();
    }
  };

  document.addEventListener('mousedown', onPointerDown, true);
  document.addEventListener('scroll', onScroll, true);
  document.addEventListener('keydown', onKeyDown, true);

  function cleanup(): void {
    if (!menu.isConnected) {
      return;
    }
    menu.remove();
    document.removeEventListener('mousedown', onPointerDown, true);
    document.removeEventListener('scroll', onScroll, true);
    document.removeEventListener('keydown', onKeyDown, true);
    if (activeCleanup === cleanup) {
      activeCleanup = null;
    }
  }

  activeCleanup = cleanup;

  return {
    hide: cleanup,
    isVisible: () => menu.isConnected,
  };
}