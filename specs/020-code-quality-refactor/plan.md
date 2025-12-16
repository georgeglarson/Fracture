# 020: Code Quality Refactor - Implementation Plan

> Phase: PLAN
> Approved: Yes
> Constitution Check: Passed

## Implementation Strategy

The refactor follows **Strangler Fig Pattern**: gradually extract modules while keeping the system functional. No big bang rewrites.

## Phase 1: Foundation (Must complete first)

### 1.1 Testing Infrastructure

**Goal**: Ability to write and run tests before refactoring.

**Approach**:
1. Install Vitest + dependencies
2. Configure for both client and server
3. Add npm scripts: `test`, `test:watch`, `test:coverage`
4. Create test utilities (mocks for Socket.IO, Venice API)
5. Write initial tests for pure functions (Formulas, Utils)

**Files to create**:
```
vitest.config.ts
vitest.workspace.ts
server/ts/__tests__/
client/ts/__tests__/
shared/ts/__tests__/
test/mocks/
test/fixtures/
```

**Package additions**:
```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "@vitest/ui": "^2.0.0"
  }
}
```

### 1.2 Structured Logging

**Goal**: Replace console.log before refactoring so we can debug issues.

**Approach**:
1. Install pino
2. Create logger wrapper with context injection
3. Replace console.log/error/warn incrementally
4. Add request ID middleware for correlation

**Files to create**:
```
server/ts/utils/logger.ts
client/ts/utils/logger.ts
shared/ts/utils/log-levels.ts
```

**Configuration**:
```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
```

### 1.3 Rate Limiting

**Goal**: Security hardening before exposing more surface area.

**Approach**:
1. Install rate-limiter-flexible
2. Create rate limit middleware
3. Apply to authentication, shops, messages
4. Add rate limit headers to responses

**Files to create**:
```
server/ts/middleware/rate-limiter.ts
server/ts/middleware/index.ts
```

**Rate Limits**:
| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| HELLO (login) | 5 | 60s | IP |
| SHOP_BUY | 10 | 60s | Player ID |
| CHAT | 5 | 10s | Player ID |
| HIT | 20 | 1s | Player ID |
| All messages | 100 | 1s | Connection |

## Phase 2: TypeScript Strict Mode

### 2.1 Enable Strict Incrementally

**Goal**: Type safety without blocking development.

**Approach**:
1. Create `tsconfig.strict.json` extending base
2. Fix files incrementally, move to strict config
3. Track progress with script
4. Final merge when all files pass

**Migration Order**:
1. `shared/ts/` (smallest, foundational)
2. `server/ts/utils/` (pure functions)
3. `server/ts/ai/` (already well-typed)
4. `server/ts/combat/` (contained)
5. `server/ts/party/` (contained)
6. `server/ts/` (remaining)
7. `client/ts/` (largest, last)

**Tracking Script**:
```bash
#!/bin/bash
# strict-progress.sh
echo "Files passing strict mode:"
npx tsc --project tsconfig.strict.json --noEmit 2>&1 | grep -c "error TS"
```

### 2.2 Type Definitions

**Goal**: Replace `any` with proper types.

**Priority Files**:
```
server/ts/player.ts          # 30+ any usages
server/ts/world.ts           # 20+ any usages
server/ts/message-router.ts  # Handler types
client/ts/game.ts            # 40+ any usages
```

**Common Patterns to Fix**:
```typescript
// Before
handleMessage(data: any) { }

// After
interface MessageData {
  type: string;
  payload: unknown;
}
handleMessage(data: MessageData) { }
```

## Phase 3: Player Class Decomposition

### 3.1 Extract PlayerCombat

**Goal**: All combat logic in one place.

**Methods to extract**:
- `grantXP()`
- `grantGold()`
- `handleKill()`
- `checkLevelAchievements()`
- `triggerNarration()`
- `receiveDamage()` (if exists)

**Interface**:
```typescript
interface IPlayerCombat {
  grantXP(amount: number): void;
  grantGold(amount: number): void;
  handleKill(mobType: string): void;
  getLevel(): number;
  getXp(): number;
}
```

**Delegation Pattern**:
```typescript
// player.ts
class Player {
  private combat: PlayerCombat;

  grantXP(amount: number) {
    this.combat.grantXP(amount);
  }
}
```

