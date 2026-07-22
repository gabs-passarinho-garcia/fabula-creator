import sample from 'lodash/sample';
import type { LocaleStrings } from './i18n/types.ts';
import type {
  Armor,
  CatalogArmor,
  CatalogShield,
  CatalogWeapon,
  CharacterEquipment,
  EquipmentCatalog,
  EquipmentPermissions,
  EquipmentPurchaseResult,
  EquipmentSelection,
  MoneyRoll,
  RpgClass,
  Shield,
  Weapon,
} from './types.ts';

export const NONE_EQUIPMENT = '__none__';

/**
 * Rolls 2d6 and returns the starting money bonus (sum × 10).
 */
export const rollStartingMoneyBonus = (): MoneyRoll => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;

  return {
    dice: [die1, die2],
    bonus: (die1 + die2) * 10,
  };
};

/**
 * Computes final pocket money from budget leftover plus the 2d6×10 roll.
 * @param spent - Total zenites spent on equipment
 * @param budget - Starting equipment budget
 * @param roll - Rolled money bonus
 */
export const calculateMoney = (spent: number, budget: number, roll: MoneyRoll): number =>
  budget - spent + roll.bonus;

/**
 * Sums the cost of a equipment selection.
 * @param selection - Chosen catalog items
 */
export const calculateEquipmentCost = (selection: EquipmentSelection): number =>
  selection.weapon.cost + (selection.armor?.cost ?? 0) + (selection.shield?.cost ?? 0);

/**
 * Builds default equipment permissions for classes without explicit equip benefits.
 */
export const createDefaultEquipmentPermissions = (): EquipmentPermissions => ({
  basicMelee: true,
  martialMelee: false,
  ranged: false,
  arcane: true,
  lightArmor: true,
  heavyArmor: false,
  martialShields: false,
});

/**
 * Applies a single class benefit string to equipment permissions.
 * @param permissions - Current permissions (mutated in place)
 * @param benefit - One starting benefit line
 * @param patterns - Locale-specific regex patterns for equip benefits
 */
const applyBenefitToPermissions = (
  permissions: EquipmentPermissions,
  benefit: string,
  patterns: LocaleStrings['equipmentBenefitPatterns'],
): void => {
  if (patterns.rangedAndMartialShields.test(benefit)) {
    permissions.ranged = true;
    permissions.martialShields = true;
  }

  if (patterns.meleeAndMartialArmor.test(benefit)) {
    permissions.basicMelee = true;
    permissions.martialMelee = true;
    permissions.heavyArmor = true;
  }

  if (patterns.heavyArmorAndMartialShields.test(benefit)) {
    permissions.heavyArmor = true;
    permissions.martialShields = true;
  }

  if (patterns.martialMeleeAndShields.test(benefit)) {
    permissions.martialMelee = true;
    permissions.martialShields = true;
  } else if (patterns.martialMelee.test(benefit)) {
    permissions.martialMelee = true;
  }
};

/**
 * Derives merged equipment permissions from all selected classes (union/OR).
 * @param classes - Selected RPG classes
 * @param patterns - Locale-specific regex patterns for equip benefits
 */
export const deriveEquipmentPermissions = (
  classes: RpgClass[],
  patterns: LocaleStrings['equipmentBenefitPatterns'],
): EquipmentPermissions => {
  const permissions = createDefaultEquipmentPermissions();

  classes.forEach((rpgClass) => {
    rpgClass.startingBenefits.forEach((benefit) => {
      applyBenefitToPermissions(permissions, benefit, patterns);
    });
  });

  return permissions;
};

/**
 * Checks whether a catalog weapon is allowed under the given permissions.
 * @param weapon - Catalog weapon entry
 * @param permissions - Derived class permissions
 */
const isWeaponAllowed = (weapon: CatalogWeapon, permissions: EquipmentPermissions): boolean => {
  switch (weapon.category) {
    case 'basic-melee':
      return permissions.basicMelee;
    case 'martial-melee':
      return permissions.martialMelee;
    case 'ranged':
      return permissions.ranged;
    case 'arcane':
      return permissions.arcane;
    default: {
      const exhaustiveCheck: never = weapon.category;
      return exhaustiveCheck;
    }
  }
};

/**
 * Checks whether a catalog armor is allowed under the given permissions.
 * @param armor - Catalog armor entry
 * @param permissions - Derived class permissions
 */
const isArmorAllowed = (armor: CatalogArmor, permissions: EquipmentPermissions): boolean => {
  switch (armor.category) {
    case 'light':
      return permissions.lightArmor;
    case 'heavy':
      return permissions.heavyArmor;
    default: {
      const exhaustiveCheck: never = armor.category;
      return exhaustiveCheck;
    }
  }
};

/**
 * Checks whether a catalog shield is allowed under the given permissions.
 * @param shield - Catalog shield entry
 * @param permissions - Derived class permissions
 */
const isShieldAllowed = (shield: CatalogShield, permissions: EquipmentPermissions): boolean => {
  switch (shield.category) {
    case 'martial':
      return permissions.martialShields;
    default: {
      const exhaustiveCheck: never = shield.category;
      return exhaustiveCheck;
    }
  }
};

/**
 * Filters the equipment catalog to items permitted by class equipment rules.
 * @param catalog - Full locale equipment catalog
 * @param permissions - Derived class permissions
 */
