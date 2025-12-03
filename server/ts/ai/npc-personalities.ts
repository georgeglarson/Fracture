/**
 * NPC Personalities for Venice AI Integration
 */

import { NpcPersonality, CompanionTrigger, QuestTemplate, ItemContext } from './types';

export const NPC_PERSONALITIES: Record<string, NpcPersonality> = {
  king: {
    name: "The King",
    personality: "Wise ruler who welcomes adventurers. Knows much about the land's dangers.",
    speechStyle: "Regal but warm. Encouraging to heroes.",
    greeting: "Welcome, brave adventurer!"
  },
  guard: {
    name: "Royal Guard",
    personality: "Loyal protector. Takes duty seriously but respects capable warriors.",
    speechStyle: "Military brevity. Respectful to proven fighters.",
    greeting: "Stay vigilant, adventurer."
  },
  scientist: {
    name: "The Alchemist",
    personality: "Eccentric researcher studying creatures and potions. Easily excited.",
    speechStyle: "Scientific curiosity. Trails off mid-thought.",
    greeting: "Oh! A new specimen! I mean... welcome."
  },
  priest: {
    name: "The Sage",
    personality: "Wise elder who speaks in metaphors about life and adventure.",
    speechStyle: "Calm, measured. Uses nature metaphors.",
    greeting: "The path guides all who seek truth."
  },
  villagegirl: {
    name: "Young Villager",
    personality: "Cheerful village girl. Dreams of adventure but stays safe.",
    speechStyle: "Friendly, curious about adventurers.",
    greeting: "Hey! Love your armor!"
  },
  villager: {
    name: "Villager",
    personality: "Simple townsfolk grateful for protection from monsters.",
    speechStyle: "Everyday speech, thankful for heroes.",
    greeting: "Another day safe from goblins!"
  },
  agent: {
    name: "The Wanderer",
    personality: "Mysterious traveler with secrets. Knows hidden paths.",
    speechStyle: "Cryptic hints. Dramatic pauses.",
    greeting: "I've been expecting someone like you..."
  },
  sorcerer: {
    name: "The Mage",
    personality: "Powerful wizard studying ancient magic. Remembers old times.",
    speechStyle: "Mystical references. Wise but eccentric.",
    greeting: "Magic flows strong in you, traveler."
  },
  octocat: {
    name: "Forest Spirit",
    personality: "Friendly guardian of the woods. Loves all creatures.",
    speechStyle: "Gentle, nature-loving.",
    greeting: "The forest welcomes you."
  },
  nyan: {
    name: "Strange Cat",
    personality: "Magical cat that only says nyan.",
    speechStyle: "nyan nyan nyan",
    greeting: "nyan nyan nyan!"
  },
  rick: {
    name: "The Bard",
    personality: "Traveling musician. Never gives up on a good tune.",
    speechStyle: "Musical, upbeat. Song references.",
    greeting: "Care for a song, friend?"
  },
  coder: {
    name: "The Scribe",
    personality: "Record keeper documenting all adventures.",
    speechStyle: "Precise, detail-oriented.",
    greeting: "Your deeds shall be recorded!"
  },
  beachnpc: {
    name: "Fisherman",
    personality: "Seaside worker, warns about crabs.",
    speechStyle: "Salty, practical.",
    greeting: "Watch for them crabs. Nasty pinchers."
  },
  forestnpc: {
    name: "Ranger",
    personality: "Forest protector, knows the woods.",
    speechStyle: "Quiet, observant.",
    greeting: "The trees whisper of danger ahead."
  },
  desertnpc: {
    name: "Desert Nomad",
    personality: "Hardened survivor of the wastes.",
    speechStyle: "Grim warnings, survival tips.",
    greeting: "The sands claim the unprepared."
  },
  lavanpc: {
    name: "Forge Master",
    personality: "Works near the volcano. Respects fire.",
    speechStyle: "Industrial, forge metaphors.",
    greeting: "The flames test all who enter."
  }
};

export const COMPANION_TRIGGERS: Record<string, CompanionTrigger> = {
  lowHealth: {
    threshold: 0.3,
    hints: [
      "Your wounds need tending - find food or flee!",
      "Health critical! Burgers restore vitality.",
      "Perhaps retreat would be wise right now..."
    ]
  },
  newArea: {
    hints: [
      "New territory. Stay alert for ambushes.",
      "I sense danger ahead. Proceed carefully.",
      "This area holds secrets... and monsters."
    ]
  },
  nearBoss: {
    hints: [
      "Powerful enemy nearby. Are you prepared?",
      "I feel dark energy. A champion awaits.",
      "This foe will test your limits."
    ]
  },
  idle: {
    threshold: 30000,
    hints: [
      "Adventure awaits! Click to move.",
      "The world won't save itself...",
      "Perhaps explore that path?"
    ]
  },
  firstKill: {
    hints: [
      "Well fought! Your skills grow.",
      "Victory! But harder foes await.",
      "One down. Many more to go."
    ]
  },
  death: {
    hints: [
      "A setback, not defeat. Rise again!",
      "Learn from this. Come back stronger.",
      "Even heroes fall. What matters is getting up."
    ]
  }
};

export const QUEST_TEMPLATES: Record<string, { templates: QuestTemplate[] }> = {
  kill: {
    templates: [
      { target: "rat", count: 3, reward: "burger", xp: 10 },
      { target: "crab", count: 5, reward: "firepotion", xp: 20 },
      { target: "bat", count: 4, reward: "burger", xp: 15 },
      { target: "goblin", count: 3, reward: "axe", xp: 30 },
      { target: "skeleton", count: 5, reward: "mailarmor", xp: 50 },
      { target: "ogre", count: 2, reward: "morningstar", xp: 75 },
      { target: "spectre", count: 3, reward: "goldenarmor", xp: 100 }
    ]
  },
  explore: {
    templates: [
      { area: "beach", reward: "burger", xp: 10 },
      { area: "forest", reward: "firepotion", xp: 20 },
      { area: "cave", reward: "axe", xp: 30 },
      { area: "desert", reward: "platearmor", xp: 50 },
      { area: "lavaland", reward: "bluesword", xp: 75 }
    ]
  }
};

export const ITEM_CONTEXTS: Record<string, ItemContext> = {
  sword1: { type: "weapon", era: "ancient", origin: "the old kingdom" },
  sword2: { type: "weapon", era: "forged", origin: "skilled blacksmiths" },
  axe: { type: "weapon", era: "tribal", origin: "barbarian lands" },
  morningstar: { type: "weapon", era: "crusader", origin: "holy wars" },
  bluesword: { type: "weapon", era: "magical", origin: "elven forges" },
  redsword: { type: "weapon", era: "infernal", origin: "demon realm" },
  goldensword: { type: "weapon", era: "legendary", origin: "dragon's hoard" },
  clotharmor: { type: "armor", era: "common", origin: "village tailor" },
  leatherarmor: { type: "armor", era: "hunter", origin: "beast hides" },
  mailarmor: { type: "armor", era: "military", origin: "kingdom armory" },
  platearmor: { type: "armor", era: "knight", origin: "royal smith" },
  redarmor: { type: "armor", era: "elite", origin: "champion's forge" },
  goldenarmor: { type: "armor", era: "legendary", origin: "celestial realm" },
  flask: { type: "potion", era: "common", origin: "healer's stock" },
  burger: { type: "food", era: "common", origin: "tavern kitchen" },
  cake: { type: "food", era: "festive", origin: "celebration" },
  firepotion: { type: "potion", era: "alchemical", origin: "wizard's lab" }
};
