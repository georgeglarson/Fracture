# PixelQuest: The Living World
## AI Showcase Plan - "Make Venice Moon"

### The Viral Vision
**One sentence pitch:** "Every creature in the game has a visible AI brain - watch rats plot, skeletons scheme, and villagers gossip in real-time."

**The Screenshot Moment:** A player stands in a village where:
- A rat thinks: *"That cheese smell... must investigate..."*
- A guard thinks: *"Player_Gerg looks suspicious today"*
- The blacksmith thinks: *"Iron shortage getting worse..."*
- A skeleton on the edge thinks: *"The horde grows stronger..."*

**The Video Moment:** Time-lapse of the world where AI thoughts update, factions shift, and a "siege" spawns because the AI decided to counter-attack.

---

## Phase 1: "The Ant Farm" (IMMEDIATE - High Viral, Achievable)

### Feature: AI Thought Bubbles on ALL Entities

Every mob and NPC displays a visible "thought" above their head that updates based on:
- Their current state (idle, hunting, fleeing)
- Nearby players and events
- Faction status
- Random AI-generated personality quirks

**Technical Implementation:**
1. New message type: `ENTITY_THOUGHT`
2. Server generates thoughts periodically (every 30-60 seconds per entity)
3. Client renders grey italic text above entity sprites
4. Thoughts are context-aware (sees player nearby, low health, etc.)

**Example Thoughts by Entity Type:**

| Entity | Idle Thought | Combat Thought | Special |
|--------|--------------|----------------|---------|
| Rat | "Cheese... always cheese..." | "TINY HUMAN ATTACKS!" | Near player: "Those boots look chewy" |
| Skeleton | "Bones ache today..." | "FLESH! FINALLY!" | "The necromancer promises revenge" |
| Goblin | "Gold gold gold..." | "Mine! All mine!" | "Chief says raid at sunset" |
| Guard | "Quiet day..." | "For the village!" | "That player keeps looting bodies..." |
| Villager | "Need more flour..." | "HELP!" | "Did you hear about Player_X?" |

**Why This Goes Viral:**
- Screenshots are instantly shareable
- Creates emergent comedy (rat philosophizing about cheese)
- Shows AI is EVERYWHERE, not just in chat
- "Human ant farm" effect

---

## Phase 2: "The Director" (MEDIUM - Crown Jewel Feature)

### Feature: Faction AI with Global Strategy

A background "Director" AI that:
1. Monitors world state every 5 minutes
2. Makes strategic decisions for each faction
3. Broadcasts "World Events" players can see
4. Actually changes spawning/behavior

**The Factions:**
- **The Horde** (Rats, Goblins, Skeletons, Ogres, Boss)
- **The Village** (NPCs, Guards)
- **The Wild** (Crabs, Bats - neutral chaos)

**Director Decision Examples:**

```
WORLD STATE: Horde lost 150 units today. Village thriving.
DIRECTOR DECISION: "The Skeleton King grows restless. Rally the bones."
EFFECT: +50% skeleton spawns for 2 hours, skeletons get "vengeful" thoughts
```

```
WORLD STATE: Players killed the boss 3 times today.
DIRECTOR DECISION: "A champion emerges from the darkness..."
EFFECT: Spawn a "Champion Skeleton" mini-boss with AI dialogue
```

```
WORLD STATE: Village NPCs talked to 0 times today.
DIRECTOR DECISION: "The village grows lonely..."
EFFECT: NPCs get "desperate" thoughts, might wander toward players
```

**Visual: World Event Banner**
When Director makes a decision, ALL players see:
```
╔══════════════════════════════════════╗
║  THE HORDE STIRS...                  ║
║  "Darkness gathers in the East"      ║
╚══════════════════════════════════════╝
```

**Why This Goes Viral:**
- Creates stories: "I logged in and there was a SIEGE"
- Dynamic world that changes based on player actions
- AI making actual strategic decisions visible to all
- Community discussion: "What will the Director do next?"

---

## Phase 3: "The Chronicle" (EASY - Community Builder)

### Feature: AI-Generated Daily Newspaper

Every 24 hours, summarize server events into a "newspaper" overlay:

**The PixelQuest Chronicle - Day 47**
```
HEADLINES:
• "Massacre in the East Forest" - Player 'NoobMaster' dies to rats 23 times
• "Economic Crisis" - Blacksmith hasn't had iron in 3 days
• "Hero Emerges" - 'Gerg' defeats Skeleton King solo
• "Village Gossip" - Guard reports suspicious loitering near the fountain

OBITUARIES:
• 847 rats met their end today. The Rat King mourns.
• 3 players fell to the dreaded Red Bat.

FACTION REPORT:
• Horde Strength: RECOVERING (Boss killed twice)
• Village Morale: HIGH (Many visitors)

WEATHER FORECAST (AI Generated):
"Dark clouds gather over the skeleton caves. The AI senses... mischief."
```

**Why This Goes Viral:**
- Players screenshot their "headlines"
- Creates community moments and inside jokes
- Proves AI watches EVERYTHING
- Daily reason to check back

---

## Phase 4: "The Living Village" (POLISH - Long-term Wow)

### Feature: NPCs with Schedules and Needs

NPCs that actually DO things:
- Blacksmith walks to mine when low on iron
- Villagers have daily routines (home → work → tavern)
- NPCs react to world events (hide during Horde surge)
- NPCs gossip about players by name

**The Emergent Moment:**
Player sees blacksmith walking toward the forest. Follows him. Blacksmith gets attacked by goblins. Player saves him. Blacksmith's future dialogue: "You saved my life in the forest! Here, take this sword."

---

## Implementation Priority

### Sprint 1: Thought Bubbles (3-4 hours)
- [ ] Add `ENTITY_THOUGHT` message type to gametypes.ts
- [ ] Create thought generation in venice.service.ts
- [ ] Add thought broadcast in world.ts (periodic tick)
- [ ] Render thought bubbles in game.ts (grey, above nameplate)
- [ ] Create thought templates for each mob type

### Sprint 2: Director AI (4-6 hours)
- [ ] Create director.service.ts with faction tracking
- [ ] Add world state aggregation (kills, deaths, events)
- [ ] Implement strategic decision generation via Venice
- [ ] Add `WORLD_EVENT` message type and banner UI
- [ ] Connect Director decisions to spawn rates

### Sprint 3: Chronicle (2-3 hours)
- [ ] Event logging system (kills, deaths, chats, visits)
- [ ] Daily summarization via Venice LLM
- [ ] Chronicle UI overlay (HTML/CSS)
- [ ] Persist chronicle history

### Sprint 4: Living Village (Future)
- [ ] NPC schedule system
- [ ] NPC pathfinding for goals
- [ ] Need-based behavior trees
- [ ] Cross-NPC memory sharing

---

## The Venice Showcase Angle

**For Marketing:**
- "Powered by Venice AI - Every creature thinks"
- Show Venice logo in Chronicle
- API calls visible in thought bubbles: "Generated by Venice"
- Stats: "10,000 AI thoughts generated today"

**Demo Script (30 seconds):**
1. Pan across village showing multiple thought bubbles
2. Kill a rat, watch nearby rats' thoughts change to fear
3. Show Director announcement: "The Horde Retaliates"
4. Open Chronicle showing AI-generated headlines
5. End card: "PixelQuest: The Living World - Powered by Venice AI"

---

## Success Metrics

- [ ] "Holy shit" reaction in first 10 seconds
- [ ] Shareable screenshots without explanation needed
- [ ] Players discussing AI decisions on socials
- [ ] "The AI decided to..." stories
- [ ] Venice AI prominently credited
