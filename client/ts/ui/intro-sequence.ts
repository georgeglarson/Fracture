/**
 * IntroSequence - Cinematic intro with AI-generated story and TTS narration
 * Single Responsibility: Display animated intro with voice narration
 */

import { AudioManager } from '../audio';

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
  onReadyForGame?: () => void; // Called when intro is done narrating (before shatter)
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
  private gameReady = false;
  private gameReadyResolver: (() => void) | null = null;
  private glitchIntroAudio: HTMLAudioElement | null = null;

  constructor() {
    // Preload glitch intro sound
    this.glitchIntroAudio = new Audio('audio/sounds/glitch-intro.mp3');
    this.glitchIntroAudio.volume = 0.4;
    AudioManager.registerAudio(this.glitchIntroAudio);
  }

  /**
   * Play glass shatter sound effect from audio file
   */
  private playShatterSound(): void {
    try {
      const audio = new Audio('audio/sounds/shatter.mp3');
      audio.volume = 0.6;
      AudioManager.registerAudio(audio);
      audio.play().catch(e => {
        console.warn('[IntroSequence] Could not play shatter sound:', e);
      });
    } catch (e) {
      console.warn('[IntroSequence] Could not play shatter sound:', e);
    }
  }

  /**
   * Signal that the game is ready (connected and loaded)
   */
  signalGameReady(): void {
    this.gameReady = true;
    if (this.gameReadyResolver) {
      this.gameReadyResolver();
      this.gameReadyResolver = null;
    }
  }

  /**
   * Wait for game to be ready
   */
  private waitForGameReady(): Promise<void> {
    if (this.gameReady) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.gameReadyResolver = resolve;
    });
  }

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
    this.audioFinished = null;

    // Play glitch intro sound at start
    if (this.glitchIntroAudio) {
      this.glitchIntroAudio.currentTime = 0;
      this.glitchIntroAudio.play().catch(() => {});
    }

    // Create the overlay
    this.createOverlay(data);

    // Start audio if available (store promise to wait for it later)
    if (data.audioUrl) {
      this.audioFinished = this.playAudio(data.audioUrl);
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
   * Play TTS audio and return a promise that resolves when done
   */
  private playAudio(url: string): Promise<void> {
    return new Promise((resolve) => {
      this.audio = new Audio(url);
      this.audio.volume = 0.8;
      AudioManager.registerAudio(this.audio);

      // Resolve when audio ends
      this.audio.addEventListener('ended', () => {
        console.log('[IntroSequence] Audio finished playing');
        resolve();
      });

      // Also resolve on error so we don't hang
      this.audio.addEventListener('error', () => {
        console.warn('[IntroSequence] Audio error, continuing');
        resolve();
      });

      this.audio.play().catch(err => {
        console.warn('[IntroSequence] Audio playback failed:', err);
        resolve();
      });
    });
  }

  private audioFinished: Promise<void> | null = null;

  /**
   * Animate the intro sequence using anime.js
   */
  private async animateIntro(): Promise<void> {
    // Check if anime.js v4 is loaded (it exports anime.animate)
    const animeAvailable = typeof (window as any).anime !== 'undefined' &&
                           typeof (window as any).anime.animate === 'function';

    if (!this.overlay || !animeAvailable) {
      console.warn('[IntroSequence] anime.js not loaded or wrong version, using fallback');
      await this.fallbackAnimation();
      return;
    }

    const animeLib = (window as any).anime;

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
      animeLib.animate(title, {
        opacity: [0, 1],
        translateY: [-20, 0],
        duration: 1500,
        ease: 'outExpo'
      });
    }

    // Wait for title
    await this.delay(1000);

    // Animate each line sequentially
    for (let i = 0; i < this.lineElements.length; i++) {
      if (!this.isPlaying) break;

      const line = this.lineElements[i];
      animeLib.animate(line, {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 800,
        ease: 'outQuad'
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
      animeLib.animate(narrator, {
        opacity: [0, 1],
        duration: 1000,
        ease: 'outQuad'
      });
    }

    await this.delay(1500);

    if (continueHint) {
      animeLib.animate(continueHint, {
        opacity: [0, 0.7],
        duration: 1000,
        ease: 'outQuad',
        loop: true,
        alternate: true
      });
    }

    // Show skip button
    if (this.skipButton) {
      this.skipButton.style.opacity = '1';
    }

    // Wait for audio to finish before auto-completing
    if (this.audioFinished) {
      console.log('[IntroSequence] Waiting for audio to finish...');
      await this.audioFinished;
    }

    // Small grace period after audio ends
    await this.delay(1500);

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

    // Wait for audio to finish before auto-completing
    if (this.audioFinished) {
      await this.audioFinished;
    }

    await this.delay(1500);
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
    // Clear any pending game ready wait
    if (this.gameReadyResolver) {
      this.gameReadyResolver();
      this.gameReadyResolver = null;
    }
    this.cleanup();
    if (this.callbacks?.onSkip) {
      this.callbacks.onSkip();
    }
  }

  /**
   * Complete the intro with fracture effect
   */
  private async complete(): Promise<void> {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }

    // Fade out and stop glitch intro audio
    if (this.glitchIntroAudio) {
      const fadeOut = setInterval(() => {
        if (this.glitchIntroAudio && this.glitchIntroAudio.volume > 0.05) {
          this.glitchIntroAudio.volume -= 0.05;
        } else {
          clearInterval(fadeOut);
          if (this.glitchIntroAudio) {
            this.glitchIntroAudio.pause();
            this.glitchIntroAudio.currentTime = 0;
          }
        }
      }, 50);
    }

    // Signal that we're ready for the game to start loading
    if (this.callbacks?.onReadyForGame) {
      this.callbacks.onReadyForGame();
    }

    // Try to use fracture effect with anime.js, fall back to simple fade
    const animeAvailable = typeof (window as any).anime !== 'undefined' &&
                           typeof (window as any).anime.animate === 'function';

    if (this.overlay && animeAvailable) {
      await this.fractureComplete();
    } else if (this.overlay) {
      // Simple fade fallback - still wait for game ready
      await this.waitForGameReady();
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
   * Create dramatic fracture/shatter effect for outro
   * Waits for game to be ready before revealing, with slower dramatic animation
   */
  private async fractureComplete(): Promise<void> {
    if (!this.overlay) return;

    const animeLib = (window as any).anime;

    // Hide original content but keep background for fragments
    const title = this.overlay.querySelector('.intro-title') as HTMLElement;
    const lines = this.overlay.querySelectorAll('.intro-line');
    const narrator = this.overlay.querySelector('.intro-narrator') as HTMLElement;
    const skipBtn = this.skipButton;
    const continueHint = this.overlay.querySelector('.intro-continue') as HTMLElement;

    // Fade out text and UI elements first
    [title, ...Array.from(lines), narrator, skipBtn, continueHint].forEach(el => {
      if (el) (el as HTMLElement).style.opacity = '0';
    });

    // Show a "preparing world" message while waiting
    const loadingMsg = document.createElement('div');
    loadingMsg.style.cssText = `
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 14px;
      color: rgba(255,255,255,0.5);
      letter-spacing: 2px;
    `;
    loadingMsg.textContent = 'Preparing world...';
    this.overlay.appendChild(loadingMsg);

    // Wait for game to be ready before starting the shatter
    await this.waitForGameReady();

    // Remove loading message
    loadingMsg.remove();

    // Create fragment container
    const fragmentContainer = document.createElement('div');
    fragmentContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 100001;
      pointer-events: none;
      perspective: 1500px;
    `;
    document.body.appendChild(fragmentContainer);

    // Create shattered glass fragments - more fragments for smoother effect
    const cols = 10;
    const rows = 8;
    const fragmentWidth = window.innerWidth / cols;
    const fragmentHeight = window.innerHeight / rows;

    const fragments: HTMLDivElement[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const fragment = document.createElement('div');
        const x = col * fragmentWidth;
        const y = row * fragmentHeight;

        // Add slight randomness to fragment size for more natural look
        const widthVariance = (Math.random() - 0.5) * 15;
        const heightVariance = (Math.random() - 0.5) * 15;

        fragment.style.cssText = `
          position: absolute;
          left: ${x}px;
          top: ${y}px;
          width: ${fragmentWidth + widthVariance}px;
          height: ${fragmentHeight + heightVariance}px;
          background: linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a12 100%);
          box-shadow: 0 0 30px rgba(97, 195, 255, 0.4), inset 0 0 40px rgba(0,0,0,0.6);
          border: 1px solid rgba(97, 195, 255, 0.3);
          transform-origin: center center;
          backface-visibility: hidden;
        `;

        // Add crack line effect on some fragments
        if (Math.random() > 0.5) {
          const crackAngle = Math.random() * 180;
          fragment.innerHTML = `<div style="
            position: absolute;
            width: 100%;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent);
            top: 50%;
            transform: rotate(${crackAngle}deg);
          "></div>`;
        }

        fragmentContainer.appendChild(fragment);
        fragments.push(fragment);
      }
    }

    // Flash effect - longer and more dramatic
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.9);
      z-index: 100002;
      opacity: 0;
      pointer-events: none;
    `;
    document.body.appendChild(flash);

    // Hide original overlay
    this.overlay.style.opacity = '0';

    // Play synthesized shatter sound effect
    this.playShatterSound();

    // Animate flash - slower, more dramatic
    animeLib.animate(flash, {
      opacity: [0, 1, 0.3, 0],
      duration: 800,
      ease: 'outQuad',
      complete: () => flash.remove()
    });

    // Animate each fragment shattering outward - MUCH SLOWER
    fragments.forEach((fragment, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;

      // Calculate direction from center
      const centerX = cols / 2;
      const centerY = rows / 2;
      const dirX = (col - centerX) / centerX;
      const dirY = (row - centerY) / centerY;

      // Random variations - larger movements
      const randomX = (Math.random() - 0.5) * 600;
      const randomY = (Math.random() - 0.5) * 500;
      const randomRotateX = (Math.random() - 0.5) * 360;
      const randomRotateY = (Math.random() - 0.5) * 360;
      const randomRotateZ = (Math.random() - 0.5) * 180;

      // Delay based on distance from center (center breaks first)
      // Longer delays for more dramatic cascading effect
      const distance = Math.sqrt(dirX * dirX + dirY * dirY);
      const delay = distance * 300; // 3x longer delay spread

      animeLib.animate(fragment, {
        translateX: dirX * 800 + randomX,
        translateY: dirY * 600 + randomY + 300, // Gravity bias
        translateZ: -400 - Math.random() * 500,
        rotateX: randomRotateX,
        rotateY: randomRotateY,
        rotateZ: randomRotateZ,
        opacity: [1, 1, 0.8, 0], // Hold opacity longer
        scale: [1, 1.1, 0.3], // Slight pop before shrinking
        duration: 2500 + Math.random() * 1000, // 2.5-3.5 seconds per fragment
        delay: delay,
        ease: 'outQuart' // Smoother easing
      });
    });

    // Cleanup after animation - 4.5 seconds total
    return new Promise(resolve => {
      setTimeout(() => {
        fragmentContainer.remove();
        this.cleanup();
        if (this.callbacks?.onComplete) {
          this.callbacks.onComplete();
        }
        resolve();
      }, 4500);
    });
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
