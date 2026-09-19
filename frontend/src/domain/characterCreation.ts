import type { LocaleStrings } from "../i18n/types";
import { selectRandomEquipment } from "../equipment";
import type {
  AttributeStats,
  CharacterCreationData,
  CharacterSheet,
  HeroicPower,
  RpgClass,
  SelectedClass,
  SelectedHeroicPower,
} from "../types";
import { calculateDerivedStats } from "./characterStats";
import { adjustRank, canIncrease, purchaseRandomPowers, rankOf, ranksForClass, selectSpellsForRanks } from "./powerRanks";

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

const distributeLevels = (targetLevel: number, classCount: number, random: RandomSource): number[] => {
  const levels = Array.from({ length: classCount }, () => 1);
  let remaining = targetLevel - classCount;
  while (remaining > 0) {
    const index = Math.floor(random.next() * classCount);
    levels[index] = (levels[index] ?? 1) + 1;
    remaining -= 1;
  }
  return levels;
};

/** Lowest total level a character can be created with. */
export const MIN_STARTING_LEVEL = 5;
/** Highest total level supported by Fabula Ultima. */
export const MAX_CHARACTER_LEVEL = 50;
/** A class stops counting towards the active class limit once mastered (level 10). */
export const MAX_CLASS_LEVEL = 10;
/** Maximum number of active (non-mastered) classes allowed at the same time. */
export const MAX_ACTIVE_CLASSES = 3;

/**
 * Number of attribute step-ups granted to a character at the given total level
 * (one at level 20 and another at level 40).
 */
export const attributeBoostCountForLevel = (level: number): number =>
  (level >= 20 ? 1 : 0) + (level >= 40 ? 1 : 0);

/**
 * Whether a class count can absorb the whole level budget: each class takes
 * 1..10 levels, no more than `MAX_ACTIVE_CLASSES` classes may stay below 10, and
 * mastered classes stop occupying an active slot.
 * @param classCount - Number of chosen classes
 * @param targetLevel - Total level to distribute
 */
const canAllocateAcrossClasses = (classCount: number, targetLevel: number): boolean => {
  for (let mastered = 0; mastered <= classCount; mastered += 1) {
    const active = classCount - mastered;
    if (active > MAX_ACTIVE_CLASSES) continue;
    // Every active class needs at least one level and stops at MAX_CLASS_LEVEL - 1
    const remaining = targetLevel - mastered * MAX_CLASS_LEVEL;
    if (remaining < active) continue;
    if (remaining > active * (MAX_CLASS_LEVEL - 1)) continue;
    return true;
  }
  return false;
};

/**
 * Highest class count offered by the manual wizard for a target level.
 * Mastered (level 10) classes no longer count towards the active class limit, so
 * a mastered class frees a slot for a brand new one.
 * @param targetLevel - Total level being allocated (5..50)
 * @param catalogSize - Number of classes available in the catalog
 */
export const maxStartingClasses = (targetLevel: number, catalogSize: number): number => {
  const bounded = Math.max(MIN_STARTING_LEVEL, Math.min(MAX_CHARACTER_LEVEL, targetLevel));
  const ceiling = Math.min(catalogSize, MAX_ACTIVE_CLASSES + MAX_CHARACTER_LEVEL / MAX_CLASS_LEVEL);
  for (let count = ceiling; count > 2; count -= 1) {
    if (canAllocateAcrossClasses(count, bounded)) return count;
  }
  return 2;
};

/**
 * Randomly distributes a total level budget across classes, never exceeding
 * `MAX_CLASS_LEVEL` per class and mastering classes before opening new ones.
 * @param classCount - Chosen classes
 * @param targetLevel - Total level to distribute
 * @param random - Injectable random source for deterministic tests
 */
