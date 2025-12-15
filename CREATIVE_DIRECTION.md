# Fracture: Creative Direction

## The Problem

Fracture has evolved far beyond its BrowserQuest origins with:
- AI-powered NPC dialogue (Venice)
- Living world with mob thoughts
- Achievement system
- Inventory & equipment
- Party system
- Daily rewards
- XP/leveling progression

**But it still looks and feels like BrowserQuest.** The new name and creative direction fix this.

---

## The Vision: "The Fractured World"

### Core Concept

This is not a medieval fantasy. This is **after the fall**.

The world exists in the aftermath of "The Fracture" - an event that tore reality apart. What remains is a patchwork of eras, dimensions, and broken timelines. The "medieval" setting is just one shard among many.

### Why This Works

1. **Explains the anachronisms** - Agent, Nyancat, Octocat aren't Easter eggs; they're entities from other shards
2. **Makes AI dialogue feel natural** - NPCs speak cryptically because reality itself is unstable
3. **Justifies the weird** - Talking mobs, respawning, the strange geography
4. **Creates mystery** - Players want to understand what happened
5. **Unique identity** - No longer a clone, but something original

---

## Character Reimagining

### The Anomalies (Former Easter Eggs)

| Current | New Identity | Role |
|---------|--------------|------|
| **Agent** | "The Watcher" | An entity that exists between shards. Knows things he shouldn't. His cryptic dialogue hints at the nature of reality. Potential quest-giver for "truth-seeker" storyline. |
| **Nyancat** | "The Glitch" | A corrupted spirit trapped in a loop. Speaks only in fragments ("nyan") because its mind shattered during the Fracture. Touching it might grant... something. |
| **Octocat** | "The Old One" | A being from before. Not malevolent, but alien. The forest grew around it. Worshipped by some, feared by others. |
| **Rick** | "The Cursed Bard" | A musician who made a deal to never be forgotten. Now he can only sing one song, forever. Tragic figure. |

### The Villagers

Survivors who rebuilt in the ruins. They don't fully understand the world they live in. Their "normal" dialogue takes on new meaning when you realize they're coping with cosmic horror.

### The Mobs

Not just monsters - fragments of what came before:
- **Skeletons/Death Knights**: The armies that fought in the war before the Fracture
- **Specters**: Echoes of people caught in the Fracture, neither alive nor dead
- **Rats/Bats/Crabs**: Mutated wildlife, changed by unstable reality
- **The Boss**: A being that emerged FROM the Fracture itself

---

## Visual Identity (Aseprite Opportunities)

### Quick Wins (Palette/Filter Changes)
- Slightly desaturated world palette (post-apocalyptic feel)
- Occasional "glitch" frames on Anomaly characters
- Subtle corruption effects on certain tiles

### Medium Effort
- New title screen with "Fractured" aesthetic
- Updated UI elements with worn/damaged look
- Glitch effect sprites for Nyancat

### Larger Projects
- New sprites for reimagined characters
- Environmental storytelling tiles (ruins, old-world debris)
- Boss redesign to feel more "eldritch"

---

## Dialogue & Lore Adjustments

### NPC Personality Updates

The Venice AI personalities should shift to match:

**King** → "The Steward"
- Not a true king, just someone who took charge
- Hints that he knows about the old world
- "We rebuilt what we could. Some things... we left buried."

**Priest** → "The Keeper"
- Maintains "old knowledge" without fully understanding it
- Speaks in half-remembered teachings
- "The texts speak of a time before the sky broke..."

**Scientist** → "The Salvager"
- Studies artifacts from before
- Potions are reverse-engineered from old-world tech
- "This formula? Found in the ruins. I don't know WHO made it..."

**Agent/Watcher**
- Already perfect. Lean into the Matrix vibes.
- He KNOWS. And he's watching to see if you figure it out.
- "You're starting to see it, aren't you? The seams."

### Mob Thoughts Updates

The "ant farm" feature becomes even more compelling:
- Skeleton: "I remember... marching. But to where?"
- Specter: "The light... I was reaching for the light..."
- Boss: "I AM THE DOOR. I AM THE WOUND."

---

