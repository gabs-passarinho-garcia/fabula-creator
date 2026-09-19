import { describe, expect, test } from "bun:test";
import { getGameData, getLocaleStrings } from "../i18n";
import {
  applyAttributeBoosts,
  attributeBoostCountForLevel,
  canOpenNewClass,
  distributeStartingLevels,
  generateRandomCharacter,
  getActiveNonMasteredClasses,
  heroicPowerOptions,
  isLevelAllocationValid,
  levelUpCharacterStep,
  MAX_CHARACTER_LEVEL,
  MAX_CLASS_LEVEL,
  maxStartingClasses,
  MIN_STARTING_LEVEL,
  stepUpAttribute,
} from "./characterCreation";
import { purchaseRandomPowers, selectSpellsForRanks, sumRanks } from "./powerRanks";

const setup = () => {
  const values = Array.from({ length: 128 }, (_, index) => (index % 10) / 10);
  let cursor = 0;
  return {
    data: getGameData("pt"),
    strings: getLocaleStrings("pt"),
    random: { next: () => values[cursor++ % values.length] ?? 0 },
  };
};

describe("generateRandomCharacter", () => {
  test("creates a level-five sheet whose power ranks sum to five", () => {
    const { data, strings, random } = setup();
    const sheet = generateRandomCharacter(data, strings, 5, random);
    const uniqueKeys = new Set(sheet.powers.map((entry) => `${entry.className}:${entry.power.name}`));

    expect(sheet.classes.length).toBeGreaterThanOrEqual(2);
    expect(sheet.classes.length).toBeLessThanOrEqual(3);
    expect(sheet.classes.reduce((total, selected) => total + selected.level, 0)).toBe(5);
    expect(sumRanks(sheet.powers)).toBe(5);
    expect(uniqueKeys.size).toBe(sheet.powers.length);
    expect(sheet.powers.every((entry) => entry.rank <= entry.power.maxLevel)).toBe(true);
    expect(sheet.powers.every((entry) => entry.power.maxLevel >= 1)).toBe(true);
    expect(sheet.name).toBe(strings.defaults.randomHeroName);
    expect(sheet.equipment.weapons.length).toBeGreaterThan(0);
  });

  test("can stack a power above rank 1 and grant one spell per rank", () => {
    const { data } = setup();
    const elementalista = data.classes.find((rpgClass) => rpgClass.name === "Elementalista");
    expect(elementalista).toBeDefined();
    if (elementalista === undefined) {
      return;
    }

    const powers = purchaseRandomPowers([{ rpgClass: elementalista, level: 2 }], { next: () => 0 });
    const magic = powers.find((entry) => entry.power.grantsSpell);
    const spells = selectSpellsForRanks(powers, [elementalista], (pool) => pool[0]!);

    expect(sumRanks(powers)).toBe(2);
    expect(powers.some((entry) => entry.rank > 1) || (magic !== undefined && magic.rank >= 1)).toBe(true);
    expect(spells).toHaveLength(magic?.rank ?? 0);
    expect(new Set(spells.map((entry) => entry.spell.name)).size).toBe(spells.length);
  });

  test("generates level 25 character respecting active non-mastered limit and granting heroic powers", () => {
    const { data, strings, random } = setup();
    const sheet = generateRandomCharacter(data, strings, 25, random);

    expect(sheet.level).toBe(25);
    expect(sheet.classes.reduce((acc, c) => acc + c.level, 0)).toBe(25);
    expect(sumRanks(sheet.powers)).toBe(25);

    // Active non-mastered classes must never exceed 3
    const activeNonMastered = getActiveNonMasteredClasses(sheet.classes);
    expect(activeNonMastered.length).toBeLessThanOrEqual(3);

    // Any class at level 10 grants a heroic power
    const masteredCount = sheet.classes.filter((c) => c.level >= 10).length;
    expect(sheet.heroicPowers?.length ?? 0).toBe(masteredCount);
  });

  test("stepUpAttribute increases attribute die size correctly up to d12", () => {
    expect(stepUpAttribute(6)).toBe(8);
    expect(stepUpAttribute(8)).toBe(10);
    expect(stepUpAttribute(10)).toBe(12);
    expect(stepUpAttribute(12)).toBe(12);
  });

  test("prevents opening a 4th non-mastered class", () => {
    const { data } = setup();
    const mockClasses = [
      { rpgClass: data.classes[0]!, level: 4 },
      { rpgClass: data.classes[1]!, level: 3 },
      { rpgClass: data.classes[2]!, level: 2 },
    ];
    expect(canOpenNewClass(mockClasses)).toBe(false);

    // If one of them becomes level 10, it's mastered and allows a new class
    mockClasses[0]!.level = 10;
    expect(canOpenNewClass(mockClasses)).toBe(true);
  });
});

