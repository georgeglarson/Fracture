/**
 * UIManager - Handles narrator text, newspaper overlays, and notifications
 * Single Responsibility: Manage in-game UI overlays and notifications
 */

export type NarratorStyle = 'epic' | 'humor' | 'ominous' | 'info' | 'default';

export interface NewsRequestCallback {
  (): void;
}

export interface NotificationCallback {
  (message: string): void;
}

export class UIManager {
  private notificationCallback: NotificationCallback | null = null;
  private newsRequestCallback: NewsRequestCallback | null = null;

  constructor() {}

  /**
   * Set the notification callback
   */
  setNotificationCallback(callback: NotificationCallback): void {
    this.notificationCallback = callback;
  }

  /**
   * Set the news request callback (for requesting news from server)
   */
  setNewsRequestCallback(callback: NewsRequestCallback): void {
    this.newsRequestCallback = callback;
  }

  // ========== Notifications ==========

  /**
   * Show a simple notification message
   */
  showNotification(message: string): void {
    if (this.notificationCallback) {
      this.notificationCallback(message);
    }
  }

  // ========== Narrator Text ==========

  /**
   * Shows narrator text prominently at the top of the screen
   * with dramatic styling based on the style parameter
   */
  showNarratorText(text: string, style: NarratorStyle = 'epic'): void {
    // Create or get narrator container
    let narratorEl = document.getElementById('narrator-text');
    if (!narratorEl) {
      narratorEl = document.createElement('div');
      narratorEl.id = 'narrator-text';
      narratorEl.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 80%;
        padding: 15px 30px;
        font-family: 'Georgia', serif;
        font-size: 18px;
        text-align: center;
        border-radius: 5px;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        pointer-events: none;
      `;
      document.body.appendChild(narratorEl);
    }

    // Style based on narrator style
    this.applyNarratorStyle(narratorEl, style);

    // Set text with dramatic quotes
    const em = document.createElement('em');
    em.textContent = `"${text}"`;
    narratorEl.textContent = '';
    narratorEl.appendChild(em);

    // Fade in
    narratorEl.style.opacity = '1';

    // Fade out after delay (based on text length)
    const displayTime = Math.max(4000, text.length * 60);
    setTimeout(() => {
      narratorEl.style.opacity = '0';
    }, displayTime);

    console.log('[Narrator]', style + ':', text);
  }

  /**
   * Apply styling to narrator element based on style type
   */
  private applyNarratorStyle(element: HTMLElement, style: NarratorStyle): void {
    switch (style) {
      case 'epic':
        element.style.background = 'linear-gradient(to right, rgba(139, 69, 19, 0.9), rgba(101, 67, 33, 0.9))';
        element.style.color = '#ffd700';
        element.style.border = '2px solid #ffd700';
        break;
      case 'humor':
        element.style.background = 'linear-gradient(to right, rgba(75, 0, 130, 0.9), rgba(138, 43, 226, 0.9))';
        element.style.color = '#fff';
        element.style.border = '2px solid #da70d6';
        break;
      case 'ominous':
        element.style.background = 'linear-gradient(to right, rgba(40, 0, 0, 0.95), rgba(80, 0, 0, 0.95))';
        element.style.color = '#ff4444';
        element.style.border = '2px solid #8b0000';
        break;
      case 'info':
        element.style.background = 'linear-gradient(to right, rgba(0, 50, 80, 0.9), rgba(0, 80, 100, 0.9))';
        element.style.color = '#87ceeb';
        element.style.border = '2px solid #4682b4';
        break;
      default:
        element.style.background = 'rgba(0, 0, 0, 0.8)';
        element.style.color = '#fff';
        element.style.border = '2px solid #666';
    }
  }

  // ========== Newspaper (Town Crier) ==========

  /**
   * Town Crier - Shows newspaper overlay with headlines
   */
  showNewspaper(headlines: string[]): void {
    // Create or get newspaper container
    let newsEl = document.getElementById('newspaper-overlay');
    if (!newsEl) {
      newsEl = document.createElement('div');
      newsEl.id = 'newspaper-overlay';
      newsEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        max-width: 90%;
        max-height: 80vh;
        padding: 20px 30px;
        font-family: 'Georgia', serif;
        background: linear-gradient(to bottom, #f4e4bc, #e8d5a3);
        color: #2a2a2a;
        border-radius: 5px;
        border: 3px solid #8b4513;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        z-index: 10000;
        overflow-y: auto;
      `;
      document.body.appendChild(newsEl);
    }

    // Build newspaper content
    const html = this.buildNewspaperHTML(headlines);
    newsEl.innerHTML = html;
    newsEl.style.display = 'block';

    // Add close button handler
    const closeBtn = document.getElementById('close-newspaper');
    if (closeBtn) {
      closeBtn.onclick = () => this.hideNewspaper();
    }

    console.log('[TownCrier] Displayed newspaper with', headlines.length, 'headlines');
  }

  /**
   * Build the HTML content for the newspaper
   */
  private buildNewspaperHTML(headlines: string[]): string {
    let html = `
      <div style="text-align: center; border-bottom: 2px solid #8b4513; padding-bottom: 10px; margin-bottom: 15px;">
        <h2 style="margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
          Town Crier
        </h2>
        <div style="font-size: 12px; color: #666; margin-top: 5px;">
          All the news that's fit to proclaim!
        </div>
      </div>
      <div style="font-size: 14px; line-height: 1.6;">
    `;

    if (headlines.length === 0) {
      html += '<p style="text-align: center; font-style: italic;">No news today... The realm is quiet.</p>';
    } else {
      headlines.forEach(headline => {
        html += `<p style="margin: 10px 0; padding-left: 10px; border-left: 3px solid #8b4513;">
          ${headline}
        </p>`;
      });
    }

    html += `
      </div>
      <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc;">
        <button id="close-newspaper" style="
          padding: 8px 20px;
          font-family: Georgia, serif;
          font-size: 14px;
          background: #8b4513;
          color: #fff;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        ">Close</button>
        <div style="font-size: 10px; color: #888; margin-top: 8px;">Press N to toggle</div>
      </div>
    `;

    return html;
  }

  /**
   * Hide the newspaper overlay
   */
  hideNewspaper(): void {
    const newsEl = document.getElementById('newspaper-overlay');
    if (newsEl) {
      newsEl.style.display = 'none';
    }
  }

  /**
   * Toggle newspaper visibility
   */
  toggleNewspaper(): void {
    const newsEl = document.getElementById('newspaper-overlay');
    if (newsEl && newsEl.style.display !== 'none') {
      this.hideNewspaper();
    } else {
      this.requestNews();
    }
  }

  /**
   * Request news from server via callback
   */
  requestNews(): void {
    if (this.newsRequestCallback) {
      console.log('[TownCrier] Requesting news from server...');
      this.newsRequestCallback();
    }
  }

  /**
   * Check if newspaper is currently visible
   */
  isNewspaperVisible(): boolean {
    const newsEl = document.getElementById('newspaper-overlay');
    return newsEl !== null && newsEl.style.display !== 'none';
  }

  /**
   * Cleanup DOM elements created by UIManager
   */
  cleanup(): void {
    const narratorEl = document.getElementById('narrator-text');
    if (narratorEl) {
      narratorEl.remove();
    }

    const newsEl = document.getElementById('newspaper-overlay');
    if (newsEl) {
      newsEl.remove();
    }
  }
}
