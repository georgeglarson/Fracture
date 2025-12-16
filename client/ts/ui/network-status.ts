/**
 * Network Status Overlay
 * Shows connection state (connecting, reconnecting, disconnected)
 */

export type NetworkState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

export class NetworkStatusOverlay {
  private overlay: HTMLDivElement | null = null;
  private state: NetworkState = 'connected';
  private reconnectAttempt = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.createOverlay();
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'network-status-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      z-index: 99998;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      color: #fff;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    this.overlay.innerHTML = `
      <div class="network-status-content" style="text-align: center;">
        <div class="network-spinner" style="
          width: 50px;
          height: 50px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: #61C3FF;
          border-radius: 50%;
          margin: 0 auto 24px;
          animation: network-spin 1s linear infinite;
        "></div>
        <div class="network-title" style="
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 12px;
        ">Connecting...</div>
        <div class="network-message" style="
          font-size: 14px;
          color: rgba(255,255,255,0.7);
          margin-bottom: 20px;
        ">Please wait while we establish connection</div>
        <div class="network-attempt" style="
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          display: none;
        ">Attempt <span class="attempt-num">1</span> of <span class="attempt-max">5</span></div>
        <button class="network-retry" style="
          display: none;
          margin-top: 24px;
          padding: 12px 32px;
          background: #61C3FF;
          border: none;
          border-radius: 6px;
          color: #000;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s ease;
        ">Retry Connection</button>
        <button class="network-reload" style="
          display: none;
          margin-top: 12px;
          padding: 10px 24px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 6px;
          color: rgba(255,255,255,0.7);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        ">Reload Page</button>
      </div>
      <style>
        @keyframes network-spin {
          to { transform: rotate(360deg); }
        }
        .network-retry:hover {
          background: #8ad4ff;
          transform: scale(1.05);
        }
        .network-reload:hover {
          border-color: rgba(255,255,255,0.6);
          color: #fff;
        }
      </style>
    `;

    // Event listeners
    const retryBtn = this.overlay.querySelector('.network-retry') as HTMLButtonElement;
    const reloadBtn = this.overlay.querySelector('.network-reload') as HTMLButtonElement;

    retryBtn?.addEventListener('click', () => {
      if (this.onRetry) this.onRetry();
    });

    reloadBtn?.addEventListener('click', () => {
      window.location.reload();
    });

    document.body.appendChild(this.overlay);
  }

  private onRetry: (() => void) | null = null;

  /**
   * Set retry callback
   */
  setRetryCallback(callback: () => void): void {
    this.onRetry = callback;
  }

  /**
   * Show connecting state
   */
  showConnecting(): void {
    this.state = 'connecting';
    this.updateUI('Connecting...', 'Establishing connection to server', false);
    this.show();
  }

  /**
   * Show reconnecting state
   */
  showReconnecting(attempt: number, maxAttempts: number = 5): void {
    this.state = 'reconnecting';
    this.reconnectAttempt = attempt;
    this.maxReconnectAttempts = maxAttempts;

    this.updateUI(
      'Connection Lost',
      'Attempting to reconnect...',
      true
    );
    this.show();
  }

  /**
   * Show disconnected state (all attempts failed)
   */
  showDisconnected(): void {
    this.state = 'disconnected';
    this.updateUI(
      'Disconnected',
      'Unable to connect to server',
      false,
      true
    );
    this.show();
  }

  /**
   * Hide overlay (connected successfully)
   */
  hide(): void {
    if (!this.overlay) return;
    this.state = 'connected';

    this.overlay.style.opacity = '0';
    setTimeout(() => {
      if (this.overlay) {
        this.overlay.style.display = 'none';
      }
    }, 300);
  }

  private show(): void {
    if (!this.overlay) return;

    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
      }
    });
  }

  private updateUI(
    title: string,
    message: string,
    showAttempts: boolean,
    showButtons: boolean = false
  ): void {
    if (!this.overlay) return;

    const titleEl = this.overlay.querySelector('.network-title') as HTMLElement;
    const messageEl = this.overlay.querySelector('.network-message') as HTMLElement;
    const attemptEl = this.overlay.querySelector('.network-attempt') as HTMLElement;
    const attemptNum = this.overlay.querySelector('.attempt-num') as HTMLElement;
    const attemptMax = this.overlay.querySelector('.attempt-max') as HTMLElement;
    const spinner = this.overlay.querySelector('.network-spinner') as HTMLElement;
    const retryBtn = this.overlay.querySelector('.network-retry') as HTMLElement;
    const reloadBtn = this.overlay.querySelector('.network-reload') as HTMLElement;

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    if (attemptEl) {
      attemptEl.style.display = showAttempts ? 'block' : 'none';
    }
    if (attemptNum) attemptNum.textContent = String(this.reconnectAttempt);
    if (attemptMax) attemptMax.textContent = String(this.maxReconnectAttempts);

    if (spinner) {
      spinner.style.display = showButtons ? 'none' : 'block';
    }
    if (retryBtn) {
      retryBtn.style.display = showButtons ? 'block' : 'none';
    }
    if (reloadBtn) {
      reloadBtn.style.display = showButtons ? 'block' : 'none';
    }
  }

  /**
   * Get current state
   */
  getState(): NetworkState {
    return this.state;
  }
}

// Singleton
let networkStatus: NetworkStatusOverlay | null = null;

export function getNetworkStatus(): NetworkStatusOverlay {
  if (!networkStatus) {
    networkStatus = new NetworkStatusOverlay();
  }
  return networkStatus;
}
