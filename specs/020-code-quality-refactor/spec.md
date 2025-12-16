# 020: Code Quality Refactor

> Status: APPROVED
> Priority: P0 (Critical - blocks sustainable development)
> Version: 1.0.0

## Problem Statement

The codebase has accumulated significant technical debt that impedes maintainability, reliability, and developer velocity. Key issues include:

- **God objects**: `Player` (1,552 lines), `Game` (2,627 lines) violate SRP
- **Zero test coverage**: No unit, integration, or E2E tests
- **Weak type safety**: `noImplicitAny: false`, `strictNullChecks: false`
- **Insufficient error handling**: ~10% of async operations have error handling
- **Missing rate limiting**: Security vulnerability for brute force attacks

This refactor establishes the foundation for sustainable development.

## Constitution Alignment

| Principle | Current State | Target State |
|-----------|---------------|--------------|
| SRP | Violated (god classes) | Enforced |
| TypeScript strict | Disabled | Enabled |
| Test coverage | 0% | 60%+ critical paths |
| Error handling | Sparse | Comprehensive |
| Security | Missing rate limiting | Implemented |

## User Stories

### US-001 [P0]: Player Class Decomposition
**As a** developer
**I want** the Player class split into focused modules
**So that** I can modify combat logic without risking inventory bugs

**Acceptance Criteria:**
- Player.ts < 400 lines
- Each extracted module has single responsibility
- All existing functionality preserved
- No breaking changes to external API

### US-002 [P0]: TypeScript Strict Mode
**As a** developer
**I want** strict TypeScript compilation
**So that** type errors are caught at compile time, not runtime

**Acceptance Criteria:**
- `noImplicitAny: true` enabled
- `strictNullChecks: true` enabled
- Build passes with zero type errors
- All `any` types replaced with proper types

### US-003 [P1]: Test Foundation
**As a** developer
**I want** a testing framework with initial coverage
**So that** regressions are caught before deployment

**Acceptance Criteria:**
- Jest configured for both client and server
- Core business logic has >60% coverage
- CI fails on test failures
- Tests run in <30 seconds

### US-004 [P1]: Error Handling
**As a** player
**I want** the game to gracefully handle errors
**So that** service failures don't crash my session

**Acceptance Criteria:**
- All async handlers have try/catch
- Errors logged with context
- Client receives error state (not silent failure)
- Venice AI failures show fallback content

### US-005 [P1]: Rate Limiting
**As a** server operator
**I want** request rate limiting
**So that** the server is protected from abuse

**Acceptance Criteria:**
- Login attempts limited (5 per minute per IP)
- Shop transactions limited (10 per minute per player)
- Message flood protection (50 per second per connection)
- Rate limit exceeded returns 429 with retry-after

### US-006 [P2]: Game Class Decomposition
**As a** developer
**I want** the client Game class split into managers
**So that** client code is maintainable

**Acceptance Criteria:**
- Game.ts < 600 lines
- Rendering, input, network separated
- State management centralized

### US-007 [P2]: Structured Logging
**As a** developer
**I want** proper logging with levels
**So that** I can debug production issues

**Acceptance Criteria:**
- Replace console.log with logger
- Log levels: debug, info, warn, error
- Structured JSON logs in production
- Request correlation IDs

## Modules to Extract

### From Player.ts (Server)

| Module | Responsibility | Est. Lines |
|--------|----------------|------------|
| `PlayerCore` | HP, position, basic state | 200 |
| `PlayerCombat` | Damage, XP, level-ups | 250 |
| `PlayerInventory` | Already exists, integrate | 150 |
| `PlayerAchievements` | Track progress, unlock | 200 |
| `PlayerParty` | Party membership, XP sharing | 150 |
| `PlayerAI` | Venice integration, quests | 200 |
| `PlayerShop` | Buy/sell transactions | 100 |
| `PlayerZone` | Zone tracking, warnings | 100 |

### From Game.ts (Client)

| Module | Responsibility | Est. Lines |
|--------|----------------|------------|
| `GameCore` | Initialization, tick loop | 300 |
| `GameRenderer` | Already exists, expand | 200 |
| `GameInput` | Already exists, expand | 150 |
| `GameNetwork` | Message handling coordination | 200 |
| `GameState` | Player state, UI state | 150 |
| `GameEntities` | Entity lifecycle | 200 |

## Technical Requirements

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Testing Stack
- **Framework**: Vitest (fast, ESM-native, Jest-compatible)
- **Coverage**: v8 (built into Vitest)
- **Mocking**: Vitest built-in
- **Target**: 60% for business logic, 40% overall

### Rate Limiting
- **Package**: `rate-limiter-flexible`
- **Storage**: In-memory (Redis-ready for scale)
- **Strategies**: Per-IP for auth, per-player for gameplay

### Logging
- **Package**: `pino` (fast structured logging)
- **Format**: JSON in production, pretty in dev
- **Levels**: Configurable via LOG_LEVEL env var

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Largest file | 2,627 lines | <600 lines |
| Test coverage | 0% | 60%+ critical |
| TypeScript strict | false | true |
| Build time | ~30s | <30s |
| Error handling | 10% | 90%+ |

## Dependencies

- Blocks: All future feature development
- Requires: None (foundational)
- Enables: Confident refactoring, rapid iteration

## Risks

| Risk | Mitigation |
|------|------------|
| Regression during refactor | Incremental extraction, extensive testing |
| Build time increase | Parallel compilation, caching |
| Type error explosion | Fix incrementally, use `// @ts-expect-error` temporarily |

## Out of Scope

- Database schema changes
- New gameplay features
- UI redesign
- Performance optimization (separate spec)

## Open Questions

- [RESOLVED] Testing framework: Vitest (faster than Jest, ESM-native)
- [RESOLVED] Logging library: Pino (best performance)