## The Newspaper ("The Fractured Chronicle")

Already AI-generated. Reframe it as:
- Reports from "scouts" exploring other shards
- Cryptic warnings about reality instabilities
- Rumors of things seen at the edges of the world

---

## Map Considerations

### Current Map Structure
The BrowserQuest map is a ~280x280 tile world with distinct biomes:
- Village/town (spawn area)
- Beach/coast
- Forest
- Cave systems
- Desert
- Lava/volcano area
- Boss arena

### Map Effort Tiers

**Tier 1: Recontextualize (No Changes)**
- Same map, new meaning
- The village becomes "the settlement" - built in ruins
- Forest becomes "the overgrowth" - nature reclaiming
- Desert becomes "the wastes" - fallout zone
- Lava becomes "the wound" - where the Fracture is strongest

**Tier 2: Tile Swaps (Medium Effort)**
- Using existing tileset but rearranging
- Add "ruin" tiles to village (broken walls, debris)
- Scatter "old world" objects (using existing chest/item sprites)
- Create "border zones" between shards with visual discontinuity

**Tier 3: New Tileset Elements (Aseprite Work)**
- Cracked/corrupted versions of existing tiles
- "Glitch" tiles for Anomaly areas
- Old-world tech debris sprites
- Environmental storytelling pieces

**Tier 4: New Map (Major Effort)**
- Complete redesign using Tiled
- Not recommended initially - too much work
- Could be "expansion" content later

### Recommended Approach
Start with Tier 1 (narrative reframing) + selective Tier 2 (tile swaps around key NPCs/areas). This gives maximum impact for minimum effort.

### Tools
- **Tiled**: Map editor (the .tmx files in `tools/maps/`)
- **Aseprite**: Sprite/tile editing
- Map conversion: `tools/maps/processmap.js`

---

## What Stays The Same

- Core gameplay loop (explore, fight, loot, level)
- Technical infrastructure (WebSocket, Venice AI, etc.)
- Map layout (recontextualized, not rebuilt)
- Most game mechanics

---

## Implementation Phases

### Phase 1: Narrative Layer (No Art Changes)
- [ ] Update NPC personalities in `npc-personalities.ts`
- [ ] Update mob thoughts to reflect new lore
- [ ] Update static dialogue in `npc.ts`
- [ ] Add lore hints to newspaper generation
- [ ] Update game title/description in HTML

### Phase 2: UI Polish
- [ ] New title screen
- [ ] Updated "About" text with new lore
- [x] Rename game to "Fracture" ✓
- [ ] Achievement descriptions rewritten for lore

### Phase 3: Visual Identity (Aseprite)
- [ ] Color palette adjustments
- [ ] Glitch effects for Anomaly characters
- [ ] Environmental detail sprites
- [ ] New character portraits for dialogue?

### Phase 4: Deep Lore
- [ ] Hidden achievements for discovering "truth"
- [ ] Secret areas/NPCs that reveal backstory
- [ ] The Watcher's questline
- [ ] The "true ending"?

---

## Name: FRACTURE

**Final choice: Fracture**

### Why It Works
- Single word, memorable
- The title IS the theme
- Can be animated to crack/shatter (title demonstrates itself)
- Strong portfolio presence
- Domain availability likely good

### Title Animation Concept
The word "FRACTURE" on the title screen:
1. Appears solid
2. Cracks spread through the letters (canvas/CSS animation)
3. Pieces drift apart slightly, floating
4. Glitch/flicker effects on fragments
5. Pieces try to reform but can't quite stabilize
6. Player clicks to enter the fractured world

### Implementation
- CSS `clip-path` or canvas-based letter fragmentation
- `requestAnimationFrame` for smooth drift
- Subtle particle effects around the cracks
- Could use existing sprite sheet approach or pure CSS

---

## Summary

By reframing the existing assets through a post-Fracture lens, the game becomes:

1. **Distinct** - Not a BrowserQuest clone, but inspired-by
2. **Cohesive** - The weird stuff makes sense
3. **Mysterious** - Players want to learn more
4. **Memorable** - A unique identity in the genre

The technical work is done. This is about **meaning**.
