/**
 * TitleAnimation - Cinematic "FRACTURE" title effect using anime.js
 * Creates a dramatic shattering/glitch effect on the title
 */

export class TitleAnimation {
  private logoElement: HTMLElement | null = null;
  private letterElements: HTMLSpanElement[] = [];
  private crackOverlay: HTMLDivElement | null = null;
  private isAnimating = false;

  constructor() {}

  /**
   * Initialize and run the title animation
   */
  async init(): Promise<void> {
    console.log('[TitleAnimation] Initializing...');

    this.logoElement = document.getElementById('logo');
    if (!this.logoElement) {
      console.warn('[TitleAnimation] Logo element not found');
      return;
    }
    console.log('[TitleAnimation] Found logo element:', this.logoElement.textContent);

    // Check if anime.js v4 is available
    const anime = (window as any).anime;
    console.log('[TitleAnimation] anime.js check:', anime ? 'found' : 'not found');
    if (anime) {
      console.log('[TitleAnimation] anime.animate:', typeof anime.animate);
    }

    if (!anime || typeof anime.animate !== 'function') {
      console.warn('[TitleAnimation] anime.js v4 not available, anime object:', anime);
      return;
    }

    console.log('[TitleAnimation] Setting up title...');
    // Set up the title for animation
    this.setupTitle();

    // Add crack overlay
    this.createCrackOverlay();

    // Run the animation sequence
    console.log('[TitleAnimation] Running animation sequence...');
    await this.runAnimation();
    console.log('[TitleAnimation] Animation complete');
  }

  /**
   * Split the title into individual letter spans for animation
   */
  private setupTitle(): void {
    if (!this.logoElement) return;

    const text = 'FRACTURE';
    this.logoElement.innerHTML = '';
    this.logoElement.style.overflow = 'visible';

    // Create a container for letters
    const letterContainer = document.createElement('div');
    letterContainer.className = 'letter-container';
    letterContainer.style.cssText = `
      display: inline-flex;
      position: relative;
    `;

    // Create spans for each letter
    this.letterElements = [];
    for (let i = 0; i < text.length; i++) {
      const span = document.createElement('span');
      span.className = 'fracture-letter';
      span.textContent = text[i];
      span.dataset.index = String(i);
      span.style.cssText = `
        display: inline-block;
        position: relative;
        transform-origin: center bottom;
        will-change: transform, opacity;
      `;
      letterContainer.appendChild(span);
      this.letterElements.push(span);
    }

    this.logoElement.appendChild(letterContainer);

    // Add CSS for glitch effect
    this.addGlitchStyles();
  }

