# Fracture Roadmap

> A living document tracking the path from foundation to addictive, successful game.

## Current State: Phase 6 Planning (Real Game)

We have a fully playable core game with SRP architecture, roaming bosses, and AI-powered NPCs. Technical foundation is solid. Now it's time to add the depth that makes a real game.

**Current Focus**: Phase 6 Complete! All core gameplay systems implemented. See Phase 6 specs (030-033).

**Recent Milestones:**
- `Phase 6 Complete` - Combat Skills, Equipment Sets, Boss Loot, Fracture Rifts
- `v2.0.0-pixelquest` - Rebrand from BrowserQuest-Ultra
- `v3.0.0-fracture` - Full rebrand to Fracture
- `v1.1.0-spec-kit` - Spec-driven development setup
- `v1.0.0-engine-foundation` - Complete SRP refactor

**What exists:**
- Real-time multiplayer browser game
- AI-powered NPCs with dynamic dialogue
- Quest system with AI generation
- Narrator system for event storytelling
- Town Crier newspaper aggregating world events
- Entity thought bubbles with AI thought pool (25% AI-generated, 75% templates)
- **SQLite storage layer** - Character/inventory/achievement persistence (016 ✅)
- Typed EventBus for decoupled systems
- **Item System** with rarity, properties, tooltips (001 ✅)
- **XP/Level progression system** (002 ✅)
- **Gold economy + NPC shops** (003 ✅)
- **Daily login rewards with streak bonuses** (004 ✅)
- **Achievements & titles** with progress tracking (005 ✅)
- **Party system + player inspect** (006 ✅)
- **Inventory system** - 20-slot grid, equip/use/drop (007 ✅)
- **Combat polish** - screen shake, particles, death effects (010 ✅)
- **Fullscreen responsive UI** with status bar (011 ✅)

**What's missing for a "real game":** (See Phase 6)
- Combat skills (active abilities)
- Equipment sets (build diversity)
- Boss-exclusive legendaries
- Endgame content (Fracture Rifts)

---

## ACTIVE PRIORITIES (December 2024)

### P0: Code Quality Refactor (020) 🔵
**Status:** In Progress - TypeScript Strict Mode Complete
**Impact:** Enables sustainable development, prevents regression, improves maintainability
**Spec:** `specs/020-code-quality-refactor/`

**Key Deliverables:**
- [x] Testing infrastructure (Vitest)
- [x] Structured logging (Pino)
- [x] Rate limiting (security)
- [x] TypeScript strict mode
- [x] Player class decomposition (1,552 → 630 lines via SRP handlers)
- [x] Game class decomposition (2,627 → 1,966 lines via controllers)
- [x] Error handling coverage (37 → 83 try/catch blocks, ~50% coverage)

**Why Now:** Technical debt is blocking velocity. Every new feature risks regression without tests.

---

### P0: Venice AI Fix ✅
**Status:** Complete - API key updated
**Impact:** All AI features working (NPC dialogue, quests, narrator, news)

### P1: Zone Bosses ✅
**Status:** Complete
- [x] Skeleton King roaming boss with 8-tile aggro range
- [x] Boss kill leaderboard
- [x] Extend aggro to regular mobs (configurable per mob type - range 3-8 by tier)
- [x] Visual indicator when mob targets you (pulsing red "!" above mob)
- [x] 6 zone-specific bosses (Giant Crab, Goblin Warlord, Bone Dragon, Sand Wurm, Demon Lord, Skeleton King)
- [x] Zone-bound spawning (bosses patrol within their zones)
- [x] Config-driven boss stats (HP, damage, armor, aggro range, respawn time)
- [x] Dynamic difficulty scaling (+20% HP / +10% damage per player)

### P2: Storage/Persistence ✅
**Status:** Complete - Server authoritative, cross-device ready
**Goal:** Replace localStorage with server-side persistence
- [x] Design storage architecture (see spec 016)
- [x] Implement SQLite storage layer (better-sqlite3)
- [x] Character persistence (level, XP, gold, equipment)
- [x] Inventory persistence (20-slot grid)
- [x] Achievement persistence (progress + unlocks)
- [x] Daily login streak persistence
- [x] Password hashing (SHA-256 + salt)
- [x] Client-side integration (server as source of truth)
- [x] Cross-device play enabled (all data from server)

### P3: Voice Acting (Fish Audio) ✅
**Status:** Complete
**Goal:** AI-generated voices for key characters
- [x] Fish Audio API integration (FishAudioService)
- [x] Voice personality per NPC type (narrator_dark, narrator_epic, king, boss, friendly_npc)
- [x] Caching strategy (memory + disk cache with MD5 keys)
- [x] Audio playback in client (AudioManager.playNpcVoice)
- [x] Intro sequence TTS narration
- [x] NPC dialogue TTS (King and key NPCs)
- [x] Narrator event TTS

### P4: Weekly/Monthly Challenges 🔵
**Status:** Not started
- [ ] Challenge definition system
- [ ] Leaderboard per challenge period
- [ ] Reward tiers
- [ ] Challenge reset scheduler

