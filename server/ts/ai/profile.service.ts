/**
 * Profile Service - Player progress and stats tracking
 * Single Responsibility: Manage player profiles and progress data
 */

import { PlayerProfile } from './types';

export class ProfileService {
  private playerProfiles: Map<string, PlayerProfile> = new Map();

  /**
   * Get or create a player profile
   */
  getProfile(playerId: string): PlayerProfile {
    if (!this.playerProfiles.has(playerId)) {
      this.playerProfiles.set(playerId, {
        kills: {},
        totalKills: 0,
        level: 1,
        areas: [],
        items: [],
        deaths: 0,
        lastActive: Date.now(),
        questsCompleted: 0
      });
    }
    return this.playerProfiles.get(playerId)!;
  }

  /**
   * Record a mob kill for a player
   * @returns true if this was a milestone kill (10, 25, 50, 100, etc.)
   */
  recordKill(playerId: string, mobType: string): { isMilestone: boolean; count: number } {
    const profile = this.getProfile(playerId);
    profile.kills[mobType] = (profile.kills[mobType] || 0) + 1;
    profile.totalKills++;
    profile.lastActive = Date.now();

    // Check for milestones
    const milestones = [10, 25, 50, 100, 250, 500, 1000];
    const isMilestone = milestones.includes(profile.totalKills);

    return { isMilestone, count: profile.totalKills };
  }

  /**
   * Record a new area explored
   * @returns true if this was a new area
   */
  recordArea(playerId: string, area: string): boolean {
    const profile = this.getProfile(playerId);
    if (!profile.areas.includes(area)) {
      profile.areas.push(area);
      profile.lastActive = Date.now();
      return true;
    }
    profile.lastActive = Date.now();
    return false;
  }

  /**
   * Record an item pickup
   */
  recordItem(playerId: string, itemType: string): void {
    const profile = this.getProfile(playerId);
    profile.items.push(itemType);
    profile.lastActive = Date.now();
  }

  /**
   * Record a player death
   */
  recordDeath(playerId: string): number {
    const profile = this.getProfile(playerId);
    profile.deaths++;
    return profile.deaths;
  }

  /**
   * Increment quests completed counter
   */
  incrementQuestsCompleted(playerId: string): number {
    const profile = this.getProfile(playerId);
    profile.questsCompleted++;
    return profile.questsCompleted;
  }

  /**
   * Check if player has killed a specific mob type
   */
  hasKilled(playerId: string, mobType: string): boolean {
    const profile = this.getProfile(playerId);
    return (profile.kills[mobType] || 0) > 0;
  }

  /**
   * Get kill count for a specific mob type
   */
  getKillCount(playerId: string, mobType: string): number {
    const profile = this.getProfile(playerId);
    return profile.kills[mobType] || 0;
  }

  /**
   * Check if player has explored an area
   */
  hasExplored(playerId: string, area: string): boolean {
    const profile = this.getProfile(playerId);
    return profile.areas.includes(area);
  }

  /**
   * Cleanup player data on disconnect
   */
  cleanup(playerId: string): void {
    this.playerProfiles.delete(playerId);
  }

  /**
   * Get all profiles (for admin/debug)
   */
  getAllProfiles(): Map<string, PlayerProfile> {
    return this.playerProfiles;
  }
}
