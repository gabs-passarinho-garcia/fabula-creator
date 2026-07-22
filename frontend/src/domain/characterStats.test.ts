import { describe, expect, test } from "bun:test";
import { getGameData, getLocaleStrings } from "../i18n";
import { calculateDerivedStats } from "./characterStats";
import type { CharacterEquipment } from "../types";

const strings = getLocaleStrings("pt");
const data = getGameData("pt");

const setup = (): { equipment: CharacterEquipment } => ({
  equipment: {
    weapons: [],
    armor: { name: "Armor", baseDefense: 2, baseMagicDefense: 1, initiativePenalty: 1, isEquipped: true },
    shield: { name: "Shield", defenseBonus: 3, magicDefenseBonus: 2, isEquipped: true },
  },
});

describe("calculateDerivedStats", () => {
  test("adds armor and shield bonuses without duplicating base defense", () => {
    const { equipment } = setup();
    const result = calculateDerivedStats(
      { DES: 8, VIG: 8, AST: 8, VON: 8 },
      [],
      equipment,
      5,
      strings,
    );

    expect(result.defense).toBe(13);
    expect(result.magicDefense).toBe(11);
    expect(result.initiative).toBe(-1);
  });

  test("applies each class benefit once", () => {
    const classes = data.classes.filter((rpgClass) =>
      rpgClass.startingBenefits.some((benefit) => strings.benefitPatterns.hp.test(benefit)),
    ).slice(0, 2);
    const result = calculateDerivedStats(
      { DES: 8, VIG: 8, AST: 8, VON: 8 },
      classes,
      { weapons: [] },
      5,
      strings,
    );

    expect(result.hp).toBe(45 + classes.length * 5);
  });
});