---

## GAME DESIGN IDEAS (Backlog)

### Kill Streak System ✅
- [x] Player kill streaks with escalating rewards (3→5→7→10→15→20 kills)
- [x] Streak interruption announcements ("X ended Y's rampage!")
- [x] XP/gold multipliers per tier (1.1x to 2.0x)
- [x] 5-minute timeout window
- [ ] Streak-based achievements/titles (future)

### Nemesis System (Shadow of Mordor style) ✅
- [x] Mobs that kill players gain power (15% per kill, max 3x)
- [x] Named enemies after 2 player kills (e.g., "Grimslayer the Unbroken")
- [x] Revenge mechanic - 2.5x XP / 2x gold for killing your nemesis
- [x] Server broadcasts nemesis power-ups and deaths to all players
- [ ] Nemesis persistence across sessions (future)

### Level Cap Increase ✅
- [x] Increased MAX_LEVEL from 20 to 50
- [x] Adjusted XP curve: 1.25 multiplier (was 1.5) for sustainable late-game
- [x] Extended zone levels: lavaland 15-35, boss 25-50
- [x] Added level achievements: Champion (30), Elite (40), Legend (50)
- [ ] Prestige system (future)

### Dynamic Difficulty ✅
- [x] Skeleton King scales with player population
- [x] +20% HP / +10% damage per additional player
- [x] Caps at 3x HP / 2x damage for 10+ players
- [x] Updates every 30 seconds to adapt to player joins/leaves
- [ ] Apply to other bosses (future)

---

## Phase 1: Core Loop (Make It Addictive)

> Goal: Create the compulsion loop that keeps players coming back.

### 001: Item System ✅
**Impact:** High - Loot is the heartbeat of an RPG
**Status:** Complete (MVP)

- [x] Random item properties (damage rolls, bonus stats)
- [x] Rarity tiers (Common/Uncommon/Rare/Epic/Legendary)
- [x] Item comparison tooltips
- [x] Drop key (D) to drop equipped weapon
- [x] Inventory system (007 ✅)
- [x] Drop tables per mob tier + zone bonuses (properties.ts, zone-manager.ts)

### 002: Progression System ✅
**Impact:** High - Levels = goals = retention
**Status:** Complete (MVP)

- [x] XP from kills
- [x] Level-up with stat increases
- [x] XP bar UI with level display
- [x] Persistence in localStorage
- [ ] Skill point allocation (future)

### 003: Economy System ✅
**Impact:** Medium - Enables trading, adds gold sink/source
**Status:** Complete

- [x] Gold currency from mob drops
- [x] Gold display in status bar
- [x] Gold persistence in localStorage
- [x] NPC merchant shops
- [x] Item buying from shops
- [x] Gold sync on player connect
- [x] Item selling to shops (context menu in inventory when shop open)
- [ ] Player-to-player trading (future)

### 007: Inventory System ✅
**Impact:** High - Enables carrying multiple items, strategic choices
**Status:** Complete (MVP)

- [x] 20-slot grid inventory (4x5)
- [x] 'I' key toggle panel
- [x] Click to equip/use items
- [x] Right-click context menu (Use/Equip/Drop)
- [x] Server-side validation
- [x] LocalStorage persistence
- [x] Consumable stacking (max 10)
- [ ] Drag-and-drop rearranging (future)
- [ ] Item sorting/filtering (future)

---

## Phase 2: Retention (Keep Them Coming Back)

> Goal: Daily engagement hooks and social features.

### 004: Daily Systems ✅
**Status:** Partial (login rewards complete)

- [x] Daily login rewards with streak bonuses
- [x] Login UI popup with reward display
- [x] Streak persistence in localStorage
- [ ] Daily quests with bonus XP/gold (future)
- [ ] Weekend events with special rewards (future)

### 005: Achievements & Titles ✅
**Status:** Complete (MVP)

- [x] 14 achievements across 4 categories (combat, wealth, progression, exploration)
- [x] Achievement progress tracking (kills, gold, levels, streaks)
- [x] Unlockable titles displayed above player names
- [x] Title selection and broadcasting to other players
- [x] Achievement unlock notifications
- [x] LocalStorage persistence
- [x] Achievement panel UI ('J' key toggle, category tabs, progress bars)

### 006: Social Features ✅
**Status:** Partial (Party + Inspect complete)

- [x] Party system with invite/accept/decline/leave
- [x] Shared XP distribution (equal split + 10% bonus per member)
- [x] Party chat channel
- [x] Party member indicators (green diamond + name color)
- [x] Party UI panel with member HP bars
- [x] Player inspect popup (right-click on players)
- [x] Context menu for player interactions
- [ ] Friends list (requires persistent accounts)
- [ ] Guild system (requires persistent accounts)

---

## Phase 3: Content (Fill the World)

> Goal: Enough content to explore for hours.

### 007: World Expansion
- New zones with level-appropriate mobs
- Zone-specific loot tables
- Environmental hazards
- Fast travel unlocks