export const filterCatalogByPermissions = (
  catalog: EquipmentCatalog,
  permissions: EquipmentPermissions,
): EquipmentCatalog => ({
  weapons: catalog.weapons.filter((weapon) => isWeaponAllowed(weapon, permissions)),
  armors: catalog.armors.filter((armor) => isArmorAllowed(armor, permissions)),
  shields: catalog.shields.filter((shield) => isShieldAllowed(shield, permissions)),
});

/**
 * Converts a catalog weapon into an equipped character weapon.
 * @param weapon - Selected catalog weapon
 */
const toEquippedWeapon = (weapon: CatalogWeapon): Weapon => ({
  name: weapon.name,
  type: weapon.type,
  accuracyAttributes: weapon.accuracyAttributes,
  damageBonus: weapon.damageBonus,
  damageType: weapon.damageType,
  isEquipped: true,
});

/**
 * Converts a catalog armor into an equipped character armor.
 * @param armor - Selected catalog armor
 */
const toEquippedArmor = (armor: CatalogArmor): Armor => {
  const equipped: Armor = {
    name: armor.name,
    isEquipped: true,
  };

  if (armor.baseDefense !== undefined) {
    equipped.baseDefense = armor.baseDefense;
  }

  if (armor.baseMagicDefense !== undefined) {
    equipped.baseMagicDefense = armor.baseMagicDefense;
  }

  if (armor.initiativePenalty !== undefined) {
    equipped.initiativePenalty = armor.initiativePenalty;
  }

  return equipped;
};

/**
 * Converts a catalog shield into an equipped character shield.
 * @param shield - Selected catalog shield
 */
const toEquippedShield = (shield: CatalogShield): Shield => ({
  name: shield.name,
  defenseBonus: shield.defenseBonus,
  magicDefenseBonus: shield.magicDefenseBonus,
  isEquipped: true,
});

/**
 * Builds character equipment from a catalog selection.
 * @param selection - Chosen weapon, armor, and shield
 */
export const toCharacterEquipment = (selection: EquipmentSelection): CharacterEquipment => ({
  weapons: [toEquippedWeapon(selection.weapon)],
  ...(selection.armor ? { armor: toEquippedArmor(selection.armor) } : {}),
  ...(selection.shield ? { shield: toEquippedShield(selection.shield) } : {}),
});

/**
 * Builds a complete purchase result including money roll.
 * @param selection - Chosen equipment items
 * @param budget - Starting equipment budget in zenites
 */
export const buildEquipmentPurchaseResult = (
  selection: EquipmentSelection,
  budget: number,
): EquipmentPurchaseResult => {
  const equipmentSpent = calculateEquipmentCost(selection);
  const moneyRoll = rollStartingMoneyBonus();

  return {
    equipment: toCharacterEquipment(selection),
    equipmentSpent,
    money: calculateMoney(equipmentSpent, budget, moneyRoll),
    moneyRoll,
  };
};

/**
 * Enumerates all valid loadouts within budget from a filtered catalog.
 * @param catalog - Permission-filtered equipment catalog
 * @param budget - Starting equipment budget in zenites
 */
export const enumerateValidLoadouts = (
  catalog: EquipmentCatalog,
  budget: number,
): EquipmentSelection[] => {
  const armorOptions: Array<CatalogArmor | null> = [null, ...catalog.armors];
  const shieldOptions: Array<CatalogShield | null> = [null, ...catalog.shields];

  return catalog.weapons.flatMap((weapon) =>
    armorOptions.flatMap((armor) =>
      shieldOptions.reduce<EquipmentSelection[]>((loadouts, shield) => {
        const cost = weapon.cost + (armor?.cost ?? 0) + (shield?.cost ?? 0);

        if (cost <= budget) {
          loadouts.push({ weapon, armor, shield });
        }

        return loadouts;
      }, []),
    ),
  );
};

/**
 * Randomly selects a valid equipment loadout respecting class permissions and budget.
 * @param catalog - Full locale equipment catalog
 * @param classes - Selected RPG classes
 * @param budget - Starting equipment budget in zenites
 * @param patterns - Locale-specific regex patterns for equip benefits
 */
export const selectRandomEquipment = (
  catalog: EquipmentCatalog,
  classes: RpgClass[],
  budget: number,
  patterns: LocaleStrings['equipmentBenefitPatterns'],
): EquipmentPurchaseResult => {
  const permissions = deriveEquipmentPermissions(classes, patterns);
  const filtered = filterCatalogByPermissions(catalog, permissions);
  const validLoadouts = enumerateValidLoadouts(filtered, budget);

  const fallbackWeapon =
    filtered.weapons.find((weapon) => weapon.cost === 0) ??
    filtered.weapons[0] ??
    catalog.weapons.find((weapon) => weapon.cost === 0)!;

  const selection = sample(validLoadouts) ?? {
    weapon: fallbackWeapon,
    armor: null,
    shield: null,
  };

  return buildEquipmentPurchaseResult(selection, budget);
};

/**
 * Formats a catalog item label with its zenite cost.
 * @param name - Item display name
 * @param cost - Item cost in zenites
 * @param formatCost - Locale-specific cost formatter
 */
export const formatEquipmentOptionLabel = (
  name: string,
  cost: number,
  formatCost: (cost: number) => string,
): string => `${name} (${formatCost(cost)})`;
