/**
 * ItemTooltip - Shows item properties on hover with comparison to equipped
 */

import { Item } from '../entity/objects/item';
import { ItemProperties, Rarity, RarityColors, RarityNames, formatItemStats } from '../../../shared/ts/items/index';
import { Types } from '../../../shared/ts/gametypes';

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

  show(item: Item, equippedWeaponKind: number | null, mouseX: number, mouseY: number): void {
    if (!this.element || !item) return;

    const content = this.buildContent(item, equippedWeaponKind);
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

  private buildContent(item: Item, equippedWeaponKind: number | null): string {
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

    // Stats
    if (props) {
      html += `<div style="color: #aaa; font-size: 10px; margin-bottom: 6px;">`;

      if (props.damageMin !== undefined && props.damageMax !== undefined) {
        html += `Damage: ${props.damageMin}-${props.damageMax}<br>`;
      }
      if (props.defense !== undefined) {
        html += `Defense: ${props.defense}<br>`;
      }
      if (props.bonusHealth) {
        html += `<span style="color: #4f4;">+${props.bonusHealth} Health</span><br>`;
      }
      if (props.bonusStrength) {
        html += `<span style="color: #f44;">+${props.bonusStrength} Strength</span><br>`;
      }
      if (props.bonusCritChance) {
        html += `<span style="color: #ff4;">+${Math.round(props.bonusCritChance * 100)}% Crit</span><br>`;
      }
      html += `</div>`;

      // Comparison with equipped (for weapons)
      if (Types.isWeapon(item.kind) && equippedWeaponKind) {
        html += this.buildComparison(props, equippedWeaponKind);
      }
    }

    // Hint to pick up
    html += `<div style="color: #888; font-size: 10px; margin-top: 4px; font-style: italic;">Click to pick up</div>`;

    return html;
  }

  private buildComparison(newProps: ItemProperties, equippedKind: number): string {
    // Simple comparison: show if damage is higher/lower
    // For now, just show equipped weapon name
    const equippedName = Types.getKindAsString(equippedKind);

    if (!newProps.damageMin || !newProps.damageMax) return '';

    // Get base damage for equipped weapon (approximate from rank)
    const equippedRank = Types.getWeaponRank(equippedKind);
    const baseDamages: Record<number, [number, number]> = {
      0: [1, 3],   // sword1
      1: [3, 6],   // sword2
      2: [6, 10],  // axe
      3: [10, 15], // morningstar
      4: [12, 18], // bluesword
      5: [15, 22], // redsword
      6: [20, 30], // goldensword
    };

    const equipped = baseDamages[equippedRank] || [1, 3];
    const avgNew = (newProps.damageMin + newProps.damageMax) / 2;
    const avgEquipped = (equipped[0] + equipped[1]) / 2;
    const diff = avgNew - avgEquipped;

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