export const distributeStartingLevels = (
  classCount: number,
  targetLevel: number,
  random: RandomSource = defaultRandomSource,
): number[] => {
  const count = Math.max(1, Math.floor(classCount));
  const levels = Array.from({ length: count }, () => 0);
  let remaining = Math.max(0, Math.min(MAX_CHARACTER_LEVEL, Math.floor(targetLevel)));

  // Every chosen class must be invested in at least once.
  for (let index = 0; index < count && remaining > 0; index += 1) {
    levels[index] = 1;
    remaining -= 1;
  }

  while (remaining > 0) {
    const candidates = levels
      .map((level, index) => ({ level, index }))
      .filter((entry) => entry.level > 0 && entry.level < MAX_CLASS_LEVEL);
    if (candidates.length === 0) break;

    // Advancing the most invested class first masters it sooner, which frees a
    // slot in the active (non-mastered) class limit.
    const highest = Math.max(...candidates.map((entry) => entry.level));
    const pool = candidates.filter((entry) => entry.level === highest);
    const chosen = pick(pool, random);
    levels[chosen.index] = (levels[chosen.index] ?? 1) + 1;
    remaining -= 1;
  }

  return levels;
};

/**
 * Whether a manual class level allocation is a legal starting sheet:
 * at least two classes, 1..10 levels each, the exact target total, and no more
 * than three active (non-mastered) classes.
 * @param levels - Levels allocated per chosen class
 * @param targetLevel - Expected total level
 */
export const isLevelAllocationValid = (levels: number[], targetLevel: number): boolean => {
  if (levels.length < 2) return false;
  if (levels.some((level) => level < 1 || level > MAX_CLASS_LEVEL)) return false;
  if (levels.reduce((total, level) => total + level, 0) !== targetLevel) return false;
  return levels.filter((level) => level < MAX_CLASS_LEVEL).length <= MAX_ACTIVE_CLASSES;
};

/**
 * Applies level 20/40 attribute step-ups in the order they were picked,
 * respecting the d12 ceiling.
 * @param attributes - Base attribute dice
 * @param boostedKeys - Attribute keys stepped up, one entry per step
 */
export const applyAttributeBoosts = (
  attributes: AttributeStats,
  boostedKeys: string[],
): AttributeStats =>
  boostedKeys.reduce<AttributeStats>(
    (current, key) => ({ ...current, [key]: stepUpAttribute(current[key] ?? 8) }),
    { ...attributes },
  );

/**
 * Lists every Heroic Power a mastered class can grant: class-specific powers
 * first, then the universal catalog.
 * @param rpgClass - Mastered class
 * @param universalHeroicPowers - Universal Heroic Power catalog
 */
export const heroicPowerOptions = (
  rpgClass: RpgClass,
  universalHeroicPowers: HeroicPower[] = [],
): SelectedHeroicPower[] => {
  const classPowers = (rpgClass.heroicPowers ?? []).map((power) => ({
    power,
    source: rpgClass.name,
  }));
  const universal = universalHeroicPowers.map((power) => ({ power, source: "Universal" }));
  return [...classPowers, ...universal];
};

/**
 * Returns names of classes that have reached Level 10 (Mastered).
 */
export const getMasteredClasses = (classes: SelectedClass[]): string[] =>
  classes.filter((c) => c.level >= 10).map((c) => c.rpgClass.name);

/**
 * Returns names of classes that are active (level > 0) but NOT yet mastered (level < 10).
 */
export const getActiveNonMasteredClasses = (classes: SelectedClass[]): string[] =>
  classes.filter((c) => c.level > 0 && c.level < 10).map((c) => c.rpgClass.name);

/**
 * Checks whether a character can pick up a new class (active non-mastered classes < 3).
 */
export const canOpenNewClass = (classes: SelectedClass[]): boolean =>
  getActiveNonMasteredClasses(classes).length < 3;

/**
 * Step up an attribute die size by 1 step (d6 -> d8 -> d10 -> d12), ceiling at 12.
 */
export const stepUpAttribute = (currentValue: number): number => {
  if (currentValue < 8) return 8;
  if (currentValue < 10) return 10;
  return 12;
};

/**
 * Randomly picks a Heroic Power for a mastered class (or universal).
 */
