# Spec 034: Progression Limits & Prestige System

## Overview
Balanced progression system that rewards active play, encourages daily returns, and provides infinite scaling through prestige.

## Session Efficiency (Soft Limits)

Combat efficiency decreases over continuous play, resetting after rest:

| Session Duration | XP/Gold Rate |
|-----------------|--------------|
| 0-30 minutes    | 100%         |
| 30-60 minutes   | 75%          |
| 60-90 minutes   | 50%          |
| 90+ minutes     | 25%          |

**Reset conditions:**
- 4+ hours offline = full reset to 100%
- New calendar day (UTC) = full reset

## Rested XP Bonus

Reward returning players:
- Accumulate 5% bonus XP per hour offline
- Maximum 100% rested bonus (20 hours offline)
- Rested bonus applies as multiplier (stacks with efficiency)
- Burns through at 1% per kill

Example: 8 hours offline = 40% rested bonus
- First ~40 kills deal bonus XP, then normal rate

## Prestige/Ascension System

When reaching max level (50), players can **Ascend**:

### Ascension Rewards (permanent, cumulative)
- +10% base XP gain per ascension
- +5% base damage per ascension
- +5% max HP per ascension
- Unlock prestige title displayed on character

### Ascension Titles
| Ascension | Title |
|-----------|-------|
| 1 | Ascended |
| 2 | Transcendent |
| 3 | Exalted |
| 4 | Divine |
| 5 | Eternal |
| 6+ | Eternal II, III, etc. |

### Ascension Process
1. Reach level 50
2. Click "Ascend" button (confirmation dialog)
3. Level resets to 1
4. Keep: Gold, inventory, achievements, ascensions
5. Lose: Current level, current XP

## UI Elements

### Status Bar Additions
- Session efficiency indicator (clock icon, shows %)
- Rested XP bar (blue, shows remaining bonus)
- Ascension count next to player name

### Ascension UI
- "ASCEND" button appears at level 50
- Glowing effect to draw attention
- Confirmation modal showing rewards

## Database Schema Changes

```sql
ALTER TABLE players ADD COLUMN ascension_count INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN rested_xp REAL DEFAULT 0;
ALTER TABLE players ADD COLUMN last_logout_time INTEGER;
ALTER TABLE players ADD COLUMN session_start_time INTEGER;
```

## Implementation Priority
1. Session efficiency tracking (server)
2. XP/Gold multiplier application
3. Rested XP accumulation and consumption
4. Ascension system and rewards
5. UI indicators
