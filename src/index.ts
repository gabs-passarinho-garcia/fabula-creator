import { intro, outro, select, text, isCancel, cancel, spinner } from '@clack/prompts';
import pc from 'picocolors';
import sample from 'lodash/sample';
import sampleSize from 'lodash/sampleSize';
import shuffle from 'lodash/shuffle';
import { getGameData, getLocaleStrings, type Locale, type LocaleStrings } from './i18n/index.ts';
import {
  NONE_EQUIPMENT,
  buildEquipmentPurchaseResult,
  deriveEquipmentPermissions,
  filterCatalogByPermissions,
  formatEquipmentOptionLabel,
  selectRandomEquipment,
} from './equipment.ts';
import type {
  AttributeStats,
  CharacterCreationData,
  CharacterEquipment,
  CharacterSheet,
  ClassPower,
  DerivedStats,
  EquipmentCatalog,
  EquipmentPurchaseResult,
  RpgClass,
  SelectedClass,
  SelectedPower,
  SelectedSpell,
  Spell,
  Weapon,
} from './types.ts';

interface DieSlot {
  id: string;
  value: number;
  label: string;
}

const STARTING_CLASS_LEVELS = 5;
const MIN_CLASSES = 1;
const MAX_CLASSES = 3;

/**
 * Exits if the prompt was cancelled; otherwise returns the narrowed value.
 * @param value - The value returned by a Clack prompt
 * @param strings - Active locale strings for the cancel message
 */
const assertNotCancelled = <T>(value: T | symbol, strings: LocaleStrings): T => {
  if (isCancel(value)) {
    cancel(strings.cancelMessage);
    process.exit(0);
  }
  return value;
};

/**
 * Awaits a Clack prompt and narrows its result after cancel handling.
 * @param prompt - Pending Clack prompt
 * @param strings - Active locale strings for the cancel message
 */
const awaitPrompt = async <T>(
  prompt: Promise<T | symbol>,
  strings: LocaleStrings,
): Promise<T> => assertNotCancelled(await prompt, strings);

/**
 * Prompts the user to choose the application language.
 */
const promptLocale = async (): Promise<Locale> => {
  const selection = await select({
    message: 'Choose your language / Escolha o idioma:',
    options: [
      { value: 'pt' as const, label: 'Português (BR)' },
      { value: 'en' as const, label: 'English' },
    ],
  });

  if (isCancel(selection)) {
    cancel('Character creation aborted. / Criação de personagem cancelada.');
    process.exit(0);
  }

  return selection as Locale;
};

/**
 * Parses a dice profile string into numeric die sizes.
 * @param diceString - The string containing dice values (e.g. "d8, d8, d10, d6")
 */
const parseDicePool = (diceString: string): number[] =>
  diceString.split(', ').map((d) => Number.parseInt(d.replace('d', ''), 10));

/**
 * Builds selectable die slots with distinct labels when duplicates exist.
 * @param diceValues - Parsed die sizes from an attribute profile
 */
const createLabeledDieSlots = (diceValues: number[]): DieSlot[] => {
  const valueTotals = diceValues.reduce<Map<number, number>>((acc, value) => {
    acc.set(value, (acc.get(value) ?? 0) + 1);
    return acc;
  }, new Map());

  const valueOccurrence = new Map<number, number>();

  return diceValues.map((value, index) => {
    const occurrence = (valueOccurrence.get(value) ?? 0) + 1;
    valueOccurrence.set(value, occurrence);
    const hasDuplicates = (valueTotals.get(value) ?? 0) > 1;
    const label = hasDuplicates ? `d${value} (${occurrence})` : `d${value}`;

    return { id: `die-${index}`, value, label };
  });
};

/**
 * Formats remaining dice for prompt context.
 * @param dice - Dice slots still available for assignment
 */
const formatRemainingDice = (dice: DieSlot[]): string =>
  dice.map((die) => die.label).join(', ');

/**
 * Randomly shuffles dice from a profile and assigns them to attributes.
 * @param diceString - The string containing dice values (e.g. "d8, d8, d10, d6")
 * @param strings - Active locale strings for attribute order
 */
