/**
 * NPC Personalities for Venice AI Integration
 */

import { NpcPersonality, CompanionTrigger, QuestTemplate, ItemContext } from './types';

// ============================================================================
// MAD-LIBS WORD POOLS - for generating unique phrases
// ============================================================================

const WORD_POOLS: Record<string, string[]> = {
  bodyPart: [
    'boots', 'fingers', 'toes', 'ears', 'ankles', 'knees', 'elbows',
    'shoelaces', 'belt', 'hair', 'nose', 'thumbs', 'heels'
  ],
  adjective: [
    'chewy', 'crunchy', 'delicious', 'tasty', 'suspicious', 'intimidating',
    'shiny', 'leathery', 'squeaky', 'tender', 'salty', 'juicy', 'crispy'
  ],
  food: [
    'cheese', 'bread', 'crumbs', 'meat', 'seeds', 'grain', 'corn',
    'bacon', 'berries', 'nuts', 'cake', 'pie', 'biscuits', 'jerky'
  ],
  container: [
    'bag', 'pocket', 'pouch', 'pack', 'satchel', 'inventory', 'backpack'
  ],
  smell: [
    'danger', 'cheese', 'fear', 'sweat', 'adventure', 'blood', 'magic',
    'death', 'gold', 'leather', 'iron', 'desperation', 'courage'
  ],
  item: [
    'sword', 'armor', 'shield', 'helmet', 'cape', 'belt', 'weapon',
    'staff', 'boots', 'gloves', 'ring', 'amulet'
  ],
  emotion: [
    'Hmm', 'Interesting', 'Curious', 'Strange', 'Scary', 'Exciting',
    'Alarming', 'Fascinating', 'Troubling', 'Intriguing'
  ]
};

/**
 * Fill in a mad-libs template with random words
 */
export function fillTemplate(template: string): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const pool = WORD_POOLS[key];
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return match; // Leave unchanged if no pool found
  });
}

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

// ============================================================================
// MOB & NPC THOUGHT BUBBLES - The "Ant Farm" Feature
// ============================================================================

export interface MobThoughts {
  idle: string[];        // Default wandering thoughts
  combat: string[];      // When attacking a player
  flee: string[];        // When low health or retreating
  playerNearby: string[];// When player is close but not fighting
  special?: string[];    // Unique personality quirks
}

