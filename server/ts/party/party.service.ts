/**
 * PartyService - Manages party operations server-side
 * Singleton pattern for global access
 */

import { Party, PartyMember } from './party';

interface PendingInvite {
  inviterId: number;
  inviterName: string;
  targetId: number;
  expiresAt: number;
}

interface PlayerRef {
  id: number;
  name: string;
  level: number;
  hitPoints: number;
  maxHitPoints: number;
  gridX: number;
  gridY: number;
  send: (message: any[]) => void;
}

export class PartyService {
  private static instance: PartyService;

  private parties: Map<string, Party> = new Map();
  private playerToParty: Map<number, string> = new Map();
  private pendingInvites: Map<string, PendingInvite> = new Map();

  private readonly INVITE_EXPIRY_MS = 30000; // 30 seconds

  private constructor() {
    // Cleanup expired invites every 10 seconds
    setInterval(() => this.cleanupExpiredInvites(), 10000);
  }

  static getInstance(): PartyService {
    if (!PartyService.instance) {
      PartyService.instance = new PartyService();
    }
    return PartyService.instance;
  }

  /**
   * Get party by ID
   */
  getParty(partyId: string): Party | undefined {
    return this.parties.get(partyId);
  }

  /**
   * Get party for a player
   */
  getPlayerParty(playerId: number): Party | undefined {
    const partyId = this.playerToParty.get(playerId);
    if (partyId) {
      return this.parties.get(partyId);
    }
    return undefined;
  }

  /**
   * Check if player is in a party
   */
  isInParty(playerId: number): boolean {
    return this.playerToParty.has(playerId);
  }

  /**
   * Send party invite
   * @returns Error message or null on success
   */
  sendInvite(inviter: PlayerRef, targetId: number, targetPlayer: PlayerRef): string | null {
    // Check if inviter is already in a party and is the leader
    const existingParty = this.getPlayerParty(inviter.id);
    if (existingParty && !existingParty.isLeader(inviter.id)) {
      return 'Only the party leader can invite players.';
    }

    // Check if inviter's party is full
    if (existingParty && existingParty.isFull()) {
      return 'Party is full.';
    }

    // Check if target is already in a party
    if (this.isInParty(targetId)) {
      return 'That player is already in a party.';
    }

    // Check for existing invite from this inviter to this target
    const inviteKey = `${inviter.id}_${targetId}`;
    if (this.pendingInvites.has(inviteKey)) {
      return 'You already sent an invite to this player.';
    }

    // Create pending invite
    this.pendingInvites.set(inviteKey, {
      inviterId: inviter.id,
      inviterName: inviter.name,
      targetId: targetId,
      expiresAt: Date.now() + this.INVITE_EXPIRY_MS
    });

    // Send invite notification to target
    targetPlayer.send([55, inviter.id, inviter.name]); // PARTY_INVITE_RECEIVED

    console.log(`[PartyService] ${inviter.name} invited player ${targetId} to party`);
    return null;
  }

  /**
   * Accept a party invite
   * @returns Party or error message
   */
  acceptInvite(accepter: PlayerRef, inviterId: number, inviterPlayer: PlayerRef | undefined): Party | string {
    const inviteKey = `${inviterId}_${accepter.id}`;
    const invite = this.pendingInvites.get(inviteKey);

    if (!invite) {
      return 'No pending invite from that player.';
    }

    if (Date.now() > invite.expiresAt) {
      this.pendingInvites.delete(inviteKey);
      return 'Invite has expired.';
    }

    // Remove the invite
    this.pendingInvites.delete(inviteKey);

    // Check if accepter is already in a party
    if (this.isInParty(accepter.id)) {
      return 'You are already in a party.';
    }

    // Get or create party
    let party = this.getPlayerParty(inviterId);

    if (!party) {
      // Inviter not in a party yet, create new one
      if (!inviterPlayer) {
        return 'Inviter is no longer available.';
      }
      party = new Party(
        inviterId,
        inviterPlayer.name,
        inviterPlayer.level,
        inviterPlayer.hitPoints,
        inviterPlayer.maxHitPoints
      );
      party.updateMemberPosition(inviterId, inviterPlayer.gridX, inviterPlayer.gridY);
      this.parties.set(party.id, party);
      this.playerToParty.set(inviterId, party.id);
    }

    // Check if party is full
    if (party.isFull()) {
      return 'Party is full.';
    }

    // Add accepter to party
    party.addMember(accepter.id, accepter.name, accepter.level, accepter.hitPoints, accepter.maxHitPoints);
    party.updateMemberPosition(accepter.id, accepter.gridX, accepter.gridY);
    this.playerToParty.set(accepter.id, party.id);

    console.log(`[PartyService] ${accepter.name} joined party ${party.id}`);
    return party;
  }

