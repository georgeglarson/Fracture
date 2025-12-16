/**
 * Toast Notification System
 * Provides non-blocking notifications for errors, warnings, info, and success messages
 */

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastOptions {
  duration?: number;      // ms, 0 = persistent until dismissed
  dismissible?: boolean;  // show X button
  action?: {
    label: string;
    callback: () => void;
  };
}

interface Toast {
  id: number;
  element: HTMLDivElement;
  timeout?: number;
}

const TOAST_ICONS: Record<ToastType, string> = {
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
  success: '✓'
};

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  error: { bg: 'rgba(180, 40, 40, 0.95)', border: '#ff4444', icon: '#ff6666' },
  warning: { bg: 'rgba(180, 140, 40, 0.95)', border: '#ffaa00', icon: '#ffcc44' },
  info: { bg: 'rgba(40, 100, 180, 0.95)', border: '#4488ff', icon: '#66aaff' },
  success: { bg: 'rgba(40, 140, 80, 0.95)', border: '#44cc66', icon: '#66ee88' }
};

export class ToastManager {
  private container: HTMLDivElement | null = null;
  private toasts: Toast[] = [];
  private nextId = 0;

  constructor() {
    this.createContainer();
    this.injectStyles();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-width: 400px;
    `;
    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    if (document.getElementById('toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      .toast {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 6px;
        border-left: 4px solid;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: #fff;
        pointer-events: auto;
        transform: translateX(120%);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }

      .toast.show {
        transform: translateX(0);
        opacity: 1;
      }

      .toast.hide {
        transform: translateX(120%);
        opacity: 0;
      }

      .toast-icon {
        font-size: 18px;
        font-weight: bold;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.2);
      }

      .toast-content {
        flex: 1;
        line-height: 1.4;
      }

      .toast-title {
        font-weight: bold;
        margin-bottom: 4px;
      }

      .toast-message {
        opacity: 0.9;
      }

      .toast-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin: -4px -4px -4px 8px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .toast-close:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }

      .toast-action {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #fff;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        margin-top: 8px;
        transition: all 0.2s ease;
      }

      .toast-action:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: rgba(255, 255, 255, 0.4);
        border-radius: 0 0 0 6px;
        transition: width linear;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show a toast notification
   */
  show(
    type: ToastType,
    message: string,
    title?: string,
    options: ToastOptions = {}
  ): number {
    const {
      duration = type === 'error' ? 6000 : 4000,
      dismissible = true,
      action
    } = options;

    const id = this.nextId++;
    const colors = TOAST_COLORS[type];
    const icon = TOAST_ICONS[type];

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = colors.bg;
    toast.style.borderColor = colors.border;

    let html = `
      <div class="toast-icon" style="color: ${colors.icon}">${icon}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
        ${action ? `<button class="toast-action">${action.label}</button>` : ''}
      </div>
    `;

    if (dismissible) {
      html += `<button class="toast-close">×</button>`;
    }

    if (duration > 0) {
      html += `<div class="toast-progress" style="width: 100%;"></div>`;
    }

    toast.innerHTML = html;

    // Event listeners
    if (dismissible) {
      const closeBtn = toast.querySelector('.toast-close');
      closeBtn?.addEventListener('click', () => this.dismiss(id));
    }

    if (action) {
      const actionBtn = toast.querySelector('.toast-action');
      actionBtn?.addEventListener('click', () => {
        action.callback();
        this.dismiss(id);
      });
    }

    // Add to container
    this.container?.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Start progress bar animation
    if (duration > 0) {
      const progress = toast.querySelector('.toast-progress') as HTMLElement;
      if (progress) {
        progress.style.transitionDuration = `${duration}ms`;
        requestAnimationFrame(() => {
          progress.style.width = '0%';
        });
      }
    }

    // Auto dismiss
    let timeoutId: number | undefined;
    if (duration > 0) {
      timeoutId = window.setTimeout(() => this.dismiss(id), duration);
    }

    this.toasts.push({ id, element: toast, timeout: timeoutId });

    return id;
  }

  /**
   * Dismiss a toast by ID
   */
  dismiss(id: number): void {
    const index = this.toasts.findIndex(t => t.id === id);
    if (index === -1) return;

    const toast = this.toasts[index];
    if (toast.timeout) {
      clearTimeout(toast.timeout);
    }

    toast.element.classList.remove('show');
    toast.element.classList.add('hide');

    setTimeout(() => {
      toast.element.remove();
    }, 300);

    this.toasts.splice(index, 1);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    [...this.toasts].forEach(t => this.dismiss(t.id));
  }

  // Convenience methods
  error(message: string, title?: string, options?: ToastOptions): number {
    return this.show('error', message, title, options);
  }

  warning(message: string, title?: string, options?: ToastOptions): number {
    return this.show('warning', message, title, options);
  }

  info(message: string, title?: string, options?: ToastOptions): number {
    return this.show('info', message, title, options);
  }

  success(message: string, title?: string, options?: ToastOptions): number {
    return this.show('success', message, title, options);
  }
}

// Singleton instance
let toastManager: ToastManager | null = null;

export function getToastManager(): ToastManager {
  if (!toastManager) {
    toastManager = new ToastManager();
  }
  return toastManager;
}

// Global convenience functions
export function showToast(type: ToastType, message: string, title?: string, options?: ToastOptions): number {
  return getToastManager().show(type, message, title, options);
}

export function showError(message: string, title?: string, options?: ToastOptions): number {
  return getToastManager().error(message, title, options);
}

export function showWarning(message: string, title?: string, options?: ToastOptions): number {
  return getToastManager().warning(message, title, options);
}

export function showInfo(message: string, title?: string, options?: ToastOptions): number {
  return getToastManager().info(message, title, options);
}

export function showSuccess(message: string, title?: string, options?: ToastOptions): number {
  return getToastManager().success(message, title, options);
}

export function dismissToast(id: number): void {
  getToastManager().dismiss(id);
}

export function dismissAllToasts(): void {
  getToastManager().dismissAll();
}
