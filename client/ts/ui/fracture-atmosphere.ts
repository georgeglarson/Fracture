/**
 * FractureAtmosphere - Creates an unsettling, glitchy atmosphere
 * Combines audio glitches, visual effects, and floating particles
 *
 * Now with dimension-specific themes for each zone!
 */

import { AudioManager } from '../audio';

/**
 * Dimension theme configuration
 */
export interface DimensionTheme {
  id: string;
  name: string;
  // Colors
  particleColor: string;
  particleGlow: string;
  vignetteColor: string;
  scanlineColor: string;
  // Symbols for particles
  symbols: string[];
  // Intensity settings
  baseIntensity: number;
  particleRate: number; // 0-1, how often particles spawn
  glitchRate: number;   // 0-1, how often glitches occur
  // Audio settings
  glitchTypes: Array<'static' | 'distort' | 'lowfreq'>;
  // CSS filter for game canvas
  canvasFilter: string;
}

/**
 * Pre-defined dimension themes
 */
export const DIMENSION_THEMES: Record<string, DimensionTheme> = {
  village: {
    id: 'village',
    name: 'The Refuge',
    particleColor: 'rgba(100, 180, 100, 0.5)',
    particleGlow: 'rgba(120, 200, 120, 0.6)',
    vignetteColor: 'rgba(0, 30, 0, 0.2)',
    scanlineColor: 'rgba(0, 50, 0, 0.02)',
    symbols: ['✦', '❋', '✿', '◇', '○', '△'],
    baseIntensity: 0.15,
    particleRate: 0.3,
    glitchRate: 0.05,
    glitchTypes: ['static'],
    canvasFilter: 'none',
  },
  beach: {
    id: 'beach',
    name: 'Shattered Coast',
    particleColor: 'rgba(80, 180, 220, 0.6)',
    particleGlow: 'rgba(100, 200, 255, 0.7)',
    vignetteColor: 'rgba(0, 20, 40, 0.25)',
    scanlineColor: 'rgba(0, 100, 150, 0.03)',
    symbols: ['≋', '∿', '◌', '◦', '⌇', '≈', '~'],
    baseIntensity: 0.25,
    particleRate: 0.5,
    glitchRate: 0.1,
    glitchTypes: ['static', 'distort'],
    canvasFilter: 'saturate(1.1) hue-rotate(-5deg)',
  },
  forest: {
    id: 'forest',
    name: 'Glitch Woods',
    particleColor: 'rgba(0, 255, 100, 0.7)',
    particleGlow: 'rgba(0, 255, 150, 0.9)',
    vignetteColor: 'rgba(0, 40, 0, 0.35)',
    scanlineColor: 'rgba(0, 255, 0, 0.04)',
    symbols: ['█', '▓', '▒', '░', '⌐', '¬', '│', '┤', '╡', '╢'],
    baseIntensity: 0.4,
    particleRate: 0.7,
    glitchRate: 0.25,
    glitchTypes: ['static', 'distort'],
    canvasFilter: 'saturate(0.9) brightness(0.95) contrast(1.1)',
  },
  cave: {
    id: 'cave',
    name: 'The Underdepths',
    particleColor: 'rgba(150, 80, 200, 0.7)',
    particleGlow: 'rgba(180, 100, 255, 0.8)',
    vignetteColor: 'rgba(20, 0, 40, 0.5)',
    scanlineColor: 'rgba(100, 0, 150, 0.04)',
    symbols: ['◈', '◇', '⬡', '⬢', '✧', '★', '☆', '∴', '∵'],
    baseIntensity: 0.5,
    particleRate: 0.6,
    glitchRate: 0.2,
    glitchTypes: ['lowfreq', 'distort'],
    canvasFilter: 'saturate(0.8) brightness(0.85) hue-rotate(20deg)',
  },
  desert: {
    id: 'desert',
    name: 'The Null Zone',
    particleColor: 'rgba(255, 0, 255, 0.6)',
    particleGlow: 'rgba(255, 100, 255, 0.8)',
    vignetteColor: 'rgba(40, 0, 40, 0.4)',
    scanlineColor: 'rgba(255, 0, 255, 0.03)',
    symbols: ['◯', '◎', '◉', '●', '○', '∅', '⊘', '⊙', '⊚'],
    baseIntensity: 0.55,
    particleRate: 0.65,
    glitchRate: 0.3,
    glitchTypes: ['static', 'lowfreq', 'distort'],
    canvasFilter: 'saturate(1.2) contrast(1.15) hue-rotate(-10deg)',
  },
  lavaland: {
    id: 'lavaland',
    name: 'The Core Breach',
    particleColor: 'rgba(255, 100, 0, 0.8)',
    particleGlow: 'rgba(255, 150, 50, 1)',
    vignetteColor: 'rgba(60, 0, 0, 0.5)',
    scanlineColor: 'rgba(255, 50, 0, 0.05)',
    symbols: ['▲', '△', '◢', '◣', '◤', '◥', '⚠', '☢', '⚡'],
    baseIntensity: 0.7,
    particleRate: 0.8,
    glitchRate: 0.4,
    glitchTypes: ['static', 'lowfreq', 'distort'],
    canvasFilter: 'saturate(1.3) brightness(1.05) sepia(0.15)',
  },
  boss: {
    id: 'boss',
    name: "Reality's Edge",
    particleColor: 'rgba(255, 255, 255, 0.9)',
    particleGlow: 'rgba(255, 255, 255, 1)',
    vignetteColor: 'rgba(0, 0, 0, 0.6)',
    scanlineColor: 'rgba(255, 255, 255, 0.06)',
    symbols: ['✕', '✖', '✗', '✘', '╳', '⨯', '☠', '⚔', '†', '‡'],
    baseIntensity: 0.85,
    particleRate: 0.9,
    glitchRate: 0.5,
    glitchTypes: ['static', 'lowfreq', 'distort'],
    canvasFilter: 'saturate(0.7) contrast(1.3) brightness(0.9)',
  },
};

