import type { LocaleStrings } from "../i18n/types";
import { selectRandomEquipment } from "../equipment";
import type {
  AttributeStats,
  CharacterCreationData,
  CharacterSheet,
  RpgClass,
  SelectedClass,
  SelectedPower,
  SelectedSpell,
} from "../types";
import { calculateDerivedStats } from "./characterStats";

export interface RandomSource {
  next: () => number;
}

const defaultRandomSource: RandomSource = { next: () => Math.random() };

const pick = <T>(items: T[], random: RandomSource): T =>
  items[Math.floor(random.next() * items.length)] ?? items[0]!;

const shuffled = <T>(items: T[], random: RandomSource): T[] =>
  [...items].sort(() => random.next() - 0.5);

const parseDiceProfile = (profile: string): number[] =>
  profile.split(", ").map((die) => Number.parseInt(die.replace("d", ""), 10));

const assignRandomAttributes = (
  profile: string,
  strings: LocaleStrings,
  random: RandomSource,
): AttributeStats => {
  const dice = shuffled(parseDiceProfile(profile), random);
  return strings.attributeOrder.reduce<AttributeStats>((attributes, key, index) => ({
    ...attributes,
    [key]: dice[index] ?? 8,
  }), {});
};

const distributeLevels = (classCount: number, random: RandomSource): number[] => {
  const levels = Array.from({ length: classCount }, () => 1);
  let remaining = 5 - classCount;
  while (remaining > 0) {
    const index = Math.floor(random.next() * classCount);
    levels[index] = (levels[index] ?? 1) + 1;
    remaining -= 1;
  }
  return levels;
};

const selectRandomPowers = (classes: SelectedClass[], random: RandomSource): SelectedPower[] =>
  classes.flatMap(({ rpgClass, level }) =>
    shuffled(rpgClass.powers, random).slice(0, level).map((power) => ({
      power,
      className: rpgClass.name,
    })),
  );

const selectRandomSpells = (
  powers: SelectedPower[],
  classes: RpgClass[],
  random: RandomSource,
): SelectedSpell[] => powers
  .filter(({ power }) => power.grantsSpell)
  .reduce<SelectedSpell[]>((selected, { power, className }) => {
    const rpgClass = classes.find((entry) => entry.name === className);
    const available = rpgClass?.spells ?? [];
    const unlearned = available.filter((spell) => !selected.some((entry) => entry.spell.name === spell.name));
    const spell = pick(unlearned.length > 0 ? unlearned : available, random);
    return available.length > 0 ? [...selected, { spell, className, grantedByPower: power.name }] : selected;
  }, []);

/**
 * Generates a valid level-five character without touching React, Tauri, or the DOM.
 * @param data - Locale-specific game data
 * @param strings - Locale-specific labels and rules
 * @param random - Injectable random source for deterministic tests
 */
export const generateRandomCharacter = (
  data: CharacterCreationData,
  strings: LocaleStrings,
  random: RandomSource = defaultRandomSource,
): CharacterSheet => {
  const concept = pick(data.identityTables.concepts, random);
  const adjective = pick(data.identityTables.adjectives, random);
  const detail = pick(data.identityTables.details, random);
  const theme = pick(data.themes, random).name;
  const attributes = assignRandomAttributes(pick(data.attributes.arrays, random).values, strings, random);
  const classCount = Math.floor(random.next() * 3) + 1;
  const pickedClasses = shuffled(data.classes, random).slice(0, classCount);
  const levels = distributeLevels(classCount, random);
  const classes = pickedClasses.map((rpgClass, index) => ({ rpgClass, level: levels[index] ?? 1 }));
  const bareClasses = classes.map(({ rpgClass }) => rpgClass);
  const powers = selectRandomPowers(classes, random);
  const spells = selectRandomSpells(powers, bareClasses, random);
  const purchase = selectRandomEquipment(
    data.equipmentCatalog,
    bareClasses,
    data.startingBudget,
    strings.equipmentBenefitPatterns,
  );

  return {
    name: strings.defaults.randomHeroName,
    identity: `${adjective} ${concept} ${detail}`,
    theme,
    classes,
    powers,
    spells,
    attributes,
    equipment: purchase.equipment,
    derivedStats: calculateDerivedStats(attributes, bareClasses, purchase.equipment, 5, strings),
    equipmentSpent: purchase.equipmentSpent,
    money: purchase.money,
    moneyRoll: purchase.moneyRoll,
  };
};