### 008: Boss Encounters
- Multi-phase boss fights
- Raid-style mechanics for groups
- Legendary loot drops

### 009: Dungeon System
- Instanced dungeons (solo or party)
- Dungeon-specific quests
- Progressive difficulty

---

## Phase 4: Polish (Make It Feel Good)

> Goal: Juice, polish, delight.

### 010: Combat Feel ✅
**Status:** Complete (MVP)

- [x] Screen shake on hit
- [x] Hit particles (blood splatter)
- [x] Death particles
- [x] Low-health vignette effect
- [ ] Combat sound effects (future)
- [ ] Ability animations (future)

### 011: UI Overhaul ✅
**Status:** Complete (MVP)

- [x] Fullscreen responsive canvas
- [x] Floating status bar with health/XP/gold
- [x] Equipment icons display
- [x] Click-through status bar for zone transitions
- [x] Camera bounds clamping for indoor areas
- [ ] Mobile-friendly controls (future)
- [ ] Accessibility options (future)

### 012: Audio ✅
**Status:** Complete (MVP)

- [x] Ambient music per zone (village, beach, forest, cave, desert, lavaland)
- [x] Combat music triggers (boss music during combat, 5s fade back)
- [x] Volume controls UI (Master/Music/SFX sliders)
- [x] Settings persistence in localStorage
- [x] SFX for level up, gold pickup, equip, achievements
- [ ] More unique SFX per action (future)

---

## Phase 5: Scale (Prepare for Growth)

> Goal: Infrastructure for thousands of concurrent players.

### 013: Horizontal Scaling
- Redis pub/sub for EventBus
- Stateless server instances
- Database sharding strategy

### 014: Analytics
- Player behavior tracking
- Retention metrics
- A/B testing framework

### 015: Anti-Cheat
- Server-side validation hardening
- Rate limiting
- Exploit detection

---

## Phase 6: Real Game (Make It Worth Playing)

> Goal: Transform from tech demo to a game people actually play.

The difference between a portfolio piece and a real game is players. These features create the depth, replayability, and aspirational content that keeps players coming back.

### 030: Combat Skills ✅
**Impact:** Critical - Combat is currently click-and-wait
**Status:** Complete
**Spec:** `specs/030-combat-skills/`

Active abilities that give players agency in combat:
- [x] Dash (Level 5): Mobility, escape/engage
- [x] Power Strike (Level 10): Burst damage
- [x] War Cry (Level 15): AOE stun
- [x] Whirlwind (Level 20): AOE damage
- [x] Skill bar UI with hotkeys (1-4)
- [x] Cooldown system with visual feedback

Transforms combat from passive to active. Players make decisions every fight.

### 031: Equipment Sets ✅
**Impact:** High - Creates build identity and farming goals
**Status:** Complete
**Spec:** `specs/031-equipment-sets/`

Matching gear grants set bonuses:
- [x] Berserker's Fury: +15% damage, -10% max HP
- [x] Guardian's Resolve: +20% max HP, +10% defense
- [x] Shadow Walker: +15% speed, +10% crit chance
- [x] Dragon's Wrath: +10% damage, +10% max HP, fire proc

Players choose a playstyle. Farming for specific pieces creates goals.

### 032: Boss Loot ✅
**Impact:** High - Gives bosses purpose
**Status:** Complete
**Spec:** `specs/032-boss-loot/`

Boss-exclusive legendary drops with unique effects:
- [x] Crown of the Undying: Revive on death (5 min CD)
- [x] Greed's Edge: +50% gold from kills
- [x] Dragonbone Cleaver: 10% chance double damage
- [x] Hellfire Mantle: Reflect 15% fire damage
- [x] Server-wide legendary drop announcements

Legendaries are aspirational. Server-wide announcements create social moments.

### 033: Challenge Mode (Fracture Rifts) ✅
**Impact:** Critical - Endgame content
**Status:** Complete
**Spec:** `specs/033-challenge-mode/`

Infinitely scaling roguelike dungeon:
- [x] Progressive difficulty (HP/DMG multipliers per depth)
- [x] 13 random modifiers per run (9 debuffs, 4 buffs)
- [x] Leaderboard tracking max depth/kills/time
- [x] Rewards scale with depth and modifier count
- [x] Rift UI with HUD and progress tracking

Solves "nothing to do at max level." Leaderboard creates competition.

---

## Principles for Prioritization

1. **Core loop first**: Item + Progression before anything else
2. **Vertical slice**: Complete one feature fully before starting another
3. **Test with players**: Get feedback early and often
4. **Don't over-scope**: Each spec defines MVP, not ideal state
5. **AI enhances, never blocks**: Every feature works without AI

---

## Next Steps

1. Review and refine 001-item-system spec
2. Create implementation plan
3. Break into tasks
4. Implement vertical slice
5. Test, iterate, ship

---

*This roadmap is not a timeline. It's a direction.*
*Last updated: 2025-12-19*
