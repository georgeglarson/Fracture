/**
 * SpriteLoader - Handles sprite loading and management
 * Single Responsibility: Load and manage sprite assets
 */

import { Sprite } from '../renderer/sprite';
import { Types } from '../../../shared/ts/gametypes';
import _ from 'lodash';

export interface SpriteLoaderContext {
  renderer: {
    upscaledRendering: boolean;
    mobile: boolean;
    tablet: boolean;
    scale: number;
  };
  entities: Record<string | number, any>;
}

export class SpriteLoader {
  private spritesets: Record<string, Sprite>[] = [{}, {}, {}];
  private sprites: Record<string, Sprite> = {};
  private context: SpriteLoaderContext | null = null;

  // All sprite names to load
  private readonly spriteNames = [
    'hand', 'sword', 'loot', 'target', 'talk', 'sparks', 'shadow16',
    'rat', 'skeleton', 'skeleton2', 'spectre', 'boss', 'deathknight',
    'ogre', 'crab', 'snake', 'eye', 'bat', 'goblin', 'wizard', 'guard',
    'king', 'villagegirl', 'villager', 'coder', 'agent', 'rick', 'scientist',
    'nyan', 'priest', 'sorcerer', 'octocat', 'beachnpc', 'forestnpc',
    'desertnpc', 'lavanpc', 'clotharmor', 'leatherarmor', 'mailarmor',
    'platearmor', 'redarmor', 'goldenarmor', 'firefox', 'death',
    'sword1', 'axe', 'chest', 'sword2', 'redsword', 'bluesword', 'goldensword',
    'item-sword2', 'item-axe', 'item-redsword', 'item-bluesword', 'item-goldensword',
    'item-leatherarmor', 'item-mailarmor', 'item-platearmor', 'item-redarmor',
    'item-goldenarmor', 'item-flask', 'item-cake', 'item-burger',
    'morningstar', 'item-morningstar', 'item-firepotion'
  ];

  setContext(context: SpriteLoaderContext): void {
    this.context = context;
  }

  getSprites(): Record<string, Sprite> {
    return this.sprites;
  }

  getSpriteNames(): string[] {
    return this.spriteNames;
  }

  /**
   * Load a single sprite at appropriate scale
   */
  loadSprite(name: string): void {
    if (!this.context) return;

    if (this.context.renderer.upscaledRendering) {
      this.spritesets[0][name] = new Sprite(name, 1);
    } else {
      this.spritesets[1][name] = new Sprite(name, 2);
      if (!this.context.renderer.mobile && !this.context.renderer.tablet) {
        this.spritesets[2][name] = new Sprite(name, 3);
      }
    }
  }

  /**
   * Load all sprites
   */
  loadSprites(): void {
    console.info('Loading sprites...');
    this.spritesets = [{}, {}, {}];
    this.spriteNames.forEach((name) => this.loadSprite(name));
  }

  /**
   * Set the current sprite scale
   */
  setSpriteScale(scale: number): void {
    if (!this.context) return;

    if (this.context.renderer.upscaledRendering) {
      this.sprites = this.spritesets[0];
    } else {
      this.sprites = this.spritesets[scale - 1];

      // Update all entities with new scale sprites
      _.each(this.context.entities, (entity) => {
        entity.sprite = null;
        entity.setSprite(this.sprites[entity.getSpriteName()]);
      });
    }
  }

  /**
   * Check if all sprites are loaded
   */
  spritesLoaded(): boolean {
    return !_.any(this.sprites, (sprite: Sprite) => !sprite.isLoaded);
  }

  /**
   * Initialize hurt sprites for all armor types
   */
  initHurtSprites(): void {
    const sprites = this.sprites;
    Types.forEachArmorKind((kind, kindName) => {
      if (sprites[kindName]) {
        sprites[kindName].createHurtSprite();
      }
    });
  }

  /**
   * Initialize shadow sprites
   */
  initShadows(): Record<string, Sprite> {
    return {
      small: this.sprites['shadow16']
    };
  }

  /**
   * Initialize cursor sprites
   */
  initCursors(): Record<string, Sprite> {
    return {
      hand: this.sprites['hand'],
      sword: this.sprites['sword'],
      loot: this.sprites['loot'],
      target: this.sprites['target'],
      arrow: this.sprites['arrow'],
      talk: this.sprites['talk']
    };
  }

  /**
   * Initialize silhouette sprites for mobs/npcs
   */
  initSilhouettes(): void {
    const sprites = this.sprites;
    Types.forEachMobOrNpcKind((kind, kindName) => {
      if (sprites[kindName]) {
        sprites[kindName].createSilhouette();
      }
    });
    if (sprites['chest']) {
      sprites['chest'].createSilhouette();
    }
    if (sprites['item-cake']) {
      sprites['item-cake'].createSilhouette();
    }
  }
}
