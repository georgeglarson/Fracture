import {Area} from './map/area';
import {Detect} from './utils/detect';

import * as _ from 'lodash';

/**
 * AudioManager - Centralized audio control with single point of state management
 *
 * Pattern: All audio state changes flow through setEnabled().
 * Individual play methods check enabled as a guard, but state transitions
 * are handled in one place to prevent audio leaks.
 */
export class AudioManager {

  game;
  extension;
  private _enabled = true;
  sounds = {};
  currentMusic = null;
  areas = [];
  musicNames = ['village', 'beach', 'forest', 'cave', 'desert', 'lavaland', 'boss', 'graveyard'];
  soundNames = ['loot', 'hit1', 'hit2', 'hurt', 'heal', 'chat', 'revive', 'death', 'firefox', 'achievement', 'kill1', 'kill2', 'noloot', 'teleport', 'chest', 'npc', 'npc-end', 'levelup', 'gold', 'equip', 'quest'];

  // Combat music state
  inCombat = false;
  combatTimeout: ReturnType<typeof setTimeout> | null = null;
  savedZoneMusic = null;
  combatMusicName = 'boss';

  // Volume controls
  masterVolume = 1.0;
  musicVolume = 1.0;
  sfxVolume = 1.0;

  // NPC voice audio element for TTS playback
  private npcVoiceAudio: HTMLAudioElement | null = null;


  constructor(game) {
    var self = this;
    this.game = game;
    this.extension = Detect.canPlayMP3() ? 'mp3' : 'ogg';


    var loadSoundFiles = function () {
      var counter = _.size(self.soundNames);
      console.info('Loading sound files...');
      _.each(self.soundNames, function (name) {
        self.loadSound(name, function () {
          counter -= 1;
          if (counter === 0) {
            if (!Detect.isSafari()) {
              loadMusicFiles();
            }
          }
        });
      });
    };

    var loadMusicFiles = function () {
      if (!self.game.renderer.mobile) {
        console.info('Loading music files...');
        self.loadMusic(self.musicNames.shift(), function () {
          _.each(self.musicNames, function (name) {
            self.loadMusic(name);
          });
        });
      }
    };

    if (!(Detect.isSafari() && Detect.isWindows())) {
      loadSoundFiles();
    } else {
      this._enabled = false;
    }
  }

  // ============================================================================
  // AUDIO GATE - Single point of control for enabled state
  // ============================================================================

  /**
   * Check if audio is enabled (read-only access)
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Central method for enabling/disabling all audio.
   * ALL state transitions flow through here to prevent audio leaks.
   */
  setEnabled(enabled: boolean): void {
    if (this._enabled === enabled) return;

    this._enabled = enabled;

    if (!enabled) {
      // DISABLE: Stop everything immediately
      this.stopAll();
    } else {
      // ENABLE: Resume music based on current location
      this.currentMusic = null;
      this.updateMusic();
    }

    console.debug('[Audio] Enabled:', enabled);
  }

  /**
   * Toggle audio on/off
   */
  toggle(): void {
    this.setEnabled(!this._enabled);
  }

  /**
   * Stop ALL audio - music, sfx, voice, fades
   * Called when disabling audio to ensure nothing leaks through
   */
  private stopAll(): void {
    // Stop current music
    if (this.currentMusic) {
      this.clearFadeIn(this.currentMusic);
      this.clearFadeOut(this.currentMusic);
      this.resetMusic(this.currentMusic);
    }

    // Stop NPC voice
    if (this.npcVoiceAudio) {
      this.npcVoiceAudio.pause();
      this.npcVoiceAudio.currentTime = 0;
      this.npcVoiceAudio = null;
    }

    // Stop all sound channels
    for (const name in this.sounds) {
      const channels = this.sounds[name];
      if (channels) {
        for (const sound of channels) {
          if (sound && !sound.paused) {
            sound.pause();
            sound.currentTime = 0;
          }
        }
      }
    }

    // Clear combat state
    if (this.combatTimeout) {
      clearTimeout(this.combatTimeout);
      this.combatTimeout = null;
    }
    this.inCombat = false;
  }

  // ============================================================================
  // VOLUME CONTROL
  // ============================================================================

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyVolumes();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.applyVolumes();
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  getMusicVolume(): number {
    return this.masterVolume * this.musicVolume;
  }

  getSfxVolume(): number {
    return this.masterVolume * this.sfxVolume;
  }