const assignAttributesRandomly = (diceString: string, strings: LocaleStrings): AttributeStats => {
  const shuffledDice = shuffle(parseDicePool(diceString));

  return strings.attributeOrder.reduce<AttributeStats>((attributes, attributeKey, index) => {
    attributes[attributeKey] = shuffledDice[index] ?? 8;
    return attributes;
  }, {});
};

interface ManualAttributeAssignment {
  dice: DieSlot[];
  attributes: AttributeStats;
}

/**
 * Prompts the user to manually assign each die to an attribute, sequentially.
 * @param diceString - The string containing dice values (e.g. "d8, d8, d10, d6")
 * @param strings - Active locale strings for prompts and attribute order
 */
const assignAttributesManually = async (
  diceString: string,
  strings: LocaleStrings,
): Promise<AttributeStats> => {
  const initialDice = createLabeledDieSlots(parseDicePool(diceString));

  const { attributes } = await strings.attributeOrder.reduce(
    async (accPromise, attributeKey) => {
      const acc = await accPromise;
      const attributeLabel = strings.attributeLabels[attributeKey] ?? attributeKey;
      const remaining = formatRemainingDice(acc.dice);

      const selection = await awaitPrompt(
        select({
          message: strings.prompts.assignDie(attributeLabel, remaining),
          options: acc.dice.map((die) => ({ value: die.id, label: die.label })),
        }),
        strings,
      );

      const chosenIndex = acc.dice.findIndex((die) => die.id === selection);
      const chosenDie = acc.dice[chosenIndex];
      const remainingDice = acc.dice.filter((_, index) => index !== chosenIndex);

      return {
        dice: remainingDice,
        attributes: { ...acc.attributes, [attributeKey]: chosenDie?.value ?? 8 },
      };
    },
    Promise.resolve<ManualAttributeAssignment>({ dice: initialDice, attributes: {} }),
  );

  return attributes;
};

/**
 * Reads an attribute value from stats using the locale-specific key.
 * @param attributes - Character attribute dice sizes
 * @param key - Attribute key for the active locale
 */
const getAttributeValue = (attributes: AttributeStats, key: string): number =>
  attributes[key] ?? 8;

/**
 * Derives the combat stats based on level, attributes, class benefits, and equipment.
 * @param attributes - Character attribute dice sizes
 * @param classes - Selected RPG classes
 * @param equipment - Starting equipment loadout
 * @param level - Character level
 * @param strings - Active locale strings for stat mapping and benefit patterns
 */
const calculateDerivedStats = (
  attributes: AttributeStats,
  classes: RpgClass[],
  equipment: CharacterEquipment,
  level: number,
  strings: LocaleStrings,
): DerivedStats => {
  const { benefitPatterns, statMapping } = strings;

  const hpBonus = classes.reduce(
    (acc, c) => acc + (c.startingBenefits.some((b) => benefitPatterns.hp.test(b)) ? 5 : 0),
    0,
  );
  const mpBonus = classes.reduce(
    (acc, c) => acc + (c.startingBenefits.some((b) => benefitPatterns.mp.test(b)) ? 5 : 0),
    0,
  );
  const ipBonus = classes.reduce(
    (acc, c) => acc + (c.startingBenefits.some((b) => benefitPatterns.ip.test(b)) ? 2 : 0),
    0,
  );

  const baseDef = (equipment.armor?.baseDefense ?? 0) + getAttributeValue(attributes, statMapping.defense);
  const baseMDef =
    (equipment.armor?.baseMagicDefense ?? 0) + getAttributeValue(attributes, statMapping.magicDefense);
  const shieldDef = equipment.shield?.isEquipped ? equipment.shield.defenseBonus + baseDef : 0;
  const shieldMDef = equipment.shield?.isEquipped ? equipment.shield.magicDefenseBonus + baseMDef : 0;
  const armorInitiativePenalty = equipment.armor?.initiativePenalty ?? 0;

  return {
    hp: level + getAttributeValue(attributes, statMapping.hp) * 5 + hpBonus,
    mp: level + getAttributeValue(attributes, statMapping.mp) * 5 + mpBonus,
    ip: 6 + ipBonus,
    defense: baseDef + shieldDef,
    magicDefense: baseMDef + shieldMDef,
    initiative: 0 - armorInitiativePenalty,
  };
};