describe("manual high level allocation", () => {
  test("offers more classes as the starting level grows", () => {
    expect(maxStartingClasses(5, 15)).toBe(3);
    // A mastered class frees an active slot, so level 20 fits four classes
    expect(maxStartingClasses(20, 15)).toBe(4);
    expect(maxStartingClasses(25, 15)).toBe(5);
    expect(maxStartingClasses(31, 15)).toBe(5);
    expect(maxStartingClasses(50, 15)).toBe(7);
    // Catalog size always caps the offer
    expect(maxStartingClasses(20, 2)).toBe(2);
    // Unsatisfiable pair falls back to the minimum
    expect(maxStartingClasses(50, 3)).toBe(2);
  });

  test("every offered class count can absorb the level budget", () => {
    const { random } = setup();
    for (let target = MIN_STARTING_LEVEL; target <= MAX_CHARACTER_LEVEL; target += 1) {
      const max = maxStartingClasses(target, 15);
      const levels = distributeStartingLevels(max, target, random);

      expect(levels).toHaveLength(max);
      expect(isLevelAllocationValid(levels, target)).toBe(true);
      // Mastered classes free slots, so higher targets must accept more than three
      if (target >= 20) expect(max).toBeGreaterThan(3);
    }
  });

  test("accepts only allocations within the class caps and active class limit", () => {
    expect(isLevelAllocationValid([10, 10, 5], 25)).toBe(true);
    expect(isLevelAllocationValid([10, 10, 10, 10], 40)).toBe(true);
    expect(isLevelAllocationValid([10, 10, 9, 1], 30)).toBe(true);
    // 5 non-mastered classes
    expect(isLevelAllocationValid([1, 1, 1, 1, 1], 5)).toBe(false);
    // wrong total, over the class cap, and fewer than two classes
    expect(isLevelAllocationValid([10, 10, 10, 10, 10], 40)).toBe(false);
    expect(isLevelAllocationValid([11, 1], 12)).toBe(false);
    expect(isLevelAllocationValid([5], 5)).toBe(false);
    expect(isLevelAllocationValid([], 5)).toBe(false);
  });

  test("distributes the budget respecting the level 10 class cap", () => {
    const { data, strings, random } = setup();
    const levels = distributeStartingLevels(3, 25, random);

    expect(levels).toHaveLength(3);
    expect(levels.reduce((total, level) => total + level, 0)).toBe(25);
    expect(levels.every((level) => level >= 1 && level <= MAX_CLASS_LEVEL)).toBe(true);
    expect(isLevelAllocationValid(levels, 25)).toBe(true);

    // Two level-10 classes cannot reach level 50 by themselves
    const lowCount = distributeStartingLevels(2, 50, random);
    expect(lowCount.reduce((total, level) => total + level, 0)).toBe(20);
    expect(isLevelAllocationValid(lowCount, 50)).toBe(false);
    expect(data.classes.length).toBeGreaterThan(0);
    expect(strings.attributeOrder.length).toBeGreaterThan(0);
  });

  test("counts and applies level 20/40 attribute boosts", () => {
    expect(attributeBoostCountForLevel(19)).toBe(0);
    expect(attributeBoostCountForLevel(20)).toBe(1);
    expect(attributeBoostCountForLevel(39)).toBe(1);
    expect(attributeBoostCountForLevel(40)).toBe(2);
    expect(attributeBoostCountForLevel(50)).toBe(2);

    expect(applyAttributeBoosts({ DES: 8, VIG: 6 }, ["DES", "DES"])).toEqual({ DES: 12, VIG: 6 });
    expect(applyAttributeBoosts({ DES: 6, VIG: 12 }, ["DES", "VIG"])).toEqual({ DES: 8, VIG: 12 });
    // The d12 ceiling is respected even with extra picks
    expect(applyAttributeBoosts({ DES: 12 }, ["DES"])).toEqual({ DES: 12 });
  });

  test("lists class and universal heroic powers for a mastered class", () => {
    const { data, strings } = setup();
    const rpgClass = data.classes.find((entry) => (entry.heroicPowers?.length ?? 0) > 0);
    expect(rpgClass).toBeDefined();
    if (rpgClass === undefined) return;

    const universals = data.universalHeroicPowers ?? [];
    const options = heroicPowerOptions(rpgClass, universals);

    expect(options).toHaveLength((rpgClass.heroicPowers?.length ?? 0) + universals.length);
    expect(options.slice(0, rpgClass.heroicPowers?.length ?? 0).every((entry) => entry.source === rpgClass.name)).toBe(true);
    expect(options.slice(-universals.length).every((entry) => entry.source === "Universal")).toBe(true);
    expect(strings.attributeOrder.length).toBeGreaterThan(0);
  });

  test("leveling a class to 10 grants exactly one heroic power", () => {
    const { data, strings, random } = setup();
    const base = generateRandomCharacter(data, strings, 5, random);
    const targetClass = base.classes[0]!.rpgClass.name;

    let sheet = base;
    while ((sheet.classes.find((entry) => entry.rpgClass.name === targetClass)?.level ?? 0) < MAX_CLASS_LEVEL) {
      sheet = levelUpCharacterStep(sheet, data.classes, strings, data.universalHeroicPowers ?? [], targetClass, undefined, random);
    }

    expect(sheet.classes.find((entry) => entry.rpgClass.name === targetClass)?.level).toBe(MAX_CLASS_LEVEL);
    expect(sheet.heroicPowers).toHaveLength(1);
    expect(sheet.level).toBeGreaterThan(base.level);
  });
});

