# PixelQuest Roadmap

> A living document tracking the path from foundation to addictive, successful game.

## Current State: Phase 3 Active - Content & Features

We have a fully playable core game with SRP architecture, roaming bosses, and AI-powered NPCs.

**Recent Milestones:**
- `v2.0.0-pixelquest` - Full rebrand from BrowserQuest-Ultra
- `v1.1.0-spec-kit` - Spec-driven development setup
- `v1.0.0-engine-foundation` - Complete SRP refactor

**What exists:**
- Real-time multiplayer browser game
- AI-powered NPCs with dynamic dialogue
- Quest system with AI generation
- Narrator system for event storytelling
- Town Crier newspaper aggregating world events
- Entity thought bubbles
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

**What's missing for a "real game":**
- Persistent accounts/storage (unlocks friends/guilds)
- Voice-acted NPCs (Fish Audio TTS integration)
- More content (areas, mobs, bosses)

---

## ACTIVE PRIORITIES (December 2024)

### P0: Venice AI Fix ✅
**Status:** Complete - API key updated
**Impact:** All AI features working (NPC dialogue, quests, narrator, news)

### P1: Mob Proximity Aggro ✅
**Status:** Complete
- [x] Skeleton King roaming boss with 8-tile aggro range
- [x] Boss kill leaderboard
- [x] Extend aggro to regular mobs (configurable per mob type - range 3-8 by tier)
- [x] Visual indicator when mob targets you (pulsing red "!" above mob)

### P2: Storage/Persistence 🟡
**Status:** Design phase
**Goal:** Replace localStorage with server-side persistence
- [ ] Design storage architecture (see spec 016)
- [ ] Implement user accounts
- [ ] Migrate existing localStorage data
- [ ] Enable cross-device play

### P3: Voice Acting (Fish Audio) 🔵
**Status:** Planning
**Goal:** AI-generated voices for all NPCs
- [ ] Fish Audio API integration
- [ ] Voice personality per NPC type
- [ ] Caching strategy for generated audio
- [ ] Audio playback in client

### P4: Weekly/Monthly Challenges 🔵
**Status:** Not started
- [ ] Challenge definition system
- [ ] Leaderboard per challenge period
- [ ] Reward tiers
- [ ] Challenge reset scheduler

---

## GAME DESIGN IDEAS (Backlog)

### Kill Streak System
- Player kill streaks with escalating rewards
- Streak interruption announcements ("X ended Y's rampage!")
- Streak-based achievements/titles

### Nemesis System (Shadow of Mordor style)
- Mobs that kill players gain power/levels
- Named enemies that "remember" players
- Revenge mechanic - bonus XP for killing your nemesis
- Creates emergent stories: "The Skeleton that killed me 3x is now level 15!"

### Level Cap Increase
- Current cap: 20 (too low?)
- Consider: 50 or 100 for longer progression
- Prestige system? Reset for cosmetic rewards
- Scaling curve adjustment needed

### Dynamic Difficulty
- Skeleton King adapts to server population
- More players = stronger boss
- Solo players get scaled-down encounters

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
*Last updated: 2024-12-14*