/**
 * Randomly distributes starting class levels among the given number of classes,
 * guaranteeing at least one level per class and a total of five levels.
 * @param classCount - Number of classes (1–3)
 */
const distributeLevelsRandomly = (classCount: number): number[] => {
  const levels = Array.from({ length: classCount }, () => 1);
  let remaining = STARTING_CLASS_LEVELS - classCount;

  while (remaining > 0) {
    const index = Math.floor(Math.random() * classCount);
    levels[index] = (levels[index] ?? 1) + 1;
    remaining -= 1;
  }

  return levels;
};

/**
 * Pairs each RPG class with its assigned starting level.
 * @param classes - Selected RPG classes in order
 * @param levels - Level allocation aligned with `classes`
 */
const buildSelectedClasses = (classes: RpgClass[], levels: number[]): SelectedClass[] =>
  classes.map((rpgClass, index) => ({
    rpgClass,
    level: levels[index] ?? 1,
  }));

/**
 * Extracts bare RPG class definitions from a selected-class list.
 * @param selectedClasses - Classes with level allocations
 */
const extractRpgClasses = (selectedClasses: SelectedClass[]): RpgClass[] =>
  selectedClasses.map(({ rpgClass }) => rpgClass);

/**
 * Randomly selects powers for a level 5 character based on their classes,
 * tagging each one with its source class name for later grouping/display.
 * @param selectedClasses - Selected RPG classes with level allocations
 */
const selectPowers = (selectedClasses: SelectedClass[]): SelectedPower[] =>
  selectedClasses.flatMap(({ rpgClass, level }) =>
    sampleSize(rpgClass.powers, level).map((power) => ({
      power,
      className: rpgClass.name,
    })),
  );

/**
 * Formats a power as a selectable prompt option, truncating its description.
 * @param power - Class power to format
 */
const formatPowerOptionLabel = (power: ClassPower): string => {
  const truncatedDesc =
    power.description.length > 60 ? `${power.description.substring(0, 60)}...` : power.description;
  return `${power.name} ${pc.dim(`- ${truncatedDesc}`)}`;
};

/**
 * Prompts the user to manually select powers for their chosen classes,
 * picking one unique power per invested class level.
 * @param selectedClasses - Selected RPG classes with level allocations
 * @param strings - Active locale strings
 */
const promptPowerSelection = async (
  selectedClasses: SelectedClass[],
  strings: LocaleStrings,
): Promise<SelectedPower[]> =>
  selectedClasses.reduce<Promise<SelectedPower[]>>(async (allPowersPromise, { rpgClass, level }) => {
    const allPowers = await allPowersPromise;
    const availablePowers = rpgClass.powers;

    const selectedForClass = await Array.from({ length: level }).reduce<Promise<SelectedPower[]>>(
      async (classPowersPromise, _, index) => {
        const classPowers = await classPowersPromise;
        const pickedNames = new Set(classPowers.map((p) => p.power.name));
        const options = availablePowers.filter((p) => !pickedNames.has(p.name));
        const remaining = level - index;

        const powerName = await awaitPrompt(
          select({
            message: strings.prompts.selectPower(rpgClass.name, remaining),
            options: options.map((p) => ({
              value: p.name,
              label: formatPowerOptionLabel(p),
            })),
          }),
          strings,
        );

        const power = options.find((p) => p.name === powerName)!;
        return [...classPowers, { power, className: rpgClass.name }];
      },
      Promise.resolve([]),
    );

    return [...allPowers, ...selectedForClass];
  }, Promise.resolve([]));

/**
 * Prompts the user to choose how many classes they want (1–3).
 * @param strings - Active locale strings
 */
const promptClassCount = async (strings: LocaleStrings): Promise<number> =>
  awaitPrompt(
    select({
      message: strings.prompts.classCount,
      options: Array.from({ length: MAX_CLASSES }, (_, index) => {
        const count = index + MIN_CLASSES;
        return { value: count, label: String(count) };
      }),
    }),
    strings,
  );