  /**
   * Add CSS keyframes for glitch effects
   */
  private addGlitchStyles(): void {
    if (document.getElementById('fracture-glitch-styles')) return;

    const style = document.createElement('style');
    style.id = 'fracture-glitch-styles';
    style.textContent = `
      @keyframes glitch-1 {
        0%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
        20% { clip-path: inset(20% 0 30% 0); transform: translate(-3px, 2px); }
        40% { clip-path: inset(60% 0 10% 0); transform: translate(3px, -2px); }
        60% { clip-path: inset(40% 0 40% 0); transform: translate(-2px, 1px); }
        80% { clip-path: inset(10% 0 70% 0); transform: translate(2px, -1px); }
      }

      @keyframes glitch-2 {
        0%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
        25% { clip-path: inset(70% 0 5% 0); transform: translate(2px, 1px); }
        50% { clip-path: inset(5% 0 70% 0); transform: translate(-2px, -1px); }
        75% { clip-path: inset(30% 0 50% 0); transform: translate(1px, 2px); }
      }

      @keyframes subtle-shake {
        0%, 100% { transform: translateX(0); }
        10% { transform: translateX(-1px); }
        30% { transform: translateX(1px); }
        50% { transform: translateX(-1px); }
        70% { transform: translateX(1px); }
        90% { transform: translateX(0); }
      }

      .fracture-letter.cracked {
        text-shadow:
          2px 2px 0 #8B4513,
          -1px -1px 0 #000,
          1px -1px 0 #000,
          -1px 1px 0 #000,
          1px 1px 0 #000,
          0 4px 0 #5C3317,
          3px 0 8px rgba(255, 100, 50, 0.5),
          -3px 0 8px rgba(100, 200, 255, 0.5);
      }

      .fracture-letter.glitching {
        animation: subtle-shake 0.1s ease-in-out;
      }

      .crack-line {
        position: absolute;
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(255, 200, 150, 0.8) 45%,
          rgba(255, 255, 255, 1) 50%,
          rgba(255, 200, 150, 0.8) 55%,
          transparent 100%
        );
        transform-origin: center;
        pointer-events: none;
        z-index: 10;
      }

      #crack-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
      }

      .title-particle {
        position: absolute;
        width: 4px;
        height: 4px;
        background: #FFD700;
        border-radius: 50%;
        pointer-events: none;
        box-shadow: 0 0 6px #FFD700;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create overlay for crack effects
   * Note: We don't modify parent positioning to avoid breaking page layout
   */
  private createCrackOverlay(): void {
    if (!this.logoElement) return;

    // Create crack overlay inside the logo element (which is already positioned)
    this.crackOverlay = document.createElement('div');
    this.crackOverlay.id = 'crack-overlay';
    this.logoElement.appendChild(this.crackOverlay);
  }

  /**
   * Run the main animation sequence
   */
  private async runAnimation(): Promise<void> {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const anime = (window as any).anime;

    // Phase 1: Letters fade in one by one
    await this.fadeInLetters(anime);

    // Phase 2: Brief pause then "impact"
    await this.delay(500);
    await this.impactEffect(anime);

    // Phase 3: Crack appears through the title
    await this.createCracks(anime);

    // Phase 4: Letters shake apart slightly then settle
    await this.shatterSettle(anime);

    // Phase 5: Subtle ongoing effects (glitch occasionally)
    this.startAmbientEffects(anime);

    this.isAnimating = false;
  }

  /**
   * Phase 1: Fade in letters with stagger
   */
  private async fadeInLetters(anime: any): Promise<void> {
    // Start all letters invisible and offset
    this.letterElements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-20px) scale(1.2)';
    });

    return new Promise(resolve => {
      anime.animate(this.letterElements, {
        opacity: [0, 1],
        translateY: [-20, 0],
        scale: [1.2, 1],
        duration: 800,
        delay: anime.stagger(80),
        ease: 'outExpo',
        complete: resolve
      });
    });
  }

  /**
   * Phase 2: Impact flash effect
   */
  private async impactEffect(anime: any): Promise<void> {
    // Quick flash
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(255, 255, 255, 0.8);
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
    `;
    document.body.appendChild(flash);

    return new Promise(resolve => {
      anime.animate(flash, {
        opacity: [0, 0.6, 0],
        duration: 300,
        ease: 'outQuad',
        complete: () => {
          flash.remove();
          resolve(undefined);
        }
      });

      // Shake all letters during impact
      anime.animate(this.letterElements, {
        translateX: () => anime.random(-5, 5),
        translateY: () => anime.random(-3, 3),
        duration: 100,
        direction: 'alternate',
        loop: 3,
        ease: 'easeInOutSine'
      });
    });
  }

