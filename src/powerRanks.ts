import type {
  ClassPower,
  RpgClass,
  SelectedClass,
  SelectedPower,
  SelectedSpell,
  Spell,
} from "./types.ts";

/** Injectable random source used when purchasing stacked ranks. */
export interface RankRandomSource {
  next: () => number;
}

/** Identifies one spell pick owed by a ranked `grantsSpell` power. */
export interface SpellGrantSlot {
  className: string;
  powerName: string;
  grantIndex: number;
}

/**
 * Returns the current rank of a named power for a class, or 0 if unowned.
 * @param powers - Collapsed selected powers
 * @param className - Class that owns the power
 * @param powerName - Catalog power name
 */
export const rankOf = (powers: SelectedPower[], className: string, powerName: string): number =>
  powers.find((entry) => entry.className === className && entry.power.name === powerName)?.rank ?? 0;

/**
 * Sums every power rank on the sheet (total class-level purchases spent).
 * @param powers - Collapsed selected powers
 */
export const sumRanks = (powers: SelectedPower[]): number =>
  powers.reduce((total, entry) => total + entry.rank, 0);

/**
 * Sums ranks belonging to a single class.
 * @param powers - Collapsed selected powers
 * @param className - Class to total
 */
export const ranksForClass = (powers: SelectedPower[], className: string): number =>
  sumRanks(powers.filter((entry) => entry.className === className));

/**
 * Returns how many purchases a class still has to spend.
 * @param classLevel - Levels invested in the class
 * @param powers - Collapsed selected powers
 * @param className - Class to inspect
 */
export const remainingPurchases = (
  classLevel: number,
  powers: SelectedPower[],
  className: string,
): number => classLevel - ranksForClass(powers, className);

/**
 * Whether a power rank can increase given remaining purchases and maxLevel.
 * @param power - Catalog power
 * @param currentRank - Rank already owned (0 if none)
 * @param remaining - Purchases still unspent for the class
 */
export const canIncrease = (power: ClassPower, currentRank: number, remaining: number): boolean =>
  remaining > 0 && currentRank < power.maxLevel;

/**
 * Whether a power rank can decrease.
 * @param currentRank - Rank already owned
 */
export const canDecrease = (currentRank: number): boolean => currentRank > 0;

/**
 * Increments or decrements a power rank, removing the entry at rank 0.
 * @param powers - Collapsed selected powers
 * @param className - Class that owns the power
 * @param power - Catalog power being adjusted
 * @param delta - +1 or -1
 * @param classLevel - Levels invested in the class (budget)
 */
export const adjustRank = (
  powers: SelectedPower[],
  className: string,
  power: ClassPower,
  delta: number,
  classLevel: number,
): SelectedPower[] => {
  const current = rankOf(powers, className, power.name);
  const remaining = remainingPurchases(classLevel, powers, className);
  const isIllegalIncrease = delta > 0 && !canIncrease(power, current, remaining);
  const isIllegalDecrease = delta < 0 && !canDecrease(current);
  if (isIllegalIncrease || isIllegalDecrease) {
    return powers;
  }

  const nextRank = current + delta;
  const without = powers.filter(
    (entry) => !(entry.className === className && entry.power.name === power.name),
  );
  return nextRank <= 0 ? without : [...without, { power, className, rank: nextRank }];
};

/**
 * Drops spell slots whose grantIndex no longer fits the owning power's rank.
 * @param spells - Selected spells
 * @param powers - Collapsed selected powers after a rank change
 */
export const trimSpellsForPowerRanks = (
  spells: SelectedSpell[],
  powers: SelectedPower[],
): SelectedSpell[] =>
  spells.filter((spell) => {
    const owner = powers.find(
      (entry) => entry.className === spell.className && entry.power.name === spell.grantedByPower,
    );
    return owner !== undefined && spell.grantIndex < owner.rank;
  });

/**
 * Expands ranked spell-granting powers into one slot per NP.
 * @param powers - Collapsed selected powers
 */
export const spellGrantSlots = (powers: SelectedPower[]): SpellGrantSlot[] =>
  powers
    .filter(({ power }) => power.grantsSpell === true)
    .flatMap(({ power, className, rank }) =>
      Array.from({ length: rank }, (_, grantIndex) => ({
        className,
        powerName: power.name,
        grantIndex,
      })),
    );

/**
 * True when every class has spent all of its power purchases.
 * @param classes - Selected classes with levels
 * @param powers - Collapsed selected powers
 */
export const areClassPowerBudgetsSpent = (
  classes: SelectedClass[],
  powers: SelectedPower[],
): boolean =>
  classes.every(({ rpgClass, level }) => remainingPurchases(level, powers, rpgClass.name) === 0);

/**
 * Spends each class level as a sequential purchase among powers below maxLevel.
 * @param classes - Selected classes with levels
 * @param random - Source of [0, 1) draws
 */
export const purchaseRandomPowers = (
  classes: SelectedClass[],
  random: RankRandomSource,
): SelectedPower[] =>
  classes.reduce<SelectedPower[]>((all, { rpgClass, level }) => {
    const forClass = Array.from({ length: level }).reduce<SelectedPower[]>((powers) => {
      const remaining = remainingPurchases(level, powers, rpgClass.name);
      const eligible = rpgClass.powers.filter((power) =>
        canIncrease(power, rankOf(powers, rpgClass.name, power.name), remaining),
      );
      if (eligible.length === 0) {
        return powers;
      }
      const index = Math.floor(random.next() * eligible.length);
      const picked = eligible[index] ?? eligible[0];
      if (picked === undefined) {
        return powers;
      }
      return adjustRank(powers, rpgClass.name, picked, 1, level);
    }, []);
    return [...all, ...forClass];
  }, []);

/**
 * Fills one distinct spell per grant slot, repeating only if the catalog is exhausted.
 * @param powers - Collapsed selected powers
 * @param classes - Class catalog (spell lists)
 * @param pick - Chooses one spell from a non-empty pool
 */
export const selectSpellsForRanks = (
  powers: SelectedPower[],
  classes: RpgClass[],
  pick: (spells: Spell[]) => Spell,
): SelectedSpell[] =>
  spellGrantSlots(powers).reduce<SelectedSpell[]>((selected, slot) => {
    const rpgClass = classes.find((entry) => entry.name === slot.className);
    const available = rpgClass?.spells ?? [];
    if (available.length === 0) {
      return selected;
    }
    const unlearned = available.filter(
      (spell) => !selected.some((entry) => entry.spell.name === spell.name),
    );
    const pool = unlearned.length > 0 ? unlearned : available;
    const spell = pick(pool);
    return [
      ...selected,
      {
        spell,
        className: slot.className,
        grantedByPower: slot.powerName,
        grantIndex: slot.grantIndex,
      },
    ];
  }, []);
