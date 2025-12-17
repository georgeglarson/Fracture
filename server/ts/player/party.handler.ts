/**
 * PartyHandler - Handles all party interactions for players
 *
 * Single Responsibility: Party invites, joins, leaves, chat
 * Extracted from Player.ts to reduce its size.
 */

import { Messages } from '../message';
import { PartyService } from '../party';

/**
 * Player interface for party handler
 */
export interface PartyPlayerContext {
  id: number;
  name: string;
  level: number;
  hitPoints: number;
  maxHitPoints: number;
  x: number;
  y: number;
  send: (message: any) => void;
  getWorld(): {
    getEntityById: (id: number) => any;
  };
}

/**
 * Create a party member reference
 */
function createMemberRef(player: any) {
  return {
    id: player.id,
    name: player.name,
    level: player.level,
    hitPoints: player.hitPoints,
    maxHitPoints: player.maxHitPoints,
    gridX: Math.floor(player.x / 16),
    gridY: Math.floor(player.y / 16),
    send: (msg: any[]) => player.send(msg)
  };
}

/**
 * Handle party invite request
 */
export function handlePartyInvite(ctx: PartyPlayerContext, targetId: number): void {
  const partyService = PartyService.getInstance();
  const world = ctx.getWorld();
  const targetPlayer = world.getEntityById(targetId);

  if (!targetPlayer || targetPlayer.constructor.name !== 'Player') {
    console.log(`[Party] ${ctx.name} tried to invite invalid player ${targetId}`);
    return;
  }

  const inviterRef = createMemberRef(ctx);
  const targetRef = createMemberRef(targetPlayer);

  const error = partyService.sendInvite(inviterRef, targetId, targetRef);
  if (error) {
    console.log(`[Party] Invite failed: ${error}`);
  }
}

/**
 * Handle accepting a party invite
 */
export function handlePartyAccept(ctx: PartyPlayerContext, inviterId: number): void {
  const partyService = PartyService.getInstance();
  const world = ctx.getWorld();
  const inviterPlayer = world.getEntityById(inviterId);

  const accepterRef = createMemberRef(ctx);
  const inviterRef = inviterPlayer ? createMemberRef(inviterPlayer) : undefined;

  const result = partyService.acceptInvite(accepterRef, inviterId, inviterRef);

  if (typeof result === 'string') {
    console.log(`[Party] Accept failed: ${result}`);
    return;
  }

  // Send PARTY_JOIN to all party members
  const members = result.getMemberData();
  for (const memberId of result.getMemberIds()) {
    const memberPlayer = world.getEntityById(memberId);
    if (memberPlayer) {
      memberPlayer.send(new Messages.PartyJoin(result.id, members, result.leaderId).serialize());
    }
  }
}

/**
 * Handle declining a party invite
 */
export function handlePartyDecline(ctx: PartyPlayerContext, inviterId: number): void {
  const partyService = PartyService.getInstance();
  partyService.declineInvite(ctx.id, inviterId);
}

/**
 * Handle leaving the party
 */
export function handlePartyLeave(ctx: PartyPlayerContext): void {
  const partyService = PartyService.getInstance();
  const world = ctx.getWorld();
  const result = partyService.leaveParty(ctx.id);

  if (!result) {
    return;
  }

  const remainingMembers = result.party.getMemberIds();
  const memberData = result.party.getMemberData();

  if (result.disbanded) {
    // Notify all remaining members that party disbanded
    for (const memberId of remainingMembers) {
      const memberPlayer = world.getEntityById(memberId);
      if (memberPlayer) {
        memberPlayer.send(new Messages.PartyDisband().serialize());
      }
    }
  } else {
    // Notify remaining members
    for (const memberId of remainingMembers) {
      const memberPlayer = world.getEntityById(memberId);
      if (memberPlayer) {
        memberPlayer.send(new Messages.PartyLeave(ctx.id).serialize());
        if (result.newLeaderId) {
          memberPlayer.send(new Messages.PartyUpdate(memberData).serialize());
        }
      }
    }
  }
}

