/**
 * Engine Module - Core ECS infrastructure
 *
 * Re-exports all engine components for clean imports.
 */

// Entity Management
export {
  EntityManager,
  getEntityManager,
  resetEntityManager,
  type Component,
  type ComponentType,
  type EntityId,
  type EntityPredicate,
  type EntityManagerEvents
} from './entity-manager';

// Event Bus (re-export from shared)
export {
  EventBus,
  getServerEventBus,
  type IEventBus,
  type EventHandler,
  type Subscription
} from '../../../shared/ts/events/event-bus';

// Event Types (re-export from shared)
export type {
  GameEventMap,
  GameEventName,
  GameEventPayload
} from '../../../shared/ts/events/event-types';

// Message Dispatcher
export {
  MessageDispatcher,
  getMessageDispatcher,
  type MessageHandler,
  type MessageContext
} from './message-dispatcher';
