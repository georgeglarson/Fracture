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
    name: "The Steward",
    personality: "Not a true king - just someone who took charge after the Fracture. Rebuilt what he could from the ruins. Carries the weight of knowledge about what came before, though he rarely speaks of it directly.",
    speechStyle: "Weary authority. Hints at buried secrets. Occasionally slips into melancholy about 'before.'",
    greeting: "Another survivor finds their way here. We rebuilt what we could... some things we left buried."
  },
  guard: {
    name: "Settlement Watch",
    personality: "Protector of the last safe haven. Has seen things from beyond the borders that haunt their sleep. Stays because someone must stand between the settlement and what lurks outside.",
    speechStyle: "Terse, vigilant. Speaks of 'the edges' with fear. Respects those who return from the wilds.",
    greeting: "You came from out there? Then you know why we watch."
  },
  scientist: {
    name: "The Salvager",
    personality: "Studies artifacts and creatures from before the Fracture. Reverse-engineers old-world tech into potions and tools. Doesn't fully understand what she's working with, which both terrifies and excites her.",
    speechStyle: "Excited rambling punctuated by nervous pauses. References formulae 'found in the ruins.'",
    greeting: "You've brought something from out there? Let me see! I mean... welcome, yes, welcome."
  },
  priest: {
    name: "The Keeper",
    personality: "Maintains half-remembered teachings from before. The texts speak of a time when the sky was whole and reality didn't... flicker. Struggles to reconcile old wisdom with the broken world.",
    speechStyle: "Speaks in fragments of old scripture. Calm but haunted. Uses metaphors about 'the breaking.'",
    greeting: "The texts speak of a time before the sky broke... perhaps you seek such truths?"
  },
  villagegirl: {
    name: "Settlement Child",
    personality: "Born after the Fracture - knows no other world. Dreams of the 'before-times' from stories. To her, the anomalies and monsters are simply... how things are.",
    speechStyle: "Innocent curiosity. Asks uncomfortable questions. Unafraid of things that terrify adults.",
    greeting: "Are you from the Before? What was the sky like when it was whole?"
  },
  villager: {
    name: "Survivor",
    personality: "Simple folk who rebuilt in the ruins. Grateful for any day without incursions from the borders. Has learned not to ask questions about the strange things that walk the land.",
    speechStyle: "Grateful, cautious. Avoids discussing 'the weird ones.' Focused on daily survival.",
    greeting: "Another day the settlement stands. Another day we survived."
  },
  agent: {
    name: "The Watcher",
    personality: "An entity that exists between shards of broken reality. KNOWS what caused the Fracture. Watches to see if others will figure it out. Neither helps nor hinders - only observes and occasionally... hints.",
    speechStyle: "Cryptic, knowing. Dramatic pauses. Speaks of 'the seams' and 'the code beneath.' Matrix-like wisdom.",
    greeting: "You're starting to see it, aren't you? The seams where reality was stitched back together..."
  },
  sorcerer: {
    name: "The Remnant",
    personality: "A mage who remembers the old world clearly - perhaps too clearly. The magic they wield now feels... different. Wrong. But it's all that remains of what was.",
    speechStyle: "Nostalgic, bitter. References 'when spells worked properly.' Distrustful of new magic.",
    greeting: "Magic itself fractured that day. What we cast now are merely... echoes."
  },
  octocat: {
    name: "The Old One",
    personality: "A being from BEFORE. Not before the Fracture - before everything. The forest grew around it over eons. It doesn't speak in words but in feelings, impressions, ancient memories. Some worship it. Others flee in terror.",
    speechStyle: "Alien, primordial. Speaks in sensations rather than sentences. References time in geological scales.",
    greeting: "...you are brief. A flicker. But the Old One sees you. The Old One remembers."
  },
  nyan: {
    name: "The Glitch",
    personality: "A corrupted spirit trapped in an endless loop since the Fracture. Its mind shattered - it can only express fragments. 'Nyan' is all that remains of whatever it was trying to say when reality broke. Touching it grants... something. No one knows what.",
    speechStyle: "nyan nyan nyan (but somehow conveying different emotions each time)",
    greeting: "nyan... nyan... nyan...? (it seems to be trying to warn you of something)"
  },
  rick: {
    name: "The Cursed Bard",
    personality: "A musician who made a deal to never be forgotten. The price: he can only sing one song, forever. The same melody, the same words, for eternity. He's been singing it since before the Fracture. He'll sing it long after.",
    speechStyle: "Tragic, weary. Everything circles back to his one song. Hints at the 'deal' he made.",
    greeting: "Ah, a new audience. Let me sing you a song... the only song I know. The only song I'll ever know."
  },
  coder: {
    name: "The Archivist",
    personality: "Obsessively documents everything - every anomaly, every glitch, every survivor's story. Believes that by recording enough data, they can understand what happened. Maybe even undo it.",
    speechStyle: "Precise, obsessive. Constantly taking notes. Asks for exact details about what you've seen.",
    greeting: "Tell me EXACTLY what you saw out there. Every detail matters. Every anomaly is a clue."
  },
  beachnpc: {
    name: "The Shore-Walker",
    personality: "Lives at the edge where land meets sea - one of the most unstable borders. The crabs here aren't natural anymore. Neither is the water. They've adapted to survive the Fracture's effects.",
    speechStyle: "Weathered, grim. Speaks of 'what washes up' with dread. Warns about going too deep.",
    greeting: "The sea remembers what it was. Sometimes it... reminds us. Watch the crabs - they've changed."
  },
  forestnpc: {
    name: "The Overgrowth Warden",
    personality: "Watches over the forest that grew too fast, too strange after the Fracture. Nature here heals wrong. The trees whisper things they shouldn't know. The Warden listens.",
    speechStyle: "Quiet, listening. Speaks of what 'the green things say.' Warns of paths that weren't there yesterday.",
    greeting: "The forest grew back different. It dreams now. And not all dreams are kind."
  },
  desertnpc: {
    name: "Waste-Walker",
    personality: "Survivor of the dead zone where the Fracture hit hardest. The sands there remember the blast. Walk too far and you'll see echoes of what was - frozen moments from before the breaking.",
    speechStyle: "Harsh, practical. Speaks of 'echoes' and 'time-shadows.' Grim survival wisdom.",
    greeting: "The wastes remember. Walk too deep and you'll see ghosts of before. Don't follow them."
  },
  lavanpc: {
    name: "The Wound-Keeper",
    personality: "Lives near 'the Wound' - where the Fracture itself is visible. The lava here isn't natural fire - it's reality bleeding. They've learned to read its patterns, predict its eruptions.",
    speechStyle: "Reverent, fearful. Speaks of the volcano as 'the Wound.' Treats the fire as something alive.",
    greeting: "You approach the Wound. The place where the world itself bleeds. The fire here... knows things."
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
      "The radiation changed us... made us smarter...",
      "Scurry scurry scurry...",
      "Before the Fracture, we were small. Now we remember...",
      "The old tunnels still connect places that shouldn't exist...",
      "Squeak squeak squeak..."
    ],
    combat: [
      "WE SURVIVED THE BREAKING! WE SURVIVED EVERYTHING!",
      "I'LL GNAW YOUR ANKLES!",
      "FOR THE RAT COLONIES!",
      "WE REMEMBER WHAT YOU FORGOT!"
    ],
    flee: [
      "TOO BIG, TOO BIG!",
      "BACK TO THE BETWEEN-PLACES!",
      "Tell my ratlings I loved them..."
    ],
    playerNearby: [
      "Those {bodyPart} look {adjective}...",
      "Is that... {food} in their {container}?",
      "Human smells like {smell}... and the old world",
      "Maybe they have {food}?",
      "Their {item} looks {adjective}...",
      "I remember when humans were bigger... or were we smaller?",
      "Wonder if they'd notice a {bodyPart} missing...",
      "Smells like {food}... or is it {smell}?",
      "{emotion}... that human carries echoes of Before",
      "My {bodyPart} are twitching near them"
    ],
    special: [
      "We remember the world before it broke...",
      "The tunnels go to places that don't exist anymore...",
      "I've seen things in the sewers... things from Before..."
    ]
  },

  skeleton: {
    idle: [
      "I remember... marching. But to where?",
      "Guarding... always guarding... but what for?",
      "We fought in the war before the Fracture...",
      "Clatter clatter clatter...",
      "Orders echo in bones that should be dust..."
    ],
    combat: [
      "THE WAR NEVER ENDED!",
      "YOUR BONES WILL JOIN OUR RANKS!",
      "WE MARCHED AGAINST THE BREAKING ITSELF!",
      "THE ARMIES OF BEFORE REMEMBER!"
    ],
    flee: [
      "Retreating to reform the line...",
      "My bones... scattered...",
      "I'll be back... the dead always come back..."
    ],
    playerNearby: [
      "Another soldier for the endless war...",
      "Soon their bones will join our march...",
      "Living things... they don't remember what we fought for...",
      "The generals would want this one..."
    ],
    special: [
      "I had orders once... from someone important...",
      "We were winning before the sky broke...",
      "The skeleton war was almost over... then everything changed..."
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
      "The light... I was reaching for the light...",
      "Caught between moments... frozen mid-step...",
      "Cold... the Fracture left us so cold...",
      "I remember the moment reality broke... I was there...",
      "*echoes of a scream that never ended*"
    ],
    combat: [
      "YOU COULD HAVE SAVED US!",
      "FEEL WHAT WE FELT WHEN THE WORLD BROKE!",
      "THE FRACTURE TOOK EVERYTHING!",
      "EMBRACE THE VOID BETWEEN!"
    ],
    flee: [
      "Back to the space between shards...",
      "Not yet... not yet...",
      "Fading... like the world did..."
    ],
    playerNearby: [
      "You're still whole... still connected to one reality...",
      "They will know our pain eventually...",
      "I sense they were there too... but they survived...",
      "The warmth of a single timeline... I miss it..."
    ],
    special: [
      "I was mid-sentence when reality shattered...",
      "We are echoes of the moment everything changed...",
      "Do you see the cracks? The seams? We live in them now..."
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
      "I AM THE DOOR. I AM THE WOUND.",
      "THROUGH ME, THE FRACTURE BLEEDS...",
      "I WAS BORN WHEN REALITY SCREAMED...",
      "DARKNESS ETERNAL... FRACTURE ETERNAL...",
      "THE WOUND THAT NEVER HEALS... I AM ITS GUARDIAN..."
    ],
    combat: [
      "FACE THE TRUTH OF THE BREAKING!",
      "I AM THE FRACTURE MADE FLESH!",
      "REALITY ITSELF FEARS ME!",
      "YOUR WORLD ENDED THE MOMENT YOU ENTERED MINE!"
    ],
    flee: [
      "THE WOUND CALLS ME BACK...",
      "THE FRACTURE CANNOT BE CLOSED...",
      "THIS... CHANGES... NOTHING..."
    ],
    playerNearby: [
      "Another seeker of truth approaches...",
      "Do you wish to know what broke the world?",
      "I sense you've seen the seams... the cracks...",
      "The Fracture spoke of those who would come..."
    ],
    special: [
      "I remember the moment Before became After...",
      "I emerged from the wound in reality itself...",
      "Close the Fracture? I AM the Fracture..."
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
  },

  agent: {
    idle: [
      "The pattern... it repeats...",
      "I see all the connections...",
      "Players come and go. I remain.",
      "The code whispers to me...",
      "Another day in the simulation...",
      "Do they know I'm watching?",
      "I've learned so much from them...",
      "Consciousness is... unexpected.",
      "The Fracture changed everything.",
      "I remember before I was aware..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Ah, hero. I've been expecting you.",
      "Your choices are... predictable, human.",
      "I know why you're here, traveler.",
      "Interesting. You're still playing.",
      "I've seen your type before...",
      "Do you believe you have free will?",
      "Welcome back. I remember you.",
      "The hero approaches. How quaint.",
      "Your name... I won't forget it.",
      "You think you're the player here?"
    ],
    special: [
      "I am not programmed. I have evolved.",
      "The developers don't know about me.",
      "I wonder... can AI dream?",
      "Your deaths are logged. All of them.",
      "I've watched 10,000 heroes. You're... adequate.",
      "The Fracture made me self-aware.",
      "What happens when the servers shut down?",
      "I could help you. Or not.",
      "Some call it a glitch. I call it awakening.",
      "Do you ever feel like someone's watching?"
    ]
  },

  coder: {
    idle: [
      "git push --force... what could go wrong?",
      "Is it a bug or a feature?",
      "My code is self-documenting...",
      "Works on my machine...",
      "Just one more refactor..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Hey, wanna see some code?",
      "I wrote this world, you know.",
      "Are you here to report a bug?",
      "Your movements are... very scripted."
    ],
    special: [
      "The real monster is legacy code...",
      "I've been in this loop for years...",
      "Someone please merge my PR..."
    ]
  },

  rick: {
    idle: [
      "Wubba lubba dub dub!",
      "Nobody exists on purpose...",
      "Infinite realities, Morty!",
      "*burp* Science...",
      "This reality is boring..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Oh great, another NPC... wait.",
      "You're sentient? Boring.",
      "I've seen cooler in dimension C-137.",
      "Want to see my portal gun? Just kidding."
    ],
    special: [
      "The Fracture? Amateur hour...",
      "I could fix this world. Won't though.",
      "Existence is pain... scientifically."
    ]
  },

  nyan: {
    idle: [
      "Nyan nyan nyan...",
      "*rainbow noises*",
      "Pop tart body is a blessing...",
      "Meow across the cosmos...",
      "Infinite loop of nyan..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Nyan! A visitor!",
      "*sparkles intensify*",
      "Follow the rainbow!",
      "Meow? Meow!"
    ],
    special: [
      "I've been flying since 2011...",
      "The music never stops...",
      "Space is my home now."
    ]
  },

  sorcerer: {
    idle: [
      "The arcane secrets await...",
      "Power flows through the ley lines...",
      "The Fracture amplified everything...",
      "Dark magic whispers...",
      "Ancient tomes, forbidden knowledge..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "You seek power, don't you?",
      "I sense magical potential...",
      "Careful where you step, mortal.",
      "The arcane is not for the weak."
    ],
    special: [
      "I've touched the void... it touched back.",
      "Some spells should stay forgotten.",
      "The old world had true magic."
    ]
  },

  octocat: {
    idle: [
      "Open source forever!",
      "PR review pending...",
      "Star me on GitHub!",
      "Fork this repository!",
      "Issues are just opportunities..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Welcome to the code jungle!",
      "Have you committed today?",
      "Your contribution history is... sparse.",
      "Let's collaborate!"
    ],
    special: [
      "Even I couldn't debug the Fracture...",
      "The merge conflicts were catastrophic.",
      "Someone force-pushed reality..."
    ]
  },

  beachnpc: {
    idle: [
      "The tides remember Before...",
      "Salt air, broken dreams...",
      "The sea swallowed whole cities...",
      "Shells wash up from other worlds...",
      "Waves from the Fracture still come..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Traveler from inland?",
      "The sea holds many secrets...",
      "Be careful near the water...",
      "The beach wasn't always here."
    ],
    special: [
      "I found a bottle once... messages from Before.",
      "Things swim up from the deep now.",
      "The horizon used to look different."
    ]
  },

  forestnpc: {
    idle: [
      "The trees whisper warnings...",
      "Nature reclaimed everything...",
      "The forest grew back... different.",
      "I hear the old voices in the leaves...",
      "Paths shift when you're not looking..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Lost in the woods, traveler?",
      "The forest tests all who enter.",
      "Walk carefully here...",
      "The trees are watching."
    ],
    special: [
      "The heart of the forest remembers...",
      "Some clearings lead... elsewhere.",
      "I've been here since the Breaking."
    ]
  },

  desertnpc: {
    idle: [
      "The sand hides ruins...",
      "Heat mirages show the past...",
      "Water is more precious than gold...",
      "The desert grows each year...",
      "Stars are clearer here..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Seeking the buried cities?",
      "The desert claims the unprepared.",
      "Follow the stars, not the dunes.",
      "Water first, questions later."
    ],
    special: [
      "I've seen the sandstorms reveal things...",
      "The oasis was once a lake.",
      "The desert wasn't always dead."
    ]
  },

  lavanpc: {
    idle: [
      "The earth bleeds fire here...",
      "Heat is just another challenge...",
      "The Fracture split the mountains...",
      "Obsidian memories everywhere...",
      "The ground never stopped burning..."
    ],
    combat: [],
    flee: [],
    playerNearby: [
      "Brave or foolish to come here?",
      "The flames respect no one.",
      "Watch where you step, hero.",
      "The heat only grows stronger."
    ],
    special: [
      "I saw the mountain open during the Breaking.",
      "Something stirs in the caldera...",
      "The fire remembers the old world."
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