  applyVolumes(): void {
    if (this.currentMusic?.sound && !this.currentMusic.sound.fadingIn && !this.currentMusic.sound.fadingOut) {
      this.currentMusic.sound.volume = this.getMusicVolume();
    }
  }

  /**
   * Initialize volume settings from storage
   */
  initVolumeSettings(masterVolume: number, musicVolume: number, sfxVolume: number, muted: boolean): void {
    this.masterVolume = masterVolume;
    this.musicVolume = musicVolume;
    this.sfxVolume = sfxVolume;

    // Use setEnabled for mute state - centralizes the logic
    if (muted && this._enabled) {
      this.setEnabled(false);
    }

    this.applyVolumes();
  }

  // ============================================================================
  // SOUND LOADING
  // ============================================================================

  load(basePath, name, loaded_callback, channels): void {
    var path = basePath + name + '.' + this.extension,
      sound = document.createElement('audio'),
      self = this;

    sound.addEventListener('canplaythrough', function (e) {
      console.debug(path + ' is ready to play.');
      if (loaded_callback) {
        loaded_callback();
      }
    }, false);

    sound.addEventListener('error', function (e) {
      console.error('Error: ' + path + ' could not be loaded.');
      self.sounds[name] = null;
    }, false);

    sound.preload = 'auto';
    sound.src = path;
    sound.load();

    this.sounds[name] = [sound];
    _.times(channels - 1, function () {
      self.sounds[name].push(sound.cloneNode(true));
    });
  }

  loadSound(name, handleLoaded): void {
    this.load('audio/sounds/', name, handleLoaded, 4);
  }

  loadMusic(name, handleLoaded?): void {
    var self = this;
    this.load('audio/music/', name, handleLoaded, 1);
    var music = this.sounds[name][0];
    music.loop = true;

    // Loop handler checks enabled state through the gate
    music.addEventListener('ended', function () {
      if (self._enabled) {
        music.play();
      }
    }, false);
  }

  getSound(name) {
    if (!this.sounds[name]) {
      return null;
    }
    var sound: any = _.detect(this.sounds[name], function (sound) {
      return sound.ended || sound.paused;
    });
    if (sound) {
      sound.currentTime = 0;
    } else {
      sound = this.sounds[name][0];
    }
    return sound;
  }

  // ============================================================================
  // SOUND PLAYBACK - All methods check enabled as guard
  // ============================================================================

  playSound(name): void {
    if (!this._enabled) return;

    var sound = this.getSound(name);
    if (sound) {
      sound.volume = this.getSfxVolume();
      sound.play();
    }
  }

  /**
   * Play NPC voice from TTS audio URL
   */
  playNpcVoice(audioUrl: string): void {
    if (!this._enabled) return;

    // Stop any currently playing NPC voice
    if (this.npcVoiceAudio) {
      this.npcVoiceAudio.pause();
      this.npcVoiceAudio.currentTime = 0;
    }

    this.npcVoiceAudio = new Audio(audioUrl);
    this.npcVoiceAudio.volume = this.getSfxVolume();

    this.npcVoiceAudio.addEventListener('canplaythrough', () => {
      // Double-check enabled state when audio is ready (async)
      if (this._enabled && this.npcVoiceAudio) {
        this.npcVoiceAudio.play().catch(err => {
          console.warn('[Audio] Failed to play NPC voice:', err);
        });
      }
    }, { once: true });

    this.npcVoiceAudio.addEventListener('error', (e) => {
      console.error('[Audio] NPC voice failed to load:', audioUrl, e);
    }, { once: true });

    this.npcVoiceAudio.load();
    console.log('[Audio] Playing NPC voice:', audioUrl);
  }

  /**
   * Stop NPC voice (public for external callers like dialogue close)
   */
  stopNpcVoice(): void {
    if (this.npcVoiceAudio) {
      this.npcVoiceAudio.pause();
      this.npcVoiceAudio.currentTime = 0;
      this.npcVoiceAudio = null;
    }
  }

  // ============================================================================
  // MUSIC AREAS
  // ============================================================================

  addArea(x, y, width, height, musicName): void {
    var area: any = new Area(x, y, width, height);
    area.musicName = musicName;
    this.areas.push(area);
  }

  getSurroundingMusic(entity) {
    if (!entity) return null;

    var music = null,
      area: any = _.detect(this.areas, function (area) {
        return area.contains(entity);
      });

    if (area) {
      music = {sound: this.getSound(area.musicName), name: area.musicName};
    }
    return music;
  }

