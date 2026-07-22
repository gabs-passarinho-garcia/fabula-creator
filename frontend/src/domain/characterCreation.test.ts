import { describe, expect, test } from "bun:test";
import { getGameData, getLocaleStrings } from "../i18n";
import { generateRandomCharacter } from "./characterCreation";

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
  test("creates a level-five sheet with one power per level", () => {
    const { data, strings, random } = setup();
    const sheet = generateRandomCharacter(data, strings, random);

    expect(sheet.classes.length).toBeGreaterThanOrEqual(1);
    expect(sheet.classes.length).toBeLessThanOrEqual(3);
    expect(sheet.classes.reduce((total, selected) => total + selected.level, 0)).toBe(5);
    expect(sheet.powers.length).toBe(5);
    expect(sheet.name).toBe(strings.defaults.randomHeroName);
    expect(sheet.equipment.weapons.length).toBeGreaterThan(0);
  });
});