export const MOB_THOUGHTS: Record<string, MobThoughts> = {
  rat: {
    idle: [
      "Cheese... must find cheese...",
      "Scurry scurry scurry...",
      "Something smells delicious nearby",
      "The sewers were cozier...",
      "Squeak squeak squeak..."
    ],
    combat: [
      "TINY TEETH, BIG FURY!",
      "I'LL GNAW YOUR ANKLES!",
      "FOR THE RAT KING!",
      "DISEASE IS MY WEAPON!"
    ],
    flee: [
      "TOO BIG, TOO BIG!",
      "RETREAT TO THE HOLES!",
      "Tell my ratlings I loved them..."
    ],
    playerNearby: [
      "Those {bodyPart} look {adjective}...",
      "Is that... {food} in their {container}?",
      "Human smells like {smell}",
      "Maybe they have {food}?",
      "Their {item} looks {adjective}...",
      "I could nibble on those {bodyPart}...",
      "Wonder if they'd notice a {bodyPart} missing...",
      "Smells like {food}... or is it {smell}?",
      "{emotion}... that human is {adjective}",
      "My {bodyPart} are twitching near them"
    ],
    special: [
      "One day, rats shall rule...",
      "The prophecy speaks of a giant cheese...",
      "I've seen things in the sewers..."
    ]
  },

  skeleton: {
    idle: [
      "Bones ache today...",
      "Guarding... always guarding...",
      "I remember when I had flesh...",
      "Clatter clatter clatter...",
      "The necromancer promised glory..."
    ],
    combat: [
      "FLESH! FINALLY FLESH!",
      "YOUR BONES WILL JOIN US!",
      "DEATH COMES ON RATTLING FEET!",
      "THE DARK LORD DEMANDS IT!"
    ],
    flee: [
      "Retreating to reassemble...",
      "My bones... scattered...",
      "I'll be back... I always come back..."
    ],
    playerNearby: [
      "Look at all that meat...",
      "Soon their bones will join ours...",
      "Living things... disgusting...",
      "The master would want this one..."
    ],
    special: [
      "I had a family once...",
      "Being dead isn't so bad...",
      "The skeleton war continues..."
    ]
  },

  goblin: {
    idle: [
      "Gold gold gold gold...",
      "Shinies must be found...",
      "Chief says raid soon...",
      "Hate the sunlight...",
      "When's dinner?"
    ],
    combat: [
      "MINE! ALL MINE!",
      "GIVE ME YOUR SHINIES!",
      "GOBLIN SMASH!",
      "FOR THE HOARD!"
    ],
    flee: [
      "RETREAT! RETREAT!",
      "Too strong! Run!",
      "Chief will hear about this!"
    ],
    playerNearby: [
      "Ooh, nice armor... want it...",
      "That weapon looks expensive...",
      "Easy pickings, maybe?",
      "Call the others?"
    ],
    special: [
      "Goblins are misunderstood...",
      "I'm the smartest goblin alive!",
      "One day I'll be chief..."
    ]
  },

  ogre: {
    idle: [
      "HUNGRY...",
      "SMASH SOMETHING SOON...",
      "OGRE BORED...",
      "WHERE FOOD?",
      "HEAD HURT FROM THINKING..."
    ],
    combat: [
      "OGRE SMASH!",
      "TINY HUMAN MAKE GOOD SNACK!",
      "CRUSH BONES!",
      "RAAARGH!"
    ],
    flee: [
      "OGRE... TIRED...",
      "COME BACK LATER...",
      "NEED REST..."
    ],
    playerNearby: [
      "LITTLE THING LOOK CRUNCHY...",
      "FOOD? FRIEND? SMASH?",
      "SHINY ARMOR... PRETTY...",
      "OGRE CONFUSED..."
    ],
    special: [
      "OGRE HAVE FEELINGS TOO...",
      "ONCE OGRE HAD PET ROCK...",
      "WHY EVERYONE RUN FROM OGRE?"
    ]
  },

  crab: {
    idle: [
      "*click click click*",
      "Sideways is the only way...",
      "Sand in my shell again...",
      "The tides call to me...",
      "Pinch pinch pinch..."
    ],
    combat: [
      "FEEL MY PINCERS!",
      "CRAB BATTLE!",
      "SNIP SNIP SNIP!",
      "THE OCEAN'S FURY!"
    ],
    flee: [
      "Back to the sea!",
      "Shell compromised!",
      "*frantic clicking*"
    ],
    playerNearby: [
      "Toes... must pinch toes...",
      "Threat detected. Pincers ready.",
      "You dare enter crab territory?",
      "Interesting... two-legged creature..."
    ],
    special: [
      "🦀 CRAB RAVE 🦀",
      "In crab culture, this is war...",
      "The crab uprising begins soon..."
    ]
  },

  bat: {
    idle: [
      "*echolocation noises*",
      "Dark... nice and dark...",
      "Hanging upside down is relaxing...",
      "Bugs are tasty today...",
      "Screeeee..."
    ],
    combat: [
      "SCREEEEE!",
      "TASTE MY FANGS!",
      "DARKNESS ATTACKS!",
      "FLAP FLAP FURY!"
    ],
    flee: [
      "Too bright! Too loud!",
      "Back to the caves!",
      "*panicked screeching*"
    ],
    playerNearby: [
      "Warm blood detected...",
      "Big creature, many echoes...",
      "Should I bite? I want to bite...",
      "Their torch hurts my eyes..."
    ],
    special: [
      "I'm not a vampire... or am I?",
      "The night is my domain...",
      "Bats are just sky puppies..."
    ]
  },

  snake: {
    idle: [
      "Ssssso cold today...",
      "Need ssssunlight...",
      "Waiting... always waiting...",
      "Sssssilence...",
      "*tongue flicking*"
    ],
    combat: [
      "SSSSTRIKE!",
      "VENOM FLOWSSS!",
      "COILSSS OF DEATH!",
      "HISSSSSSS!"
    ],
    flee: [
      "Ssslither away...",
      "Another time...",
      "Too dangerousss..."
    ],
    playerNearby: [
      "Warm-blooded prey nearby...",
      "Ssso many placesss to bite...",
      "They cannot sssee me...",
      "Patience... patience..."
    ],
    special: [
      "I wasss a wizard once...",
      "Sssnakes get bad pressss...",
      "The Great Ssserpent watches..."
    ]
  },

  spectre: {
    idle: [
      "Between worlds... forever...",
      "The living mock us...",
      "Cold... so cold...",
      "I remember warmth once...",
      "*ethereal moaning*"
    ],
    combat: [
      "JOIN US IN DEATH!",
      "YOUR SOUL IS MINE!",
      "FEEL THE COLD!",
      "EMBRACE ETERNITY!"
    ],
    flee: [
      "The veil calls me back...",
      "Not yet... not yet...",
      "Dissipating..."
    ],
    playerNearby: [
      "Such vibrant life force...",
      "They will join us eventually...",
      "I sense their fear...",
      "The warmth... I crave it..."
    ],
    special: [
      "I died on my wedding day...",
      "Unfinished business keeps me here...",
      "Do you see my chains?"
    ]
  },

  skeleton2: {
    idle: [
      "Elite bones never rest...",
      "The dark army grows...",
      "Awaiting orders...",
      "Superior bones, superior soldier...",
      "The weak skeletons embarrass us..."
    ],
    combat: [
      "FOR THE SKELETON KING!",
      "ELITE DEATH SQUAD!",
      "YOUR SKULL JOINS OUR RANKS!",
      "PRECISION BONE STRIKE!"
    ],
    flee: [
      "Strategic withdrawal...",
      "Reporting to command...",
      "This isn't over..."
    ],
    playerNearby: [
      "Target acquired...",
      "Impressive combat stance...",
      "Analyzing threat level...",
      "The king wants this one alive... mostly."
    ],
    special: [
      "I was a general in life...",
      "The bone throne shall be mine...",
      "Lesser undead disgust me..."
    ]
  },

  eye: {
    idle: [
      "Watching... always watching...",
      "I see everything...",
      "Blink? Never heard of it...",
      "The all-seeing gaze...",
      "*intense staring*"
    ],
    combat: [
      "YOU CANNOT HIDE!",
      "MY GAZE PIERCES ALL!",
      "BEHOLD TRUE SIGHT!",
      "WITNESS ME!"
    ],
    flee: [
      "Must... blink... retreat...",
      "Vision... blurring...",
      "I didn't see this coming..."
    ],
    playerNearby: [
      "I see your true self...",
      "Interesting soul you have there...",
      "Your secrets are known to me...",
      "Don't look away..."
    ],
    special: [
      "I've seen the end of everything...",
      "The things I've witnessed...",
      "Beauty is in the eye of me..."
    ]
  },

  wizard: {
    idle: [
      "The arcane flows through me...",
      "Spell components running low...",
      "Magic is everything...",
      "Foolish mortals everywhere...",
      "*mystical mumbling*"
    ],
    combat: [
      "ARCANE DESTRUCTION!",
      "FEEL MY POWER!",
      "MAGIC MISSILE!",
      "BY THE ELDER SIGNS!"
    ],
    flee: [
      "I shall return stronger!",
      "This was merely a test!",
      "Teleporting... eventually..."
    ],
    playerNearby: [
      "A test subject approaches...",
      "Interesting magical aura...",
      "They would make a good familiar...",
      "Perhaps an experiment is in order..."
    ],
    special: [
      "I graduated top of my class...",
      "These robes are vintage...",
      "The council was wrong about me..."
    ]
  },

  boss: {
    idle: [
      "ALL SHALL KNEEL BEFORE ME...",
      "THIS REALM IS MINE...",
      "HEROES ARE BUT INSECTS...",
      "DARKNESS ETERNAL...",
      "THE THRONE OF BONES AWAITS..."
    ],
    combat: [
      "FACE YOUR DOOM!",
      "I AM INEVITABLE!",
      "DESTRUCTION INCARNATE!",
      "YOUR LEGEND ENDS HERE!"
    ],
    flee: [
      "IMPOSSIBLE... BUT NOT OVER...",
      "THE DARKNESS WILL RETURN...",
      "THIS... CANNOT... BE..."
    ],
    playerNearby: [
      "Another challenger approaches...",
      "Your courage... or foolishness...",
      "I sense great power... and greater fear...",
      "The prophecy spoke of you..."
    ],
    special: [
      "I was once like you...",
      "Power corrupts? Power PERFECTS.",
      "The final boss is just a construct..."
    ]
  },

  deathknight: {
    idle: [
      "Honor... even in death...",
      "My oath binds me still...",
      "The cold armor is my prison...",
      "Memories of light fade...",
      "Duty eternal..."
    ],
    combat: [
      "FOR THE FALLEN KINGDOM!",
      "DEATH'S CHAMPION STRIKES!",
      "NO MERCY! NO QUARTER!",
      "BY MY CURSED BLADE!"
    ],
    flee: [
      "A tactical retreat...",
      "I shall return with vengeance...",
      "This battle, not the war..."
    ],
    playerNearby: [
      "A worthy opponent, perhaps...",
      "Your form needs work...",
      "I see potential in you...",
      "Do you seek death so eagerly?"
    ],
    special: [
      "I remember honor...",
      "In life, I was a champion...",
      "The curse... it whispers..."
    ]
  }
};

