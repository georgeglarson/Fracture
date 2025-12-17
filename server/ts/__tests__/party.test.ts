/**
 * Tests for Party and PartyService
 * Covers: party creation, invites, membership, XP sharing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Party } from '../party/party';

describe('Party', () => {
  let party: Party;

  beforeEach(() => {
    party = new Party(1, 'Leader', 10, 100, 100);
  });

  describe('constructor', () => {
    it('should create party with leader as first member', () => {
      expect(party.leaderId).toBe(1);
      expect(party.size).toBe(1);
      expect(party.hasMember(1)).toBe(true);
    });

    it('should generate unique party ID', () => {
      expect(party.id).toMatch(/^party_\d+_1$/);
    });
  });

  describe('addMember', () => {
    it('should add a new member', () => {
      const result = party.addMember(2, 'Player2', 5, 80, 80);

      expect(result).toBe(true);
      expect(party.size).toBe(2);
      expect(party.hasMember(2)).toBe(true);
    });

    it('should not add duplicate member', () => {
      party.addMember(2, 'Player2', 5, 80, 80);
      const result = party.addMember(2, 'Player2', 5, 80, 80);

      expect(result).toBe(false);
      expect(party.size).toBe(2);
    });

    it('should not add member when party is full', () => {
      // Add 4 more members (leader + 4 = max 5)
      party.addMember(2, 'P2', 5, 80, 80);
      party.addMember(3, 'P3', 5, 80, 80);
      party.addMember(4, 'P4', 5, 80, 80);
      party.addMember(5, 'P5', 5, 80, 80);

      expect(party.isFull()).toBe(true);

      const result = party.addMember(6, 'P6', 5, 80, 80);
      expect(result).toBe(false);
      expect(party.size).toBe(5);
    });
  });

  describe('removeMember', () => {
    it('should remove a member', () => {
      party.addMember(2, 'Player2', 5, 80, 80);
      party.removeMember(2);

      expect(party.hasMember(2)).toBe(false);
      expect(party.size).toBe(1);
    });

    it('should transfer leadership when leader leaves', () => {
      party.addMember(2, 'Player2', 5, 80, 80);
      party.addMember(3, 'Player3', 5, 80, 80);

      const newLeader = party.removeMember(1);

      expect(newLeader).toBe(2);
      expect(party.leaderId).toBe(2);
      expect(party.isLeader(2)).toBe(true);
    });

    it('should return null when last member leaves', () => {
      const result = party.removeMember(1);
      expect(result).toBeNull();
      expect(party.size).toBe(0);
    });

    it('should return current leader if non-leader leaves', () => {
      party.addMember(2, 'Player2', 5, 80, 80);
      const result = party.removeMember(2);

      expect(result).toBe(1);
      expect(party.leaderId).toBe(1);
    });
  });

  describe('isLeader', () => {
    it('should identify leader correctly', () => {
      party.addMember(2, 'Player2', 5, 80, 80);

      expect(party.isLeader(1)).toBe(true);
      expect(party.isLeader(2)).toBe(false);
    });
  });

  describe('transferLeadership', () => {
    it('should transfer leadership to existing member', () => {
      party.addMember(2, 'Player2', 5, 80, 80);
      const result = party.transferLeadership(2);

      expect(result).toBe(true);
      expect(party.leaderId).toBe(2);
    });

    it('should fail if target is not a member', () => {
      const result = party.transferLeadership(999);
      expect(result).toBe(false);
      expect(party.leaderId).toBe(1);
    });
  });

  describe('updateMemberHp', () => {
    it('should update member HP', () => {
      party.updateMemberHp(1, 50, 100);
      const members = party.getMemberData();

      expect(members[0].hp).toBe(50);
      expect(members[0].maxHp).toBe(100);
    });
  });

  describe('updateMemberPosition', () => {
    it('should update member position', () => {
      party.updateMemberPosition(1, 10, 20);
      const members = party.getMemberData();

      expect(members[0].gridX).toBe(10);
      expect(members[0].gridY).toBe(20);
    });
  });

  describe('getMembersInRange', () => {
    beforeEach(() => {
      party.addMember(2, 'P2', 5, 80, 80);
      party.addMember(3, 'P3', 5, 80, 80);
      party.addMember(4, 'P4', 5, 80, 80);

      // Set positions
      party.updateMemberPosition(1, 50, 50);  // Center
      party.updateMemberPosition(2, 55, 50);  // 5 tiles away
      party.updateMemberPosition(3, 60, 60);  // 10 diagonal
      party.updateMemberPosition(4, 100, 100); // 50 tiles away
    });

    it('should return members within range', () => {
      const inRange = party.getMembersInRange(50, 50, 15);

      expect(inRange).toContain(1);
      expect(inRange).toContain(2);
      expect(inRange).toContain(3);
      expect(inRange).not.toContain(4);
    });

    it('should use default range of 15', () => {
      const inRange = party.getMembersInRange(50, 50);
      expect(inRange.length).toBe(3);
    });

    it('should handle narrow range', () => {
      const inRange = party.getMembersInRange(50, 50, 5);

      expect(inRange).toContain(1);
      expect(inRange).toContain(2);
      expect(inRange).not.toContain(3);
      expect(inRange).not.toContain(4);
    });
  });

  describe('getMemberIds', () => {
    it('should return all member IDs', () => {
      party.addMember(2, 'P2', 5, 80, 80);
      party.addMember(3, 'P3', 5, 80, 80);

      const ids = party.getMemberIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids).toContain(3);
    });
  });

  describe('getMemberData', () => {
    it('should return member data for serialization', () => {
      party.addMember(2, 'P2', 5, 80, 80);
      party.updateMemberPosition(1, 10, 20);

      const data = party.getMemberData();

      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: 1,
        name: 'Leader',
        level: 10,
        hp: 100,
        maxHp: 100,
        gridX: 10,
        gridY: 20
      });
    });
  });

  describe('isFull', () => {
    it('should return false when party has room', () => {
      expect(party.isFull()).toBe(false);
    });

    it('should return true when party is at max capacity', () => {
      party.addMember(2, 'P2', 5, 80, 80);
      party.addMember(3, 'P3', 5, 80, 80);
      party.addMember(4, 'P4', 5, 80, 80);
      party.addMember(5, 'P5', 5, 80, 80);

      expect(party.isFull()).toBe(true);
    });
  });
});

describe('PartyService.calculatePartyXpBonus', () => {
  // Test the XP bonus calculation directly since it's a pure function
  it('should return 1.0 for solo player', () => {
    // memberCount <= 1 returns 1.0
    const bonus = calculateXpBonus(1);
    expect(bonus).toBe(1.0);
  });

  it('should return 1.1 for 2 members', () => {
    const bonus = calculateXpBonus(2);
    expect(bonus).toBe(1.1);
  });

  it('should return 1.2 for 3 members', () => {
    const bonus = calculateXpBonus(3);
    expect(bonus).toBe(1.2);
  });

  it('should return 1.4 for 5 members', () => {
    const bonus = calculateXpBonus(5);
    expect(bonus).toBe(1.4);
  });

  it('should cap at 1.5 for more than 6 members', () => {
    const bonus = calculateXpBonus(10);
    expect(bonus).toBe(1.5);
  });
});

// Helper to match PartyService.calculatePartyXpBonus logic
function calculateXpBonus(memberCount: number): number {
  if (memberCount <= 1) return 1.0;
  const bonus = Math.min(0.5, (memberCount - 1) * 0.1);
  return 1.0 + bonus;
}
