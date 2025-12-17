/**
 * PartyHandler - Handles client-side party operations
 *
 * Single Responsibility: Party init, invites, joins, leaves, chat
 * Extracted from Game.ts to reduce its size.
 */

import { PartyUI, PartyMember } from '../ui/party-ui';
import { PlayerInspect } from '../ui/player-inspect';
import { ContextMenu } from '../ui/context-menu';
import { GameClient } from '../network/gameclient';
import { Renderer } from '../renderer/renderer';
import { Player } from '../entity/character/player/player';

/**
 * Game context for party operations
 */
export interface PartyGameContext {
  client: any; // GameClient
  player: any; // Player
  playerId: number;
  partyUI: PartyUI | null;
  playerInspect: PlayerInspect | null;
  contextMenu: ContextMenu | null;
  renderer: any; // Renderer
  started: boolean;

  // Methods
  showNotification: (message: string) => void;
  showBubbleFor: (entity: any, message: string) => void;
  getEntityById: (id: number) => any;
  getMouseGridPosition: () => { x: number; y: number };
  getEntityAt: (x: number, y: number) => any;
}

/**
 * Initialize party UI with callbacks
 */
export function initPartyUI(ctx: PartyGameContext): { partyUI: PartyUI; playerInspect: PlayerInspect; contextMenu: ContextMenu } {
  const partyUI = new PartyUI();
  const playerInspect = new PlayerInspect();
  const contextMenu = new ContextMenu();

  // Set player ID when available
  if (ctx.player) {
    partyUI.setPlayerId(ctx.player.id);
  }

  // Set up party callbacks
  partyUI.setCallbacks({
    onAcceptInvite: (inviterId) => ctx.client?.sendPartyAccept(inviterId),
    onDeclineInvite: (inviterId) => ctx.client?.sendPartyDecline(inviterId),
    onLeaveParty: () => ctx.client?.sendPartyLeave(),
    onKickMember: (memberId) => ctx.client?.sendPartyKick(memberId),
    onSendChat: (message) => ctx.client?.sendPartyChat(message)
  });

  // Set up inspect callbacks
  playerInspect.setCallbacks({
    onInviteToParty: (playerId) => ctx.client?.sendPartyInvite(playerId)
  });
  playerInspect.setPartyStatusChecker(() => partyUI?.isInParty() ?? false);

  // Set up context menu callbacks
  contextMenu.setCallbacks({
    onInspect: (entityId) => ctx.client?.sendPlayerInspect(entityId),
    onInvite: (playerId) => ctx.client?.sendPartyInvite(playerId)
  });
  contextMenu.setPartyStatusChecker(() => partyUI?.isInParty() ?? false);

  return { partyUI, playerInspect, contextMenu };
}

/**
 * Handle party invite from another player
 */
export function handlePartyInvite(ctx: PartyGameContext, inviterId: number, inviterName: string): void {
  if (ctx.partyUI) {
    ctx.partyUI.showInvite(inviterId, inviterName);
  }
  console.info('[Party] Received invite from', inviterName);
}

/**
 * Handle joining a party
 */
export function handlePartyJoin(ctx: PartyGameContext, partyId: string, members: PartyMember[], leaderId: number): void {
  if (ctx.partyUI) {
    ctx.partyUI.joinParty(partyId, members, leaderId);
    // Update renderer with party member IDs
    ctx.renderer?.setPartyMembers(members.map(m => m.id));
  }
  ctx.showNotification('Joined party');
  console.info('[Party] Joined party', partyId);
}

/**
 * Handle a member leaving the party
 */
export function handlePartyLeave(ctx: PartyGameContext, playerId: number): void {
  if (ctx.partyUI) {
    ctx.partyUI.memberLeft(playerId);
    // Update renderer
    ctx.renderer?.setPartyMembers(ctx.partyUI.getPartyMemberIds());
  }
  console.info('[Party] Player left:', playerId);
}

/**
 * Handle party disband
 */
export function handlePartyDisband(ctx: PartyGameContext): void {
  if (ctx.partyUI) {
    ctx.partyUI.leaveParty();
    ctx.renderer?.setPartyMembers([]);
  }
  ctx.showNotification('Party disbanded');
  console.info('[Party] Party disbanded');
}

/**
 * Handle party member update
 */
export function handlePartyUpdate(ctx: PartyGameContext, members: PartyMember[]): void {
  if (ctx.partyUI) {
    ctx.partyUI.updateMembers(members);
    ctx.renderer?.setPartyMembers(members.map(m => m.id));
  }
}

/**
 * Handle party chat message
 */
export function handlePartyChat(ctx: PartyGameContext, senderId: number, senderName: string, message: string): void {
  // Show party chat in regular chat with [Party] prefix
  if (ctx.partyUI) {
    ctx.partyUI.addChatMessage(senderName, message);
  }
  // Create chat bubble
  const entity = ctx.getEntityById(senderId);
  if (entity) {
    ctx.showBubbleFor(entity, '[P] ' + message);
  }
  console.info('[Party Chat]', senderName + ':', message);
}

/**
 * Handle player inspect result
 */
export function handlePlayerInspectResult(
  ctx: PartyGameContext,
  playerId: number,
  name: string,
  title: string | null,
  level: number,
  weapon: number,
  armor: number
): void {
  if (ctx.playerInspect) {
    ctx.playerInspect.show({
      playerId,
      name,
      title,
      level,
      weapon,
      armor
    });
  }
}

/**
 * Show context menu for a player
 */
export function showPlayerContextMenu(ctx: PartyGameContext, playerId: number, playerName: string, screenX: number, screenY: number): void {
  if (ctx.contextMenu && playerId !== ctx.playerId) {
    ctx.contextMenu.showForPlayer(playerId, playerName, screenX, screenY);
  }
}

/**
 * Handle right-click on the game canvas
 */
export function rightClick(ctx: PartyGameContext, screenX: number, screenY: number): boolean {
  if (!ctx.started || !ctx.contextMenu) return false;

  const pos = ctx.getMouseGridPosition();
  const entity = ctx.getEntityAt(pos.x, pos.y);

  // Check if entity is a player (not NPC, not mob, not self)
  if (entity && entity instanceof Player && entity.id !== ctx.playerId) {
    showPlayerContextMenu(ctx, entity.id, entity.name, screenX, screenY);
    return true;
  }

  return false;
}