/**
 * Prompts the user to pick distinct classes sequentially.
 * @param availableClasses - Full class catalog for the active locale
 * @param classCount - Number of classes to pick
 * @param strings - Active locale strings
 */
const promptClassSelection = async (
  availableClasses: RpgClass[],
  classCount: number,
  strings: LocaleStrings,
): Promise<RpgClass[]> =>
  Array.from({ length: classCount }).reduce<Promise<RpgClass[]>>(async (accPromise, _, index) => {
    const selected = await accPromise;
    const pickedNames = new Set(selected.map((rpgClass) => rpgClass.name));
    const options = availableClasses.filter((rpgClass) => !pickedNames.has(rpgClass.name));

    const className = await awaitPrompt(
      select({
        message: strings.prompts.selectClass(index + 1, classCount),
        options: options.map((rpgClass) => ({ value: rpgClass.name, label: rpgClass.name })),
      }),
      strings,
    );

    const rpgClass = options.find((entry) => entry.name === className)!;
    return [...selected, rpgClass];
  }, Promise.resolve([]));

/**
 * Prompts the user to distribute five starting levels across chosen classes.
 * @param classes - Selected RPG classes in order
 * @param strings - Active locale strings
 */
const promptLevelDistribution = async (
  classes: RpgClass[],
  strings: LocaleStrings,
): Promise<number[]> => {
  if (classes.length === 1) {
    return [STARTING_CLASS_LEVELS];
  }

  const levels: number[] = [];
  let remaining = STARTING_CLASS_LEVELS;

  for (let index = 0; index < classes.length - 1; index += 1) {
    const rpgClass = classes[index];
    if (!rpgClass) continue;

    const classesRemaining = classes.length - index;
    const min = 1;
    const max = remaining - (classesRemaining - 1);
    const options = Array.from({ length: max - min + 1 }, (_, optionIndex) => min + optionIndex);

    const level = await awaitPrompt(
      select({
        message: strings.prompts.assignClassLevel(rpgClass.name, remaining, min, max),
        options: options.map((value) => ({ value, label: String(value) })),
      }),
      strings,
    );

    levels.push(level);
    remaining -= level;
  }

  levels.push(remaining);
  return levels;
};

/**
 * Runs the full manual class-selection flow: count, pick, distribute levels.
 * @param availableClasses - Full class catalog for the active locale
 * @param strings - Active locale strings
 */
const promptSelectedClasses = async (
  availableClasses: RpgClass[],
  strings: LocaleStrings,
): Promise<SelectedClass[]> => {
  const classCount = await promptClassCount(strings);
  const pickedClasses = await promptClassSelection(availableClasses, classCount, strings);
  const levels = await promptLevelDistribution(pickedClasses, strings);
  return buildSelectedClasses(pickedClasses, levels);
};

/**
 * Prompts the user to pick one spell for each spell-granting power they own,
 * used in the step-by-step manual character creation flow.
 * @param selectedPowers - Powers already chosen for the character
 * @param classes - Selected RPG classes (source of each class's spell list)
 * @param strings - Active locale strings
 */
const promptSpellSelection = async (
  selectedPowers: SelectedPower[],
  classes: RpgClass[],
  strings: LocaleStrings,
): Promise<SelectedSpell[]> => {
  const spellGrantingPowers = filterSpellGrantingPowers(selectedPowers);

  return spellGrantingPowers.reduce<Promise<SelectedSpell[]>>(async (accPromise, { power, className }) => {
    const acc = await accPromise;
    const rpgClass = classes.find((c) => c.name === className);
    const availableSpells = rpgClass?.spells ?? [];
    if (availableSpells.length === 0) return acc;

    const alreadyLearned = new Set(acc.map((entry) => entry.spell.name));
    const options = pickUnlearnedSpell(availableSpells, alreadyLearned);

    const spellName = await awaitPrompt(
      select({
        message: strings.prompts.selectSpell(className, power.name),
        options: options.map((spell) => ({
          value: spell.name,
          label: formatSpellOptionLabel(spell, strings),
        })),
      }),
      strings,
    );

    const spell = options.find((entry) => entry.name === spellName);
    if (!spell) return acc;

    return [...acc, { spell, className, grantedByPower: power.name }];
  }, Promise.resolve([]));
};

