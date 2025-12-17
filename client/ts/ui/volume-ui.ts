/**
 * VolumeUI - Handles volume controls panel
 * Single Responsibility: Manage audio volume UI
 */

import { AudioManager } from '../audio';
import { Storage } from '../utils/storage';

export interface VolumeCallbacks {
  getAudioManager: () => AudioManager;
  getStorage: () => Storage;
}

export class VolumeUI {
  private callbacks: VolumeCallbacks | null = null;
  private panel: HTMLElement | null = null;
  private isOpen = false;

  constructor() {
    this.createPanel();
  }

  setCallbacks(callbacks: VolumeCallbacks): void {
    this.callbacks = callbacks;
    // Don't load settings immediately - audio manager may not exist yet
    // Settings will be loaded when panel is first opened
  }

  private createPanel(): void {
    // Create volume panel element
    const panel = document.createElement('div');
    panel.id = 'volume-panel';
    panel.className = 'volume-panel';
    panel.innerHTML = `
      <div class="volume-header">Audio Settings</div>
      <div class="volume-control">
        <label>Master</label>
        <input type="range" id="volume-master" min="0" max="100" value="100">
        <span id="volume-master-val">100%</span>
      </div>
      <div class="volume-control">
        <label>Music</label>
        <input type="range" id="volume-music" min="0" max="100" value="100">
        <span id="volume-music-val">100%</span>
      </div>
      <div class="volume-control">
        <label>SFX</label>
        <input type="range" id="volume-sfx" min="0" max="100" value="100">
        <span id="volume-sfx-val">100%</span>
      </div>
      <div class="volume-mute">
        <label>
          <input type="checkbox" id="volume-mute-all">
          Mute All
        </label>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    // Add event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const masterSlider = document.getElementById('volume-master') as HTMLInputElement;
    const musicSlider = document.getElementById('volume-music') as HTMLInputElement;
    const sfxSlider = document.getElementById('volume-sfx') as HTMLInputElement;
    const muteCheckbox = document.getElementById('volume-mute-all') as HTMLInputElement;

    if (masterSlider) {
      masterSlider.addEventListener('input', () => {
        const value = parseInt(masterSlider.value, 10);
        this.updateMasterVolume(value);
      });
    }

    if (musicSlider) {
      musicSlider.addEventListener('input', () => {
        const value = parseInt(musicSlider.value, 10);
        this.updateMusicVolume(value);
      });
    }

    if (sfxSlider) {
      sfxSlider.addEventListener('input', () => {
        const value = parseInt(sfxSlider.value, 10);
        this.updateSfxVolume(value);
      });
    }

    if (muteCheckbox) {
      muteCheckbox.addEventListener('change', () => {
        this.toggleMute(muteCheckbox.checked);
      });
    }

    // Stop clicks inside panel from reaching the game
    if (this.panel) {
      this.panel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Close panel when clicking outside (use capture phase)
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.panel) {
        const muteBtn = document.getElementById('mutebutton');
        const clickedInPanel = this.panel.contains(e.target as Node);
        const clickedMuteBtn = muteBtn && muteBtn.contains(e.target as Node);

        if (!clickedInPanel && !clickedMuteBtn) {
          this.hide();
        }
      }
    }, true); // Use capture phase to run before other handlers
  }

  private updateMasterVolume(value: number): void {
    const valSpan = document.getElementById('volume-master-val');
    if (valSpan) valSpan.textContent = `${value}%`;

    if (this.callbacks) {
      const audio = this.callbacks.getAudioManager();
      audio.setMasterVolume(value / 100);
      this.saveSettings();
    }
  }

  private updateMusicVolume(value: number): void {
    const valSpan = document.getElementById('volume-music-val');
    if (valSpan) valSpan.textContent = `${value}%`;

    if (this.callbacks) {
      const audio = this.callbacks.getAudioManager();
      audio.setMusicVolume(value / 100);
      this.saveSettings();
    }
  }

  private updateSfxVolume(value: number): void {
    const valSpan = document.getElementById('volume-sfx-val');
    if (valSpan) valSpan.textContent = `${value}%`;

    if (this.callbacks) {
      const audio = this.callbacks.getAudioManager();
      audio.setSfxVolume(value / 100);
      this.saveSettings();
    }
  }

  private toggleMute(muted: boolean): void {
    if (this.callbacks) {
      const audio = this.callbacks.getAudioManager();
      // Use centralized setEnabled for all state transitions
      audio.setEnabled(!muted);
      this.saveSettings();

      // Update mute button visual
      const muteBtn = document.getElementById('mutebutton');
      if (muteBtn) {
        muteBtn.classList.toggle('active', !muted);
      }
    }
  }

  private loadSettings(): void {
    if (!this.callbacks) return;

    const storage = this.callbacks.getStorage();
    if (!storage) return;

    const settings = storage.getAudioSettings();
    const audio = this.callbacks.getAudioManager();

    // Apply settings to audio manager (if it exists)
    if (!audio) {
      console.warn('[VolumeUI] Audio manager not available yet');
      return;
    }

    audio.initVolumeSettings(
      settings.masterVolume,
      settings.musicVolume,
      settings.sfxVolume,
      settings.muted
    );

    // Update UI
    const masterSlider = document.getElementById('volume-master') as HTMLInputElement;
    const musicSlider = document.getElementById('volume-music') as HTMLInputElement;
    const sfxSlider = document.getElementById('volume-sfx') as HTMLInputElement;
    const muteCheckbox = document.getElementById('volume-mute-all') as HTMLInputElement;
    const masterVal = document.getElementById('volume-master-val');
    const musicVal = document.getElementById('volume-music-val');
    const sfxVal = document.getElementById('volume-sfx-val');

    if (masterSlider) {
      masterSlider.value = String(Math.round(settings.masterVolume * 100));
      if (masterVal) masterVal.textContent = `${masterSlider.value}%`;
    }
    if (musicSlider) {
      musicSlider.value = String(Math.round(settings.musicVolume * 100));
      if (musicVal) musicVal.textContent = `${musicSlider.value}%`;
    }
    if (sfxSlider) {
      sfxSlider.value = String(Math.round(settings.sfxVolume * 100));
      if (sfxVal) sfxVal.textContent = `${sfxSlider.value}%`;
    }
    if (muteCheckbox) {
      muteCheckbox.checked = settings.muted;
    }

    // Update mute button visual
    const muteBtn = document.getElementById('mutebutton');
    if (muteBtn) {
      muteBtn.classList.toggle('active', !settings.muted);
    }
  }

  private saveSettings(): void {
    if (!this.callbacks) return;

    const storage = this.callbacks.getStorage();
    const audio = this.callbacks.getAudioManager();

    storage.saveAudioSettings(
      audio.masterVolume,
      audio.musicVolume,
      audio.sfxVolume,
      !audio.enabled
    );
  }

  toggle(): void {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Toggle mute state (called when mute button is clicked)
   */
  toggleMuteState(): void {
    if (!this.callbacks) return;

    const audio = this.callbacks.getAudioManager();
    if (!audio) return;

    // Toggle using the centralized setEnabled method
    audio.toggle();

    // Update button visual to match new state
    this.updateMuteButton();

    // Save settings
    this.saveSettings();
  }

  /**
   * Update mute button visual to match audio state
   */
  updateMuteButton(): void {
    if (!this.callbacks) return;

    const audio = this.callbacks.getAudioManager();
    const muteBtn = document.getElementById('mutebutton');

    if (muteBtn && audio) {
      // active = sound on (🔊), no active = muted (🔇)
      if (audio.enabled) {
        muteBtn.classList.add('active');
      } else {
        muteBtn.classList.remove('active');
      }
    }
  }

  /**
   * Initialize mute button state on game load
   * Call this after audio manager is ready
   */
  initMuteButtonState(): void {
    this.updateMuteButton();
  }

  show(): void {
    if (this.panel) {
      // Load settings when panel opens (audio manager should exist by now)
      this.loadSettings();
      this.panel.classList.add('active');
      this.isOpen = true;
    }
  }

  hide(): void {
    if (this.panel) {
      this.panel.classList.remove('active');
      this.isOpen = false;
    }
  }
}
