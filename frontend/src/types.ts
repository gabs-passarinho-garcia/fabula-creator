export interface IdentityTables {
  concepts: string[];
  adjectives: string[];
  details: string[];
}

export interface Theme {
  name: string;
  description: string;
}

export interface ClassPower {
  name: string;
  maxLevel: number;
  description: string;
  mechanics?: string;
  /** Flags powers that unlock spell learning (e.g. "Magia Elemental"), so the
   *  creator knows to prompt/roll a spell whenever this power is selected. */
  grantsSpell?: boolean;
}

export interface Spell {
  name: string;
  pmCost: string;
  target: string;
  duration: string;
  isOffensive: boolean;
  mechanics: string;
}

export interface RpgClass {
  name: string;
  description: string;
  startingBenefits: string[];
  powers: ClassPower[];
  /** Only present for caster classes (Elementalista, Entropista, Espiritualista). */
  spells?: Spell[];
}

export interface Weapon {
  name: string;
  type: 'melee' | 'ranged';
  accuracyAttributes: [string, string];
  damageBonus: number;
  damageType: string;
  isEquipped: boolean;
}

export interface Armor {
  name: string;
  baseDefense?: number;
  baseMagicDefense?: number;
  initiativePenalty?: number;
  isEquipped: boolean;
}

export interface Shield {
  name: string;
  defenseBonus: number;
  magicDefenseBonus: number;
  isEquipped: boolean;
}

export type WeaponCategory = 'basic-melee' | 'martial-melee' | 'ranged' | 'arcane';

export type ArmorCategory = 'light' | 'heavy';

export type ShieldCategory = 'martial';

export interface CatalogWeapon extends Weapon {
  cost: number;
  category: WeaponCategory;
}

export interface CatalogArmor extends Armor {
  cost: number;
  category: ArmorCategory;
}

export interface CatalogShield extends Shield {
  cost: number;
  category: ShieldCategory;
}

export interface EquipmentCatalog {
  weapons: CatalogWeapon[];
  armors: CatalogArmor[];
  shields: CatalogShield[];
}

export interface EquipmentPermissions {
  basicMelee: boolean;
  martialMelee: boolean;
  ranged: boolean;
  arcane: boolean;
  lightArmor: boolean;
  heavyArmor: boolean;
  martialShields: boolean;
}

export interface EquipmentSelection {
  weapon: CatalogWeapon;
  armor: CatalogArmor | null;
  shield: CatalogShield | null;
}

export interface MoneyRoll {
  dice: [number, number];
  bonus: number;
}

export interface EquipmentPurchaseResult {
  equipment: CharacterEquipment;
  equipmentSpent: number;
  money: number;
  moneyRoll: MoneyRoll;
}

export interface CharacterEquipment {
  weapons: Weapon[];
  armor?: Armor;
  shield?: Shield;
}

export interface CharacterCreationData {
  identityTables: IdentityTables;
  themes: Theme[];
  classes: RpgClass[];
  attributes: { arrays: Array<{ description: string; values: string }> };
  startingEquipment: CharacterEquipment;
  equipmentCatalog: EquipmentCatalog;
  startingBudget: number;
}

export type AttributeStats = Record<string, number>;

export interface DerivedStats {
  hp: number;
  mp: number;
  ip: number;
  defense: number;
  magicDefense: number;
  initiative: number;
}

/** An RPG class paired with the number of starting levels invested in it. */
export interface SelectedClass {
  rpgClass: RpgClass;
  level: number;
}

/** A class power tagged with the class it came from, for grouped display. */
export interface SelectedPower {
  power: ClassPower;
  className: string;
}

/** A learned spell tagged with its class and the power that granted it. */
export interface SelectedSpell {
  spell: Spell;
  className: string;
  grantedByPower: string;
}

export interface CharacterSheet {
  name: string;
  identity: string;
  theme: string;
  classes: SelectedClass[];
  powers: SelectedPower[];
  spells: SelectedSpell[];
  attributes: AttributeStats;
  equipment: CharacterEquipment;
  derivedStats: DerivedStats;
  equipmentSpent: number;
  money: number;
  moneyRoll: MoneyRoll;
}