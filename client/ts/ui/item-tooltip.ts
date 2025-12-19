/**
 * ItemTooltip - Shows item properties on hover with comparison to equipped
 */

import { Item } from '../entity/objects/item';
import { ItemProperties, Rarity, RarityColors, RarityNames, formatItemStats } from '../../../shared/ts/items/index';
import { Types } from '../../../shared/ts/gametypes';
import { getWeaponStats, getArmorStats, compareWeapons } from '../../../shared/ts/equipment/equipment-stats';
import { getItemSet, getSetDefinition, formatSetBonus, SetId } from '../../../shared/ts/equipment/set-data';

export class ItemTooltip {
  private element: HTMLDivElement | null = null;
  private visible = false;

  constructor() {
    this.createElement();
  }

  private createElement(): void {
    this.element = document.createElement('div');
    this.element.id = 'item-tooltip';
    this.element.style.cssText = `
      position: fixed;
      display: none;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #555;
      border-radius: 4px;
      padding: 8px 12px;
      color: #fff;
      font-family: 'GraphicPixel', monospace;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      min-width: 150px;
      max-width: 250px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    `;
    document.body.appendChild(this.element);
  }

  show(
    item: Item,
    equippedWeaponKind: number | null,
    mouseX: number,
    mouseY: number,
    equippedWeaponProps?: { damageMin?: number; damageMax?: number } | null
  ): void {
    if (!this.element || !item) return;

    const content = this.buildContent(item, equippedWeaponKind, equippedWeaponProps);
    this.element.innerHTML = content;

    // Position tooltip near mouse but not overlapping
    const offsetX = 15;
    const offsetY = 15;
    let x = mouseX + offsetX;
    let y = mouseY + offsetY;

    // Keep tooltip on screen
    const rect = this.element.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Show briefly to get dimensions
    this.element.style.display = 'block';
    const tooltipWidth = this.element.offsetWidth;
    const tooltipHeight = this.element.offsetHeight;

    if (x + tooltipWidth > windowWidth - 10) {
      x = mouseX - tooltipWidth - offsetX;
    }
    if (y + tooltipHeight > windowHeight - 10) {
      y = mouseY - tooltipHeight - offsetY;
    }

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.visible = true;
  }

  hide(): void {
    if (this.element && this.visible) {
      this.element.style.display = 'none';
      this.visible = false;
    }
  }

  private buildContent(
    item: Item,
    equippedWeaponKind: number | null,
    equippedWeaponProps?: { damageMin?: number; damageMax?: number } | null
  ): string {
    const props = item.properties;
    const itemName = item.itemKind || 'Unknown Item';
    const rarity = item.getRarity();
    const rarityColor = item.getRarityColor();
    const rarityName = RarityNames[rarity];

    let html = '';

    // Item name with rarity color
    html += `<div style="color: ${rarityColor}; font-weight: bold; margin-bottom: 4px;">`;
    if (rarity !== Rarity.COMMON) {
      html += `${rarityName} `;
    }
    html += `${this.formatItemName(itemName)}</div>`;

    // Stats - show properties if available, otherwise base stats from shared module
    html += `<div style="color: #aaa; font-size: 10px; margin-bottom: 6px;">`;

    if (props && props.damageMin !== undefined && props.damageMax !== undefined) {
      html += `Damage: ${props.damageMin}-${props.damageMax}<br>`;
    } else if (Types.isWeapon(item.kind)) {
      const weaponStats = getWeaponStats(item.kind);
      if (weaponStats) {
        html += `Damage: ${weaponStats.min}-${weaponStats.max}<br>`;
      }
    }

    if (props && props.defense !== undefined) {
      html += `Defense: ${props.defense}<br>`;
    } else if (Types.isArmor(item.kind)) {
      const armorStats = getArmorStats(item.kind);
      if (armorStats) {
        html += `Defense: ${armorStats.defense}<br>`;
      }
    }

    if (props?.bonusHealth) {
      html += `<span style="color: #4f4;">+${props.bonusHealth} Health</span><br>`;
    }
    if (props?.bonusStrength) {
      html += `<span style="color: #f44;">+${props.bonusStrength} Strength</span><br>`;
    }
    if (props?.bonusCritChance) {
      html += `<span style="color: #ff4;">+${Math.round(props.bonusCritChance * 100)}% Crit</span><br>`;
    }
    html += `</div>`;

    // Set info
    html += this.buildSetInfo(item.kind);

    // Comparison with equipped (for weapons) using shared compareWeapons
    if (Types.isWeapon(item.kind) && equippedWeaponKind) {
      html += this.buildComparison(item.kind, props, equippedWeaponKind, equippedWeaponProps);
    }

    // Hint to pick up
    html += `<div style="color: #888; font-size: 10px; margin-top: 4px; font-style: italic;">Click to pick up</div>`;

    return html;
  }

  /**
   * Build comparison HTML using shared compareWeapons function
   */
  private buildComparison(
    itemKind: number,
    props: ItemProperties | null,
    equippedKind: number,
    equippedProps?: { damageMin?: number; damageMax?: number } | null
  ): string {
    const equippedName = Types.getKindAsString(equippedKind);

    // Use shared compareWeapons with actual equipped properties for accurate comparison
    const diff = compareWeapons(
      itemKind,
      equippedKind,
      props as { damageMin?: number; damageMax?: number } | null,
      equippedProps || null
    );

    let html = `<div style="border-top: 1px solid #444; margin-top: 4px; padding-top: 4px;">`;
    html += `<span style="color: #888;">vs. ${this.formatItemName(equippedName)}: </span>`;

    if (diff > 0) {
      html += `<span style="color: #4f4;">↑ +${diff.toFixed(0)} dmg</span>`;
    } else if (diff < 0) {
      html += `<span style="color: #f44;">↓ ${diff.toFixed(0)} dmg</span>`;
    } else {
      html += `<span style="color: #888;">=</span>`;
    }
    html += `</div>`;

    return html;
  }

  /**
   * Build set info section for items that belong to equipment sets
   */
  private buildSetInfo(itemKind: number): string {
    const setId = getItemSet(itemKind);
    if (!setId) return '';

    const set = getSetDefinition(setId);
    if (!set) return '';

    let html = `<div style="border-top: 1px solid ${set.color}40; margin-top: 6px; padding-top: 6px;">`;

    // Set name
    html += `<div style="color: ${set.color}; font-weight: bold; font-size: 11px;">`;
    html += `${set.name}</div>`;

    // Required pieces
    html += `<div style="color: #888; font-size: 10px;">`;
    html += `(${set.requiredPieces}) Set Bonus:</div>`;

    // Bonus effects
    const bonusLines = formatSetBonus(set.bonus);
    for (const line of bonusLines) {
      const isNegative = line.includes('-') && !line.includes('+');
      const color = isNegative ? '#f88' : '#8f8';
      html += `<div style="color: ${color}; font-size: 10px; padding-left: 8px;">${line}</div>`;
    }

    html += `</div>`;
    return html;
  }

  private formatItemName(name: string): string {
    // Convert "redsword" to "Red Sword"
    return name
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
      .replace(/sword/i, ' Sword')
      .replace(/armor/i, ' Armor')
      .replace(/axe/i, 'Axe')
      .replace(/morningstar/i, 'Morning Star')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
