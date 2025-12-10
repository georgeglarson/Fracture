/**
 * ContextMenu - Right-click menu for player interactions
 * Single Responsibility: Display context menu for entity interactions
 */

export interface ContextMenuOption {
  label: string;
  action: () => void;
  disabled?: boolean;
}

export interface ContextMenuCallbacks {
  onInspect: (entityId: number) => void;
  onInvite: (playerId: number) => void;
}

export class ContextMenu {
  private callbacks: ContextMenuCallbacks | null = null;
  private isInParty: () => boolean = () => false;

  constructor() {
    // Close menu on any click outside
    document.addEventListener('click', () => this.hide());
    document.addEventListener('contextmenu', (e) => {
      // Don't close if right-clicking on canvas (we'll handle that separately)
      const target = e.target as HTMLElement;
      if (!target.closest('#container')) {
        this.hide();
      }
    });
  }

  /**
   * Set callback handlers
   */
  setCallbacks(callbacks: ContextMenuCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set party status checker
   */
  setPartyStatusChecker(checker: () => boolean): void {
    this.isInParty = checker;
  }

  /**
   * Show context menu for a player
   */
  showForPlayer(playerId: number, playerName: string, x: number, y: number): void {
    const options: ContextMenuOption[] = [
      {
        label: 'Inspect',
        action: () => {
          if (this.callbacks) {
            this.callbacks.onInspect(playerId);
          }
        }
      }
    ];

    // Only show invite option if not already in a party
    if (!this.isInParty()) {
      options.push({
        label: 'Invite to Party',
        action: () => {
          if (this.callbacks) {
            this.callbacks.onInvite(playerId);
          }
        }
      });
    }

    this.render(options, x, y, playerName);
  }

  /**
   * Render the context menu
   */
  private render(options: ContextMenuOption[], x: number, y: number, title?: string): void {
    // Remove existing menu
    this.hide();

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      min-width: 140px;
      background: rgba(40, 40, 50, 0.95);
      border: 1px solid #555;
      border-radius: 6px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
      z-index: 10001;
      font-family: Arial, sans-serif;
      font-size: 13px;
      overflow: hidden;
    `;

    let html = '';

    // Optional title
    if (title) {
      html += `
        <div style="
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid #444;
          color: #ddd;
          font-weight: bold;
          font-size: 12px;
        ">${title}</div>
      `;
    }

    // Menu options
    options.forEach((option, index) => {
      html += `
        <div class="context-menu-option" data-index="${index}" style="
          padding: 8px 12px;
          color: ${option.disabled ? '#666' : '#fff'};
          cursor: ${option.disabled ? 'default' : 'pointer'};
          transition: background 0.15s;
        ">${option.label}</div>
      `;
    });

    menu.innerHTML = html;
    document.body.appendChild(menu);

    // Adjust position if menu would go off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }

    // Add hover effects and click handlers
    const optionElements = menu.querySelectorAll('.context-menu-option');
    optionElements.forEach((el, index) => {
      const option = options[index];
      if (!option.disabled) {
        el.addEventListener('mouseenter', () => {
          (el as HTMLElement).style.background = 'rgba(74, 124, 74, 0.5)';
        });
        el.addEventListener('mouseleave', () => {
          (el as HTMLElement).style.background = 'transparent';
        });
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          option.action();
          this.hide();
        });
      }
    });
  }

  /**
   * Hide the context menu
   */
  hide(): void {
    const menu = document.getElementById('context-menu');
    if (menu) {
      menu.remove();
    }
  }

  /**
   * Check if menu is visible
   */
  isVisible(): boolean {
    return document.getElementById('context-menu') !== null;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.hide();
  }
}
