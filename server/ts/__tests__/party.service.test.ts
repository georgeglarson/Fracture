/**
 * Tests for PartyService
 * Covers: singleton, invite flow, accept/decline, leave, kick, HP/position
 * updates, disconnect handling, XP bonus, range queries
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// We need to work around the singleton + setInterval in the constructor.
// Reset the singleton instance before each test so tests are isolated.
// We also fake timers to prevent real setInterval from running.

let PartyService: typeof import('../party/party.service').PartyService;
let Party: typeof import('../party/party').Party;

beforeEach(async () => {
  vi.useFakeTimers();
  // Clear the module cache so each test gets a fresh singleton
  vi.resetModules();
  const svcMod = await import('../party/party.service');
  const partyMod = await import('../party/party');
  PartyService = svcMod.PartyService;
  Party = partyMod.Party;
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPlayerRef(
  id: number,
  name: string,
  overrides: Record<string, any> = {},
) {
  return {
    id,
    name,
    level: 10,
    hitPoints: 100,
    maxHitPoints: 100,
    gridX: 0,
    gridY: 0,
    send: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PartyService', () => {
  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const a = PartyService.getInstance();
      const b = PartyService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('getParty / getPlayerParty / isInParty', () => {
    it('should return undefined for unknown party ID', () => {
      const svc = PartyService.getInstance();
      expect(svc.getParty('nonexistent')).toBeUndefined();
    });

    it('should return undefined when player is not in any party', () => {
      const svc = PartyService.getInstance();
      expect(svc.getPlayerParty(999)).toBeUndefined();
    });

    it('should report false for isInParty when player has no party', () => {
      const svc = PartyService.getInstance();
      expect(svc.isInParty(42)).toBe(false);
    });
  });

  // =========================================================================
  // sendInvite
  // =========================================================================
  describe('sendInvite', () => {
    it('should create a pending invite and notify the target', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const target = createPlayerRef(2, 'Target');

      const result = svc.sendInvite(inviter, 2, target);

      expect(result).toBeNull(); // null means success
      expect(target.send).toHaveBeenCalledWith([55, 1, 'Inviter']);
    });

    it('should reject invite from non-leader party member', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const member = createPlayerRef(2, 'Member');
      const target = createPlayerRef(3, 'Target');
      const joiner = createPlayerRef(2, 'Member');

      // Create a party: leader invites member, member accepts
      svc.sendInvite(leader, 2, member);
      svc.acceptInvite(joiner, 1, leader);

      // Now member (non-leader) tries to invite target
      const result = svc.sendInvite(member, 3, target);
      expect(result).toBe('Only the party leader can invite players.');
    });

    it('should reject invite when party is full', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');

      // Build a full party (5 members)
      for (let i = 2; i <= 5; i++) {
        const p = createPlayerRef(i, `P${i}`);
        svc.sendInvite(leader, i, p);
        svc.acceptInvite(p, 1, leader);
      }

      const target = createPlayerRef(6, 'Target');
      const result = svc.sendInvite(leader, 6, target);
      expect(result).toBe('Party is full.');
    });

    it('should reject invite when target is already in a party', () => {
      const svc = PartyService.getInstance();
      const leader1 = createPlayerRef(1, 'Leader1');
      const target = createPlayerRef(2, 'Target');

      // Target joins leader1 party
      svc.sendInvite(leader1, 2, target);
      svc.acceptInvite(target, 1, leader1);

      // Another leader tries to invite target
      const leader2 = createPlayerRef(3, 'Leader2');
      const result = svc.sendInvite(leader2, 2, target);
      expect(result).toBe('That player is already in a party.');
    });

    it('should reject duplicate invite to same target', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const target = createPlayerRef(2, 'Target');

      svc.sendInvite(inviter, 2, target);
      const result = svc.sendInvite(inviter, 2, target);
      expect(result).toBe('You already sent an invite to this player.');
    });

    it('should allow inviting a different player after first invite', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const target1 = createPlayerRef(2, 'Target1');
      const target2 = createPlayerRef(3, 'Target2');

      svc.sendInvite(inviter, 2, target1);
      const result = svc.sendInvite(inviter, 3, target2);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // acceptInvite
  // =========================================================================
  describe('acceptInvite', () => {
    it('should create a party when inviter has no party yet', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const accepter = createPlayerRef(2, 'Accepter');

      svc.sendInvite(inviter, 2, accepter);
      const result = svc.acceptInvite(accepter, 1, inviter);

      expect(result).toBeInstanceOf(Party);
      const party = result as Party;
      expect(party.hasMember(1)).toBe(true);
      expect(party.hasMember(2)).toBe(true);
      expect(party.size).toBe(2);
      expect(party.leaderId).toBe(1);
    });

    it('should add to existing party when inviter already has one', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');
      const p3 = createPlayerRef(3, 'P3');

      // Create party with leader + p2
      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);

      // Now invite p3
      svc.sendInvite(leader, 3, p3);
      const result = svc.acceptInvite(p3, 1, leader);

      expect(result).toBeInstanceOf(Party);
      const party = result as Party;
      expect(party.size).toBe(3);
      expect(party.hasMember(3)).toBe(true);
    });

    it('should return error when no pending invite exists', () => {
      const svc = PartyService.getInstance();
      const accepter = createPlayerRef(2, 'Accepter');

      const result = svc.acceptInvite(accepter, 1, undefined);
      expect(result).toBe('No pending invite from that player.');
    });

    it('should return error when invite has expired', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const accepter = createPlayerRef(2, 'Accepter');

      svc.sendInvite(inviter, 2, accepter);

      // Advance past 30-second expiry
      vi.advanceTimersByTime(31000);

      const result = svc.acceptInvite(accepter, 1, inviter);
      expect(result).toBe('Invite has expired.');
    });

    it('should return error when accepter is already in a party', () => {
      const svc = PartyService.getInstance();
      const leader1 = createPlayerRef(1, 'Leader1');
      const leader2 = createPlayerRef(3, 'Leader2');
      const player = createPlayerRef(2, 'Player');

      // Leader2 invites player first (while player is not yet in a party)
      svc.sendInvite(leader2, 2, player);

      // Player joins leader1's party in the meantime
      svc.sendInvite(leader1, 2, player);
      svc.acceptInvite(player, 1, leader1);

      // Now player tries to accept leader2's invite, but is already in a party
      const result = svc.acceptInvite(player, 3, leader2);
      expect(result).toBe('You are already in a party.');
    });

    it('should return error when inviter is unavailable and has no party', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const accepter = createPlayerRef(2, 'Accepter');

      svc.sendInvite(inviter, 2, accepter);

      // Accept with inviterPlayer = undefined and inviter not in a party
      const result = svc.acceptInvite(accepter, 1, undefined);
      expect(result).toBe('Inviter is no longer available.');
    });

    it('should return error when party is full at accept time', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');

      // Build a party with 4 members (leader + 3)
      for (let i = 2; i <= 4; i++) {
        const p = createPlayerRef(i, `P${i}`);
        svc.sendInvite(leader, i, p);
        svc.acceptInvite(p, 1, leader);
      }

      // Invite two more players simultaneously
      const p5 = createPlayerRef(5, 'P5');
      const p6 = createPlayerRef(6, 'P6');
      svc.sendInvite(leader, 5, p5);
      svc.sendInvite(leader, 6, p6);

      // p5 accepts - fills the party to 5
      const result5 = svc.acceptInvite(p5, 1, leader);
      expect(result5).toBeInstanceOf(Party);

      // p6 accepts - party is now full
      const result6 = svc.acceptInvite(p6, 1, leader);
      expect(result6).toBe('Party is full.');
    });

    it('should track party membership after accept', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const accepter = createPlayerRef(2, 'Accepter');

      svc.sendInvite(inviter, 2, accepter);
      svc.acceptInvite(accepter, 1, inviter);

      expect(svc.isInParty(1)).toBe(true);
      expect(svc.isInParty(2)).toBe(true);

      const party1 = svc.getPlayerParty(1);
      const party2 = svc.getPlayerParty(2);
      expect(party1).toBeDefined();
      expect(party1).toBe(party2);
    });

    it('should update member positions from player refs', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter', { gridX: 10, gridY: 20 });
      const accepter = createPlayerRef(2, 'Accepter', { gridX: 30, gridY: 40 });

      svc.sendInvite(inviter, 2, accepter);
      const party = svc.acceptInvite(accepter, 1, inviter) as Party;

      const members = party.getMemberData();
      const inviterData = members.find(m => m.id === 1);
      const accepterData = members.find(m => m.id === 2);

      expect(inviterData!.gridX).toBe(10);
      expect(inviterData!.gridY).toBe(20);
      expect(accepterData!.gridX).toBe(30);
      expect(accepterData!.gridY).toBe(40);
    });

    it('should remove invite after acceptance', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const accepter = createPlayerRef(2, 'Accepter');

      svc.sendInvite(inviter, 2, accepter);
      svc.acceptInvite(accepter, 1, inviter);

      // Trying to accept again should fail since invite was consumed
      // Need new accepter since the player is now in party
      const accepter3 = createPlayerRef(3, 'Accepter3');
      const result = svc.acceptInvite(accepter3, 1, inviter);
      expect(result).toBe('No pending invite from that player.');
    });
  });

  // =========================================================================
  // declineInvite
  // =========================================================================
  describe('declineInvite', () => {
    it('should remove the pending invite', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const target = createPlayerRef(2, 'Target');

      svc.sendInvite(inviter, 2, target);
      svc.declineInvite(2, 1);

      // Attempting to accept should fail
      const result = svc.acceptInvite(target, 1, inviter);
      expect(result).toBe('No pending invite from that player.');
    });

    it('should not throw when declining a non-existent invite', () => {
      const svc = PartyService.getInstance();
      expect(() => svc.declineInvite(2, 999)).not.toThrow();
    });
  });

  // =========================================================================
  // leaveParty
  // =========================================================================
  describe('leaveParty', () => {
    it('should return null when player is not in a party', () => {
      const svc = PartyService.getInstance();
      const result = svc.leaveParty(999);
      expect(result).toBeNull();
    });

    it('should disband party when only two members and one leaves', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const member = createPlayerRef(2, 'Member');

      svc.sendInvite(leader, 2, member);
      svc.acceptInvite(member, 1, leader);

      const result = svc.leaveParty(2);

      expect(result).not.toBeNull();
      expect(result!.disbanded).toBe(true);
      expect(result!.newLeaderId).toBeNull();

      // Both players should no longer be in a party
      expect(svc.isInParty(1)).toBe(false);
      expect(svc.isInParty(2)).toBe(false);
    });

    it('should transfer leadership when leader leaves a 3-member party', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');
      const p3 = createPlayerRef(3, 'P3');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);
      svc.sendInvite(leader, 3, p3);
      svc.acceptInvite(p3, 1, leader);

      const result = svc.leaveParty(1);

      expect(result).not.toBeNull();
      expect(result!.disbanded).toBe(false);
      expect(result!.newLeaderId).not.toBeNull();

      // Leader removed from tracking
      expect(svc.isInParty(1)).toBe(false);
      // Remaining members still in party
      expect(svc.isInParty(2)).toBe(true);
      expect(svc.isInParty(3)).toBe(true);
    });

    it('should not report leadership change when non-leader leaves', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');
      const p3 = createPlayerRef(3, 'P3');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);
      svc.sendInvite(leader, 3, p3);
      svc.acceptInvite(p3, 1, leader);

      const result = svc.leaveParty(2);

      expect(result).not.toBeNull();
      expect(result!.disbanded).toBe(false);
      expect(result!.newLeaderId).toBeNull(); // no leadership change
    });

    it('should remove party from tracking when disbanded', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const member = createPlayerRef(2, 'Member');

      svc.sendInvite(leader, 2, member);
      const party = svc.acceptInvite(member, 1, leader) as Party;

      svc.leaveParty(2);

      // Party should be deleted
      expect(svc.getParty(party.id)).toBeUndefined();
    });
  });

  // =========================================================================
  // kickMember
  // =========================================================================
  describe('kickMember', () => {
    it('should return null when leader is not in a party', () => {
      const svc = PartyService.getInstance();
      const result = svc.kickMember(1, 2);
      expect(result).toBeNull();
    });

    it('should fail when non-leader tries to kick', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');
      const p3 = createPlayerRef(3, 'P3');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);
      svc.sendInvite(leader, 3, p3);
      svc.acceptInvite(p3, 1, leader);

      const result = svc.kickMember(2, 3);
      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.message).toBe('Only the leader can kick members.');
    });

    it('should fail when leader tries to kick themselves', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);

      const result = svc.kickMember(1, 1);
      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.message).toBe('You cannot kick yourself.');
    });

    it('should fail when target is not in the party', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);

      const result = svc.kickMember(1, 999);
      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.message).toBe('Player is not in your party.');
    });

    it('should successfully kick a valid member', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');
      const p3 = createPlayerRef(3, 'P3');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);
      svc.sendInvite(leader, 3, p3);
      svc.acceptInvite(p3, 1, leader);

      const result = svc.kickMember(1, 2);

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.party.hasMember(2)).toBe(false);
      expect(svc.isInParty(2)).toBe(false);
    });

    it('should keep remaining members intact after kick', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');
      const p3 = createPlayerRef(3, 'P3');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);
      svc.sendInvite(leader, 3, p3);
      svc.acceptInvite(p3, 1, leader);

      svc.kickMember(1, 2);

      expect(svc.isInParty(1)).toBe(true);
      expect(svc.isInParty(3)).toBe(true);
      const party = svc.getPlayerParty(1);
      expect(party!.size).toBe(2);
    });
  });

  // =========================================================================
  // updateMemberHp
  // =========================================================================
  describe('updateMemberHp', () => {
    it('should update HP for a player in a party', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);

      const party = svc.updateMemberHp(1, 50, 100);

      expect(party).toBeDefined();
      const members = party!.getMemberData();
      const leaderData = members.find(m => m.id === 1);
      expect(leaderData!.hp).toBe(50);
      expect(leaderData!.maxHp).toBe(100);
    });

    it('should return undefined when player is not in a party', () => {
      const svc = PartyService.getInstance();
      const result = svc.updateMemberHp(999, 50, 100);
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // updateMemberPosition
  // =========================================================================
  describe('updateMemberPosition', () => {
    it('should update position for a player in a party', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);

      svc.updateMemberPosition(1, 42, 84);

      const party = svc.getPlayerParty(1);
      const members = party!.getMemberData();
      const leaderData = members.find(m => m.id === 1);
      expect(leaderData!.gridX).toBe(42);
      expect(leaderData!.gridY).toBe(84);
    });

    it('should not throw when player is not in a party', () => {
      const svc = PartyService.getInstance();
      expect(() => svc.updateMemberPosition(999, 10, 20)).not.toThrow();
    });
  });

  // =========================================================================
  // handlePlayerDisconnect
  // =========================================================================
  describe('handlePlayerDisconnect', () => {
    it('should return undefined when player is not in a party', () => {
      const svc = PartyService.getInstance();
      const result = svc.handlePlayerDisconnect(999);
      expect(result).toBeUndefined();
    });

    it('should remove player from party and return the party', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');
      const p3 = createPlayerRef(3, 'P3');

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);
      svc.sendInvite(leader, 3, p3);
      svc.acceptInvite(p3, 1, leader);

      const result = svc.handlePlayerDisconnect(3);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Party);
      expect(svc.isInParty(3)).toBe(false);
    });

    it('should clear pending invites involving disconnected player as inviter', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const target = createPlayerRef(2, 'Target');
      const p3 = createPlayerRef(3, 'P3');

      // Inviter creates party with p3
      svc.sendInvite(inviter, 3, p3);
      svc.acceptInvite(p3, 1, inviter);

      // Inviter sends invite to target
      svc.sendInvite(inviter, 2, target);

      // Inviter disconnects
      svc.handlePlayerDisconnect(1);

      // Target should not be able to accept the invite
      const result = svc.acceptInvite(target, 1, undefined);
      expect(result).toBe('No pending invite from that player.');
    });

    it('should clear pending invites involving disconnected player as target', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const target = createPlayerRef(2, 'Target');

      // Create invite (target not yet in a party for invite to succeed)
      svc.sendInvite(inviter, 2, target);

      // We need target in a party for handlePlayerDisconnect to do something
      // Let's create a scenario: target joins a party first, then disconnects
      const leader2 = createPlayerRef(3, 'Leader2');
      svc.sendInvite(leader2, 2, target);
      svc.acceptInvite(target, 3, leader2);

      // Target disconnects
      svc.handlePlayerDisconnect(2);

      // The original invite from inviter(1) to target(2) should be cleared
      const freshTarget = createPlayerRef(2, 'Target');
      const result = svc.acceptInvite(freshTarget, 1, inviter);
      expect(result).toBe('No pending invite from that player.');
    });

    it('should disband party when disconnect leaves only one member', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const member = createPlayerRef(2, 'Member');

      svc.sendInvite(leader, 2, member);
      const party = svc.acceptInvite(member, 1, leader) as Party;

      svc.handlePlayerDisconnect(2);

      // Party should be disbanded
      expect(svc.getParty(party.id)).toBeUndefined();
      expect(svc.isInParty(1)).toBe(false);
    });
  });

  // =========================================================================
  // getMembersInRange
  // =========================================================================
  describe('getMembersInRange', () => {
    it('should return only the player when not in a party', () => {
      const svc = PartyService.getInstance();
      const result = svc.getMembersInRange(42, 10, 20);
      expect(result).toEqual([42]);
    });

    it('should delegate to party.getMembersInRange when in a party', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader', { gridX: 50, gridY: 50 });
      const p2 = createPlayerRef(2, 'P2', { gridX: 55, gridY: 50 });

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);

      // Update positions explicitly
      svc.updateMemberPosition(1, 50, 50);
      svc.updateMemberPosition(2, 55, 50);

      const inRange = svc.getMembersInRange(1, 50, 50, 10);
      expect(inRange).toContain(1);
      expect(inRange).toContain(2);
    });

    it('should respect the range parameter', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader', { gridX: 0, gridY: 0 });
      const p2 = createPlayerRef(2, 'P2', { gridX: 100, gridY: 100 });

      svc.sendInvite(leader, 2, p2);
      svc.acceptInvite(p2, 1, leader);

      svc.updateMemberPosition(1, 0, 0);
      svc.updateMemberPosition(2, 100, 100);

      const inRange = svc.getMembersInRange(1, 0, 0, 5);
      expect(inRange).toContain(1);
      expect(inRange).not.toContain(2);
    });
  });

  // =========================================================================
  // calculatePartyXpBonus
  // =========================================================================
  describe('calculatePartyXpBonus', () => {
    it('should return 1.0 for solo player (memberCount = 1)', () => {
      const svc = PartyService.getInstance();
      expect(svc.calculatePartyXpBonus(1)).toBe(1.0);
    });

    it('should return 1.0 for memberCount = 0', () => {
      const svc = PartyService.getInstance();
      expect(svc.calculatePartyXpBonus(0)).toBe(1.0);
    });

    it('should return 1.1 for 2 members', () => {
      const svc = PartyService.getInstance();
      expect(svc.calculatePartyXpBonus(2)).toBe(1.1);
    });

    it('should return 1.2 for 3 members', () => {
      const svc = PartyService.getInstance();
      expect(svc.calculatePartyXpBonus(3)).toBe(1.2);
    });

    it('should return 1.3 for 4 members', () => {
      const svc = PartyService.getInstance();
      expect(svc.calculatePartyXpBonus(4)).toBe(1.3);
    });

    it('should return 1.4 for 5 members', () => {
      const svc = PartyService.getInstance();
      expect(svc.calculatePartyXpBonus(5)).toBe(1.4);
    });

    it('should cap at 1.5 for 6 members', () => {
      const svc = PartyService.getInstance();
      expect(svc.calculatePartyXpBonus(6)).toBe(1.5);
    });

    it('should cap at 1.5 for large member counts', () => {
      const svc = PartyService.getInstance();
      expect(svc.calculatePartyXpBonus(20)).toBe(1.5);
    });
  });

  // =========================================================================
  // cleanupExpiredInvites (via timer)
  // =========================================================================
  describe('expired invite cleanup', () => {
    it('should remove expired invites when cleanup timer fires', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const target = createPlayerRef(2, 'Target');

      svc.sendInvite(inviter, 2, target);

      // Advance past expiry (30s) plus a full cleanup interval (10s)
      // At 40s the cleanup fires and removes the expired invite entirely.
      // Then a new sendInvite to a different target to verify the old invite key
      // was cleaned up.  But the simplest check: after 40s, the cleanup timer
      // (which fires every 10s) will have seen now > expiresAt and deleted the entry.
      // acceptInvite will then say "No pending invite" rather than "Invite has expired".
      vi.advanceTimersByTime(40000);

      const result = svc.acceptInvite(target, 1, inviter);
      expect(result).toBe('No pending invite from that player.');
    });

    it('should not remove invites that have not expired yet', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const target = createPlayerRef(2, 'Target');

      svc.sendInvite(inviter, 2, target);

      // Advance 10s (cleanup fires but invite hasn't expired yet at 30s)
      vi.advanceTimersByTime(10000);

      // Invite should still be valid
      const result = svc.acceptInvite(target, 1, inviter);
      // Verify it's a Party object (has party properties)
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect((result as any).leaderId).toBe(1);
      expect((result as any).hasMember(2)).toBe(true);
    });
  });

  // =========================================================================
  // Edge cases / integration
  // =========================================================================
  describe('integration scenarios', () => {
    it('should allow re-inviting after decline', () => {
      const svc = PartyService.getInstance();
      const inviter = createPlayerRef(1, 'Inviter');
      const target = createPlayerRef(2, 'Target');

      svc.sendInvite(inviter, 2, target);
      svc.declineInvite(2, 1);

      // Should be able to re-invite
      const result = svc.sendInvite(inviter, 2, target);
      expect(result).toBeNull();
    });

    it('should allow player to join new party after leaving old one', () => {
      const svc = PartyService.getInstance();
      const leader1 = createPlayerRef(1, 'Leader1');
      const leader2 = createPlayerRef(3, 'Leader2');
      const player = createPlayerRef(2, 'Player');

      // Player joins leader1
      svc.sendInvite(leader1, 2, player);
      svc.acceptInvite(player, 1, leader1);
      expect(svc.isInParty(2)).toBe(true);

      // Player leaves
      svc.leaveParty(2);
      expect(svc.isInParty(2)).toBe(false);

      // Player joins leader2
      svc.sendInvite(leader2, 2, player);
      const result = svc.acceptInvite(player, 3, leader2);
      expect(result).toBeInstanceOf(Party);
      expect(svc.isInParty(2)).toBe(true);
    });

    it('should handle party getParty returning the correct party by ID', () => {
      const svc = PartyService.getInstance();
      const leader = createPlayerRef(1, 'Leader');
      const p2 = createPlayerRef(2, 'P2');

      svc.sendInvite(leader, 2, p2);
      const party = svc.acceptInvite(p2, 1, leader) as Party;

      const fetched = svc.getParty(party.id);
      expect(fetched).toBe(party);
    });

    it('should handle multiple parties independently', () => {
      const svc = PartyService.getInstance();
      const leader1 = createPlayerRef(1, 'Leader1');
      const p2 = createPlayerRef(2, 'P2');
      const leader3 = createPlayerRef(3, 'Leader3');
      const p4 = createPlayerRef(4, 'P4');

      // Party 1
      svc.sendInvite(leader1, 2, p2);
      const party1 = svc.acceptInvite(p2, 1, leader1) as Party;

      // Party 2
      svc.sendInvite(leader3, 4, p4);
      const party2 = svc.acceptInvite(p4, 3, leader3) as Party;

      expect(party1.id).not.toBe(party2.id);
      expect(svc.getPlayerParty(1)).toBe(party1);
      expect(svc.getPlayerParty(3)).toBe(party2);

      // Kicking from party1 should not affect party2
      svc.kickMember(1, 2);
      expect(svc.isInParty(2)).toBe(false);
      expect(svc.isInParty(4)).toBe(true);
    });
  });

  // =========================================================================
  // Party.removeMember edge case: removing non-member
  // =========================================================================
  describe('Party edge cases', () => {
    it('should return leaderId when removing a non-member', () => {
      const party = new Party(1, 'Leader', 10, 100, 100);
      party.addMember(2, 'P2', 5, 80, 80);

      const result = party.removeMember(999);
      expect(result).toBe(1); // returns leaderId
      expect(party.size).toBe(2); // unchanged
    });

    it('should not update HP for non-member', () => {
      const party = new Party(1, 'Leader', 10, 100, 100);
      party.updateMemberHp(999, 50, 100);
      // No crash, member data unchanged
      const members = party.getMemberData();
      expect(members[0].hp).toBe(100);
    });

    it('should not update position for non-member', () => {
      const party = new Party(1, 'Leader', 10, 100, 100);
      party.updateMemberPosition(999, 50, 50);
      // No crash, member data unchanged
      const members = party.getMemberData();
      expect(members[0].gridX).toBe(0);
    });
  });
});
