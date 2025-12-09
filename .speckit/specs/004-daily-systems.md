# 004: Daily Systems

> Status: **In Progress**
> Priority: Phase 2 - Retention
> Dependencies: 003-economy-system (gold rewards)

## Overview

Daily engagement systems that reward players for consistent logins and give them reasons to return each day.

## MVP Scope

**Included:**
- Daily login reward (gold + XP on first login)
- Login streak tracking (1-7 day cycles)
- Streak multiplier for rewards
- UI popup showing reward claimed
- Persistence in localStorage

**Deferred:**
- Daily quests with objectives
- Weekend/holiday events
- Premium daily rewards
- Daily reward calendar UI

---

## Reward Structure

### Base Daily Reward
| Day | Gold | XP | Multiplier |
|-----|------|-----|------------|
| 1   | 10   | 25  | 1.0x       |
| 2   | 15   | 35  | 1.2x       |
| 3   | 20   | 50  | 1.4x       |
| 4   | 25   | 65  | 1.6x       |
| 5   | 35   | 85  | 1.8x       |
| 6   | 50   | 100 | 2.0x       |
| 7   | 100  | 200 | 2.5x       |

After day 7, streak resets to day 1.

### Streak Rules
- Login within 24 hours of previous login: streak continues
- Miss a day: streak resets to 1
- Reward is granted once per calendar day (UTC)

---

## Data Model

### Client Storage (localStorage)
```typescript
daily: {
  lastLoginDate: string;     // ISO date "2025-12-08"
  currentStreak: number;     // 1-7
  longestStreak: number;     // historical max
  totalDailyLogins: number;  // lifetime count
}
```

### Message Types
```typescript
DAILY_REWARD = 44  // [DAILY_REWARD, gold, xp, streak, isNewDay]
```

---

## Implementation

### Step 1: Add Message Type
**File:** `shared/ts/gametypes.ts`
```typescript
DAILY_REWARD = 44
```

### Step 2: Daily Reward Logic (Server)
**File:** `server/ts/daily/daily-reward.ts`

New service that:
- Calculates reward based on streak
- Determines if player is eligible for daily reward
- Sends DAILY_REWARD message

### Step 3: Player Daily State
**File:** `server/ts/player.ts`

Add fields:
- `lastLoginDate: string`
- `currentStreak: number`

### Step 4: Grant on Welcome
**File:** `server/ts/player.ts`

In player connection:
- Check if new day since last login
- Calculate streak (continue or reset)
- Grant reward if eligible
- Send DAILY_REWARD message

### Step 5: Client Handler
**File:** `client/ts/network/message-handlers.ts`

Handle DAILY_REWARD:
- Show popup notification
- Update gold/XP displays
- Save to localStorage

### Step 6: Daily Reward Popup UI
**File:** `client/index.html` + `client/css/main.css`

Styled popup:
- "Daily Reward!" header
- Gold/XP amounts
- Streak indicator
- Auto-dismiss after 5s

### Step 7: Persistence
**File:** `client/ts/utils/storage.ts`

Add daily storage methods:
- `getDailyData()`
- `saveDailyLogin()`
- `getStreak()`

---

## Files to Modify

| File | Changes |
|------|---------|
| `shared/ts/gametypes.ts` | Add DAILY_REWARD message |
| `server/ts/player.ts` | Daily state, reward granting |
| `client/ts/network/gameclient.ts` | Daily callback |
| `client/ts/network/message-handlers.ts` | Handle DAILY_REWARD |
| `client/ts/game.ts` | Daily reward state |
| `client/index.html` | Daily popup element |
| `client/css/main.css` | Popup styling |
| `client/ts/utils/storage.ts` | Daily persistence |

---

## UI Design

### Daily Reward Popup
```
┌─────────────────────────────┐
│       🎁 DAILY REWARD!      │
│                             │
│    Day 3 Streak! 🔥🔥🔥      │
│                             │
│        +20 Gold             │
│        +50 XP               │
│                             │
│    Keep it up for more!     │
└─────────────────────────────┘
```

- Center of screen
- Gold background/border
- Fades in, auto-dismiss after 5s
- Click anywhere to dismiss

---

## Verification Checklist

- [ ] First login of day → reward popup appears
- [ ] Gold and XP added correctly
- [ ] Refresh same day → no duplicate reward
- [ ] Login next day → streak increments, better reward
- [ ] Miss a day → streak resets to 1
- [ ] 7-day streak → max reward, then resets to day 1
- [ ] localStorage persists streak across sessions