/**
 * Filters the powers that unlock spell learning (flagged as `grantsSpell`
 * in the game data, e.g. "Magia Elemental", "Magia Entrópica").
 * @param selectedPowers - Powers already chosen for the character
 */
const filterSpellGrantingPowers = (selectedPowers: SelectedPower[]): SelectedPower[] =>
  selectedPowers.filter(({ power }) => power.grantsSpell === true);

/**
 * Picks a spell for a given class that hasn't already been learned in this
 * selection batch, falling back to the full list if all are already taken.
 * @param availableSpells - Full spell list for the granting class
 * @param alreadyLearned - Spell names already picked in this selection
 */
const pickUnlearnedSpell = (availableSpells: Spell[], alreadyLearned: Set<string>): Spell[] => {
  const learnable = availableSpells.filter((spell) => !alreadyLearned.has(spell.name));
  return learnable.length > 0 ? learnable : availableSpells;
};

/**
 * Randomly learns one spell per spell-granting power the character has,
 * used in the fully-random character generation flow.
 * @param selectedPowers - Powers already chosen for the character
 * @param classes - Selected RPG classes (source of each class's spell list)
 */
const selectRandomSpells = (selectedPowers: SelectedPower[], classes: RpgClass[]): SelectedSpell[] =>
  filterSpellGrantingPowers(selectedPowers).reduce<SelectedSpell[]>((acc, { power, className }) => {
    const rpgClass = classes.find((c) => c.name === className);
    const availableSpells = rpgClass?.spells ?? [];
    if (availableSpells.length === 0) return acc;

    const alreadyLearned = new Set(acc.map((entry) => entry.spell.name));
    const spell = sample(pickUnlearnedSpell(availableSpells, alreadyLearned));
    if (!spell) return acc;

    return [...acc, { spell, className, grantedByPower: power.name }];
  }, []);

/**
 * Formats a spell as a selectable prompt option, showing its PM cost, target
 * and whether it's offensive or supportive.
 * @param spell - Spell to format
 * @param strings - Active locale strings for spell tags
 */
const formatSpellOptionLabel = (spell: Spell, strings: LocaleStrings): string => {
  const tag = spell.isOffensive ? pc.red(strings.sheet.offensiveTag) : pc.green(strings.sheet.supportTag);
  return `${spell.name} ${pc.dim(`(${spell.pmCost} PM · ${spell.target})`)} ${tag}`;
};

/**
 * Formats a weapon attack string for the TUI display.
 * @param weapon - Weapon to format
 * @param attributes - Character attribute dice sizes
 * @param strings - Active locale strings for attack formatting
 */
const formatWeaponAttack = (
  weapon: Weapon,
  attributes: AttributeStats,
  strings: LocaleStrings,
): string => {
  const [attr1, attr2] = weapon.accuracyAttributes;
  const roll1 = getAttributeValue(attributes, attr1);
  const roll2 = getAttributeValue(attributes, attr2);

  return strings.sheet.weaponAttack({
    weaponName: pc.yellow(weapon.name),
    attr1,
    attr2,
    roll1,
    roll2,
    damageBonus: weapon.damageBonus,
    damageType: weapon.damageType,
  });
};

/**
 * Prompts the user to purchase starting equipment within the zenite budget.
 * @param catalog - Full locale equipment catalog
 * @param classes - Selected RPG classes
 * @param budget - Starting equipment budget in zenites
 * @param strings - Active locale strings
 */
