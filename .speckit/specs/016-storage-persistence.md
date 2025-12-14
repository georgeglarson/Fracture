# 016: Storage & Persistence System

> Goal: Replace client-side localStorage with server-side persistence for cross-device play and proper user accounts.

## Status: Design Phase

## Problem Statement

Currently, all player data is stored in browser localStorage:
- Progress lost if browser data cleared
- No cross-device play
- No way to implement friends/guilds
- Vulnerable to client-side manipulation

## Design Decision: Storage Technology

### Option A: SQLite (Recommended for MVP)
**Pros:**
- Zero infrastructure - single file
- Built-in with Node.js via better-sqlite3
- Fast for small-to-medium scale
- Easy to backup (just copy file)
- Schema migrations with simple SQL

**Cons:**
- Single-server only (no horizontal scaling)
- Need migration path for growth

### Option B: PostgreSQL
**Pros:**
- Production-grade ACID database
- Horizontal scaling possible
- Rich query language
- JSON column support

**Cons:**
- Requires separate service
- More infrastructure complexity
- Overkill for MVP

### Option C: Redis
**Pros:**
- Extremely fast
- Built-in TTL for sessions
- Pub/sub for real-time features

**Cons:**
- Volatile by default (requires persistence config)
- Not ideal for structured data
- Better as cache layer on top of SQL

### Recommendation: SQLite MVP + PostgreSQL Later
1. Start with SQLite - fast to implement, no infrastructure
2. Abstract storage behind interface - easy to swap later
3. Migrate to PostgreSQL when scaling requires it

## Data Models

### User Account
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,        -- UUID
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

### Player Character
```sql
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  hp INTEGER DEFAULT 100,
  max_hp INTEGER DEFAULT 100,
  gold INTEGER DEFAULT 0,
  armor_kind INTEGER,
  weapon_kind INTEGER,
  x INTEGER DEFAULT 0,
  y INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_saved DATETIME
);
```

### Inventory
```sql
CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  slot INTEGER NOT NULL,
  item_kind INTEGER NOT NULL,
  count INTEGER DEFAULT 1,
  properties TEXT,  -- JSON for item stats
  UNIQUE(character_id, slot)
);
```

### Achievements
```sql
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  achievement_id TEXT NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  progress INTEGER DEFAULT 0,
  UNIQUE(character_id, achievement_id)
);
```

### Daily Login
```sql
CREATE TABLE daily_logins (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  last_login DATE,
  streak INTEGER DEFAULT 0
);
```

## Authentication Flow

### Option A: Username/Password + JWT (Recommended)
1. User registers with username/password
2. Server returns JWT token
3. Client stores JWT in localStorage
4. JWT included in WebSocket handshake
5. Refresh token for extended sessions

### Option B: OAuth (Future)
- Google/Discord login
- Reduces friction for users
- More complex to implement

## Migration Strategy

### Phase 1: Server-Side Storage (Keep localStorage for now)
1. Implement SQLite storage layer
2. Add save endpoints to server
3. Client saves to both localStorage AND server
4. Read from localStorage, fallback to server

### Phase 2: Authentication
1. Add user registration/login endpoints
2. Associate characters with user accounts
3. Remove localStorage dependency
4. Guest mode for try-before-signup

### Phase 3: Polish
1. Account management UI
2. Character selection screen
3. Data export/import
4. Account deletion

## API Endpoints

```typescript
// Auth
POST /api/auth/register  { username, password }
POST /api/auth/login     { username, password }
POST /api/auth/refresh   { refreshToken }

// Character
GET  /api/character               // Get current character
POST /api/character/save          // Save character state
GET  /api/character/inventory     // Get inventory
POST /api/character/inventory     // Save inventory

// Achievements
GET  /api/achievements            // Get all achievements
POST /api/achievements/unlock/:id // Unlock achievement
```

## Storage Interface (SRP)

```typescript
// Abstract interface for easy swapping
interface IStorageService {
  // Users
  createUser(username: string, passwordHash: string): Promise<User>;
  findUserByUsername(username: string): Promise<User | null>;

  // Characters
  createCharacter(userId: string, name: string): Promise<Character>;
  getCharacter(characterId: string): Promise<Character | null>;
  saveCharacter(character: CharacterData): Promise<void>;

  // Inventory
  getInventory(characterId: string): Promise<InventorySlot[]>;
  saveInventory(characterId: string, slots: InventorySlot[]): Promise<void>;

  // Achievements
  getAchievements(characterId: string): Promise<Achievement[]>;
  unlockAchievement(characterId: string, achievementId: string): Promise<void>;
}

// Implementations
class SQLiteStorageService implements IStorageService { ... }
class PostgresStorageService implements IStorageService { ... }  // Future
```

## Success Criteria

- [ ] User can register and login
- [ ] Progress persists across devices
- [ ] Data survives browser clear
- [ ] JWT authentication works
- [ ] Inventory syncs to server
- [ ] Achievements sync to server
- [ ] Guest mode allows playing without account
- [ ] Existing localStorage data can be migrated

## Non-Goals (Future)

- Account linking (email change, password reset)
- Two-factor authentication
- Social login (OAuth)
- Admin panel
- Data analytics

---

*Last updated: 2024-12-14*