### 3.2 Extract PlayerAchievements

**Methods to extract**:
- `initAchievements()`
- `checkKillAchievements()`
- `checkLevelAchievements()`
- `unlockAchievement()`
- `updateAchievementProgress()`

### 3.3 Extract PlayerParty

**Methods to extract**:
- `handlePartyInvite()`
- `handlePartyAccept()`
- `handlePartyDecline()`
- `handlePartyLeave()`
- `handlePartyChat()`
- `handlePartyKick()`
- `handlePartyPromote()`

### 3.4 Extract PlayerAI

**Methods to extract**:
- `handleNpcTalk()`
- `handleQuestRequest()`
- `handleQuestProgress()`
- `triggerNarration()`
- `handleCompanionHint()`

### 3.5 Extract PlayerShop

**Methods to extract**:
- `handleShopOpen()`
- `handleShopBuy()`
- `handleShopSell()`
- `handleShopClose()`

### 3.6 Extract PlayerZone

**Methods to extract**:
- `updateZone()`
- `checkZoneWarnings()`
- `handleZoneEnter()`

## Phase 4: Error Handling

### 4.1 Create Error Types

```typescript
// errors.ts
export class GameError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
  }
}

export class VeniceError extends GameError {
  constructor(message: string) {
    super(message, 'VENICE_ERROR', true);
  }
}

export class ValidationError extends GameError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', true);
  }
}
```

### 4.2 Wrap All Async Handlers

**Pattern**:
```typescript
// Before
async handleNpcTalk(npcKind: number) {
  const response = await venice.generateDialogue(...);
  this.send(response);
}

// After
async handleNpcTalk(npcKind: number) {
  try {
    const response = await venice.generateDialogue(...);
    this.send(new Messages.NpcTalkResponse(npcKind, response));
  } catch (error) {
    logger.error({ error, npcKind, playerId: this.id }, 'NPC talk failed');
    this.send(new Messages.NpcTalkResponse(npcKind, this.getFallbackDialogue(npcKind)));
  }
}
```

### 4.3 Add Error Messages

```typescript
// message.ts
export class ErrorMessage {
  constructor(
    private code: string,
    private message: string,
    private retryable: boolean
  ) {}

  serialize() {
    return [Types.Messages.ERROR, this.code, this.message, this.retryable];
  }
}
```

## Phase 5: Game Class Decomposition (Client)

### 5.1 Extract GameState

**State to centralize**:
- `player`
- `playerLevel`, `playerXp`, `playerGold`
- `currentQuest`
- `currentNpcTalk`
- All callbacks

### 5.2 Enhance Existing Managers

**EntityManager**:
- Move entity lifecycle from Game
- Add entity queries

**InputManager**:
- Move all input handling
- Add input state machine

**UIManager**:
- Move all UI show/hide methods
- Add UI state management

## Phase 6: Documentation & Cleanup

### 6.1 JSDoc Coverage

Add JSDoc to all public methods in extracted modules.

### 6.2 Remove Dead Code

- Commented console.log statements
- Unused imports
- Deprecated methods

### 6.3 Consistent Patterns

- All services use constructor injection
- All managers use provider functions
- All errors use GameError hierarchy

## Rollback Strategy

Each phase is independently deployable. If issues arise:

1. **Phase 1**: Revert package.json, remove test files
2. **Phase 2**: Revert tsconfig, keep `any` annotations
3. **Phase 3**: Revert to monolithic Player (facades enable this)
4. **Phase 4**: Revert error handling, restore console.log
5. **Phase 5**: Keep client monolithic

## Verification

After each phase:
1. `npm run build` passes
2. `npm run test` passes (once tests exist)
3. Manual gameplay test: create character, fight mobs, level up, buy item
4. AI features work: talk to NPC, get quest, read newspaper

## Timeline Considerations

Phases can be done incrementally alongside feature work:
- Phase 1 (Foundation): Do first, enables everything else
- Phase 2 (TypeScript): Can be file-by-file over time
- Phase 3 (Player): One module per session
- Phase 4 (Errors): Can be opportunistic
- Phase 5 (Game): Lower priority, do when touching client
- Phase 6 (Cleanup): Continuous
