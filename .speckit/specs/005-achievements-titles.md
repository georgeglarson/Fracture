# 005: Achievements & Titles

**Status:** Implemented
**Priority:** Medium-High
**Dependencies:** 002 (Progression), 003 (Economy)

## Overview

Achievement system that tracks player milestones and rewards unlockable titles displayed above player names.

## MVP Scope

### Achievement Categories

1. **Combat** - Kill-based achievements
   - First Blood (kill 1 mob)
   - Rat Slayer (kill 10 rats)
   - Skeleton Crusher (kill 25 skeletons)
   - Boss Hunter (kill a boss)
   - Centurion (kill 100 mobs total)

2. **Wealth** - Gold-based achievements
   - Pocket Change (earn 100 gold)
   - Investor (earn 1,000 gold)
   - Wealthy (earn 10,000 gold)
   - First Purchase (buy from shop)

3. **Progression** - Level-based achievements
   - Adventurer (reach level 5)
   - Warrior (reach level 10)
   - Veteran (reach level 20)

4. **Exploration** - Discovery achievements
   - First Steps (enter the game)
   - Daily Devotee (7-day login streak)

### Title System

Titles displayed above player name:
- Format: `[Title] PlayerName`
- Example: `[Rat Slayer] Bob`

Unlocked titles can be selected from achievements panel.

### Data Model

```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'wealth' | 'progression' | 'exploration';
  requirement: {
    type: 'kills' | 'kills_type' | 'gold_earned' | 'gold_spent' | 'level' | 'streak' | 'custom';
    target: number;
    mobType?: string;  // for kills_type
  };
  reward?: {
    title?: string;
    gold?: number;
    xp?: number;
  };
  icon: string;  // CSS class or sprite name
}

interface PlayerAchievements {
  unlocked: string[];  // achievement IDs
  progress: Record<string, number>;  // partial progress
  selectedTitle: string | null;
}
```

### Message Types

```typescript
// Client -> Server
ACHIEVEMENT_SELECT_TITLE = 50  // [ACHIEVEMENT_SELECT_TITLE, achievementId]

// Server -> Client
ACHIEVEMENT_UNLOCK = 51        // [ACHIEVEMENT_UNLOCK, achievementId]
ACHIEVEMENT_PROGRESS = 52      // [ACHIEVEMENT_PROGRESS, achievementId, current, target]
PLAYER_TITLE_UPDATE = 53       // [PLAYER_TITLE_UPDATE, playerId, title]
```

## Implementation Steps

### Step 1: Define Achievements Data
- Create `shared/ts/achievements/achievement-data.ts`
- Define all achievements with requirements and rewards

### Step 2: Server Achievement Service
- Create `server/ts/achievements/achievement.service.ts`
- Track progress, check unlock conditions
- Integrate with existing events (mob kill, gold gain, level up)

### Step 3: Player Achievement State
- Add `achievements` field to Player class
- Persist to client via WELCOME or new message
- Handle title selection

### Step 4: Client Achievement UI
- Achievement panel (accessible via button or key)
- Progress bars for incomplete achievements
- Title selection dropdown
- Unlock notification popup

### Step 5: Title Display
- Modify player name rendering to include title
- Broadcast title changes to other players

### Step 6: Persistence
- Save achievements to localStorage (client-side for now)
- Sync on connect like gold/xp

## Files to Create

| File | Purpose |
|------|---------|
| `shared/ts/achievements/achievement-data.ts` | Achievement definitions |
| `shared/ts/achievements/index.ts` | Re-exports |
| `server/ts/achievements/achievement.service.ts` | Server-side tracking |
| `client/ts/ui/achievement-ui.ts` | UI component (category tabs, progress bars, title selection) |

## Files to Modify

| File | Changes |
|------|---------|
| `shared/ts/gametypes.ts` | New message types |
| `server/ts/player.ts` | Achievement state, title |
| `server/ts/world.ts` | Hook kill events to achievement service |
| `client/ts/game.ts` | Achievement panel integration |
| `client/ts/network/gameclient.ts` | New handlers |
| `client/ts/network/message-handlers.ts` | Process achievement messages |
| `client/ts/renderer/renderer.ts` | Render title with player name |
| `client/index.html` | Achievement panel HTML |
| `client/css/main.css` | Achievement panel styles |

## Testing Checklist

- [x] Kill mob -> progress updates
- [x] Meet requirement -> achievement unlocks
- [x] Unlock -> notification appears
- [x] Open panel ('J' key) -> see all achievements with category tabs
- [x] Select title -> title appears above name
- [x] Other players see your title
- [x] Refresh -> achievements persist

## Visual Design

**Achievement Panel:**
- Grid of achievement icons
- Locked = grayed out
- Unlocked = full color with checkmark
- Hover = tooltip with name/description/progress

**Unlock Notification:**
- Slide in from right
- Gold border, achievement icon
- "Achievement Unlocked: [Name]"
- Auto-dismiss after 3 seconds

**Title Display:**
- Above player name
- Smaller font, different color (gold for legendary titles)