  // ============================================================================
  // MUSIC PLAYBACK
  // ============================================================================

  updateMusic(): void {
    if (!this._enabled) return;

    var music = this.getSurroundingMusic(this.game.player);

    if (music) {
      if (!this.isCurrentMusic(music)) {
        if (this.currentMusic) {
          this.fadeOutCurrentMusic();
        }
        this.playMusic(music);
      }
    } else {
      this.fadeOutCurrentMusic();
    }
  }

  isCurrentMusic(music): boolean {
    return this.currentMusic && (music.name === this.currentMusic.name);
  }

  playMusic(music): void {
    if (!this._enabled || !music?.sound) return;

    if (music.sound.fadingOut) {
      this.fadeInMusic(music);
    } else {
      music.sound.volume = this.getMusicVolume();
      music.sound.play();
    }
    this.currentMusic = music;
  }

  resetMusic(music): void {
    if (music?.sound?.readyState > 0) {
      music.sound.pause();
      music.sound.currentTime = 0;
    }
  }

  fadeOutMusic(music, ended_callback): void {
    var self = this;
    if (music && !music.sound.fadingOut) {
      this.clearFadeIn(music);
      music.sound.fadingOut = setInterval(function () {
        var step = 0.02,
        volume = music.sound.volume - step;

        if (self._enabled && volume >= step) {
          music.sound.volume = volume;
        } else {
          music.sound.volume = 0;
          self.clearFadeOut(music);
          ended_callback(music);
        }
      }, 50);
    }
  }

  fadeInMusic(music): void {
    var self = this;
    if (music && !music.sound.fadingIn) {
      this.clearFadeOut(music);
      const targetVolume = this.getMusicVolume();
      music.sound.fadingIn = setInterval(function () {
        var step = 0.01,
        volume = music.sound.volume + step;

        if (self._enabled && volume < targetVolume - step) {
          music.sound.volume = volume;
        } else {
          music.sound.volume = targetVolume;
          self.clearFadeIn(music);
        }
      }, 30);
    }
  }

  clearFadeOut(music): void {
    if (music?.sound?.fadingOut) {
      clearInterval(music.sound.fadingOut);
      music.sound.fadingOut = null;
    }
  }

  clearFadeIn(music): void {
    if (music?.sound?.fadingIn) {
      clearInterval(music.sound.fadingIn);
      music.sound.fadingIn = null;
    }
  }

  fadeOutCurrentMusic(): void {
    var self = this;
    if (this.currentMusic) {
      this.fadeOutMusic(this.currentMusic, function (music) {
        self.resetMusic(music);
      });
      this.currentMusic = null;
    }
  }

  // ============================================================================
  // COMBAT MUSIC
  // ============================================================================

  enterCombat(): void {
    if (!this._enabled) return;

    // Clear any pending combat exit
    if (this.combatTimeout) {
      clearTimeout(this.combatTimeout);
      this.combatTimeout = null;
    }

    if (this.inCombat) return;

    this.inCombat = true;

    // Save current zone music to restore later
    if (this.currentMusic && this.currentMusic.name !== this.combatMusicName) {
      this.savedZoneMusic = this.currentMusic;
    }

    // Fade to combat music
    const combatSound = this.getSound(this.combatMusicName);
    if (combatSound) {
      const combatMusic = { sound: combatSound, name: this.combatMusicName };
      if (this.currentMusic && this.currentMusic.name !== this.combatMusicName) {
        this.fadeOutMusic(this.currentMusic, () => {
          this.resetMusic(this.currentMusic);
        });
      }
      this.playMusic(combatMusic);
      console.debug('[Audio] Combat music started');
    }
  }

  exitCombat(): void {
    if (!this._enabled || !this.inCombat) return;

    if (this.combatTimeout) {
      clearTimeout(this.combatTimeout);
    }

    // Delay exit to allow for continuous combat
    this.combatTimeout = setTimeout(() => {
      this.inCombat = false;
      this.combatTimeout = null;

      if (this.currentMusic?.name === this.combatMusicName) {
        this.fadeOutMusic(this.currentMusic, () => {
          this.resetMusic(this.currentMusic);
          this.currentMusic = null;
          this.updateMusic();
        });
      }
      console.debug('[Audio] Combat music ended');
    }, 5000);
  }

  refreshCombat(): void {
    if (this.inCombat) {
      if (this.combatTimeout) {
        clearTimeout(this.combatTimeout);
        this.combatTimeout = null;
      }
      this.exitCombat();
    }
  }
}
