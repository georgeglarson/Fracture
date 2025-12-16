/**
 * Party data model - represents a group of players
 */

export interface PartyMember {
  id: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  gridX: number;
  gridY: number;
}

export class Party {
  id: string;
  leaderId: number;
  members: Map<number, PartyMember>;
  maxSize: number = 5;
  createdAt: number;

  constructor(leaderId: number, leaderName: string, leaderLevel: number, leaderHp: number, leaderMaxHp: number) {
    this.id = `party_${Date.now()}_${leaderId}`;
    this.leaderId = leaderId;
    this.members = new Map();
    this.createdAt = Date.now();

    // Add leader as first member
    this.members.set(leaderId, {
      id: leaderId,
      name: leaderName,
      level: leaderLevel,
      hp: leaderHp,
      maxHp: leaderMaxHp,
      gridX: 0,
      gridY: 0
    });
  }

  /**
   * Check if party is full
   */
  isFull(): boolean {
    return this.members.size >= this.maxSize;
  }

  /**
   * Check if player is in this party
   */
  hasMember(playerId: number): boolean {
    return this.members.has(playerId);
  }

  /**
   * Check if player is the party leader
   */
  isLeader(playerId: number): boolean {
    return this.leaderId === playerId;
  }

  /**
   * Add a new member to the party
   */
  addMember(id: number, name: string, level: number, hp: number, maxHp: number): boolean {
    if (this.isFull() || this.hasMember(id)) {
      return false;
    }

    this.members.set(id, {
      id,
      name,
      level,
      hp,
      maxHp,
      gridX: 0,
      gridY: 0
    });
    return true;
  }

  /**
   * Remove a member from the party
   * Returns the new leader ID if leadership transferred, null if party empty
   */
  removeMember(playerId: number): number | null {
    if (!this.hasMember(playerId)) {
      return this.leaderId;
    }

    this.members.delete(playerId);

    // If party is now empty
    if (this.members.size === 0) {
      return null;
    }

    // If leader left, transfer to oldest member (first in map)
    if (playerId === this.leaderId) {
      const firstMember = this.members.keys().next().value;
      if (firstMember !== undefined) {
        this.leaderId = firstMember;
      }
      return this.leaderId;
    }

    return this.leaderId;
  }

  /**
   * Transfer leadership to another member
   */
  transferLeadership(newLeaderId: number): boolean {
    if (!this.hasMember(newLeaderId)) {
      return false;
    }
    this.leaderId = newLeaderId;
    return true;
  }

  /**
   * Update member's HP for party UI
   */
  updateMemberHp(playerId: number, hp: number, maxHp: number): void {
    const member = this.members.get(playerId);
    if (member) {
      member.hp = hp;
      member.maxHp = maxHp;
    }
  }

  /**
   * Update member's position for proximity checks
   */
  updateMemberPosition(playerId: number, gridX: number, gridY: number): void {
    const member = this.members.get(playerId);
    if (member) {
      member.gridX = gridX;
      member.gridY = gridY;
    }
  }

  /**
   * Get all member IDs
   */
  getMemberIds(): number[] {
    return Array.from(this.members.keys());
  }

  /**
   * Get member data array for network serialization
   */
  getMemberData(): PartyMember[] {
    return Array.from(this.members.values());
  }

  /**
   * Get members within range of a position (for shared XP)
   * @param gridX Center X position
   * @param gridY Center Y position
   * @param range Tile range (default 15)
   */
  getMembersInRange(gridX: number, gridY: number, range: number = 15): number[] {
    const inRange: number[] = [];
    for (const [id, member] of this.members) {
      const dx = Math.abs(member.gridX - gridX);
      const dy = Math.abs(member.gridY - gridY);
      if (dx <= range && dy <= range) {
        inRange.push(id);
      }
    }
    return inRange;
  }

  /**
   * Get party size
   */
  get size(): number {
    return this.members.size;
  }
}
