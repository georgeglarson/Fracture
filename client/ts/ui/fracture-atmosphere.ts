/**
 * FractureAtmosphere - Creates an unsettling, glitchy atmosphere
 * Combines audio glitches, visual effects, and floating particles
 */

export class FractureAtmosphere {
  private audioCtx: AudioContext | null = null;
  private container: HTMLElement | null = null;
  private particleContainer: HTMLElement | null = null;
  private scanlineOverlay: HTMLElement | null = null;
  private enabled = true;
  private intensity = 0.3; // 0-1, how intense effects are

  // Timers
  private glitchTimer: ReturnType<typeof setInterval> | null = null;
  private particleTimer: ReturnType<typeof setInterval> | null = null;

  // Fracture symbols for particles
  private readonly symbols = ['░', '▓', '█', '◢', '◣', '✕', '⚡', '◈', '⬡', '▲', '●', '◆', '╳', '⌁', '⏣'];
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
      this.glitchSounds.push(audio);
    });
  }

  private preloadRadioChatter(): void {
    this.numbersStation = new Audio('audio/sounds/numbers.mp3');
    this.numbersStation.volume = 0.08; // Very quiet, eerie background
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
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          );
          opacity: 0.5;
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
            rgba(0, 0, 0, 0.3) 100%
          );
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
          color: rgba(180, 60, 60, 0.6);
          font-size: 14px;
          text-shadow: 0 0 5px rgba(180, 60, 60, 0.8);
          animation: fracture-float 8s ease-in-out infinite;
          user-select: none;
        }

        .fracture-particle.bright {
          color: rgba(220, 100, 100, 0.8);
          text-shadow: 0 0 10px rgba(255, 100, 100, 0.9);
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
      </style>
      <div class="fracture-scanlines"></div>
      <div class="fracture-vignette"></div>
      <div class="fracture-particles"></div>
    `;

    document.body.appendChild(this.container);
    this.particleContainer = this.container.querySelector('.fracture-particles');
    this.scanlineOverlay = this.container.querySelector('.fracture-scanlines');
  }

  private startAmbientEffects(): void {
    // Random visual glitches
    this.glitchTimer = setInterval(() => {
      if (!this.enabled || Math.random() > this.intensity * 0.3) return;
      this.triggerVisualGlitch();
    }, 5000 + Math.random() * 10000);

    // Spawn floating particles
    this.particleTimer = setInterval(() => {
      if (!this.enabled || Math.random() > this.intensity) return;
      this.spawnParticle();
    }, 2000 + Math.random() * 3000);

    // Initial particles
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.spawnParticle(), i * 500);
    }
  }

  /**
   * Spawn a floating fracture symbol
   */
  private spawnParticle(): void {
    if (!this.particleContainer) return;

    const particle = document.createElement('div');
    particle.className = 'fracture-particle' + (Math.random() > 0.7 ? ' bright' : '');
    particle.textContent = this.symbols[Math.floor(Math.random() * this.symbols.length)];

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
