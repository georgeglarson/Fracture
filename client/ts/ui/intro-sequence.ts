/**
 * IntroSequence - Cinematic intro with AI-generated story and TTS narration
 * Single Responsibility: Display animated intro with voice narration
 */

// Import anime.js (UMD build loaded as global)
declare const anime: any;

export interface IntroData {
  story: string;
  lines: string[];
  audioUrl?: string;
  voiceName: string;
  cached: boolean;
}

export interface IntroCallbacks {
  onComplete: () => void;
  onSkip: () => void;
}

export class IntroSequence {
  private overlay: HTMLDivElement | null = null;
  private audio: HTMLAudioElement | null = null;
  private callbacks: IntroCallbacks | null = null;
  private isPlaying = false;
  private currentLineIndex = 0;
  private lines: string[] = [];
  private lineElements: HTMLElement[] = [];
  private skipButton: HTMLButtonElement | null = null;

  constructor() {}

  /**
   * Set callback handlers
   */
  setCallbacks(callbacks: IntroCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Fetch intro data from server
   */
  async fetchIntro(playerName: string): Promise<IntroData | null> {
    try {
      const response = await fetch('/api/intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName })
      });

      if (!response.ok) {
        console.warn('[IntroSequence] API returned error:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[IntroSequence] Failed to fetch intro:', error);
      return null;
    }
  }

  /**
   * Play the intro sequence
   */
  async play(data: IntroData): Promise<void> {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lines = data.lines;
    this.currentLineIndex = 0;

    // Create the overlay
    this.createOverlay(data);

    // Start audio if available
    if (data.audioUrl) {
      this.playAudio(data.audioUrl);
    }

    // Animate the intro
    await this.animateIntro();
  }

  /**
   * Create the cinematic overlay
   */
  private createOverlay(data: IntroData): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'intro-sequence';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a12 100%);
      z-index: 100000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Georgia', 'Times New Roman', serif;
      opacity: 0;
      transition: opacity 0.5s ease;
    `;

    // Add particle background effect
    const particles = document.createElement('div');
    particles.className = 'intro-particles';
    particles.innerHTML = this.createParticles(30);
    this.overlay.appendChild(particles);

    // Title
    const title = document.createElement('h1');
    title.className = 'intro-title';
    title.textContent = 'FRACTURE';
    title.style.cssText = `
      font-size: 72px;
      font-weight: 300;
      letter-spacing: 20px;
      color: #fff;
      text-shadow: 0 0 30px rgba(97, 195, 255, 0.5), 0 0 60px rgba(97, 195, 255, 0.3);
      margin-bottom: 60px;
      opacity: 0;
      transform: translateY(-20px);
    `;
    this.overlay.appendChild(title);

    // Story container
    const storyContainer = document.createElement('div');
    storyContainer.className = 'intro-story';
    storyContainer.style.cssText = `
      max-width: 800px;
      padding: 0 40px;
      text-align: center;
    `;

    // Create line elements
    this.lineElements = [];
    this.lines.forEach((line, index) => {
      const lineEl = document.createElement('p');
      lineEl.className = 'intro-line';
      lineEl.style.cssText = `
        font-size: 24px;
        line-height: 1.8;
        color: #c0c0d0;
        margin: 20px 0;
        opacity: 0;
        transform: translateY(20px);
      `;
      lineEl.textContent = line;
      storyContainer.appendChild(lineEl);
      this.lineElements.push(lineEl);
    });

    this.overlay.appendChild(storyContainer);

    // Narrator credit
    const narrator = document.createElement('div');
    narrator.className = 'intro-narrator';
    narrator.innerHTML = `<span style="color: #666;">Narrated by</span> <span style="color: #61C3FF;">${data.voiceName}</span>`;
    narrator.style.cssText = `
      position: absolute;
      bottom: 100px;
      font-size: 14px;
      letter-spacing: 2px;
      opacity: 0;
    `;
    this.overlay.appendChild(narrator);

    // Skip button
    this.skipButton = document.createElement('button');
    this.skipButton.textContent = 'Skip Intro';
    this.skipButton.style.cssText = `
      position: absolute;
      bottom: 40px;
      right: 40px;
      padding: 12px 24px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.3);
      color: rgba(255,255,255,0.6);
      font-family: Arial, sans-serif;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s ease;
      opacity: 0;
    `;
    this.skipButton.addEventListener('mouseenter', () => {
      if (this.skipButton) {
        this.skipButton.style.borderColor = 'rgba(97, 195, 255, 0.8)';
        this.skipButton.style.color = '#61C3FF';
      }
    });
    this.skipButton.addEventListener('mouseleave', () => {
      if (this.skipButton) {
        this.skipButton.style.borderColor = 'rgba(255,255,255,0.3)';
        this.skipButton.style.color = 'rgba(255,255,255,0.6)';
      }
    });
    this.skipButton.addEventListener('click', () => this.skip());
    this.overlay.appendChild(this.skipButton);

    // Press key to continue
    const continueHint = document.createElement('div');
    continueHint.className = 'intro-continue';
    continueHint.textContent = 'Press SPACE or ENTER to continue';
    continueHint.style.cssText = `
      position: absolute;
      bottom: 40px;
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      letter-spacing: 1px;
      opacity: 0;
    `;
    this.overlay.appendChild(continueHint);

    document.body.appendChild(this.overlay);

    // Fade in
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
      }
    });

    // Keyboard handler
    this.setupKeyboardHandler();
  }

  /**
   * Create floating particle elements
   */
  private createParticles(count: number): string {
    let html = '';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 100;
      const delay = Math.random() * 20;
      const duration = 15 + Math.random() * 20;
      const size = 1 + Math.random() * 3;
      const opacity = 0.1 + Math.random() * 0.3;
      html += `<div style="
        position: absolute;
        left: ${x}%;
        bottom: -10px;
        width: ${size}px;
        height: ${size}px;
        background: rgba(97, 195, 255, ${opacity});
        border-radius: 50%;
        animation: float-up ${duration}s ${delay}s infinite linear;
      "></div>`;
    }
    return html;
  }

  /**
   * Play TTS audio
   */
  private playAudio(url: string): void {
    this.audio = new Audio(url);
    this.audio.volume = 0.8;
    this.audio.play().catch(err => {
      console.warn('[IntroSequence] Audio playback failed:', err);
    });
  }

  /**
   * Animate the intro sequence using anime.js
   */
  private async animateIntro(): Promise<void> {
    if (!this.overlay || typeof anime === 'undefined') {
      console.warn('[IntroSequence] anime.js not loaded, using fallback animation');
      await this.fallbackAnimation();
      return;
    }

    // Inject CSS animation for particles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes float-up {
        0% { transform: translateY(0) scale(1); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    // Title animation
    const title = this.overlay.querySelector('.intro-title');
    if (title) {
      anime({
        targets: title,
        opacity: [0, 1],
        translateY: [-20, 0],
        duration: 1500,
        easing: 'easeOutExpo'
      });
    }

    // Wait for title
    await this.delay(1000);

    // Animate each line sequentially
    for (let i = 0; i < this.lineElements.length; i++) {
      if (!this.isPlaying) break;

      const line = this.lineElements[i];
      anime({
        targets: line,
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 800,
        easing: 'easeOutQuad'
      });

      // Calculate delay based on line length (rough approximation of speech timing)
      const wordsPerSecond = 2.5;
      const wordCount = this.lines[i].split(' ').length;
      const lineDelay = Math.max(2000, (wordCount / wordsPerSecond) * 1000);

      await this.delay(lineDelay);
    }

    // Show narrator credit and continue prompt
    const narrator = this.overlay.querySelector('.intro-narrator');
    const continueHint = this.overlay.querySelector('.intro-continue');

    if (narrator) {
      anime({
        targets: narrator,
        opacity: [0, 1],
        duration: 1000,
        easing: 'easeOutQuad'
      });
    }

    await this.delay(1500);

    if (continueHint) {
      anime({
        targets: continueHint,
        opacity: [0, 0.7],
        duration: 1000,
        easing: 'easeOutQuad',
        loop: true,
        direction: 'alternate'
      });
    }

    // Show skip button
    if (this.skipButton) {
      this.skipButton.style.opacity = '1';
    }

    // Auto-continue after a delay
    await this.delay(3000);
    if (this.isPlaying) {
      this.complete();
    }
  }

  /**
   * Fallback animation without anime.js
   */
  private async fallbackAnimation(): Promise<void> {
    if (!this.overlay) return;

    const title = this.overlay.querySelector('.intro-title') as HTMLElement;
    if (title) {
      title.style.transition = 'all 1s ease';
      title.style.opacity = '1';
      title.style.transform = 'translateY(0)';
    }

    await this.delay(1000);

    for (let i = 0; i < this.lineElements.length; i++) {
      if (!this.isPlaying) break;

      const line = this.lineElements[i];
      line.style.transition = 'all 0.8s ease';
      line.style.opacity = '1';
      line.style.transform = 'translateY(0)';

      const wordCount = this.lines[i].split(' ').length;
      const lineDelay = Math.max(2000, (wordCount / 2.5) * 1000);
      await this.delay(lineDelay);
    }

    if (this.skipButton) {
      this.skipButton.style.opacity = '1';
    }

    await this.delay(3000);
    if (this.isPlaying) {
      this.complete();
    }
  }

  /**
   * Setup keyboard handlers
   */
  private setupKeyboardHandler(): void {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        this.complete();
        document.removeEventListener('keydown', handler);
      }
    };
    document.addEventListener('keydown', handler);
  }

  /**
   * Skip the intro
   */
  skip(): void {
    this.isPlaying = false;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.cleanup();
    if (this.callbacks?.onSkip) {
      this.callbacks.onSkip();
    }
  }

  /**
   * Complete the intro
   */
  private complete(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }

    // Fade out
    if (this.overlay) {
      this.overlay.style.transition = 'opacity 0.8s ease';
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        this.cleanup();
        if (this.callbacks?.onComplete) {
          this.callbacks.onComplete();
        }
      }, 800);
    } else {
      this.cleanup();
      if (this.callbacks?.onComplete) {
        this.callbacks.onComplete();
      }
    }
  }

  /**
   * Cleanup DOM elements
   */
  private cleanup(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.lineElements = [];
    this.skipButton = null;
  }

  /**
   * Promise-based delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