const purchaseEquipmentManually = async (
  catalog: EquipmentCatalog,
  classes: RpgClass[],
  budget: number,
  strings: LocaleStrings,
): Promise<EquipmentPurchaseResult> => {
  const permissions = deriveEquipmentPermissions(classes, strings.equipmentBenefitPatterns);
  const filtered = filterCatalogByPermissions(catalog, permissions);
  const { formatCost } = strings.prompts;

  const weaponName = await awaitPrompt(
    select({
      message: strings.prompts.selectWeapon(budget),
      options: filtered.weapons
        .filter((weapon) => weapon.cost <= budget)
        .map((weapon) => ({
          value: weapon.name,
          label: formatEquipmentOptionLabel(weapon.name, weapon.cost, formatCost),
        })),
    }),
    strings,
  );

  const weapon = filtered.weapons.find((entry) => entry.name === weaponName)!;
  let remaining = budget - weapon.cost;

  const armorSelection = await awaitPrompt(
    select({
      message: strings.prompts.selectArmor(remaining),
      options: [
        { value: NONE_EQUIPMENT, label: strings.prompts.noArmorOption(0) },
        ...filtered.armors
          .filter((armor) => armor.cost <= remaining)
          .map((armor) => ({
            value: armor.name,
            label: formatEquipmentOptionLabel(armor.name, armor.cost, formatCost),
          })),
      ],
    }),
    strings,
  );

  const armor =
    armorSelection === NONE_EQUIPMENT
      ? null
      : (filtered.armors.find((entry) => entry.name === armorSelection) ?? null);
  remaining -= armor?.cost ?? 0;

  const shieldSelection = await awaitPrompt(
    select({
      message: strings.prompts.selectShield(remaining),
      options: [
        { value: NONE_EQUIPMENT, label: strings.prompts.noShieldOption(0) },
        ...filtered.shields
          .filter((shield) => shield.cost <= remaining)
          .map((shield) => ({
            value: shield.name,
            label: formatEquipmentOptionLabel(shield.name, shield.cost, formatCost),
          })),
      ],
    }),
    strings,
  );

  const shield =
    shieldSelection === NONE_EQUIPMENT
      ? null
      : (filtered.shields.find((entry) => entry.name === shieldSelection) ?? null);

  return buildEquipmentPurchaseResult({ weapon, armor, shield }, budget);
};

/**
 * Generates a completely random character sheet using the provided dataset.
 * @param data - Locale-specific character creation data
 * @param strings - Active locale strings
 */
const generateRandomCharacter = (data: CharacterCreationData, strings: LocaleStrings): CharacterSheet => {
  const { defaults } = strings;
  const concept = sample(data.identityTables.concepts) ?? defaults.concept;
  const adjective = sample(data.identityTables.adjectives) ?? defaults.adjective;
  const detail = sample(data.identityTables.details) ?? defaults.detail;
  const theme = sample(data.themes)?.name ?? defaults.theme;

  const attributeProfile = sample(data.attributes.arrays)?.values ?? defaults.attributeProfile;
  const attributes = assignAttributesRandomly(attributeProfile, strings);

  const selectedClasses = (() => {
    const classCount = Math.floor(Math.random() * MAX_CLASSES) + MIN_CLASSES;
    const pickedClasses = sampleSize(data.classes, classCount);
    const levels = distributeLevelsRandomly(classCount);
    return buildSelectedClasses(pickedClasses, levels);
  })();
  const rpgClasses = extractRpgClasses(selectedClasses);
  const powers = selectPowers(selectedClasses);
  const spells = selectRandomSpells(powers, rpgClasses);
  const purchase = selectRandomEquipment(
    data.equipmentCatalog,
    rpgClasses,
    data.startingBudget,
    strings.equipmentBenefitPatterns,
  );
  const derivedStats = calculateDerivedStats(attributes, rpgClasses, purchase.equipment, 5, strings);

  return {
    name: defaults.randomHeroName,
    identity: `${adjective} ${concept} ${detail}`,
    theme,
    classes: selectedClasses,
    powers,
    spells,
    attributes,
    equipment: purchase.equipment,
    derivedStats,
    equipmentSpent: purchase.equipmentSpent,
    money: purchase.money,
    moneyRoll: purchase.moneyRoll,
  };
};

/**
 * Prompts the user interactively to build a character step by step.
 * @param data - Locale-specific character creation data
 * @param strings - Active locale strings
 */
