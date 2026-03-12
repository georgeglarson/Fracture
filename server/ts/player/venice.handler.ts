/**
 * VeniceHandler - Handles all Venice AI interactions for players
 *
 * Single Responsibility: AI-powered NPC dialogue, quests, narrator, etc.
 * Extracted from Player.ts to reduce its size.
 */

import { Types } from '../../../shared/ts/gametypes';
import { Messages } from '../message';
import { getVeniceService, getFishAudioService } from '../ai';
import { isMerchant, getShopInventory } from '../shop/shop.service';
import { shopService } from '../shop/shop.service';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Venice');

/**
 * Player interface for Venice handler
 */
export interface VenicePlayerContext {
  id: number;
  name: string;
  send: (message: any) => void;
}

/**
 * Generate TTS audio for dialogue
 */
async function generateTTS(text: string, npcType: string): Promise<string | null> {
  const fishAudio = getFishAudioService();
  if (!fishAudio || !npcType) return null;

  try {
    const result = await fishAudio.textToSpeech(text, npcType);
    if (result) {
      log.debug({ npcType, audioUrl: result.audioUrl, cached: result.cached }, 'Generated TTS');
      return result.audioUrl;
    }
  } catch (error) {
    log.error({ err: error }, 'FishAudio TTS error');
  }
  return null;
}

/**
 * Handle NPC dialogue request
 */
export async function handleNpcTalk(ctx: VenicePlayerContext, npcKind: number): Promise<void> {
  log.debug({ npcKind }, 'handleNpcTalk');
  const venice = getVeniceService();
  const npcType = Types.getKindAsString(npcKind);

  // Check if this NPC is a merchant - if so, send shop data too
  if (isMerchant(npcKind)) {
    const shop = getShopInventory(npcKind);
    if (shop) {
      log.debug({ shopName: shop.name }, 'Opening shop');
      const items = shopService.getInventoryWithStock(npcKind);
      ctx.send(new Messages.ShopOpen(npcKind, shop.name, items || []).serialize());
    }
  }

  if (!npcType) {
    ctx.send(new Messages.NpcTalkResponse(npcKind, '...', null).serialize());
    return;
  }

  // If Venice isn't available, use static NPC personality greetings
  if (!venice) {
    const { NPC_PERSONALITIES } = await import('../ai/npc-personalities.js');
    const personality = NPC_PERSONALITIES[npcType.toLowerCase()];
    const fallback = personality ? personality.greeting : '...';
    const audioUrl = await generateTTS(fallback, npcType);
    ctx.send(new Messages.NpcTalkResponse(npcKind, fallback, audioUrl).serialize());
    return;
  }

  try {
    log.debug({ npcType }, 'Generating dialogue');
    const response = await venice.generateNpcDialogue(
      npcType,
      ctx.name,
      ctx.id.toString()
    );
    log.debug({ response }, 'Got dialogue response');

    const audioUrl = await generateTTS(response, npcType);
    ctx.send(new Messages.NpcTalkResponse(npcKind, response, audioUrl).serialize());
  } catch (error) {
    log.error({ err: error }, 'Venice NPC talk error');
    const fallback = venice.getFallback(npcType);
    const audioUrl = await generateTTS(fallback, npcType);
    ctx.send(new Messages.NpcTalkResponse(npcKind, fallback, audioUrl).serialize());
  }
}

/**
 * Handle quest request from NPC
 */
export async function handleRequestQuest(ctx: VenicePlayerContext, npcKind: number): Promise<void> {
  const venice = getVeniceService();
  const npcType = Types.getKindAsString(npcKind);

  if (!venice || !npcType) {
    return;
  }

  try {
    const quest = await venice.generateQuest(ctx.id.toString(), npcType);
    ctx.send(new Messages.QuestOffer(quest).serialize());
  } catch (error) {
    log.error({ err: error }, 'Venice quest generation error');
  }
}

/**
 * Handle mob kill - for quest tracking and narration
 */
export function handleKill(ctx: VenicePlayerContext, mobType: string, triggerNarration: (event: string, details?: Record<string, any>) => Promise<void>): void {
  const venice = getVeniceService();
  if (!venice) return;

  const profile = venice.getProfile(ctx.id.toString());
  const prevKills = profile.totalKills;

  const result = venice.recordKill(ctx.id.toString(), mobType);
  if (result && result.completed) {
    ctx.send(new Messages.QuestComplete(result).serialize());
  }

  const newKills = profile.totalKills;

  // First kill ever
  if (prevKills === 0 && newKills === 1) {
    triggerNarration('firstKill', { mobType });
  }
  // Kill milestones (10, 25, 50, 100, etc.)
  else if ([10, 25, 50, 100, 250, 500].includes(newKills)) {
    triggerNarration('killMilestone', { mobType, count: newKills });
  }
  // Boss kill
  else if (mobType.toLowerCase() === 'boss' || mobType.toLowerCase() === 'skeleton2') {
    triggerNarration('bossKill', { bossType: mobType });
  }
}

/**
 * Handle area change - for quest tracking and companion hints
 */