  /**
   * Phase 3: Create crack lines through the title
   */
  private async createCracks(anime: any): Promise<void> {
    if (!this.crackOverlay || !this.logoElement) return;

    const rect = this.logoElement.getBoundingClientRect();
    const cracks: HTMLDivElement[] = [];

    // Create 3-5 crack lines
    const crackCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < crackCount; i++) {
      const crack = document.createElement('div');
      crack.className = 'crack-line';

      // Random position and angle
      const startX = Math.random() * 100;
      const startY = 30 + Math.random() * 40;
      const angle = -30 + Math.random() * 60;
      const length = 30 + Math.random() * 70;

      crack.style.cssText = `
        position: absolute;
        left: ${startX}%;
        top: ${startY}%;
        width: 0px;
        height: 2px;
        transform: rotate(${angle}deg);
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(255, 200, 150, 0.6) 30%,
          rgba(255, 255, 255, 0.9) 50%,
          rgba(255, 200, 150, 0.6) 70%,
          transparent 100%
        );
        box-shadow: 0 0 10px rgba(255, 150, 50, 0.5);
      `;

      this.crackOverlay.appendChild(crack);
      cracks.push(crack);

      // Animate crack growing
      anime.animate(crack, {
        width: [0, length],
        opacity: [0, 1, 0.7],
        duration: 200 + Math.random() * 200,
        delay: i * 50,
        ease: 'outExpo'
      });
    }

    // Add cracked class to letters
    this.letterElements.forEach(el => el.classList.add('cracked'));

    // Spawn particles from crack points
    this.spawnParticles(anime, 15);

    await this.delay(400);
  }

  /**
   * Phase 4: Letters shake apart then settle
   */
  private async shatterSettle(anime: any): Promise<void> {
    // Scatter slightly
    await new Promise<void>(resolve => {
      anime.animate(this.letterElements, {
        translateX: () => anime.random(-8, 8),
        translateY: () => anime.random(-5, 5),
        rotateZ: () => anime.random(-5, 5),
        duration: 300,
        ease: 'outExpo',
        complete: resolve
      });
    });

    // Settle back
    await new Promise<void>(resolve => {
      anime.animate(this.letterElements, {
        translateX: 0,
        translateY: 0,
        rotateZ: 0,
        duration: 800,
        ease: 'outElastic(1, 0.5)',
        complete: resolve
      });
    });
  }

  /**
   * Spawn golden particles
   */
  private spawnParticles(anime: any, count: number): void {
    if (!this.logoElement) return;

    const rect = this.logoElement.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'title-particle';

      const startX = rect.left + Math.random() * rect.width;
      const startY = rect.top + rect.height / 2;

      particle.style.left = startX + 'px';
      particle.style.top = startY + 'px';

      document.body.appendChild(particle);

      anime.animate(particle, {
        translateX: anime.random(-100, 100),
        translateY: anime.random(-80, 80),
        scale: [1, 0],
        opacity: [1, 0],
        duration: 800 + Math.random() * 400,
        ease: 'outExpo',
        complete: () => particle.remove()
      });
    }
  }

  /**
   * Ambient glitch effects that continue playing
   */
  private startAmbientEffects(anime: any): void {
    // Random glitch on letters every few seconds
    const glitchLoop = () => {
      if (!this.letterElements.length) return;

      // Pick random letter
      const letter = this.letterElements[Math.floor(Math.random() * this.letterElements.length)];

      // Quick glitch
      letter.classList.add('glitching');
      anime.animate(letter, {
        translateX: [0, anime.random(-2, 2), 0],
        skewX: [0, anime.random(-3, 3), 0],
        duration: 100,
        ease: 'easeInOutSine',
        complete: () => letter.classList.remove('glitching')
      });

      // Schedule next glitch (random 2-6 seconds)
      setTimeout(glitchLoop, 2000 + Math.random() * 4000);
    };

    // Start the loop after a delay
    setTimeout(glitchLoop, 2000);

    // Occasional subtle pulse on all letters
    const pulseLoop = () => {
      anime.animate(this.letterElements, {
        scale: [1, 1.02, 1],
        duration: 2000,
        ease: 'easeInOutSine'
      });

      setTimeout(pulseLoop, 8000 + Math.random() * 4000);
    };

    setTimeout(pulseLoop, 5000);
  }

  /**
   * Promise-based delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
