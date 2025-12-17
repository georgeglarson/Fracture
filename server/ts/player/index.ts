/**
 * Player Services Index
 *
 * Re-exports all player-related services for clean imports
 */

// Combat
export {CombatService, getCombatService} from './combat.service';
export type {PlayerAttackResult, PlayerDamageResult, FirePotionState} from './combat.service';

// Daily Rewards
export {DailyRewardService, getDailyRewardService} from './daily-reward.service';
export type {DailyRewardResult} from './daily-reward.service';

// Economy
export {EconomyService, getEconomyService} from './economy.service';
export type {PurchaseResult, SellResult} from './economy.service';

// Message Routing
export {MessageRouter} from './message-router';

// Movement
export {MovementService, getMovementService} from './movement.service';
export type {MovementResult, ZoneChangeResult, Position} from './movement.service';

// Progression
export {ProgressionService, createProgressionService} from './progression.service';
export type {ProgressionState, ProgressionCallbacks, LevelUpResult, XPGainResult, GoldGainResult} from './progression.service';

// Equipment (re-export from equipment folder for convenience)
export {EquipmentManager} from '../equipment/equipment-manager';
export type {EquipmentCallbacks} from '../equipment/equipment-manager';