export class FractureAtmosphere {
  private audioCtx: AudioContext | null = null;
  private container: HTMLElement | null = null;
  private particleContainer: HTMLElement | null = null;
  private scanlineOverlay: HTMLElement | null = null;
  private vignetteOverlay: HTMLElement | null = null;
  private enabled = true;
  private intensity = 0.3; // 0-1, how intense effects are

  // Current dimension theme
  private currentTheme: DimensionTheme = DIMENSION_THEMES.village;
  private currentZone: string = 'village';

  // Timers
  private glitchTimer: ReturnType<typeof setInterval> | null = null;
  private particleTimer: ReturnType<typeof setInterval> | null = null;

  // Fracture symbols for particles (default, overridden by theme)
  private readonly defaultSymbols = ['░', '▓', '█', '◢', '◣', '✕', '⚡', '◈', '⬡', '▲', '●', '◆', '╳', '⌁', '⏣'];
  private readonly corruptSymbols = ['̷', '̸', '̶', '̵', '̴']; // Zalgo-lite

  // Preloaded glitch sounds
  private glitchSounds: HTMLAudioElement[] = [];
  private numbersStation: HTMLAudioElement | null = null;
  private radioChatterTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initAudioContext();
    this.preloadGlitchSounds();
    this.preloadRadioChatter();
    this.createOverlays();
    this.startAmbientEffects();
  }

  private preloadGlitchSounds(): void {
    const soundFiles = ['glitch1.mp3', 'glitch2.mp3', 'glitch3.mp3'];
    soundFiles.forEach(file => {
      const audio = new Audio(`audio/sounds/${file}`);
      audio.volume = 0.2;
      AudioManager.registerAudio(audio);
      this.glitchSounds.push(audio);
    });
  }

  private preloadRadioChatter(): void {
    this.numbersStation = new Audio('audio/sounds/numbers.mp3');
    this.numbersStation.volume = 0.08; // Very quiet, eerie background
    AudioManager.registerAudio(this.numbersStation);
    this.startRadioChatterLoop();
  }

  private startRadioChatterLoop(): void {
    // Play numbers station randomly every 45-120 seconds
    const scheduleNext = () => {
      const delay = 45000 + Math.random() * 75000; // 45-120 seconds
      this.radioChatterTimer = setTimeout(() => {
        this.playRadioChatter();
        scheduleNext();
      }, delay);
    };
    // First broadcast after 30-60 seconds
    this.radioChatterTimer = setTimeout(() => {
      this.playRadioChatter();
      scheduleNext();
    }, 30000 + Math.random() * 30000);
  }

  private playRadioChatter(): void {
    if (!this.enabled || !this.numbersStation) return;

    // Play a random segment (5-15 seconds) of the numbers station
    const audio = this.numbersStation;
    const maxStart = Math.max(0, audio.duration - 15);
    audio.currentTime = Math.random() * maxStart;
    audio.volume = 0.05 + Math.random() * 0.08; // Vary volume slightly

    // Add slight static/distortion feel with fade in/out
    audio.play().catch(() => {});

    // Fade out after 5-12 seconds
    const playDuration = 5000 + Math.random() * 7000;
    setTimeout(() => {
      if (audio) {
        const fadeOut = setInterval(() => {
          if (audio.volume > 0.01) {
            audio.volume = Math.max(0, audio.volume - 0.01);
          } else {
            clearInterval(fadeOut);
            audio.pause();
          }
        }, 100);
      }
    }, playDuration);
  }

  /**
   * Play a random glitch sound effect
   */
  playRandomGlitch(volume = 0.2): void {
    if (!this.enabled || this.glitchSounds.length === 0) return;
    const sound = this.glitchSounds[Math.floor(Math.random() * this.glitchSounds.length)];
    sound.volume = volume;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  private initAudioContext(): void {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('[FractureAtmosphere] Web Audio not available');
    }
  }

  private createOverlays(): void {
    // Main container for effects
    this.container = document.createElement('div');
    this.container.id = 'fracture-atmosphere';
    this.container.innerHTML = `
      <style>
        #fracture-atmosphere {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 9999;
          /* CSS variables for dimension theming */
          --particle-color: rgba(180, 60, 60, 0.6);
          --particle-glow: rgba(180, 60, 60, 0.8);
          --vignette-color: rgba(0, 0, 0, 0.3);
          --scanline-color: rgba(0, 0, 0, 0.03);
        }

        .fracture-scanlines {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            var(--scanline-color) 2px,
            var(--scanline-color) 4px
          );
          opacity: 0.5;
          transition: background 1s ease;
        }

        .fracture-vignette {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(
            ellipse at center,
            transparent 50%,
            var(--vignette-color) 100%
          );
          transition: background 1.5s ease;
        }

        .fracture-particles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .fracture-particle {
          position: absolute;
          color: var(--particle-color);
          font-size: 14px;
          text-shadow: 0 0 5px var(--particle-glow);
          animation: fracture-float 8s ease-in-out infinite;
          user-select: none;
        }

        .fracture-particle.bright {
          filter: brightness(1.3);
          text-shadow: 0 0 10px var(--particle-glow), 0 0 20px var(--particle-glow);
        }

        @keyframes fracture-float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          50% {
            transform: translateY(-100px) rotate(180deg);
          }
        }

        .fracture-glitch {
          animation: fracture-glitch-anim 0.1s linear;
        }

        @keyframes fracture-glitch-anim {
          0% { filter: none; }
          20% { filter: hue-rotate(90deg) saturate(2); }
          40% { filter: invert(1); transform: translate(-2px, 1px); }
          60% { filter: hue-rotate(-90deg); transform: translate(2px, -1px); }
          80% { filter: saturate(0.5) brightness(1.2); }
          100% { filter: none; }
        }

        .fracture-chromatic {
          animation: fracture-chromatic-anim 0.3s ease-out;
        }

        @keyframes fracture-chromatic-anim {
          0% {
            text-shadow: -2px 0 red, 2px 0 cyan;
            filter: blur(0px);
          }
          50% {
            text-shadow: -4px 0 red, 4px 0 cyan;
            filter: blur(1px);
          }
          100% {
            text-shadow: none;
            filter: none;
          }
        }

        .fracture-flicker {
          animation: fracture-flicker-anim 0.15s steps(2);
        }

        @keyframes fracture-flicker-anim {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        /* Zone transition effect */
        .fracture-zone-transition {
          animation: zone-shift 0.8s ease-out;
        }

        @keyframes zone-shift {
          0% { filter: brightness(1.5) saturate(0); }
          50% { filter: brightness(0.5) saturate(2); }
          100% { filter: none; }
        }

        /* Dimension name display */
        .dimension-name {
          position: absolute;
          top: 80px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Press Start 2P', monospace;
          font-size: 16px;
          color: white;
          text-shadow: 0 0 10px var(--particle-glow), 2px 2px 0 rgba(0,0,0,0.8);
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }

        .dimension-name.visible {
          animation: dimension-reveal 3s ease-out forwards;
        }

        @keyframes dimension-reveal {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          15% { opacity: 1; transform: translateX(-50%) translateY(0); }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
      </style>
      <div class="fracture-scanlines"></div>
      <div class="fracture-vignette"></div>
      <div class="fracture-particles"></div>
      <div class="dimension-name"></div>
    `;

    document.body.appendChild(this.container);
    this.particleContainer = this.container.querySelector('.fracture-particles');
    this.scanlineOverlay = this.container.querySelector('.fracture-scanlines');
    this.vignetteOverlay = this.container.querySelector('.fracture-vignette');
  }

  private startAmbientEffects(): void {
    // Random visual glitches - rate based on theme
    this.glitchTimer = setInterval(() => {
      if (!this.enabled) return;
      // Use theme's glitch rate
      if (Math.random() > this.currentTheme.glitchRate) return;
      this.triggerVisualGlitch();
    }, 5000 + Math.random() * 10000);

    // Spawn floating particles - rate based on theme
    this.particleTimer = setInterval(() => {
      if (!this.enabled) return;
      // Use theme's particle rate
      if (Math.random() > this.currentTheme.particleRate) return;
      this.spawnParticle();
    }, 2000 + Math.random() * 3000);

    // Initial particles
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.spawnParticle(), i * 500);
    }
  }

  /**
   * Spawn a floating fracture symbol using current theme
   */
  private spawnParticle(): void {
    if (!this.particleContainer) return;

    const symbols = this.currentTheme.symbols.length > 0
      ? this.currentTheme.symbols
      : this.defaultSymbols;

    const particle = document.createElement('div');
    particle.className = 'fracture-particle' + (Math.random() > 0.7 ? ' bright' : '');
    particle.textContent = symbols[Math.floor(Math.random() * symbols.length)];

    // Apply theme colors directly to particle (for instant color change)
    particle.style.color = this.currentTheme.particleColor;
    particle.style.textShadow = `0 0 5px ${this.currentTheme.particleGlow}`;

    // Random position
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${60 + Math.random() * 40}%`;
    particle.style.animationDuration = `${6 + Math.random() * 6}s`;
    particle.style.animationDelay = `${Math.random() * 2}s`;
    particle.style.fontSize = `${10 + Math.random() * 12}px`;

    this.particleContainer.appendChild(particle);

    // Remove after animation
    setTimeout(() => particle.remove(), 15000);
  }

  /**
   * Set the dimension theme based on zone ID
   * Triggers visual transition and updates all theme-dependent elements
   */
  setDimensionTheme(zoneId: string, showName = true): void {
    const theme = DIMENSION_THEMES[zoneId] || DIMENSION_THEMES.village;

    // Skip if same zone
    if (this.currentZone === zoneId && this.currentTheme === theme) return;

    const previousZone = this.currentZone;
    this.currentZone = zoneId;
    this.currentTheme = theme;

    console.log(`[Fracture] Entering dimension: ${theme.name}`);

    // Update CSS variables
    if (this.container) {
      this.container.style.setProperty('--particle-color', theme.particleColor);
      this.container.style.setProperty('--particle-glow', theme.particleGlow);
      this.container.style.setProperty('--vignette-color', theme.vignetteColor);
      this.container.style.setProperty('--scanline-color', theme.scanlineColor);
    }

    // Update intensity to match zone
    this.setIntensity(theme.baseIntensity);

    // Apply canvas filter
    const gameCanvas = document.getElementById('canvas');
    if (gameCanvas) {
      gameCanvas.style.filter = theme.canvasFilter;
      gameCanvas.style.transition = 'filter 1s ease';
    }

    // Show dimension name on transition
    if (showName && previousZone !== zoneId) {
      this.showDimensionName(theme.name);
    }

    // Trigger transition effects
    if (previousZone !== zoneId) {
      this.triggerZoneTransition();
    }

    // Clear existing particles and spawn new themed ones
    if (this.particleContainer) {
      // Keep existing particles, new ones will use new theme
      for (let i = 0; i < Math.ceil(theme.particleRate * 5); i++) {
        setTimeout(() => this.spawnParticle(), i * 300);
      }
    }
  }

  /**
   * Show the dimension name briefly
   */
  private showDimensionName(name: string): void {
    const nameEl = this.container?.querySelector('.dimension-name') as HTMLElement;
    if (nameEl) {
      nameEl.textContent = name;
      nameEl.classList.remove('visible');
      // Force reflow to restart animation
      void nameEl.offsetWidth;
      nameEl.classList.add('visible');
    }
  }

  /**
   * Trigger zone transition visual effect
   */
  private triggerZoneTransition(): void {
    const gameContainer = document.getElementById('container');
    if (gameContainer) {
      gameContainer.classList.add('fracture-zone-transition');
      setTimeout(() => gameContainer.classList.remove('fracture-zone-transition'), 800);
    }

    // Play appropriate glitch sound
    const glitchType = this.currentTheme.glitchTypes[
      Math.floor(Math.random() * this.currentTheme.glitchTypes.length)
    ];
    this.playAudioGlitch(glitchType, 0.2);
    this.playRandomGlitch(0.15);
  }

  /**
   * Get the current dimension theme
   */
  getCurrentTheme(): DimensionTheme {
    return this.currentTheme;
  }

  /**
   * Get the current zone ID
   */
  getCurrentZone(): string {
    return this.currentZone;
  }

  /**
   * Trigger a brief visual glitch effect
   */
  triggerVisualGlitch(): void {
    const gameCanvas = document.getElementById('canvas');
    if (gameCanvas) {
      gameCanvas.classList.add('fracture-glitch');
      setTimeout(() => gameCanvas.classList.remove('fracture-glitch'), 100);
    }

    // Play real glitch sound
    if (Math.random() > 0.5) {
      this.playRandomGlitch(0.15);
    }
  }

  /**
   * Trigger screen flicker (for damage, corruption events)
   */
  triggerFlicker(): void {
    const body = document.body;
    body.classList.add('fracture-flicker');
    setTimeout(() => body.classList.remove('fracture-flicker'), 150);
  }

  /**
   * Trigger chromatic aberration effect
   */
  triggerChromatic(): void {
    const gameContainer = document.getElementById('container');
    if (gameContainer) {
      gameContainer.classList.add('fracture-chromatic');
      setTimeout(() => gameContainer.classList.remove('fracture-chromatic'), 300);
    }
  }

  /**
   * Play an audio glitch sound
   */
  playAudioGlitch(type: 'static' | 'distort' | 'lowfreq' = 'static', volume = 0.15): void {
    if (!this.audioCtx || !this.enabled) return;

    // Resume audio context if suspended
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const ctx = this.audioCtx;
    const duration = 0.05 + Math.random() * 0.1;
    const now = ctx.currentTime;

    switch (type) {
      case 'static': {
        // White noise burst
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(now);
        source.stop(now + duration);
        break;
      }

      case 'lowfreq': {
        // Low frequency rumble
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(30 + Math.random() * 20, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }

      case 'distort': {
        // Distorted tone
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100 + Math.random() * 200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + duration);

        const distortion = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i / 128) - 1;
          curve[i] = Math.tanh(x * 5);
        }
        distortion.curve = curve;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(distortion);
        distortion.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
        break;
      }
    }
  }

  /**
   * Corrupt text with zalgo-like characters
   */
  corruptText(text: string, intensity = 0.2): string {
    if (Math.random() > intensity) return text;

    return text.split('').map(char => {
      if (Math.random() > 0.8) {
        return char + this.corruptSymbols[Math.floor(Math.random() * this.corruptSymbols.length)];
      }
      return char;
    }).join('');
  }

  /**
   * Set overall intensity (0-1)
   */
  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value));

    // Update scanline visibility
    if (this.scanlineOverlay) {
      this.scanlineOverlay.style.opacity = String(0.3 + this.intensity * 0.4);
    }
  }

  /**
   * Enable/disable effects
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.container) {
      this.container.style.display = enabled ? 'block' : 'none';
    }
  }

  /**
   * Trigger effects when player takes damage
   */
  onPlayerDamage(): void {
    this.triggerFlicker();
    this.playRandomGlitch(0.12);
  }

  /**
   * Trigger effects when entering corrupted area
   */
  onEnterCorruptedArea(): void {
    this.setIntensity(0.6);
    this.triggerChromatic();
    this.playRandomGlitch(0.25);
    this.playAudioGlitch('lowfreq', 0.15);

    // Spawn extra particles
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.spawnParticle(), i * 200);
    }
  }

  /**
   * Reset to normal intensity
   */
  onLeaveCorruptedArea(): void {
    this.setIntensity(0.3);
  }

  /**
   * Trigger death effect
   */
  onPlayerDeath(): void {
    this.triggerVisualGlitch();
    this.triggerChromatic();
    this.playRandomGlitch(0.3);
    this.playAudioGlitch('lowfreq', 0.2);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.glitchTimer) clearInterval(this.glitchTimer);
    if (this.particleTimer) clearInterval(this.particleTimer);
    if (this.radioChatterTimer) clearTimeout(this.radioChatterTimer);
    if (this.numbersStation) {
      this.numbersStation.pause();
      this.numbersStation = null;
    }
    if (this.container) this.container.remove();
    if (this.audioCtx) this.audioCtx.close();
  }
}