const generateManualCharacter = async (
  data: CharacterCreationData,
  strings: LocaleStrings,
): Promise<CharacterSheet> => {
  const name = await awaitPrompt(
    text({
      message: strings.prompts.heroName,
      placeholder: strings.prompts.heroNamePlaceholder,
    }),
    strings,
  );

  const concept = await awaitPrompt(
    select({
      message: strings.prompts.identityConcept,
      options: data.identityTables.concepts.map((c) => ({ value: c, label: c })),
    }),
    strings,
  );

  const adjective = await awaitPrompt(
    select({
      message: strings.prompts.identityAdjective,
      options: data.identityTables.adjectives.map((a) => ({ value: a, label: a })),
    }),
    strings,
  );

  const detail = await awaitPrompt(
    select({
      message: strings.prompts.identityDetail,
      options: data.identityTables.details.map((d) => ({ value: d, label: d })),
    }),
    strings,
  );

  const theme = await awaitPrompt(
    select({
      message: strings.prompts.coreTheme,
      options: data.themes.map((t) => ({ value: t.name, label: `${t.name} - ${t.description}` })),
    }),
    strings,
  );

  const attributeProfileString = await awaitPrompt(
    select({
      message: strings.prompts.attributeDistribution,
      options: data.attributes.arrays.map((attr) => ({
        value: attr.values,
        label: `${attr.description} (${attr.values})`,
      })),
    }),
    strings,
  );

  const selectedClasses = await promptSelectedClasses(data.classes, strings);
  const rpgClasses = extractRpgClasses(selectedClasses);

  const attributes = await assignAttributesManually(attributeProfileString, strings);
  const powers = await promptPowerSelection(selectedClasses, strings);
  const spells = await promptSpellSelection(powers, rpgClasses, strings);
  const purchase = await purchaseEquipmentManually(
    data.equipmentCatalog,
    rpgClasses,
    data.startingBudget,
    strings,
  );
  const derivedStats = calculateDerivedStats(
    attributes,
    rpgClasses,
    purchase.equipment,
    5,
    strings,
  );

  return {
    name,
    identity: `${adjective} ${concept} ${detail}`,
    theme,
    classes: selectedClasses,
    powers,
    spells,
    attributes,
    equipment: purchase.equipment,
    derivedStats,
    equipmentSpent: purchase.equipmentSpent,
    money: purchase.money,
    moneyRoll: purchase.moneyRoll,
  };
};

/**
 * Groups selected powers by their source class name, preserving selection
 * order, so the sheet can render a per-class section instead of a flat list.
 * @param powers - Powers tagged with their source class
 */
const groupPowersByClass = (powers: SelectedPower[]): Map<string, ClassPower[]> =>
  powers.reduce<Map<string, ClassPower[]>>((map, { power, className }) => {
    const existing = map.get(className) ?? [];
    map.set(className, [...existing, power]);
    return map;
  }, new Map());

/**
 * Renders the final character sheet to the console.
 * @param character - Completed character sheet
 * @param strings - Active locale strings
 */
