# 012: Audio System

**Status:** In Progress
**Phase:** 4 - Polish

## Overview

Complete the audio system with ambient zone music, combat music triggers, and volume controls.

**What exists:**
- AudioManager with full music/SFX infrastructure
- 17 sound effects (hit, heal, loot, death, etc.)
- Zone-based music area detection
- Fade in/out between zones
- Audio toggle (M key)

**What's missing:**
- Music files (village, beach, forest, cave, desert, lavaland, boss)
- Combat music trigger
- Volume sliders (master, music, SFX)
- Low-health heartbeat SFX

---

## MVP Scope

1. **Zone Music** - Ambient background music per area
2. **Combat Music** - Triggers when in combat, fades when out
3. **Volume Controls** - Basic UI to adjust levels
4. **Additional SFX** - Level up, inventory, shop sounds

**Deferred:**
- Dynamic music layers (intensity based on danger)
- 3D positional audio
- Music crossfading between similar tracks

---

## Music Zones

| Zone | File | Style |
|------|------|-------|
| village | village.mp3 | Peaceful, medieval town |
| beach | beach.mp3 | Calm, waves, seagulls |
| forest | forest.mp3 | Mysterious, nature ambient |
| cave | cave.mp3 | Dark, echoing, tense |
| desert | desert.mp3 | Hot, sparse, wind |
| lavaland | lavaland.mp3 | Ominous, volcanic rumbles |
| boss | boss.mp3 | Epic, intense orchestral |
| combat | combat.mp3 | Action, fast-paced |

---

## Implementation Steps

### Phase 1: Music Files

1. **Source royalty-free music tracks**
   - OpenGameArt.org
   - FreeMusicArchive
   - CC0 licensed tracks

2. **Create `client/audio/music/` directory**
   - Add .mp3 and .ogg versions of each track
   - Target 128kbps for reasonable file size

3. **Test zone transitions**
   - Verify fade in/out works
   - Check for audio glitches

### Phase 2: Combat Music

4. **Add combat state tracking**
   - Player enters combat when attacking or being attacked
   - Player exits combat 5s after last combat action

5. **Implement combatMusicTrigger in AudioManager**
   - On combat start: fade ambient → combat music
   - On combat end: fade combat → ambient music

6. **Add combat music file**

### Phase 3: Volume Controls

7. **Add AudioSettings interface**
   ```typescript
   interface AudioSettings {
     masterVolume: number;  // 0-1
     musicVolume: number;   // 0-1
     sfxVolume: number;     // 0-1
   }
   ```

8. **Create VolumeUI component**
   - Three sliders: Master, Music, SFX
   - Mute toggles per channel
   - Settings icon in status bar

9. **Persist to localStorage**

### Phase 4: Additional SFX

10. **Add new sound effects**
    - levelup.mp3 - Triumphant fanfare
    - inventory.mp3 - Bag rustle
    - equip.mp3 - Armor/weapon clank
    - buy.mp3 - Coin clink (shop purchase)
    - error.mp3 - Denied action

11. **Wire up to game events**

---

## Files to Create

| File | Purpose |
|------|---------|
| `client/audio/music/*.mp3` | Zone music tracks |
| `client/ts/ui/volume-ui.ts` | Volume controls panel |

## Files to Modify

| File | Changes |
|------|---------|
| `client/ts/audio.ts` | Combat music, volume controls |
| `client/ts/utils/storage.ts` | Persist audio settings |
| `client/ts/game.ts` | Combat state tracking |
| `index.html` | Volume UI button in status bar |

---

## Audio Sources (CC0/Royalty-Free)

Potential sources for music:
- **OpenGameArt.org** - Game-ready audio
- **Incompetech** - Kevin MacLeod's library
- **FreePD.com** - Public domain music
- **Mixkit** - Free sound effects

---

## Testing Checklist

- [ ] Music plays when entering village
- [ ] Music fades between zones
- [ ] Combat music triggers on attack
- [ ] Combat music fades after 5s peace
- [ ] M key toggles all audio
- [ ] Volume sliders work
- [ ] Settings persist on reload
- [ ] No audio glitches on rapid zone changes
- [ ] Mobile: music disabled (existing behavior)
- [ ] Safari: graceful degradation

---

*Last updated: 2025-12-11*
