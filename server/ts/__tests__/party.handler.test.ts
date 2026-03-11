/**
 * Tests for PartyHandler
 * Covers: invite, accept, decline, leave, kick, chat, inspect,
 *         cleanup, updatePosition, updateHp
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the singleton factory so every test controls its own mock instance.
// vi.mock is hoisted; the factory closure references `mockPartyService` which
// is set in beforeEach before each test runs.
// ---------------------------------------------------------------------------
let mockPartyService: Record<string, any>;

vi.mock('../party/index.js', () => ({
  PartyService: {
    getInstance: () => mockPartyService,
  },
}));

let mockIsPlayer: ReturnType<typeof vi.fn>;

vi.mock('../utils.js', () => ({
  isPlayer: (...args: any[]) => mockIsPlayer(...args),
}));

vi.mock('../message.js', () => ({
  Messages: {
    PartyJoin: class {
      constructor(public partyId: string, public members: any[], public leaderId: number) {}
      serialize() { return [58, this.partyId, this.members, this.leaderId]; }
    },
    PartyLeave: class {
      constructor(public playerId: number) {}
      serialize() { return [59, this.playerId]; }
    },
    PartyDisband: class {
      serialize() { return [61]; }
    },
    PartyUpdate: class {
      constructor(public members: any[]) {}
      serialize() { return [62, this.members]; }
    },
    PartyChat: class {
      constructor(public senderId: number, public senderName: string, public message: string) {}
      serialize() { return [63, this.senderId, this.senderName, this.message]; }
    },
    PlayerInspectResult: class {
      constructor(
        public playerId: number,
        public name: string,
        public title: string | null,
        public level: number,
        public weapon: number,
        public armor: number,
      ) {}
      serialize() { return [65, this.playerId, this.name, this.title, this.level, this.weapon, this.armor]; }
    },
  },
}));

// Import the handler functions *after* the mocks are declared
import {
  PartyPlayerContext,
  handlePartyInvite,
  handlePartyAccept,
  handlePartyDecline,
  handlePartyLeave,
  handlePartyKick,
  handlePartyChat,
  handlePlayerInspect,
  cleanupParty,
  updatePartyPosition,
  updatePartyHp,
} from '../player/party.handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockCtx(overrides: Partial<PartyPlayerContext> = {}): PartyPlayerContext {
  const entityMap = new Map<number, any>();
  return {
    id: 1,
    name: 'TestPlayer',
    level: 10,
    hitPoints: 100,
    maxHitPoints: 100,
    x: 160,
    y: 320,
    send: vi.fn(),
    getWorld: () => ({
      getEntityById: (id: number) => entityMap.get(id),
    }),
    _entityMap: entityMap,
    ...overrides,
  } as PartyPlayerContext & { _entityMap: Map<number, any> };
}

function addEntityToCtx(ctx: any, entity: any): void {
  ctx._entityMap.set(entity.id, entity);
}

function createMockPlayer(id: number, name: string, overrides: Record<string, any> = {}): any {
  return {
    id,
    name,
    type: 'player',
    isAI: false,
    level: 5,
    hitPoints: 80,
    maxHitPoints: 80,
    x: 64,
    y: 128,
    title: null,
    weapon: 10,
    armor: 20,
    send: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PartyHandler', () => {
  let ctx: PartyPlayerContext & { _entityMap: Map<number, any> };

  beforeEach(() => {
    ctx = createMockCtx() as PartyPlayerContext & { _entityMap: Map<number, any> };
    mockIsPlayer = vi.fn(() => true);

    // Default mock party service - all methods return sensible defaults.
    // Individual tests override as needed.
    mockPartyService = {
      sendInvite: vi.fn(() => null),
      acceptInvite: vi.fn(() => 'No pending invite from that player.'),
      declineInvite: vi.fn(),
      leaveParty: vi.fn(() => null),
      kickMember: vi.fn(() => null),
      getPlayerParty: vi.fn(() => undefined),
      updateMemberPosition: vi.fn(),
      updateMemberHp: vi.fn(() => undefined),
      handlePlayerDisconnect: vi.fn(() => undefined),
    };
  });

  // =========================================================================
  // handlePartyInvite
  // =========================================================================
  describe('handlePartyInvite', () => {
    it('should call sendInvite with member refs when target is a valid player', () => {
      const target = createMockPlayer(2, 'TargetPlayer');
      addEntityToCtx(ctx, target);

      handlePartyInvite(ctx, 2);

      expect(mockPartyService.sendInvite).toHaveBeenCalledTimes(1);
      const [inviterRef, targetId, targetRef] = mockPartyService.sendInvite.mock.calls[0];
      expect(inviterRef.id).toBe(1);
      expect(inviterRef.name).toBe('TestPlayer');
      expect(targetId).toBe(2);
      expect(targetRef.id).toBe(2);
      expect(targetRef.name).toBe('TargetPlayer');
    });

    it('should pass tile coordinates as gridX/gridY', () => {
      const target = createMockPlayer(2, 'Target', { x: 33, y: 47 });
      addEntityToCtx(ctx, target);

      handlePartyInvite(ctx, 2);

      const [inviterRef, , targetRef] = mockPartyService.sendInvite.mock.calls[0];
      // ctx.x=160, ctx.y=320 -> gridX=160, gridY=320
      expect(inviterRef.gridX).toBe(160);
      expect(inviterRef.gridY).toBe(320);
      // target.x=33, target.y=47 -> gridX=33, gridY=47
      expect(targetRef.gridX).toBe(33);
      expect(targetRef.gridY).toBe(47);
    });

    it('should not call sendInvite when target entity does not exist', () => {
      handlePartyInvite(ctx, 999);

      expect(mockPartyService.sendInvite).not.toHaveBeenCalled();
    });

    it('should not call sendInvite when target is not a human player (isPlayer false)', () => {
      const aiPlayer = createMockPlayer(2, 'AIBot', { isAI: true });
      addEntityToCtx(ctx, aiPlayer);
      mockIsPlayer.mockReturnValue(false);

      handlePartyInvite(ctx, 2);

      expect(mockPartyService.sendInvite).not.toHaveBeenCalled();
    });

    it('should log when sendInvite returns an error string', () => {
      const target = createMockPlayer(2, 'Target');
      addEntityToCtx(ctx, target);
      mockPartyService.sendInvite.mockReturnValue('Party is full.');

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      handlePartyInvite(ctx, 2);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Party is full.'));
      spy.mockRestore();
    });

    it('should not log when sendInvite succeeds (returns null)', () => {
      const target = createMockPlayer(2, 'Target');
      addEntityToCtx(ctx, target);
      mockPartyService.sendInvite.mockReturnValue(null);

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      handlePartyInvite(ctx, 2);

      // Only the [Party] log line for invalid targets would be logged; not the error path
      const failCalls = spy.mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('Invite failed'),
      );
      expect(failCalls.length).toBe(0);
      spy.mockRestore();
    });
  });

  // =========================================================================
  // handlePartyAccept
  // =========================================================================
  describe('handlePartyAccept', () => {
    it('should send PartyJoin to every member when accept succeeds', () => {
      const member2Send = vi.fn();
      const member3Send = vi.fn();

      const inviter = createMockPlayer(2, 'Inviter');
      addEntityToCtx(ctx, inviter);

      const member2 = { id: 2, send: member2Send };
      const member3 = { id: 3, send: member3Send };
      ctx._entityMap.set(2, member2);
      ctx._entityMap.set(3, member3);

      const mockMembers = [
        { id: 1, name: 'TestPlayer', level: 10, hp: 100, maxHp: 100 },
        { id: 2, name: 'Inviter', level: 5, hp: 80, maxHp: 80 },
        { id: 3, name: 'Third', level: 7, hp: 90, maxHp: 90 },
      ];
      const mockParty = {
        id: 'party_123',
        leaderId: 2,
        getMemberData: vi.fn(() => mockMembers),
        getMemberIds: vi.fn(() => [1, 2, 3]),
      };
      mockPartyService.acceptInvite.mockReturnValue(mockParty);

      // Add ctx itself (id=1) to entity map so it also receives the message
      ctx._entityMap.set(1, { id: 1, send: ctx.send });

      handlePartyAccept(ctx, 2);

      // Each member should receive a PartyJoin message
      expect(ctx.send).toHaveBeenCalledWith([58, 'party_123', mockMembers, 2]);
      expect(member2Send).toHaveBeenCalledWith([58, 'party_123', mockMembers, 2]);
      expect(member3Send).toHaveBeenCalledWith([58, 'party_123', mockMembers, 2]);
    });

    it('should pass inviterRef as undefined when inviter entity is missing', () => {
      // Inviter with id=2 is NOT in the entity map
      mockPartyService.acceptInvite.mockReturnValue('Inviter is no longer available.');

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      handlePartyAccept(ctx, 2);

      const [accepterRef, inviterId, inviterRef] = mockPartyService.acceptInvite.mock.calls[0];
      expect(accepterRef.id).toBe(1);
      expect(inviterId).toBe(2);
      expect(inviterRef).toBeUndefined();
      spy.mockRestore();
    });

    it('should pass inviterRef when inviter entity exists', () => {
      const inviter = createMockPlayer(2, 'Inviter');
      addEntityToCtx(ctx, inviter);
      mockPartyService.acceptInvite.mockReturnValue('Some error.');

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      handlePartyAccept(ctx, 2);

      const [, , inviterRef] = mockPartyService.acceptInvite.mock.calls[0];
      expect(inviterRef).toBeDefined();
      expect(inviterRef.id).toBe(2);
      spy.mockRestore();
    });

    it('should log and return when acceptInvite returns an error string', () => {
      mockPartyService.acceptInvite.mockReturnValue('No pending invite from that player.');

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      handlePartyAccept(ctx, 2);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No pending invite'));
      spy.mockRestore();
    });

    it('should not send any messages when acceptInvite returns an error', () => {
      mockPartyService.acceptInvite.mockReturnValue('Invite has expired.');

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      handlePartyAccept(ctx, 2);

      expect(ctx.send).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should skip members whose entity is not found in world', () => {
      const mockParty = {
        id: 'party_456',
        leaderId: 2,
        getMemberData: vi.fn(() => []),
        getMemberIds: vi.fn(() => [1, 999]),
      };
      mockPartyService.acceptInvite.mockReturnValue(mockParty);

      ctx._entityMap.set(1, { id: 1, send: ctx.send });
      // 999 is NOT in entity map

      handlePartyAccept(ctx, 2);

      // Only member 1 receives the message; no crash for member 999
      expect(ctx.send).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // handlePartyDecline
  // =========================================================================
  describe('handlePartyDecline', () => {
    it('should call declineInvite with correct player and inviter IDs', () => {
      handlePartyDecline(ctx, 5);

      expect(mockPartyService.declineInvite).toHaveBeenCalledWith(1, 5);
    });

    it('should use the context player id, not hardcoded values', () => {
      const ctx2 = createMockCtx({ id: 42, name: 'AnotherPlayer' });
      handlePartyDecline(ctx2, 7);

      expect(mockPartyService.declineInvite).toHaveBeenCalledWith(42, 7);
    });
  });

  // =========================================================================
  // handlePartyLeave
  // =========================================================================
  describe('handlePartyLeave', () => {
    it('should do nothing when leaveParty returns null (not in a party)', () => {
      mockPartyService.leaveParty.mockReturnValue(null);

      handlePartyLeave(ctx);

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should send PartyDisband to remaining members when party is disbanded', () => {
      const member2Send = vi.fn();
      const member3Send = vi.fn();
      ctx._entityMap.set(2, { id: 2, send: member2Send });
      ctx._entityMap.set(3, { id: 3, send: member3Send });

      mockPartyService.leaveParty.mockReturnValue({
        party: {
          getMemberIds: () => [2, 3],
          getMemberData: () => [],
        },
        newLeaderId: null,
        disbanded: true,
      });

      handlePartyLeave(ctx);

      expect(member2Send).toHaveBeenCalledWith([61]);
      expect(member3Send).toHaveBeenCalledWith([61]);
    });

    it('should send PartyLeave to remaining members when not disbanded', () => {
      const member2Send = vi.fn();
      ctx._entityMap.set(2, { id: 2, send: member2Send });

      const memberData = [{ id: 2, name: 'Player2', level: 5, hp: 80, maxHp: 80 }];
      mockPartyService.leaveParty.mockReturnValue({
        party: {
          getMemberIds: () => [2],
          getMemberData: () => memberData,
        },
        newLeaderId: null,
        disbanded: false,
      });

      handlePartyLeave(ctx);

      // PartyLeave with the leaving player's id
      expect(member2Send).toHaveBeenCalledWith([59, 1]);
    });

    it('should also send PartyUpdate when there is a new leader', () => {
      const member2Send = vi.fn();
      const member3Send = vi.fn();
      ctx._entityMap.set(2, { id: 2, send: member2Send });
      ctx._entityMap.set(3, { id: 3, send: member3Send });

      const memberData = [
        { id: 2, name: 'Player2', level: 5, hp: 80, maxHp: 80 },
        { id: 3, name: 'Player3', level: 7, hp: 90, maxHp: 90 },
      ];
      mockPartyService.leaveParty.mockReturnValue({
        party: {
          getMemberIds: () => [2, 3],
          getMemberData: () => memberData,
        },
        newLeaderId: 2,
        disbanded: false,
      });

      handlePartyLeave(ctx);

      // Both members get PartyLeave and PartyUpdate
      expect(member2Send).toHaveBeenCalledWith([59, 1]);
      expect(member2Send).toHaveBeenCalledWith([62, memberData]);
      expect(member3Send).toHaveBeenCalledWith([59, 1]);
      expect(member3Send).toHaveBeenCalledWith([62, memberData]);
    });

    it('should not send PartyUpdate when no leadership change', () => {
      const member2Send = vi.fn();
      ctx._entityMap.set(2, { id: 2, send: member2Send });

      mockPartyService.leaveParty.mockReturnValue({
        party: {
          getMemberIds: () => [2],
          getMemberData: () => [],
        },
        newLeaderId: null,
        disbanded: false,
      });

      handlePartyLeave(ctx);

      // PartyLeave yes, PartyUpdate no
      expect(member2Send).toHaveBeenCalledWith([59, 1]);
      const updateCalls = member2Send.mock.calls.filter(
        (c: any[]) => Array.isArray(c[0]) && c[0][0] === 62,
      );
      expect(updateCalls.length).toBe(0);
    });

    it('should skip members not found in world', () => {
      mockPartyService.leaveParty.mockReturnValue({
        party: {
          getMemberIds: () => [999],
          getMemberData: () => [],
        },
        newLeaderId: null,
        disbanded: true,
      });

      // Should not throw
      expect(() => handlePartyLeave(ctx)).not.toThrow();
    });
  });

  // =========================================================================
  // handlePartyKick
  // =========================================================================
  describe('handlePartyKick', () => {
    it('should log and return when kickMember returns null', () => {
      mockPartyService.kickMember.mockReturnValue(null);

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      handlePartyKick(ctx, 2);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Kick failed'));
      spy.mockRestore();
    });

    it('should log and return when kick is not successful', () => {
      mockPartyService.kickMember.mockReturnValue({
        success: false,
        message: 'Only the leader can kick members.',
        party: {},
      });

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      handlePartyKick(ctx, 2);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Only the leader can kick'));
      spy.mockRestore();
    });

    it('should send PartyDisband to the kicked player', () => {
      const kickedSend = vi.fn();
      ctx._entityMap.set(2, { id: 2, send: kickedSend });

      const memberData = [{ id: 1, name: 'TestPlayer', level: 10, hp: 100, maxHp: 100 }];
      mockPartyService.kickMember.mockReturnValue({
        success: true,
        party: {
          getMemberIds: () => [1],
          getMemberData: () => memberData,
        },
      });
      ctx._entityMap.set(1, { id: 1, send: ctx.send });

      handlePartyKick(ctx, 2);

      expect(kickedSend).toHaveBeenCalledWith([61]);
    });

    it('should send PartyLeave and PartyUpdate to remaining members', () => {
      const kickedSend = vi.fn();
      const member3Send = vi.fn();
      ctx._entityMap.set(2, { id: 2, send: kickedSend });
      ctx._entityMap.set(3, { id: 3, send: member3Send });
      ctx._entityMap.set(1, { id: 1, send: ctx.send });

      const memberData = [
        { id: 1, name: 'TestPlayer', level: 10, hp: 100, maxHp: 100 },
        { id: 3, name: 'Player3', level: 7, hp: 90, maxHp: 90 },
      ];
      mockPartyService.kickMember.mockReturnValue({
        success: true,
        party: {
          getMemberIds: () => [1, 3],
          getMemberData: () => memberData,
        },
      });

      handlePartyKick(ctx, 2);

      // Remaining members get PartyLeave (with kicked id) and PartyUpdate
      expect(ctx.send).toHaveBeenCalledWith([59, 2]);
      expect(ctx.send).toHaveBeenCalledWith([62, memberData]);
      expect(member3Send).toHaveBeenCalledWith([59, 2]);
      expect(member3Send).toHaveBeenCalledWith([62, memberData]);
    });

    it('should not crash when kicked player entity is not in world', () => {
      // Kicked player id=2 is NOT in entity map
      mockPartyService.kickMember.mockReturnValue({
        success: true,
        party: {
          getMemberIds: () => [1],
          getMemberData: () => [],
        },
      });
      ctx._entityMap.set(1, { id: 1, send: ctx.send });

      expect(() => handlePartyKick(ctx, 2)).not.toThrow();
    });

    it('should call kickMember with ctx.id as leader and target id', () => {
      mockPartyService.kickMember.mockReturnValue(null);

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      handlePartyKick(ctx, 5);

      expect(mockPartyService.kickMember).toHaveBeenCalledWith(1, 5);
      spy.mockRestore();
    });
  });

  // =========================================================================
  // handlePartyChat
  // =========================================================================
  describe('handlePartyChat', () => {
    it('should do nothing when player is not in a party', () => {
      mockPartyService.getPlayerParty.mockReturnValue(undefined);

      handlePartyChat(ctx, 'Hello everyone!');

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should send PartyChat to all party members', () => {
      const member2Send = vi.fn();
      const member3Send = vi.fn();
      ctx._entityMap.set(1, { id: 1, send: ctx.send });
      ctx._entityMap.set(2, { id: 2, send: member2Send });
      ctx._entityMap.set(3, { id: 3, send: member3Send });

      mockPartyService.getPlayerParty.mockReturnValue({
        getMemberIds: () => [1, 2, 3],
      });

      handlePartyChat(ctx, 'Let us go!');

      expect(ctx.send).toHaveBeenCalledWith([63, 1, 'TestPlayer', 'Let us go!']);
      expect(member2Send).toHaveBeenCalledWith([63, 1, 'TestPlayer', 'Let us go!']);
      expect(member3Send).toHaveBeenCalledWith([63, 1, 'TestPlayer', 'Let us go!']);
    });

    it('should skip members not found in world', () => {
      ctx._entityMap.set(1, { id: 1, send: ctx.send });
      // Member 999 is NOT in entity map

      mockPartyService.getPlayerParty.mockReturnValue({
        getMemberIds: () => [1, 999],
      });

      handlePartyChat(ctx, 'Anyone there?');

      expect(ctx.send).toHaveBeenCalledTimes(1);
    });

    it('should use the sender name and id from context', () => {
      const ctx2 = createMockCtx({ id: 42, name: 'CustomName' }) as any;
      ctx2._entityMap.set(42, { id: 42, send: ctx2.send });

      mockPartyService.getPlayerParty.mockReturnValue({
        getMemberIds: () => [42],
      });

      handlePartyChat(ctx2, 'Hi');

      expect(ctx2.send).toHaveBeenCalledWith([63, 42, 'CustomName', 'Hi']);
    });
  });

  // =========================================================================
  // handlePlayerInspect
  // =========================================================================
  describe('handlePlayerInspect', () => {
    it('should send PlayerInspectResult with target details', () => {
      const target = createMockPlayer(2, 'InspectTarget', {
        title: 'Champion',
        level: 15,
        weapon: 30,
        armor: 40,
      });
      addEntityToCtx(ctx, target);

      handlePlayerInspect(ctx, 2);

      expect(ctx.send).toHaveBeenCalledWith([65, 2, 'InspectTarget', 'Champion', 15, 30, 40]);
    });

    it('should not send anything when target does not exist', () => {
      handlePlayerInspect(ctx, 999);

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should not send anything when target is not a human player', () => {
      const aiMob = createMockPlayer(2, 'AIBot', { isAI: true });
      addEntityToCtx(ctx, aiMob);
      mockIsPlayer.mockReturnValue(false);

      handlePlayerInspect(ctx, 2);

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should log when target is invalid', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      handlePlayerInspect(ctx, 999);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('tried to inspect invalid player'));
      spy.mockRestore();
    });

    it('should send null title when target has no title', () => {
      const target = createMockPlayer(2, 'NoTitle', { title: null });
      addEntityToCtx(ctx, target);

      handlePlayerInspect(ctx, 2);

      const sentData = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(sentData[3]).toBeNull();
    });
  });

  // =========================================================================
  // cleanupParty
  // =========================================================================
  describe('cleanupParty', () => {
    it('should do nothing when handlePlayerDisconnect returns undefined', () => {
      mockPartyService.handlePlayerDisconnect.mockReturnValue(undefined);

      cleanupParty(ctx);

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should do nothing when remaining members list is empty', () => {
      mockPartyService.handlePlayerDisconnect.mockReturnValue({
        getMemberIds: () => [],
        getMemberData: () => [],
      });

      cleanupParty(ctx);

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should send PartyLeave and PartyUpdate when multiple members remain', () => {
      const member2Send = vi.fn();
      const member3Send = vi.fn();
      ctx._entityMap.set(2, { id: 2, send: member2Send });
      ctx._entityMap.set(3, { id: 3, send: member3Send });

      const memberData = [
        { id: 2, name: 'Player2', level: 5, hp: 80, maxHp: 80 },
        { id: 3, name: 'Player3', level: 7, hp: 90, maxHp: 90 },
      ];
      mockPartyService.handlePlayerDisconnect.mockReturnValue({
        getMemberIds: () => [2, 3],
        getMemberData: () => memberData,
      });

      cleanupParty(ctx);

      expect(member2Send).toHaveBeenCalledWith([59, 1]);
      expect(member2Send).toHaveBeenCalledWith([62, memberData]);
      expect(member3Send).toHaveBeenCalledWith([59, 1]);
      expect(member3Send).toHaveBeenCalledWith([62, memberData]);
    });

    it('should send PartyLeave and PartyDisband when only one member remains', () => {
      const member2Send = vi.fn();
      ctx._entityMap.set(2, { id: 2, send: member2Send });

      mockPartyService.handlePlayerDisconnect.mockReturnValue({
        getMemberIds: () => [2],
        getMemberData: () => [{ id: 2, name: 'Player2', level: 5, hp: 80, maxHp: 80 }],
      });

      cleanupParty(ctx);

      expect(member2Send).toHaveBeenCalledWith([59, 1]);
      expect(member2Send).toHaveBeenCalledWith([61]);
    });

    it('should skip members not found in world', () => {
      // Member 999 not in entity map
      mockPartyService.handlePlayerDisconnect.mockReturnValue({
        getMemberIds: () => [999],
        getMemberData: () => [],
      });

      expect(() => cleanupParty(ctx)).not.toThrow();
    });

    it('should call handlePlayerDisconnect with the context player id', () => {
      mockPartyService.handlePlayerDisconnect.mockReturnValue(undefined);

      cleanupParty(ctx);

      expect(mockPartyService.handlePlayerDisconnect).toHaveBeenCalledWith(1);
    });
  });

  // =========================================================================
  // updatePartyPosition
  // =========================================================================
  describe('updatePartyPosition', () => {
    it('should call updateMemberPosition with tile coordinates', () => {
      const ctx2 = createMockCtx({ x: 170, y: 255 });

      updatePartyPosition(ctx2);

      expect(mockPartyService.updateMemberPosition).toHaveBeenCalledWith(1, 170, 255);
    });

    it('should use ctx.id for the player id', () => {
      const ctx2 = createMockCtx({ id: 42, x: 0, y: 0 });

      updatePartyPosition(ctx2);

      expect(mockPartyService.updateMemberPosition).toHaveBeenCalledWith(42, 0, 0);
    });

    it('should handle exact tile boundaries', () => {
      const ctx2 = createMockCtx({ x: 160, y: 320 });

      updatePartyPosition(ctx2);

      expect(mockPartyService.updateMemberPosition).toHaveBeenCalledWith(1, 160, 320);
    });
  });

  // =========================================================================
  // updatePartyHp
  // =========================================================================
  describe('updatePartyHp', () => {
    it('should call updateMemberHp with current hit points', () => {
      const ctx2 = createMockCtx({ id: 3, hitPoints: 75, maxHitPoints: 120 });

      updatePartyHp(ctx2);

      expect(mockPartyService.updateMemberHp).toHaveBeenCalledWith(3, 75, 120);
    });

    it('should do nothing when updateMemberHp returns undefined (not in party)', () => {
      mockPartyService.updateMemberHp.mockReturnValue(undefined);

      updatePartyHp(ctx);

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should send PartyUpdate to other party members but not the sender', () => {
      const member2Send = vi.fn();
      const member3Send = vi.fn();
      ctx._entityMap.set(1, { id: 1, send: ctx.send });
      ctx._entityMap.set(2, { id: 2, send: member2Send });
      ctx._entityMap.set(3, { id: 3, send: member3Send });

      const memberData = [
        { id: 1, name: 'TestPlayer', level: 10, hp: 100, maxHp: 100 },
        { id: 2, name: 'Player2', level: 5, hp: 80, maxHp: 80 },
        { id: 3, name: 'Player3', level: 7, hp: 90, maxHp: 90 },
      ];
      mockPartyService.updateMemberHp.mockReturnValue({
        getMemberData: () => memberData,
        getMemberIds: () => [1, 2, 3],
      });

      updatePartyHp(ctx);

      // ctx (id=1) should NOT receive the update
      expect(ctx.send).not.toHaveBeenCalled();
      // Other members should receive the update
      expect(member2Send).toHaveBeenCalledWith([62, memberData]);
      expect(member3Send).toHaveBeenCalledWith([62, memberData]);
    });

    it('should skip members not found in world', () => {
      ctx._entityMap.set(1, { id: 1, send: ctx.send });
      // Member 999 not in entity map

      mockPartyService.updateMemberHp.mockReturnValue({
        getMemberData: () => [],
        getMemberIds: () => [1, 999],
      });

      expect(() => updatePartyHp(ctx)).not.toThrow();
      // ctx is skipped because memberId === ctx.id
      expect(ctx.send).not.toHaveBeenCalled();
    });
  });
});
