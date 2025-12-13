# PixelQuest Constitution

> Project governing principles and development guidelines. All implementations must adhere to these standards.

## Vision

An AI-enhanced HTML5 multiplayer RPG that combines the charm of classic browser games with modern AI technology to create a living, breathing world that never feels empty.

## Core Principles

### 1. Player Experience First

- **Engagement over features**: Every system must contribute to player engagement. Features that don't enhance the core gameplay loop should be rejected.
- **Variable rewards**: Embrace randomness and surprise. The brain craves unpredictability within bounded expectations.
- **Minimal friction**: Instant play. No downloads, no accounts required to start. Progressive enhancement for returning players.
- **Responsive feedback**: Every action should have immediate, satisfying feedback (visual, audio, narrative).

### 2. AI as Enhancement, Not Replacement

- **AI augments NPCs**: AI makes NPCs feel alive through dynamic dialogue, thoughts, and reactions.
- **AI never blocks gameplay**: If AI services fail, the game continues with static fallbacks.
- **AI creates narrative**: Events are narrated, achievements celebrated, deaths mourned - creating emotional investment.
- **AI populates the world**: AI characters ensure the world never feels empty, enabling community building.

### 3. Architecture Standards

- **Single Responsibility Principle**: Each module has one job. No god classes.
- **Event-driven communication**: Systems communicate via typed EventBus, enabling loose coupling.
- **Interface-first design**: Define contracts before implementations. Enables testing and swappability.
- **Graceful degradation**: Every external dependency must have a fallback path.

### 4. Code Quality

- **TypeScript required**: All new code must be TypeScript with strict mode.
- **No console.log in production**: Use proper logging with levels.
- **Build must pass**: No merging code that breaks the build.
- **Performance budget**: Client must maintain 60fps on mid-range devices.

### 5. Security Non-Negotiables

- **No secrets in code**: API keys, credentials via environment variables only.
- **Validate all inputs**: Trust nothing from the client. Server is authoritative.
- **Sanitize all outputs**: Prevent XSS, injection attacks.
- **No eval**: Never use eval() or dynamic code execution.

## Technical Requirements

### Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Language | TypeScript 5.x | Type safety, modern JS |
| Build | Webpack (client), TSC (server) | Industry standard |
| Runtime | Node.js 20+ | LTS, performance |
| Transport | Socket.io | Real-time, fallbacks |
| AI | Venice AI SDK | Uncensored, game-appropriate |
| Events | eventemitter3 | Fast, typed, swappable to Redis |

### Performance Targets

- Server tick rate: 50ms (20 TPS)
- Client render: 60fps
- WebSocket latency: <100ms perceived
- AI response: <2s with loading indicator

### Browser Support

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+
- Mobile: iOS Safari, Chrome Android

## Development Process

### Spec-Driven Development

All significant features must follow the spec-kit workflow:

1. **Specify**: Define user stories with acceptance criteria
2. **Plan**: Technical approach with constitution check
3. **Tasks**: Break into independently testable work items
4. **Implement**: Execute with continuous validation

### Testing Requirements

- Unit tests for business logic
- Integration tests for API endpoints
- Manual gameplay validation for each feature
- No feature ships without test coverage

### Commit Standards

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- One logical change per commit
- Reference spec/issue when applicable

## What We Don't Do

- **No pay-to-win**: Monetization must not create unfair advantages
- **No predatory mechanics**: No dark patterns, manipulative timers, or exploitation
- **No scope creep**: Features not in the current spec get their own spec
- **No premature optimization**: Measure before optimizing
- **No technical debt without tickets**: If you must take a shortcut, document it

## Living Document

This constitution evolves with the project. Amendments require:

1. Clear rationale for the change
2. Impact assessment on existing code
3. Migration plan if standards change

---

*Last updated: 2025-12-06*
*Version: 1.0.0*
