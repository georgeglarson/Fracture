# 020: Code Quality Refactor - Tasks

> Phase: TASKS
> Total Tasks: 42
> Completed: 16 (Phase 1 core complete)
> Estimated Sessions: 8-12

## Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

---

## Phase 1: Foundation

### 1.1 Testing Infrastructure

- [x] **T-001**: Install Vitest and dependencies
  ```bash
  pnpm add -D vitest @vitest/coverage-v8 @vitest/ui
  ```
  - Verify: `pnpm vitest --version`

- [x] **T-002**: Create vitest.config.ts for server
  - Location: `vitest.config.ts`
  - Include: coverage thresholds, test patterns
  - Verify: `pnpm vitest run --config vitest.config.ts`

- [x] **T-003**: Create test directory structure
  ```
  server/ts/__tests__/
  client/ts/__tests__/
  shared/ts/__tests__/
  test/mocks/socket.mock.ts
  test/mocks/venice.mock.ts
  test/fixtures/player.fixture.ts
  ```

- [x] **T-004**: Add npm scripts for testing
  ```json
  {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
  ```

- [x] **T-005**: Write tests for Formulas.ts
  - Location: `shared/ts/__tests__/formulas.test.ts`
  - Cover: `xpFromMob`, `goldFromMob`, `damageFormula`, `xpToNextLevel`
  - Target: 100% coverage

- [x] **T-006**: Write tests for Utils.ts
  - Location: `server/ts/__tests__/utils.test.ts`
  - Cover: `sanitize`, `random`, `clamp`, `isValidName`
  - Target: 100% coverage

- [x] **T-007**: Create Socket.IO mock
  - Location: `test/mocks/socket.mock.ts`
  - Interface: emit, on, broadcast
  - Use: Player tests

- [x] **T-008**: Create Venice API mock
  - Location: `test/mocks/venice.mock.ts`
  - Mock responses for: dialogue, quest, narrator
  - Use: AI service tests

### 1.2 Structured Logging

- [x] **T-009**: Install pino and pino-pretty
  ```bash
  pnpm add pino
  pnpm add -D pino-pretty
  ```

- [x] **T-010**: Create logger wrapper
  - Location: `server/ts/utils/logger.ts`
  - Export: `logger`, `createChildLogger`
  - Support: LOG_LEVEL env var

- [ ] **T-011**: Replace console.log in main.ts
  - File: `server/ts/main.ts`
  - Replace all console.log/error/warn
  - Add startup context logging

- [ ] **T-012**: Replace console.log in world.ts
  - File: `server/ts/world.ts`
  - Add entity lifecycle logging
  - Add group management logging

- [ ] **T-013**: Replace console.log in player.ts
  - File: `server/ts/player.ts`
  - Add player action logging
  - Include player ID in context

- [ ] **T-014**: Replace console.log in AI services
  - Files: `server/ts/ai/*.ts`
  - Add Venice API call logging
  - Add response time metrics

### 1.3 Rate Limiting

- [x] **T-015**: Install rate-limiter-flexible
  ```bash
  pnpm add rate-limiter-flexible
  ```

- [x] **T-016**: Create rate limiter middleware
  - Location: `server/ts/middleware/rate-limiter.ts`
  - Strategies: per-IP, per-player
  - Export: `rateLimitByIP`, `rateLimitByPlayer`

- [x] **T-017**: Apply rate limiting to authentication
  - File: `server/ts/player/message-router.ts`
  - Limit: 5 attempts per minute per IP
  - Return: Error message on limit

- [x] **T-018**: Apply rate limiting to shops
  - Limit: 10 transactions per minute
  - Key: Player ID

- [x] **T-019**: Apply rate limiting to chat/messages
  - Limit: 5 messages per 10 seconds
  - Key: Player ID

- [x] **T-020**: Add flood protection
  - Limit: 20 combat actions per second per connection
  - Action: Rate limited with error message

---

## Phase 2: TypeScript Strict Mode

### 2.1 Configuration

- [ ] **T-021**: Create tsconfig.strict.json
  ```json
  {
    "extends": "./tsconfig.json",
    "compilerOptions": {
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true
    }
  }
  ```

- [ ] **T-022**: Create strict migration tracking script
  - Location: `scripts/strict-progress.sh`
  - Output: Files passing/failing strict mode

### 2.2 Fix Types by Directory

- [ ] **T-023**: Fix shared/ts types
  - Target: 0 errors
  - Focus: gametypes.ts, events/

- [ ] **T-024**: Fix server/ts/utils types
  - Target: 0 errors
  - Focus: Pure functions

- [ ] **T-025**: Fix server/ts/ai types
  - Target: 0 errors
  - Focus: Venice API types, service interfaces

- [ ] **T-026**: Fix server/ts/combat types
  - Target: 0 errors
  - Focus: Entity interface, CombatSystem

- [ ] **T-027**: Fix server/ts/party types
  - Target: 0 errors

