import type { LocaleStrings } from "../i18n/types";
import type { AttributeStats, CharacterEquipment, DerivedStats, RpgClass } from "../types";

const DEFAULT_DIE_SIZE = 8;

/**
 * Reads an attribute die size while applying the game's default value.
 * @param attributes - Character attribute dice sizes
 * @param attributeName - Locale-specific attribute key
 */
export const getAttributeValue = (attributes: AttributeStats, attributeName: string): number =>
  attributes[attributeName] ?? DEFAULT_DIE_SIZE;

/**
 * Calculates the derived combat statistics for a character.
 * @param attributes - Character attribute dice sizes
 * @param classes - Classes contributing starting benefits
 * @param equipment - Equipped character loadout
 * @param level - Character level
 * @param strings - Locale-specific stat mappings and benefit patterns
 */
export const calculateDerivedStats = (
  attributes: AttributeStats,
  classes: RpgClass[],
  equipment: CharacterEquipment,
  level: number,
  strings: LocaleStrings,
): DerivedStats => {
  const { benefitPatterns, statMapping } = strings;
  const countClassesWithBenefit = (pattern: RegExp): number =>
    classes.filter((rpgClass) => rpgClass.startingBenefits.some((benefit) => pattern.test(benefit))).length;

  const hpBonus = countClassesWithBenefit(benefitPatterns.hp) * 5;
  const mpBonus = countClassesWithBenefit(benefitPatterns.mp) * 5;
  const ipBonus = countClassesWithBenefit(benefitPatterns.ip) * 2;

  const baseDefense =
    (equipment.armor?.baseDefense ?? 0) + getAttributeValue(attributes, statMapping.defense);
  const baseMagicDefense =
    (equipment.armor?.baseMagicDefense ?? 0) + getAttributeValue(attributes, statMapping.magicDefense);
  const shieldDefense = equipment.shield?.isEquipped ? equipment.shield.defenseBonus : 0;
  const shieldMagicDefense = equipment.shield?.isEquipped ? equipment.shield.magicDefenseBonus : 0;

  return {
    hp: level + getAttributeValue(attributes, statMapping.hp) * 5 + hpBonus,
    mp: level + getAttributeValue(attributes, statMapping.mp) * 5 + mpBonus,
    ip: 6 + ipBonus,
    defense: baseDefense + shieldDefense,
    magicDefense: baseMagicDefense + shieldMagicDefense,
    initiative: -(equipment.armor?.initiativePenalty ?? 0),
  };
};