const displayCharacterSheet = (character: CharacterSheet, strings: LocaleStrings): void => {
  const { sheet } = strings;
  const attributeLine = strings.attributeOrder
    .map((key) => `${key}: d${getAttributeValue(character.attributes, key)}`)
    .join(' | ');

  console.log('\n' + pc.bold(pc.green(sheet.title)));
  console.log(`${pc.cyan(sheet.name)} ${character.name}`);
  console.log(`${pc.cyan(sheet.identity)} ${character.identity}`);
  console.log(`${pc.cyan(sheet.theme)} ${character.theme}`);

  console.log(pc.bold(pc.blue(`\n${sheet.attributesHeading}`)));
  console.log(attributeLine);

  console.log(pc.bold(pc.blue(`\n${sheet.derivedStatsHeading}`)));
  console.log(
    `${sheet.hp}: ${character.derivedStats.hp} | ${sheet.mp}: ${character.derivedStats.mp} | ${sheet.ip}: ${character.derivedStats.ip}`,
  );
  console.log(
    `${sheet.defense}: ${character.derivedStats.defense} | ${sheet.magicDefense}: ${character.derivedStats.magicDefense} | ${sheet.initiative}: ${character.derivedStats.initiative}`,
  );

  console.log(pc.bold(pc.red(`\n${sheet.combatHeading}`)));
  const armorName = character.equipment.armor?.name ?? sheet.noArmor;
  const shieldName = character.equipment.shield?.name ?? sheet.noShield;
  console.log(`${pc.cyan(sheet.protection)} ${armorName} / ${shieldName}`);

  character.equipment.weapons.forEach((weapon) => {
    console.log(formatWeaponAttack(weapon, character.attributes, strings));
  });

  const leftover = character.money - character.moneyRoll.bonus;
  console.log(
    `${pc.cyan(sheet.equipmentSpent)} ${character.equipmentSpent}z | ${pc.cyan(sheet.money)} ${character.money}z ${sheet.moneyRoll(character.moneyRoll.dice, character.moneyRoll.bonus, leftover)}`,
  );

  const classSummary = sheet.formatClassSummary(
    character.classes.map(({ rpgClass }) => rpgClass.name),
    character.classes.map(({ level }) => level),
  );
  console.log(pc.bold(pc.blue(`\n${sheet.classesHeading}`)));
  console.log(`${pc.cyan(sheet.classes)} ${classSummary} (${sheet.level})`);

  const powersByClass = groupPowersByClass(character.powers);
  Array.from(powersByClass.entries()).forEach(([className, powers]) => {
    console.log(pc.bold(pc.yellow(`\n  ${className}`)));
    powers.forEach((power) => {
      const details = power.mechanics ?? power.description;
      console.log(`    ✨  ${pc.magenta(power.name)}: ${pc.gray(details)}`);
    });
  });

  if (character.spells.length > 0) {
    console.log(pc.bold(pc.blue(`\n${sheet.spellsHeading}`)));
    character.spells.forEach(({ spell, className, grantedByPower }) => {
      const tag = spell.isOffensive ? pc.red(sheet.offensiveTag) : pc.green(sheet.supportTag);
      console.log(`  🔮  ${pc.magenta(spell.name)} ${pc.dim(`(${className} · ${grantedByPower})`)} ${tag}`);
      console.log(
        `      ${sheet.spellCost(spell.pmCost)} | ${sheet.spellTarget(spell.target)} | ${sheet.spellDuration(spell.duration)}`,
      );
      console.log(`      ${pc.gray(spell.mechanics)}`);
    });
  }

  console.log(pc.bold(pc.green('\n=======================\n')));
};

/**
 * Main application runner. Initializes the TUI and handles the execution flow.
 */
const runTui = async (): Promise<void> => {
  if (!process.stdin.isTTY) {
    console.error(
      'This app requires an interactive terminal. Run it from a terminal.\n' +
        'Este app precisa de um terminal interativo. Execute-o a partir de um terminal.',
    );
    process.exit(1);
  }

  console.clear();

  const locale = await promptLocale();
  const strings = getLocaleStrings(locale);
  const data = getGameData(locale);

  intro(pc.bgCyan(pc.black(strings.introTitle)));

  const mode = await awaitPrompt(
    select({
      message: strings.modePrompt,
      options: [
        { value: 'random', label: strings.modeRandom },
        { value: 'manual', label: strings.modeManual },
      ],
    }),
    strings,
  );

  const s = spinner();
  s.start(strings.spinnerStart);

  const character =
    mode === 'random'
      ? generateRandomCharacter(data, strings)
      : await generateManualCharacter(data, strings);

  s.stop(strings.spinnerStop);

  displayCharacterSheet(character, strings);
  outro(strings.outro);
};

/**
 * Application entrypoint wrapper for bundler compatibility.
 */
const main = async (): Promise<void> => {
  try {
    await runTui();
  } catch (error) {
    console.error(pc.red('A fatal error occurred during creation: / Ocorreu um erro fatal:'), error);
    process.exit(1);
  }
};

void main();

export type {
  AttributeStats,
  CharacterCreationData,
  CharacterEquipment,
  CharacterSheet,
  ClassPower,
  DerivedStats,
  IdentityTables,
  RpgClass,
  SelectedClass,
  SelectedPower,
  SelectedSpell,
  Spell,
  Theme,
  Weapon,
} from './types.ts';