export async function handleAreaChange(ctx: VenicePlayerContext, area: string, triggerNarration: (event: string, details?: Record<string, any>) => Promise<void>): Promise<void> {
  const venice = getVeniceService();
  if (!venice) return;

  const profile = venice.getProfile(ctx.id.toString());
  const isNewArea = !profile.areas.includes(area);

  const result = venice.recordArea(ctx.id.toString(), area);
  if (result && result.completed) {
    ctx.send(new Messages.QuestComplete(result).serialize());
  }

  // AI Narrator: Announce new area discovery
  if (isNewArea) {
    triggerNarration('newArea', { area });
  }

  // Send companion hint for new area
  const hint = await venice.getCompanionHint(ctx.id.toString(), 'newArea', { area });
  if (hint) {
    ctx.send(new Messages.CompanionHint(hint).serialize());
  }
}

/**
 * Handle item pickup - for lore generation
 */
export async function handleItemPickup(ctx: VenicePlayerContext, itemKind: number): Promise<void> {
  const venice = getVeniceService();
  if (!venice) return;

  const itemType = Types.getKindAsString(itemKind);
  if (itemType) {
    venice.recordItem(ctx.id.toString(), itemType);
    const lore = await venice.generateItemLore(itemType);
    ctx.send(new Messages.ItemLore(itemKind, lore).serialize());
  }
}

/**
 * Handle low health - for companion hints
 */
export async function handleLowHealth(ctx: VenicePlayerContext, healthPercent: number): Promise<void> {
  const venice = getVeniceService();
  if (!venice) return;

  const hint = await venice.getCompanionHint(
    ctx.id.toString(),
    'lowHealth',
    { percent: Math.round(healthPercent * 100) }
  );
  if (hint) {
    ctx.send(new Messages.CompanionHint(hint).serialize());
  }
}

/**
 * Handle player death - for companion hints and narration
 */
export async function handleDeath(ctx: VenicePlayerContext, killerType: string, triggerNarration: (event: string, details?: Record<string, any>) => Promise<void>): Promise<void> {
  const venice = getVeniceService();
  if (!venice) return;

  venice.recordDeath(ctx.id.toString());

  // AI Narrator: Dramatic death commentary
  triggerNarration('death', { killer: killerType });

  const hint = await venice.getCompanionHint(
    ctx.id.toString(),
    'death',
    { killer: killerType }
  );
  if (hint) {
    ctx.send(new Messages.CompanionHint(hint).serialize());
  }
}

/**
 * Cleanup Venice data when player disconnects
 */
export function cleanupVenice(playerId: string): void {
  const venice = getVeniceService();
  if (venice) {
    venice.cleanupPlayer(playerId);
  }
}

/**
 * Handle news request (Town Crier)
 */
export async function handleNewsRequest(ctx: VenicePlayerContext): Promise<void> {
  log.debug({ player: ctx.name }, 'handleNewsRequest');
  const venice = getVeniceService();
  if (!venice) {
    ctx.send(new Messages.NewsResponse([]).serialize());
    return;
  }

  try {
    const newspaper = await venice.generateNewspaper();
    log.debug({ headlineCount: newspaper.headlines.length }, 'Generated headlines');
    const response = new Messages.NewsResponse(newspaper.headlines).serialize();
    ctx.send(response);
  } catch (error) {
    log.error({ err: error }, 'Venice newspaper error');
    ctx.send(new Messages.NewsResponse(['No news today...']).serialize());
  }
}

// Narration state tracking
const narrationState = new Map<number, { lastTime: number }>();
const NARRATION_COOLDOWN = 5000; // 5 seconds

/**
 * Trigger AI narration for player events
 */
export async function triggerNarration(
  ctx: VenicePlayerContext,
  event: string,
  details?: Record<string, any>
): Promise<void> {
  const venice = getVeniceService();
  if (!venice) return;

  // Cooldown to prevent spam (except for important events)
  const importantEvents = ['join', 'death', 'bossKill'];
  const now = Date.now();
  const state = narrationState.get(ctx.id) || { lastTime: 0 };

  if (!importantEvents.includes(event) && (now - state.lastTime) < NARRATION_COOLDOWN) {
    return;
  }

  log.debug({ event }, 'Triggering narration');

  try {
    // Try AI narration first
    const narration = await venice.generateNarration(
      event,
      ctx.name,
      ctx.id.toString(),
      details
    );

    if (narration) {
      ctx.send(new Messages.Narrator(narration.text, narration.style, narration.audioUrl).serialize());
      narrationState.set(ctx.id, { lastTime: now });
    } else {
      // Fallback to static narration (no audio for fallbacks)
      const fallback = venice.getStaticNarration(event, ctx.name, details);
      ctx.send(new Messages.Narrator(fallback.text, fallback.style).serialize());
      narrationState.set(ctx.id, { lastTime: now });
    }
  } catch (error) {
    log.error({ err: error }, 'Narrator error');
    // Use static fallback on error (no audio for fallbacks)
    const fallback = venice.getStaticNarration(event, ctx.name, details);
    ctx.send(new Messages.Narrator(fallback.text, fallback.style).serialize());
  }
}

/**
 * Cleanup narration state for a player
 */
export function cleanupNarration(playerId: number): void {
  narrationState.delete(playerId);
}