export const pickRandomHeroicPower = (
  rpgClass: RpgClass,
  universalPowers: HeroicPower[] = [],
  alreadyChosen: SelectedHeroicPower[] = [],
  random: RandomSource = defaultRandomSource,
): SelectedHeroicPower | null => {
  const classPowers = (rpgClass.heroicPowers ?? []).map((hp) => ({
    power: hp,
    source: rpgClass.name,
  }));
  const univPowers = universalPowers.map((hp) => ({
    power: hp,
    source: "Universal",
  }));
  const pool = [...classPowers, ...univPowers].filter(
    (item) => !alreadyChosen.some((c) => c.power.name === item.power.name),
  );
  if (pool.length === 0) return null;
  return pick(pool, random);
};

/**
 * Performs a single level up step on a character sheet (either random or specified choice).
 */
export const levelUpCharacterStep = (
  sheet: CharacterSheet,
  allClasses: RpgClass[],
  strings: LocaleStrings,
  universalHeroicPowers: HeroicPower[] = [],
  targetClassName?: string,
  targetPowerName?: string,
  random: RandomSource = defaultRandomSource,
): CharacterSheet => {
  if (sheet.level >= 50) return sheet;

  const nextLevel = sheet.level + 1;

  // 1. Determine which class gets the level
  let classes = [...sheet.classes];
  let targetClass: RpgClass;

  if (targetClassName) {
    const existingIndex = classes.findIndex((c) => c.rpgClass.name === targetClassName);
    if (existingIndex >= 0) {
      const current = classes[existingIndex]!;
      classes[existingIndex] = { ...current, level: current.level + 1 };
      targetClass = current.rpgClass;
    } else {
      if (!canOpenNewClass(classes)) {
        throw new Error("Cannot open a 4th non-mastered class!");
      }
      const newClassCatalog = allClasses.find((c) => c.name === targetClassName);
      if (!newClassCatalog) throw new Error(`Class ${targetClassName} not found`);
      targetClass = newClassCatalog;
      classes.push({ rpgClass: targetClass, level: 1 });
    }
  } else {
    // Random selection
    const nonMastered = classes.filter((c) => c.level < 10);
    const canOpen = canOpenNewClass(classes);
    const unusedCatalogClasses = allClasses.filter(
      (ac) => !classes.some((c) => c.rpgClass.name === ac.name),
    );

    const choices: Array<{ type: "existing" | "new"; rpgClass: RpgClass }> = [];
    nonMastered.forEach((c) => choices.push({ type: "existing", rpgClass: c.rpgClass }));
    if (canOpen && unusedCatalogClasses.length > 0) {
      choices.push({ type: "new", rpgClass: pick(unusedCatalogClasses, random) });
    }

    const chosen = pick(choices, random);
    targetClass = chosen.rpgClass;
    const existingIndex = classes.findIndex((c) => c.rpgClass.name === targetClass.name);
    if (existingIndex >= 0) {
      const current = classes[existingIndex]!;
      classes[existingIndex] = { ...current, level: current.level + 1 };
    } else {
      classes.push({ rpgClass: targetClass, level: 1 });
    }
  }

  // 2. Power allocation
  let powers = [...sheet.powers];
  const classObj = classes.find((c) => c.rpgClass.name === targetClass.name)!;
  const currentRemaining = classObj.level - ranksForClass(powers, targetClass.name);

  if (currentRemaining > 0) {
    if (targetPowerName) {
      const powerCatalog = targetClass.powers.find((p) => p.name === targetPowerName);
      if (powerCatalog) {
        powers = adjustRank(powers, targetClass.name, powerCatalog, 1, classObj.level);
      }
    } else {
      const eligible = targetClass.powers.filter((p) =>
        canIncrease(p, rankOf(powers, targetClass.name, p.name), currentRemaining),
      );
      if (eligible.length > 0) {
        const pickedPower = pick(eligible, random);
        powers = adjustRank(powers, targetClass.name, pickedPower, 1, classObj.level);
      }
    }
  }

  // 3. Spells selection update if needed
  const bareClasses = classes.map((c) => c.rpgClass);
  const spells = selectSpellsForRanks(powers, bareClasses, (available) => pick(available, random));

  // 4. Check Mastery at Level 10
  let heroicPowers = [...(sheet.heroicPowers ?? [])];
  if (classObj.level === 10) {
    const heroicChoice = pickRandomHeroicPower(
      targetClass,
      universalHeroicPowers,
      heroicPowers,
      random,
    );
    if (heroicChoice) {
      heroicPowers.push(heroicChoice);
    }
  }

  // 5. Attribute Boost at Level 20 or 40
  let attributes = { ...sheet.attributes };
  if (nextLevel === 20 || nextLevel === 40) {
    const attrKeys = strings.attributeOrder.filter(
      (key) => (attributes[key] ?? 8) < 12,
    );
    if (attrKeys.length > 0) {
      const chosenAttrKey = pick(attrKeys, random);
      attributes[chosenAttrKey] = stepUpAttribute(attributes[chosenAttrKey] ?? 8);
    }
  }

  // 6. Recalculate derived stats
  const derivedStats = calculateDerivedStats(
    attributes,
    bareClasses,
    sheet.equipment,
    nextLevel,
    strings,
  );

  return {
    ...sheet,
    level: nextLevel,
    classes,
    powers,
    spells,
    heroicPowers,
    attributes,
    derivedStats,
  };
};

