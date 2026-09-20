export type Locale = 'pt' | 'en';

export interface LocaleStrings {
  languagePrompt: string;
  languageOptions: Record<Locale, string>;
  cancelMessage: string;
  introTitle: string;
  modePrompt: string;
  modeRandom: string;
  modeManual: string;
  spinnerStart: string;
  spinnerStop: string;
  outro: string;
  fatalError: string;
  prompts: {
    heroName: string;
    heroNamePlaceholder: string;
    identityConcept: string;
    identityAdjective: string;
    identityDetail: string;
    coreTheme: string;
    attributeDistribution: string;
    classCount: string;
    selectClass: (index: number, total: number) => string;
    assignClassLevel: (className: string, remaining: number, min: number, max: number) => string;
    assignDie: (attributeLabel: string, remaining: string) => string;
    selectWeapon: (remaining: number) => string;
    selectArmor: (remaining: number) => string;
    selectShield: (remaining: number) => string;
    noArmorOption: (cost: number) => string;
    noShieldOption: (cost: number) => string;
    formatCost: (cost: number) => string;
    /** Prompts the user to select a class power */
    selectPower: (className: string, remaining: number) => string;
    /** Explains that class levels are spent as stackable power ranks */
    choosePowersHint: string;
    /** Shows unspent power purchases for a class */
    remainingPurchases: (remaining: number, total: number) => string;
    /** Prompts the user to select a spell granted by a ranked class power */
    selectSpell: (className: string, powerName: string, slot: number, total: number) => string;
  };
  defaults: {
    randomHeroName: string;
    concept: string;
    adjective: string;
    detail: string;
    theme: string;
    attributeProfile: string;
  };
  attributeOrder: string[];
  attributeLabels: Record<string, string>;
  statMapping: {
    hp: string;
    mp: string;
    defense: string;
    magicDefense: string;
  };
  benefitPatterns: {
    hp: RegExp;
    mp: RegExp;
    ip: RegExp;
  };
  equipmentBenefitPatterns: {
    rangedAndMartialShields: RegExp;
    meleeAndMartialArmor: RegExp;
    heavyArmorAndMartialShields: RegExp;
    martialMelee: RegExp;
    martialMeleeAndShields: RegExp;
  };
  sheet: {
    title: string;
    name: string;
    identity: string;
    theme: string;
    attributesHeading: string;
    derivedStatsHeading: string;
    hp: string;
    mp: string;
    ip: string;
    defense: string;
    magicDefense: string;
    initiative: string;
    combatHeading: string;
    protection: string;
    noArmor: string;
    noShield: string;
    equipmentSpent: string;
    money: string;
    moneyRoll: (dice: [number, number], bonus: number, leftover: number) => string;
    classesHeading: string;
    classes: string;
    level: string;
    formatClassSummary: (classNames: string[], levels: number[]) => string;
    weaponAttack: (params: {
      weaponName: string;
      attr1: string;
      attr2: string;
      roll1: number;
      roll2: number;
      damageBonus: number;
      damageType: string;
    }) => string;
    /** Heading for the spells section on the character sheet */
    spellsHeading: string;
    /** Tag denoting an offensive spell */
    offensiveTag: string;
    /** Tag denoting a support spell */
    supportTag: string;
    /** Formats the MP cost of a spell */
    spellCost: (cost: string) => string;
    /** Formats the target of a spell */
    spellTarget: (target: string) => string;
    /** Formats the duration of a spell */
    spellDuration: (duration: string) => string;
    /** Formats current skill rank versus catalog maximum */
    powerRank: (rank: number, maxLevel: number) => string;
    /** Tooltip/label for the Change Photo button */
    changePhoto: string;
    /** Fallback text shown when a hero has no photo */
    noPhoto: string;
    /** Indicator shown when a saved hero is being edited */
    editingSavedHero: string;
    /** Alt text for the hero photo */
    photoPlaceholder: string;
    /** Hint text near the photo picker */
    selectPhotoHint: string;
  };
}