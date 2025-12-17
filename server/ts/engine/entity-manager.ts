/**
 * EntityManager - Core ECS entity management
 *
 * Responsibilities:
 * - Create/destroy entities
 * - Add/remove components to entities
 * - Query entities by component types
 * - Provide entity lookups by ID
 */

import { EventEmitter } from 'events';

// Component type identifier
export type ComponentType = string;

// Base component interface - all components must be serializable
export interface Component {
  readonly type: ComponentType;
}

// Entity is just an ID - components hold all state
export type EntityId = number;

// Component storage for an entity
type ComponentMap = Map<ComponentType, Component>;

// Query predicate
export type EntityPredicate = (entityId: EntityId, components: ComponentMap) => boolean;

export interface EntityManagerEvents {
  'entity:created': (entityId: EntityId) => void;
  'entity:destroyed': (entityId: EntityId) => void;
  'component:added': (entityId: EntityId, component: Component) => void;
  'component:removed': (entityId: EntityId, componentType: ComponentType) => void;
}

export class EntityManager {
  private nextEntityId: EntityId = 1;
  private entities: Map<EntityId, ComponentMap> = new Map();
  private componentIndex: Map<ComponentType, Set<EntityId>> = new Map();
  private emitter: EventEmitter = new EventEmitter();

  /**
   * Create a new entity
   * @returns The new entity's ID
   */
  createEntity(): EntityId {
    const id = this.nextEntityId++;
    this.entities.set(id, new Map());
    this.emitter.emit('entity:created', id);
    return id;
  }

  /**
   * Create an entity with a specific ID (for loading saved entities)
   */
  createEntityWithId(id: EntityId): EntityId {
    if (this.entities.has(id)) {
      throw new Error(`Entity ${id} already exists`);
    }
    this.entities.set(id, new Map());
    if (id >= this.nextEntityId) {
      this.nextEntityId = id + 1;
    }
    this.emitter.emit('entity:created', id);
    return id;
  }

  /**
   * Destroy an entity and all its components
   */
  destroyEntity(entityId: EntityId): boolean {
    const components = this.entities.get(entityId);
    if (!components) return false;

    // Remove from all component indexes
    for (const [componentType] of components) {
      const index = this.componentIndex.get(componentType);
      if (index) {
        index.delete(entityId);
      }
    }

    this.entities.delete(entityId);
    this.emitter.emit('entity:destroyed', entityId);
    return true;
  }

  /**
   * Check if an entity exists
   */
  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Add a component to an entity
   */
  addComponent<T extends Component>(entityId: EntityId, component: T): T {
    const components = this.entities.get(entityId);
    if (!components) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    components.set(component.type, component);

    // Update component index
    let index = this.componentIndex.get(component.type);
    if (!index) {
      index = new Set();
      this.componentIndex.set(component.type, index);
    }
    index.add(entityId);

    this.emitter.emit('component:added', entityId, component);
    return component;
  }

  /**
   * Remove a component from an entity
   */
  removeComponent(entityId: EntityId, componentType: ComponentType): boolean {
    const components = this.entities.get(entityId);
    if (!components) return false;

    const removed = components.delete(componentType);
    if (removed) {
      const index = this.componentIndex.get(componentType);
      if (index) {
        index.delete(entityId);
      }
      this.emitter.emit('component:removed', entityId, componentType);
    }
    return removed;
  }

  /**
   * Get a component from an entity
   */
  getComponent<T extends Component>(entityId: EntityId, componentType: ComponentType): T | undefined {
    const components = this.entities.get(entityId);
    if (!components) return undefined;
    return components.get(componentType) as T | undefined;
  }

  /**
   * Check if an entity has a component
   */
  hasComponent(entityId: EntityId, componentType: ComponentType): boolean {
    const components = this.entities.get(entityId);
    if (!components) return false;
    return components.has(componentType);
  }

  /**
   * Check if an entity has all specified components
   */
  hasComponents(entityId: EntityId, componentTypes: ComponentType[]): boolean {
    const components = this.entities.get(entityId);
    if (!components) return false;
    return componentTypes.every(type => components.has(type));
  }

  /**
   * Get all components for an entity
   */
  getAllComponents(entityId: EntityId): Component[] {
    const components = this.entities.get(entityId);
    if (!components) return [];
    return Array.from(components.values());
  }

  /**
   * Query entities that have all specified component types
   */
  queryEntities(...componentTypes: ComponentType[]): EntityId[] {
    if (componentTypes.length === 0) {
      return Array.from(this.entities.keys());
    }

    // Start with the smallest index for efficiency
    let smallestSet: Set<EntityId> | undefined;
    let smallestSize = Infinity;

    for (const type of componentTypes) {
      const index = this.componentIndex.get(type);
      if (!index || index.size === 0) {
        return []; // No entities have this component
      }
      if (index.size < smallestSize) {
        smallestSize = index.size;
        smallestSet = index;
      }
    }

    if (!smallestSet) return [];

    // Filter to entities that have ALL required components
    return Array.from(smallestSet).filter(entityId =>
      this.hasComponents(entityId, componentTypes)
    );
  }

  /**
   * Query entities with a custom predicate
   */
  queryEntitiesWhere(predicate: EntityPredicate): EntityId[] {
    const results: EntityId[] = [];
    for (const [entityId, components] of this.entities) {
      if (predicate(entityId, components)) {
        results.push(entityId);
      }
    }
    return results;
  }

  /**
   * Iterate over all entities with specified components
   */
  forEachWith(
    componentTypes: ComponentType[],
    callback: (entityId: EntityId, ...components: Component[]) => void
  ): void {
    const entities = this.queryEntities(...componentTypes);
    for (const entityId of entities) {
      const components = componentTypes.map(type =>
        this.getComponent(entityId, type)!
      );
      callback(entityId, ...components);
    }
  }

  /**
   * Get count of entities
   */
  getEntityCount(): number {
    return this.entities.size;
  }

  /**
   * Get count of entities with specific component
   */
  getComponentCount(componentType: ComponentType): number {
    const index = this.componentIndex.get(componentType);
    return index ? index.size : 0;
  }

  /**
   * Subscribe to entity manager events
   */
  on<K extends keyof EntityManagerEvents>(
    event: K,
    listener: EntityManagerEvents[K]
  ): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Unsubscribe from entity manager events
   */
  off<K extends keyof EntityManagerEvents>(
    event: K,
    listener: EntityManagerEvents[K]
  ): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Clear all entities (for testing or world reset)
   */
  clear(): void {
    for (const entityId of Array.from(this.entities.keys())) {
      this.destroyEntity(entityId);
    }
    this.nextEntityId = 1;
  }
}

// Singleton instance for the game
let entityManager: EntityManager | null = null;

export function getEntityManager(): EntityManager {
  if (!entityManager) {
    entityManager = new EntityManager();
  }
  return entityManager;
}

export function resetEntityManager(): void {
  if (entityManager) {
    entityManager.clear();
  }
  entityManager = null;
}
