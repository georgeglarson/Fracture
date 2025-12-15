/**
 * Venice AI Module for PixelQuest
 *
 * This module provides AI-powered features:
 * - NPC Dialogue (DialogueService)
 * - Quest Generation (QuestService)
 * - AI Companion Hints (CompanionService)
 * - Event Narration (NarratorService)
 * - Entity Thoughts (ThoughtService)
 * - Town Crier News (NewsService)
 * - Player Profiles (ProfileService)
 *
 * Use VeniceService facade for backward compatibility,
 * or import individual services for specific needs.
 */

// Core types
export * from './types';
export * from './npc-personalities';

// Main facade (backward compatible)
export * from './venice.service';

// Individual services (for advanced usage)
export { VeniceClient } from './venice-client';
export { ProfileService } from './profile.service';
export { DialogueService } from './dialogue.service';
export { QuestService } from './quest.service';
export { CompanionService } from './companion.service';
export { NarratorService } from './narrator.service';
export { ThoughtService } from './thought.service';
export { NewsService } from './news.service';

// AI Players
export * from './aiplayer';

// Fish Audio TTS
export { FishAudioService, initFishAudioService, getFishAudioService, VOICES } from './fish-audio.service';
export type { VoiceType, TTSResult } from './fish-audio.service';