  /**
   * Decline a party invite
   */
  declineInvite(declinerId: number, inviterId: number): void {
    const inviteKey = `${inviterId}_${declinerId}`;
    this.pendingInvites.delete(inviteKey);
    console.log(`[PartyService] Player ${declinerId} declined invite from ${inviterId}`);
  }

  /**
   * Leave current party
   * @returns New leader ID if leadership transferred, null if party disbanded
   */
  leaveParty(playerId: number): { party: Party; newLeaderId: number | null; disbanded: boolean } | null {
    const party = this.getPlayerParty(playerId);
    if (!party) {
      return null;
    }

    const wasLeader = party.isLeader(playerId);
    const newLeaderId = party.removeMember(playerId);
    this.playerToParty.delete(playerId);

    // Check if party should be disbanded
    if (party.size <= 1) {
      // Remove last member from tracking
      const lastMemberId = party.getMemberIds()[0];
      if (lastMemberId) {
        this.playerToParty.delete(lastMemberId);
      }
      this.parties.delete(party.id);
      console.log(`[PartyService] Party ${party.id} disbanded`);
      return { party, newLeaderId: null, disbanded: true };
    }

    console.log(`[PartyService] Player ${playerId} left party ${party.id}, new leader: ${newLeaderId}`);
    return { party, newLeaderId: wasLeader ? newLeaderId : null, disbanded: false };
  }

  /**
   * Kick a player from the party (leader only)
   */
  kickMember(leaderId: number, targetId: number): { party: Party; success: boolean; message?: string } | null {
    const party = this.getPlayerParty(leaderId);
    if (!party) {
      return null;
    }

    if (!party.isLeader(leaderId)) {
      return { party, success: false, message: 'Only the leader can kick members.' };
    }

    if (leaderId === targetId) {
      return { party, success: false, message: 'You cannot kick yourself.' };
    }

    if (!party.hasMember(targetId)) {
      return { party, success: false, message: 'Player is not in your party.' };
    }

    party.removeMember(targetId);
    this.playerToParty.delete(targetId);

    console.log(`[PartyService] Player ${targetId} was kicked from party ${party.id}`);
    return { party, success: true };
  }

  /**
   * Update member HP (call when player takes damage or heals)
   */
  updateMemberHp(playerId: number, hp: number, maxHp: number): Party | undefined {
    const party = this.getPlayerParty(playerId);
    if (party) {
      party.updateMemberHp(playerId, hp, maxHp);
      return party;
    }
    return undefined;
  }

  /**
   * Update member position (call when player moves)
   */
  updateMemberPosition(playerId: number, gridX: number, gridY: number): void {
    const party = this.getPlayerParty(playerId);
    if (party) {
      party.updateMemberPosition(playerId, gridX, gridY);
    }
  }

  /**
   * Handle player disconnect - remove from party
   */
  handlePlayerDisconnect(playerId: number): Party | undefined {
    const result = this.leaveParty(playerId);
    if (result) {
      // Also clear any pending invites involving this player
      for (const [key, invite] of this.pendingInvites) {
        if (invite.inviterId === playerId || invite.targetId === playerId) {
          this.pendingInvites.delete(key);
        }
      }
      return result.party;
    }
    return undefined;
  }

  /**
   * Get members in range for shared XP calculation
   */
  getMembersInRange(playerId: number, gridX: number, gridY: number, range: number = 15): number[] {
    const party = this.getPlayerParty(playerId);
    if (!party) {
      return [playerId];
    }
    return party.getMembersInRange(gridX, gridY, range);
  }

  /**
   * Calculate XP bonus for party kills
   * Base: +10% per additional party member (max +50% at 5 members)
   */
  calculatePartyXpBonus(memberCount: number): number {
    if (memberCount <= 1) return 1.0;
    const bonus = Math.min(0.5, (memberCount - 1) * 0.1);
    return 1.0 + bonus;
  }

  /**
   * Cleanup expired invites
   */
  private cleanupExpiredInvites(): void {
    const now = Date.now();
    for (const [key, invite] of this.pendingInvites) {
      if (now > invite.expiresAt) {
        this.pendingInvites.delete(key);
      }
    }
  }
}
