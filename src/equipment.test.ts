import { describe, expect, test } from 'bun:test';
import { buildEquipmentPurchaseResult, calculateEquipmentCost, filterCatalogByPermissions } from './equipment.ts';
import type { EquipmentCatalog, EquipmentPermissions } from './types.ts';

const setup = (): { catalog: EquipmentCatalog; permissions: EquipmentPermissions } => ({
  catalog: {
    weapons: [
      {
        name: 'Training Sword', type: 'melee', accuracyAttributes: ['MIG', 'DES'],
        damageBonus: 0, damageType: 'physical', isEquipped: true, cost: 0, category: 'basic-melee',
      },
      {
        name: 'Longbow', type: 'ranged', accuracyAttributes: ['DES', 'VON'],
        damageBonus: 2, damageType: 'physical', isEquipped: true, cost: 30, category: 'ranged',
      },
    ],
    armors: [],
    shields: [],
  },
  permissions: {
    basicMelee: true, martialMelee: false, ranged: false, arcane: false,
    lightArmor: true, heavyArmor: false, martialShields: false,
  },
});

describe('equipment domain', () => {
  test('filters catalog by permission category', () => {
    const { catalog, permissions } = setup();
    const filtered = filterCatalogByPermissions(catalog, permissions);

    expect(filtered.weapons.map(({ name }) => name)).toEqual(['Training Sword']);
  });

  test('builds equipped items and preserves budget accounting', () => {
    const { catalog } = setup();
    const selection = { weapon: catalog.weapons[0]!, armor: null, shield: null };

    expect(calculateEquipmentCost(selection)).toBe(0);
    const result = buildEquipmentPurchaseResult(selection, 100);
    expect(result.equipment.weapons[0]?.name).toBe('Training Sword');
    expect(result.equipmentSpent).toBe(0);
    expect(result.money).toBeGreaterThanOrEqual(100);
  });
});