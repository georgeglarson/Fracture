/**
 * PartyUI - Handles party panel, invite popups, and party member displays
 * Single Responsibility: Manage party-related UI elements
 */

export interface PartyMember {
  id: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
}

export interface PartyCallbacks {
  onAcceptInvite: (inviterId: number) => void;
  onDeclineInvite: (inviterId: number) => void;
  onLeaveParty: () => void;
  onKickMember: (memberId: number) => void;
  onSendChat: (message: string) => void;
}

export class PartyUI {
  private partyId: string | null = null;
  private members: PartyMember[] = [];
  private leaderId: number | null = null;
  private myPlayerId: number | null = null;
  private callbacks: PartyCallbacks | null = null;
  private pendingInvites: Map<number, string> = new Map(); // inviterId -> inviterName

  constructor() {}

  /**
   * Set the local player ID
   */
  setPlayerId(playerId: number): void {
    this.myPlayerId = playerId;
  }

  /**
   * Set callback handlers
   */
  setCallbacks(callbacks: PartyCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Show party invite popup
   */
  showInvite(inviterId: number, inviterName: string): void {
    this.pendingInvites.set(inviterId, inviterName);
    this.renderInvitePopup(inviterId, inviterName);
  }

  /**
   * Render the invite popup
   */
  private renderInvitePopup(inviterId: number, inviterName: string): void {
    // Remove any existing popup for this inviter
    const existingPopup = document.getElementById(`party-invite-${inviterId}`);
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.id = `party-invite-${inviterId}`;
    popup.className = 'party-invite-popup';
    popup.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      width: 250px;
      padding: 15px;
      background: linear-gradient(to bottom, rgba(40, 60, 40, 0.95), rgba(30, 50, 30, 0.95));
      border: 2px solid #4a7c4a;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
      z-index: 9000;
      font-family: Arial, sans-serif;
      color: #fff;
    `;

    popup.innerHTML = `
      <div style="margin-bottom: 10px; font-size: 14px; text-align: center;">
        <strong>${inviterName}</strong> invites you to join their party!
      </div>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="accept-invite-${inviterId}" style="
          padding: 8px 16px;
          background: #4a7c4a;
          color: #fff;
          border: 1px solid #6a9c6a;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        ">Accept</button>
        <button id="decline-invite-${inviterId}" style="
          padding: 8px 16px;
          background: #7c4a4a;
          color: #fff;
          border: 1px solid #9c6a6a;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        ">Decline</button>
      </div>
    `;

    document.body.appendChild(popup);

    // Add button handlers
    const acceptBtn = document.getElementById(`accept-invite-${inviterId}`);
    const declineBtn = document.getElementById(`decline-invite-${inviterId}`);

    if (acceptBtn) {
      acceptBtn.onclick = () => {
        this.hideInvite(inviterId);
        if (this.callbacks) {
          this.callbacks.onAcceptInvite(inviterId);
        }
      };
    }

    if (declineBtn) {
      declineBtn.onclick = () => {
        this.hideInvite(inviterId);
        if (this.callbacks) {
          this.callbacks.onDeclineInvite(inviterId);
        }
      };
    }

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      this.hideInvite(inviterId);
    }, 30000);
  }

  /**
   * Hide invite popup
   */
  hideInvite(inviterId: number): void {
    this.pendingInvites.delete(inviterId);
    const popup = document.getElementById(`party-invite-${inviterId}`);
    if (popup) {
      popup.remove();
    }
  }

  /**
   * Join a party
   */
  joinParty(partyId: string, members: PartyMember[], leaderId: number): void {
    this.partyId = partyId;
    this.members = members;
    this.leaderId = leaderId;
    this.renderPartyPanel();
  }

  /**
   * Update party members
   */
  updateMembers(members: PartyMember[]): void {
    this.members = members;
    this.renderPartyPanel();
  }

  /**
   * Member left party
   */
  memberLeft(playerId: number): void {
    this.members = this.members.filter(m => m.id !== playerId);
    this.renderPartyPanel();
  }

  /**
   * Leave/disband party
   */
  leaveParty(): void {
    this.partyId = null;
    this.members = [];
    this.leaderId = null;
    this.hidePartyPanel();
  }

  /**
   * Check if in a party
   */
  isInParty(): boolean {
    return this.partyId !== null;
  }

  /**
   * Get party member IDs
   */
  getPartyMemberIds(): number[] {
    return this.members.map(m => m.id);
  }

  /**
   * Render the party panel
   */
  private renderPartyPanel(): void {
    let panel = document.getElementById('party-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'party-panel';
      panel.style.cssText = `
        position: fixed;
        top: 60px;
        left: 10px;
        width: 180px;
        background: linear-gradient(to bottom, rgba(40, 40, 50, 0.9), rgba(30, 30, 40, 0.9));
        border: 2px solid #555;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        z-index: 8000;
        font-family: Arial, sans-serif;
        color: #fff;
        overflow: hidden;
      `;
      document.body.appendChild(panel);
    }

    const isLeader = this.myPlayerId === this.leaderId;

    let html = `
      <div style="padding: 10px; background: rgba(0,0,0,0.3); border-bottom: 1px solid #444;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; font-size: 13px;">Party (${this.members.length}/5)</span>
          <button id="leave-party-btn" style="
            padding: 3px 8px;
            font-size: 11px;
            background: #7c4a4a;
            color: #fff;
            border: 1px solid #9c6a6a;
            border-radius: 3px;
            cursor: pointer;
          ">Leave</button>
        </div>
      </div>
      <div style="padding: 5px;">
    `;

    for (const member of this.members) {
      const hpPercent = Math.max(0, Math.min(100, (member.hp / member.maxHp) * 100));
      const isMe = member.id === this.myPlayerId;
      const isMemberLeader = member.id === this.leaderId;

      html += `
        <div class="party-member" data-id="${member.id}" style="
          padding: 6px;
          margin: 3px 0;
          background: ${isMe ? 'rgba(74, 124, 74, 0.3)' : 'rgba(255,255,255,0.05)'};
          border-radius: 4px;
          ${!isMe ? 'cursor: pointer;' : ''}
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 12px; ${isMemberLeader ? 'color: #ffd700;' : ''}">
              ${isMemberLeader ? '★ ' : ''}${member.name}
            </span>
            <span style="font-size: 10px; color: #aaa;">Lv${member.level}</span>
          </div>
          <div style="
            height: 6px;
            background: #333;
            border-radius: 3px;
            overflow: hidden;
          ">
            <div style="
              width: ${hpPercent}%;
              height: 100%;
              background: ${hpPercent > 50 ? '#4a7c4a' : hpPercent > 25 ? '#b8860b' : '#8b0000'};
              transition: width 0.3s;
            "></div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    panel.innerHTML = html;

    // Add event handlers
    const leaveBtn = document.getElementById('leave-party-btn');
    if (leaveBtn) {
      leaveBtn.onclick = () => {
        if (this.callbacks) {
          this.callbacks.onLeaveParty();
        }
      };
    }

    // Add kick functionality for leader
    if (isLeader) {
      const memberDivs = panel.querySelectorAll('.party-member');
      memberDivs.forEach(div => {
        const memberId = parseInt((div as HTMLElement).dataset.id || '0');
        if (memberId !== this.myPlayerId) {
          div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showKickConfirm(memberId, this.members.find(m => m.id === memberId)?.name || '');
          });
        }
      });
    }
  }

  /**
   * Show kick confirmation
   */
  private showKickConfirm(memberId: number, memberName: string): void {
    const existing = document.getElementById('kick-confirm');
    if (existing) existing.remove();

    const confirm = document.createElement('div');
    confirm.id = 'kick-confirm';
    confirm.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 20px;
      background: rgba(40, 40, 50, 0.95);
      border: 2px solid #7c4a4a;
      border-radius: 8px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      color: #fff;
      text-align: center;
    `;

    confirm.innerHTML = `
      <div style="margin-bottom: 15px;">Kick <strong>${memberName}</strong> from party?</div>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="confirm-kick" style="
          padding: 8px 16px;
          background: #7c4a4a;
          color: #fff;
          border: 1px solid #9c6a6a;
          border-radius: 4px;
          cursor: pointer;
        ">Kick</button>
        <button id="cancel-kick" style="
          padding: 8px 16px;
          background: #555;
          color: #fff;
          border: 1px solid #777;
          border-radius: 4px;
          cursor: pointer;
        ">Cancel</button>
      </div>
    `;

    document.body.appendChild(confirm);

    document.getElementById('confirm-kick')!.onclick = () => {
      if (this.callbacks) {
        this.callbacks.onKickMember(memberId);
      }
      confirm.remove();
    };

    document.getElementById('cancel-kick')!.onclick = () => {
      confirm.remove();
    };
  }

  /**
   * Hide party panel
   */
  private hidePartyPanel(): void {
    const panel = document.getElementById('party-panel');
    if (panel) {
      panel.remove();
    }
  }

  /**
   * Add party chat message
   */
  addChatMessage(senderName: string, message: string): void {
    console.log(`[Party Chat] ${senderName}: ${message}`);
    // Party chat messages are shown in the regular chat with [Party] prefix
  }

  /**
   * Cleanup all party UI elements
   */
  cleanup(): void {
    this.hidePartyPanel();
    this.pendingInvites.forEach((_, inviterId) => {
      this.hideInvite(inviterId);
    });
    this.pendingInvites.clear();
    const kickConfirm = document.getElementById('kick-confirm');
    if (kickConfirm) kickConfirm.remove();
  }
}
