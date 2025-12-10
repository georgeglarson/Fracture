# 006: Social Features - Party System + Player Inspect

**Status:** Complete (MVP)
**Phase:** 2 - Retention

## Overview

Session-based party system enabling group play without requiring persistent accounts.

## MVP Scope (Implemented)

### Party System
- Party invite/accept/decline/leave/kick
- Max 5 players per party
- Party leader (creator, oldest inherits on leave)
- Shared XP distribution with proximity check (15 tiles)
- XP bonus: +10% per additional member (max +50% at 5 members)
- Party chat channel
- Visual indicators for party members (green diamond + green name)
- Party UI panel showing member HP bars

### Player Inspect
- Right-click context menu on players
- Inspect popup showing: name, title, level, weapon, armor
- "Invite to Party" option in context menu

## Deferred (Requires Persistent Accounts)

- Friends list
- Guild system
- Persistent party history

## Message Types

```
PARTY_INVITE = 54           // Client: [54, targetPlayerId]
PARTY_INVITE_RECEIVED = 55  // Server: [55, inviterId, inviterName]
PARTY_ACCEPT = 56           // Client: [56, inviterId]
PARTY_DECLINE = 57          // Client: [57, inviterId]
PARTY_JOIN = 58             // Server: [58, partyId, members[], leaderId]
PARTY_LEAVE = 59            // Client: [59] / Server: [59, playerId]
PARTY_KICK = 60             // Client: [60, targetId]
PARTY_DISBAND = 61          // Server: [61]
PARTY_UPDATE = 62           // Server: [62, members[]]
PARTY_CHAT = 63             // Client: [63, msg] / Server: [63, senderId, name, msg]
PLAYER_INSPECT = 64         // Client: [64, targetId]
PLAYER_INSPECT_RESULT = 65  // Server: [65, id, name, title, level, weapon, armor]
```

## Files Created

| File | Purpose |
|------|---------|
| `server/ts/party/party.ts` | Party data model |
| `server/ts/party/party.service.ts` | Party management singleton |
| `server/ts/party/index.ts` | Module exports |
| `client/ts/ui/party-ui.ts` | Party panel UI |
| `client/ts/ui/player-inspect.ts` | Inspect popup |
| `client/ts/ui/context-menu.ts` | Right-click menu |

## Files Modified

| File | Changes |
|------|---------|
| `shared/ts/gametypes.ts` | Message types 54-65 |
| `server/ts/format.ts` | Format validation |
| `server/ts/message.ts` | Message classes |
| `server/ts/player.ts` | Party handlers |
| `server/ts/combat/combat-system.ts` | Shared XP distribution |
| `client/ts/network/gameclient.ts` | Party handlers/send methods |
| `client/ts/network/message-handlers.ts` | setupPartyHandlers |
| `client/ts/renderer/renderer.ts` | Party member indicators |
| `client/ts/game.ts` | UI initialization, rightClick handler |
| `client/ts/main.ts` | contextmenu event binding |

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Party size | 5 max | Balance coordination vs chaos |
| XP sharing | Equal split + bonus | Encourages grouping |
| Nearby range | 15 tiles | Prevents AFK leeching |
| Invite expiry | 30 seconds | Quick decisions |
| Leadership | Creator, oldest inherits | Simple succession |
| Session-based | No persistence | Avoids account system dependency |

## Testing Checklist

- [x] Right-click player shows context menu
- [x] Click "Inspect" shows popup with player stats
- [x] Click "Invite to Party" sends invite
- [x] Target receives invite popup
- [x] Accept creates party, panel shows
- [x] Party members have green indicator
- [x] Kill mob splits XP between nearby members
- [x] Party chat works
- [x] Leave party removes from party
- [x] Leader leaves, next member becomes leader
- [x] Last member leaves, party disbanded