// NPC thoughts (for guards, villagers etc when not talking)
export const NPC_THOUGHTS: Record<string, MobThoughts> = {
  guard: {
    idle: [
      "Watching for trouble...",
      "All quiet... too quiet...",
      "Shift ends in... never.",
      "The king pays well enough...",
      "Seen any suspicious goblins?"
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "That adventurer looks capable...",
      "Hope they're not causing trouble...",
      "Nice gear... legitimate, I hope?",
      "Another hero passing through..."
    ],
    special: [
      "I used to be an adventurer...",
      "Arrow to the knee jokes aren't funny.",
      "The night shift is worse..."
    ]
  },

  villagegirl: {
    idle: [
      "I wonder what's beyond the walls...",
      "Market day tomorrow!",
      "That adventurer was cute...",
      "Boring boring boring...",
      "Dreams of adventure..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Ooh, a real hero!",
      "Their armor is so shiny!",
      "I want to be like them someday...",
      "Should I say hi?"
    ],
    special: [
      "One day I'll leave this village...",
      "I've been practicing sword moves!",
      "The stories don't mention the smell..."
    ]
  },

  villager: {
    idle: [
      "Fields need tending...",
      "Hope the harvest is good...",
      "Goblins took my turnips...",
      "Simple life, simple joys...",
      "Tax collector coming soon..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Thank the gods for heroes!",
      "Keep us safe, adventurer!",
      "Are the roads safe now?",
      "Can you kill the rats in my barn?"
    ],
    special: [
      "I saw a dragon once. Or a big bird.",
      "My cousin is an adventurer. Was.",
      "The old days were harder..."
    ]
  },

  king: {
    idle: [
      "Heavy is the head...",
      "The kingdom thrives... mostly...",
      "Another petition to read...",
      "Royal duties never end...",
      "The throne is uncomfortable..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "A hero approaches the throne!",
      "Perhaps they can help the realm...",
      "Adventurers bring hope... and chaos.",
      "I should offer a quest..."
    ],
    special: [
      "Being king isn't all feasts...",
      "My father's crown fits poorly...",
      "The nobles plot. They always plot."
    ]
  },

  scientist: {
    idle: [
      "Hypothesis... testing needed...",
      "Where did I put that beaker?",
      "The formula is ALMOST right...",
      "Science waits for no one!",
      "Explosion in 3... 2... nevermind."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "A test subject! I mean, visitor!",
      "Fascinating anatomy...",
      "Could I get a blood sample?",
      "Have you seen any rare creatures?"
    ],
    special: [
      "They called me mad! Mad!",
      "The ethics board doesn't understand...",
      "My potions are perfectly safe-ish..."
    ]
  },

  priest: {
    idle: [
      "The light guides all...",
      "Prayers for the fallen...",
      "Balance in all things...",
      "The scrolls speak truth...",
      "Meditation brings clarity..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Blessings upon you, traveler...",
      "Your aura carries... violence.",
      "Seek redemption in good deeds.",
      "The path is long, but worthy."
    ],
    special: [
      "Even priests have doubts...",
      "The old gods stir...",
      "I've seen things... miraculous things."
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
