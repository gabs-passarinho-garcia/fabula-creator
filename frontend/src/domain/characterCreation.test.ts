import { describe, expect, test } from "bun:test";
import { getGameData, getLocaleStrings } from "../i18n";
import { generateRandomCharacter } from "./characterCreation";
import { purchaseRandomPowers, selectSpellsForRanks, sumRanks } from "./powerRanks";

const setup = () => {
  const values = Array.from({ length: 64 }, (_, index) => (index % 10) / 10);
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
    const sheet = generateRandomCharacter(data, strings, random);
    const uniqueKeys = new Set(sheet.powers.map((entry) => `${entry.className}:${entry.power.name}`));

    expect(sheet.classes.length).toBeGreaterThanOrEqual(1);
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
});