/**
 * Handle kicking a member from the party
 */
export function handlePartyKick(ctx: PartyPlayerContext, targetId: number): void {
  const partyService = PartyService.getInstance();
  const world = ctx.getWorld();
  const result = partyService.kickMember(ctx.id, targetId);

  if (!result || !result.success) {
    console.log(`[Party] Kick failed: ${result?.message || 'Unknown error'}`);
    return;
  }

  // Notify the kicked player
  const kickedPlayer = world.getEntityById(targetId);
  if (kickedPlayer) {
    kickedPlayer.send(new Messages.PartyDisband().serialize());
  }

  // Notify remaining party members
  const memberData = result.party.getMemberData();
  for (const memberId of result.party.getMemberIds()) {
    const memberPlayer = world.getEntityById(memberId);
    if (memberPlayer) {
      memberPlayer.send(new Messages.PartyLeave(targetId).serialize());
      memberPlayer.send(new Messages.PartyUpdate(memberData).serialize());
    }
  }
}

/**
 * Handle party chat message
 */
export function handlePartyChat(ctx: PartyPlayerContext, message: string): void {
  const partyService = PartyService.getInstance();
  const world = ctx.getWorld();
  const party = partyService.getPlayerParty(ctx.id);

  if (!party) {
    return;
  }

  // Send chat to all party members
  for (const memberId of party.getMemberIds()) {
    const memberPlayer = world.getEntityById(memberId);
    if (memberPlayer) {
      memberPlayer.send(new Messages.PartyChat(ctx.id, ctx.name, message).serialize());
    }
  }
}

/**
 * Handle player inspect request
 */
export function handlePlayerInspect(ctx: PartyPlayerContext, targetId: number): void {
  const world = ctx.getWorld();
  const targetPlayer = world.getEntityById(targetId);

  if (!targetPlayer || targetPlayer.constructor.name !== 'Player') {
    console.log(`[Inspect] ${ctx.name} tried to inspect invalid player ${targetId}`);
    return;
  }

  ctx.send(new Messages.PlayerInspectResult(
    targetPlayer.id,
    targetPlayer.name,
    targetPlayer.title,
    targetPlayer.level,
    targetPlayer.weapon,
    targetPlayer.armor
  ).serialize());
}

/**
 * Cleanup party data on disconnect
 */
export function cleanupParty(ctx: PartyPlayerContext): void {
  const partyService = PartyService.getInstance();
  const world = ctx.getWorld();
  const party = partyService.handlePlayerDisconnect(ctx.id);

  if (party) {
    const remainingMembers = party.getMemberIds();
    const memberData = party.getMemberData();

    if (remainingMembers.length === 0) {
      return;
    }

    for (const memberId of remainingMembers) {
      const memberPlayer = world.getEntityById(memberId);
      if (memberPlayer) {
        memberPlayer.send(new Messages.PartyLeave(ctx.id).serialize());
        if (remainingMembers.length > 1) {
          memberPlayer.send(new Messages.PartyUpdate(memberData).serialize());
        } else {
          memberPlayer.send(new Messages.PartyDisband().serialize());
        }
      }
    }
  }
}

/**
 * Update party position (for shared XP proximity checks)
 */
export function updatePartyPosition(ctx: PartyPlayerContext): void {
  const partyService = PartyService.getInstance();
  partyService.updateMemberPosition(ctx.id, Math.floor(ctx.x / 16), Math.floor(ctx.y / 16));
}

/**
 * Update party HP (for party UI)
 */
export function updatePartyHp(ctx: PartyPlayerContext): void {
  const partyService = PartyService.getInstance();
  const world = ctx.getWorld();
  const party = partyService.updateMemberHp(ctx.id, ctx.hitPoints, ctx.maxHitPoints);

  if (party) {
    const memberData = party.getMemberData();
    for (const memberId of party.getMemberIds()) {
      const memberPlayer = world.getEntityById(memberId);
      if (memberPlayer && memberId !== ctx.id) {
        memberPlayer.send(new Messages.PartyUpdate(memberData).serialize());
      }
    }
  }
}
