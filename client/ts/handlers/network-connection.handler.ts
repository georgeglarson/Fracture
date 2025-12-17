/**
 * NetworkConnectionHandler - Handles network connection lifecycle events
 *
 * Single Responsibility: Connection, reconnection, disconnection, auth events
 * Extracted from Game.ts to reduce its size.
 */

import { GameClient } from '../network/gameclient';
import { ClientEvents } from '../network/client-events';
import { getNetworkStatus } from '../ui/network-status';
import { showError, showSuccess } from '../ui/toast';

/**
 * Game context for network connection operations
 */
export interface NetworkConnectionContext {
  player: { name: string } | null;
  started: boolean;
  username: string;

  // Methods
  sendHello: (player: any) => void;
}

/**
 * Setup network connection event handlers
 */
export function setupConnectionHandlers(
  ctx: NetworkConnectionContext,
  client: GameClient
): void {
  // Handle successful connection
  client.on(ClientEvents.CONNECTED, () => {
    console.info('Starting client/server handshake');

    // Hide any network status overlay
    getNetworkStatus().hide();

    ctx.player!.name = ctx.username;
    ctx.started = true;

    ctx.sendHello(ctx.player);
  });

  // Handle network reconnection events
  client.on(ClientEvents.RECONNECTING, (attemptNumber: number) => {
    console.info('Reconnection attempt ' + attemptNumber);
    getNetworkStatus().showReconnecting(attemptNumber, 5);
  });

  client.on(ClientEvents.RECONNECTED, () => {
    console.info('Successfully reconnected');
    getNetworkStatus().hide();
    showSuccess('Connection restored', 'Reconnected');
  });

  client.on(ClientEvents.DISCONNECTED, (message: string) => {
    console.error('Disconnected:', message);
    getNetworkStatus().showDisconnected();
    getNetworkStatus().setRetryCallback(() => {
      window.location.reload();
    });
  });

  // Handle authentication failure
  client.on(ClientEvents.AUTH_FAIL, (reason: string) => {
    console.error('[Auth] Authentication failed:', reason);
    ctx.started = false;

    let title = 'Authentication Failed';
    let message = 'Please try again.';
    if (reason === 'wrong_password') {
      message = 'The password you entered is incorrect.';
    } else if (reason === 'password_required') {
      title = 'Password Required';
      message = 'This name is already registered. Please enter a password (3+ characters).';
    }

    // Show error toast with reload action
    showError(message, title, {
      duration: 0, // Persistent until dismissed
      action: {
        label: 'Try Again',
        callback: () => window.location.reload()
      }
    });
  });
}