/**
 * Generates a valid character from Level 5 up to Level 50 without touching React, Tauri, or the DOM.
 * @param data - Locale-specific game data
 * @param strings - Locale-specific labels and rules
 * @param targetLevel - Target level between 5 and 50
 * @param random - Injectable random source for deterministic tests
 */
export const generateRandomCharacter = (
  data: CharacterCreationData,
  strings: LocaleStrings,
  targetLevel: number = 5,
  random: RandomSource = defaultRandomSource,
): CharacterSheet => {
  const boundedLevel = Math.max(5, Math.min(50, targetLevel));

  const concept = pick(data.identityTables.concepts, random);
  const adjective = pick(data.identityTables.adjectives, random);
  const detail = pick(data.identityTables.details, random);
  const theme = pick(data.themes, random).name;
  const attributes = assignRandomAttributes(pick(data.attributes.arrays, random).values, strings, random);

  // Generate starting Level 5 base character
  const classCount = Math.floor(random.next() * 2) + 2;
  const pickedClasses = shuffled(data.classes, random).slice(0, classCount);
  const startingLevels = distributeLevels(5, classCount, random);
  const startingSelectedClasses = pickedClasses.map((rpgClass, index) => ({
    rpgClass,
    level: startingLevels[index] ?? 1,
  }));
  const bareClasses = startingSelectedClasses.map(({ rpgClass }) => rpgClass);
  const powers = purchaseRandomPowers(startingSelectedClasses, random);
  const spells = selectSpellsForRanks(powers, bareClasses, (available) => pick(available, random));
  const purchase = selectRandomEquipment(
    data.equipmentCatalog,
    bareClasses,
    data.startingBudget,
    strings.equipmentBenefitPatterns,
  );

  let sheet: CharacterSheet = {
    name: strings.defaults.randomHeroName,
    identity: `${adjective} ${concept} ${detail}`,
    theme,
    level: 5,
    classes: startingSelectedClasses,
    powers,
    spells,
    heroicPowers: [],
    attributes,
    equipment: purchase.equipment,
    derivedStats: calculateDerivedStats(attributes, bareClasses, purchase.equipment, 5, strings),
    equipmentSpent: purchase.equipmentSpent,
    money: purchase.money,
    moneyRoll: purchase.moneyRoll,
  };

  // Level up step by step from level 5 to target level
  while (sheet.level < boundedLevel) {
    sheet = levelUpCharacterStep(
      sheet,
      data.classes,
      strings,
      data.universalHeroicPowers ?? [],
      undefined,
      undefined,
      random,
    );
  }

  return sheet;
};