- [ ] **T-028**: Fix server/ts core types
  - Files: player.ts, world.ts, mob.ts, message.ts
  - Target: 0 errors
  - Note: Largest effort

- [ ] **T-029**: Enable strict in main tsconfig
  - After all files pass
  - Update CI to fail on type errors

---

## Phase 3: Player Class Decomposition

### 3.1 PlayerCombat

- [ ] **T-030**: Create PlayerCombat class
  - Location: `server/ts/player/player-combat.ts`
  - Interface: IPlayerCombat
  - Methods: grantXP, grantGold, handleKill, checkLevelAchievements

- [ ] **T-031**: Write tests for PlayerCombat
  - Location: `server/ts/player/__tests__/player-combat.test.ts`
  - Cover: XP grants, level-ups, gold grants
  - Target: 80% coverage

- [ ] **T-032**: Integrate PlayerCombat into Player
  - Delegate methods
  - Verify functionality unchanged

### 3.2 PlayerAchievements

- [ ] **T-033**: Create PlayerAchievements class
  - Location: `server/ts/player/player-achievements.ts`
  - Methods: init, check, unlock, updateProgress

- [ ] **T-034**: Write tests for PlayerAchievements
  - Cover: Unlock conditions, progress tracking

- [ ] **T-035**: Integrate PlayerAchievements into Player

### 3.3 PlayerParty

- [ ] **T-036**: Create PlayerParty class
  - Location: `server/ts/player/player-party.ts`
  - Methods: invite, accept, leave, chat, kick

- [ ] **T-037**: Write tests for PlayerParty

- [ ] **T-038**: Integrate PlayerParty into Player

### 3.4 PlayerAI

- [ ] **T-039**: Create PlayerAI class
  - Location: `server/ts/player/player-ai.ts`
  - Methods: handleNpcTalk, handleQuest, triggerNarration

- [ ] **T-040**: Write tests for PlayerAI
  - Use Venice mock

- [ ] **T-041**: Integrate PlayerAI into Player

### 3.5 Remaining Extractions

- [ ] **T-042**: Create PlayerShop class
- [ ] **T-043**: Create PlayerZone class
- [ ] **T-044**: Final Player.ts cleanup
  - Target: <400 lines
  - Remove dead code
  - Add JSDoc

---

## Phase 4: Error Handling

- [ ] **T-045**: Create error types
  - Location: `server/ts/errors/index.ts`
  - Types: GameError, VeniceError, ValidationError

- [ ] **T-046**: Create error message type
  - Add to: `server/ts/message.ts`
  - Fields: code, message, retryable

- [ ] **T-047**: Add error handling to AI services
  - Wrap all async calls
  - Log with context
  - Return fallbacks

- [ ] **T-048**: Add error handling to message router
  - Wrap all handlers
  - Send error messages to client

- [ ] **T-049**: Client-side error display
  - Handle ERROR message type
  - Show user-friendly notifications

---

## Phase 5: Game Class Decomposition (Client)

- [ ] **T-050**: Create GameState module
  - Location: `client/ts/state/game-state.ts`
  - Centralize: player state, UI state, callbacks

- [ ] **T-051**: Enhance EntityManager
  - Move entity lifecycle from Game
  - Add entity query methods

- [ ] **T-052**: Enhance InputManager
  - Move all input handling from Game
  - Add input state machine

- [ ] **T-053**: Enhance UIManager
  - Move UI show/hide methods
  - Add UI state management

- [ ] **T-054**: Refactor Game.ts
  - Delegate to managers
  - Target: <600 lines

---

## Phase 6: Documentation & Cleanup

- [ ] **T-055**: Add JSDoc to all extracted modules
- [ ] **T-056**: Remove dead code (console.log comments, unused imports)
- [ ] **T-057**: Update ARCHITECTURE_SRP.md
- [ ] **T-058**: Create CONTRIBUTING.md with patterns
- [ ] **T-059**: Final test coverage audit (target: 60%+)

---

## Verification Checklist (After Each Phase)

- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] Server starts without errors
- [ ] Manual test: Create character, fight, level up, buy item
- [ ] AI test: Talk to NPC, get quest, check newspaper

---

## Task Dependencies

```
T-001 → T-002 → T-003 → T-004 (Testing setup)
T-009 → T-010 → T-011..T-014 (Logging)
T-015 → T-016 → T-017..T-020 (Rate limiting)

T-005, T-006 depend on T-004
T-030..T-044 depend on T-005..T-008 (tests first)

T-021 → T-022 → T-023..T-029 (TypeScript strict)
T-029 blocks final merge

T-045 → T-046 → T-047..T-049 (Error handling)

Phase 5 can run parallel to Phase 3
Phase 6 runs last
```

---

## Quick Wins (Can Do Anytime)

These tasks are low-risk and can be done opportunistically:

1. T-009, T-010 (Install pino, create wrapper)
2. T-015, T-016 (Install rate limiter, create middleware)
3. T-021, T-022 (Create strict config, tracking script)
4. T-055, T-056 (Documentation, dead code removal)

---

*Last updated: 2025-12-16*
