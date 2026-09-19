import { describe, expect, test } from "bun:test";
import type { ClassPower, SelectedPower, SelectedSpell, Spell } from "../types";
import {
  adjustRank,
  canDecrease,
  canIncrease,
  purchaseRandomPowers,
  remainingPurchases,
  selectSpellsForRanks,
  spellGrantSlots,
  sumRanks,
  trimSpellsForPowerRanks,
} from "./powerRanks";

const setup = () => {
  const tavernTalk: ClassPower = {
    name: "Papo de Taverna",
    maxLevel: 3,
    description: "Gossip",
  };
  const traveler: ClassPower = {
    name: "Viajante Experiente",
    maxLevel: 1,
    description: "Travel",
  };
  const elementalMagic: ClassPower = {
    name: "Magia Elemental",
    maxLevel: 10,
    description: "Spells",
    grantsSpell: true,
  };
  const bolt: Spell = {
    name: "Bolt",
    pmCost: "10",
    target: "One",
    duration: "Instant",
    isOffensive: true,
    mechanics: "Zap",
  };
  const flare: Spell = {
    name: "Flare",
    pmCost: "20",
    target: "One",
    duration: "Instant",
    isOffensive: true,
    mechanics: "Burn",
  };
  const rpgClass = {
    name: "Andarilho",
    description: "Wanderer",
    startingBenefits: [],
    powers: [tavernTalk, traveler],
  };
  return { tavernTalk, traveler, elementalMagic, bolt, flare, rpgClass };
};

describe("powerRanks", () => {
  test("sums remaining purchases against class levels", () => {
    const { tavernTalk, rpgClass } = setup();
    const powers: SelectedPower[] = [{ power: tavernTalk, className: rpgClass.name, rank: 2 }];

    expect(remainingPurchases(3, powers, rpgClass.name)).toBe(1);
    expect(sumRanks(powers)).toBe(2);
  });

  test("refuses ranks above maxLevel or class budget", () => {
    const { tavernTalk, traveler, rpgClass } = setup();
    const stacked = adjustRank([], rpgClass.name, tavernTalk, 1, 2);
    const stackedTwice = adjustRank(stacked, rpgClass.name, tavernTalk, 1, 2);
    const overBudget = adjustRank(stackedTwice, rpgClass.name, tavernTalk, 1, 2);
    const oneShot = adjustRank([], rpgClass.name, traveler, 1, 2);
    const overMax = adjustRank(oneShot, rpgClass.name, traveler, 1, 2);

    expect(canIncrease(tavernTalk, 2, 0)).toBe(false);
    expect(overBudget).toHaveLength(1);
    expect(overBudget[0]?.rank).toBe(2);
    expect(canIncrease(traveler, 1, 1)).toBe(false);
    expect(overMax[0]?.rank).toBe(1);
  });

  test("removes the power when rank drops to zero", () => {
    const { tavernTalk, rpgClass } = setup();
    const owned = adjustRank([], rpgClass.name, tavernTalk, 1, 3);
    const cleared = adjustRank(owned, rpgClass.name, tavernTalk, -1, 3);

    expect(canDecrease(1)).toBe(true);
    expect(owned).toHaveLength(1);
    expect(cleared).toHaveLength(0);
  });

  test("trims extra spells when a grantsSpell rank drops", () => {
    const { elementalMagic, bolt, flare } = setup();
    const powers: SelectedPower[] = [{ power: elementalMagic, className: "Elementalista", rank: 1 }];
    const spells: SelectedSpell[] = [
      { spell: bolt, className: "Elementalista", grantedByPower: "Magia Elemental", grantIndex: 0 },
      { spell: flare, className: "Elementalista", grantedByPower: "Magia Elemental", grantIndex: 1 },
    ];

    const trimmed = trimSpellsForPowerRanks(spells, powers);

    expect(trimmed).toHaveLength(1);
    expect(trimmed[0]?.grantIndex).toBe(0);
    expect(spellGrantSlots(powers)).toHaveLength(1);
  });

  test("random purchases can stack a power above rank 1 without exceeding maxLevel", () => {
    const { rpgClass } = setup();
    const powers = purchaseRandomPowers([{ rpgClass, level: 3 }], { next: () => 0 });

    expect(sumRanks(powers)).toBe(3);
    expect(powers.some((entry) => entry.rank > 1)).toBe(true);
    expect(powers.every((entry) => entry.rank <= entry.power.maxLevel)).toBe(true);
    expect(new Set(powers.map((entry) => `${entry.className}:${entry.power.name}`)).size).toBe(
      powers.length,
    );
  });

  test("selects one unique spell per grantsSpell rank", () => {
    const { elementalMagic, bolt, flare } = setup();
    const caster = {
      name: "Elementalista",
      description: "Caster",
      startingBenefits: [],
      powers: [elementalMagic],
      spells: [bolt, flare],
    };
    const powers: SelectedPower[] = [{ power: elementalMagic, className: caster.name, rank: 2 }];
    const spells = selectSpellsForRanks(powers, [caster], (pool) => pool[0]!);

    expect(spells).toHaveLength(2);
    expect(spells.map((entry) => entry.spell.name)).toEqual(["Bolt", "Flare"]);
    expect(spells.map((entry) => entry.grantIndex)).toEqual([0, 1]);
  });
});
