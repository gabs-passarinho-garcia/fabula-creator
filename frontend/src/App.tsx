import React, { useCallback, useEffect, useMemo, useState } from "react";
import { sounds } from "./sound";
import { getLocaleStrings, getGameData } from "./i18n";
import {
  deriveEquipmentPermissions,
  filterCatalogByPermissions,
  buildEquipmentPurchaseResult,
} from "./equipment";
import type { Locale, LocaleStrings } from "./i18n/types";
import type {
  CharacterSheet,
  RpgClass,
  ClassPower,
  Spell,
  CatalogWeapon,
  CatalogArmor,
  CatalogShield,
  SelectedClass,
  SelectedPower,
  SelectedSpell,
  SelectedHeroicPower,
  AttributeStats,
  Weapon,
} from "./types";
import {
  RotateCcw,
  CheckCircle2,
  X,
} from "lucide-react";
import confetti from "canvas-confetti";
import { calculateDerivedStats } from "./domain/characterStats";
import {
  applyAttributeBoosts,
  attributeBoostCountForLevel,
  canOpenNewClass,
  distributeStartingLevels,
  generateRandomCharacter,
  heroicPowerOptions,
  isLevelAllocationValid,
  levelUpCharacterStep,
  MAX_CHARACTER_LEVEL,
  MAX_CLASS_LEVEL,
  maxStartingClasses,
  MIN_STARTING_LEVEL,
  stepUpAttribute,
} from "./domain/characterCreation";
import {
  adjustRank,
  areClassPowerBudgetsSpent,
  canDecrease,
  canIncrease,
  purchaseRandomPowers,
  rankOf,
  remainingPurchases,
  selectSpellsForRanks,
  spellGrantSlots,
  sumRanks,
  trimSpellsForPowerRanks,
} from "./domain/powerRanks";
import { isTauriRuntime } from "./shared/tauri";
import { exportCharacterSheet, parseCharacterSheet } from "./services/characterFileService";
import type { CharacterRepository, SavedCharacterRecord } from "./services/characterRepository";
import { createLocalStorageCharacterRepository } from "./services/localStorageCharacterRepository";
import { createTauriCharacterRepository } from "./services/tauriCharacterRepository";
import { AppHeader } from "./components/AppHeader";
import { TitleScreen } from "./components/TitleScreen";
import { HeroGallery } from "./components/HeroGallery";
import { CharacterSheetView } from "./components/CharacterSheetView";

type SuccessModal = {
  title: string;
  message: string;
} | null;

export default function App() {
  const [locale, setLocale] = useState<Locale>("pt");
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<"title" | "random" | "manual" | "gallery" | "sheet">("title");

  // Gallery states
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterRecord[]>([]);

  // Active character sheet being viewed
  const [activeSheet, setActiveSheet] = useState<CharacterSheet | null>(null);
  // Id of the persisted record backing `activeSheet` (null for unsaved sheets)
  const [activeRecordId, setActiveRecordId] = useState<number | null>(null);
  const [successModal, setSuccessModal] = useState<SuccessModal>(null);

  // --- Manual Creation States ---
  const [manualStep, setManualStep] = useState<number>(1);
  const [name, setName] = useState<string>("");
  const [concept, setConcept] = useState<string>("");
  const [adjective, setAdjective] = useState<string>("");
  const [detail, setDetail] = useState<string>("");
  const [theme, setTheme] = useState<string>("");

  // Stats
  const [statDistribution, setStatDistribution] = useState<string>("d8, d8, d8, d8");
  const [assignedStats, setAssignedStats] = useState<AttributeStats>({ DES: 8, VIG: 8, AST: 8, VON: 8 });
  const [statDicePool, setStatDicePool] = useState<number[]>([]);
  const [statAssignments, setStatAssignments] = useState<Record<string, number>>({});

  // Classes
  const [classCount, setClassCount] = useState<number>(2);
  const [selectedClasses, setSelectedClasses] = useState<RpgClass[]>([]);
  const [classLevels, setClassLevels] = useState<Record<string, number>>({});

  // Powers
  const [selectedPowers, setSelectedPowers] = useState<SelectedPower[]>([]);

  // Spells
  const [selectedSpells, setSelectedSpells] = useState<SelectedSpell[]>([]);

  // Equipment Shop
  const [selectedWeapon, setSelectedWeapon] = useState<CatalogWeapon | null>(null);
  const [selectedArmor, setSelectedArmor] = useState<CatalogArmor | null>(null);
  const [selectedShield, setSelectedShield] = useState<CatalogShield | null>(null);

  // Load locale strings and game data
  const strings: LocaleStrings = getLocaleStrings(locale);
  const gameData = getGameData(locale);

  // Initialize sounds and load saved chars on mount
  useEffect(() => {
    sounds.setSoundEnabled(soundOn);
  }, [soundOn]);

  const repository = useMemo<CharacterRepository>(
    () => isTauriRuntime()
      ? createTauriCharacterRepository()
      : createLocalStorageCharacterRepository(),
    [],
  );

  const loadSavedCharacters = useCallback(async () => {
    try {
      setSavedCharacters(await repository.load());
    } catch (error) {
      console.error("Failed to load saved characters:", error);
    }
  }, [repository]);

  useEffect(() => {
    void loadSavedCharacters();
  }, [loadSavedCharacters]);

  const saveCharacterToDb = async (sheet: CharacterSheet) => {
    if (activeRecordId !== null) {
      // Editing a hero loaded from the gallery keeps a single record per hero.
      await repository.update(activeRecordId, sheet);
    } else {
      setActiveRecordId(await repository.save(sheet));
    }
    await loadSavedCharacters();
  };

  /** Fills defaults for legacy sheets saved before the level system existed. */
  const normalizeSheet = useCallback((sheet: CharacterSheet): CharacterSheet => {
    const legacyLevel = sheet.level as number | undefined;
    return {
      ...sheet,
      level: legacyLevel ?? MIN_STARTING_LEVEL,
      heroicPowers: sheet.heroicPowers ?? [],
    };
  }, []);

  /** Persists a leveled sheet when it came from the gallery, otherwise keeps it in memory. */
  const persistEvolvedSheet = async (sheet: CharacterSheet) => {
    if (activeRecordId === null) return;
    await repository.update(activeRecordId, sheet);
    await loadSavedCharacters();
  };

  const deleteCharacterFromDb = async (id: number) => {
    await repository.delete(id);
    await loadSavedCharacters();
  };

  // Sound triggers wrapping manager
  const playClick = () => sounds.playClick();
  const playConfirm = () => sounds.playConfirm();
  const playCancel = () => sounds.playCancel();
  const playLevelUp = () => sounds.playLevelUp();

  // Random level state
  const [randomTargetLevel, setRandomTargetLevel] = useState<number>(5);

  // Manual creation high level state
  const [manualTargetLevel, setManualTargetLevel] = useState<number>(MIN_STARTING_LEVEL);
  const [manualHeroicPowers, setManualHeroicPowers] = useState<SelectedHeroicPower[]>([]);
  const [manualAttributeBoosts, setManualAttributeBoosts] = useState<string[]>([]);

  // Level Up Modal state (empty class/power means "pick randomly")
  const [showLevelUpModal, setShowLevelUpModal] = useState<boolean>(false);
  const [levelUpTargetClass, setLevelUpTargetClass] = useState<string>("");
  const [levelUpTargetPower, setLevelUpTargetPower] = useState<string>("");

  /** Publishes an evolved sheet, persists it when it belongs to the gallery and celebrates. */
  const applyLevelUpResult = (evolved: CharacterSheet) => {
    setActiveSheet(evolved);
    setShowLevelUpModal(false);
    setLevelUpTargetClass("");
    setLevelUpTargetPower("");
    playLevelUp();
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    void persistEvolvedSheet(evolved);
  };

  // Mode selections
  const handleRandomCreation = (targetLevel: number = 5) => {
    playConfirm();
    const sheet = generateRandomCharacter(
      gameData,
      strings,
      targetLevel,
    );

    setActiveSheet(sheet);
    setActiveRecordId(null);
    setCurrentScreen("sheet");
    setTimeout(() => {
      playLevelUp();
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }, 150);
  };

  /** Class names the next level may be invested in (active classes plus newly openable ones). */
  const levelUpClassOptions = useMemo(() => {
    if (!activeSheet) return [] as string[];
    const active = activeSheet.classes
      .filter((entry) => entry.level < MAX_CLASS_LEVEL)
      .map((entry) => entry.rpgClass.name);
    if (!canOpenNewClass(activeSheet.classes)) return active;
    const untouched = gameData.classes
      .filter((rpgClass) => !activeSheet.classes.some((entry) => entry.rpgClass.name === rpgClass.name))
      .map((rpgClass) => rpgClass.name);
    return [...active, ...untouched];
  }, [activeSheet, gameData.classes]);

  /** Power names still purchasable for the class chosen in the Level Up modal. */
  const levelUpPowerOptions = useMemo(() => {
    if (!activeSheet || levelUpTargetClass === "") return [] as string[];
    const owned = activeSheet.classes.find((entry) => entry.rpgClass.name === levelUpTargetClass);
    const catalog = owned?.rpgClass ?? gameData.classes.find((rpgClass) => rpgClass.name === levelUpTargetClass);
    if (!catalog) return [] as string[];
    const nextLevel = (owned?.level ?? 0) + 1;
    const remaining = remainingPurchases(nextLevel, activeSheet.powers, levelUpTargetClass);
    return catalog.powers
      .filter((power) =>
        canIncrease(power, rankOf(activeSheet.powers, levelUpTargetClass, power.name), remaining),
      )
      .map((power) => power.name);
  }, [activeSheet, levelUpTargetClass, gameData.classes]);

  // Helper to parse dice pools
  const parseDiceStr = (diceString: string): number[] =>
    diceString.split(", ").map((d) => parseInt(d.replace("d", ""), 10));

  // --- MANUAL CREATION ACTIONS ---
  const startManualCreation = () => {
    playConfirm();
    setManualStep(1);
    setName("");
    setConcept(gameData.identityTables.concepts[0] || "");
    setAdjective(gameData.identityTables.adjectives[0] || "");
    setDetail(gameData.identityTables.details[0] || "");
    setTheme(gameData.themes[0]?.name || "");

    // Default dice pool from first option
    const poolStr = gameData.attributes.arrays[0].values;
    setStatDistribution(poolStr);
    setStatDicePool(parseDiceStr(poolStr));
    setStatAssignments({});

    // Dynamic, language-agnostic attribute stats keys
    const initialStats = strings.attributeOrder.reduce((acc, key) => {
      acc[key] = 8;
      return acc;
    }, {} as AttributeStats);
    setAssignedStats(initialStats);

    setClassCount(2);
    setSelectedClasses([]);
    setClassLevels({});
    setSelectedPowers([]);
    setSelectedSpells([]);
    setManualTargetLevel(MIN_STARTING_LEVEL);
    setManualHeroicPowers([]);
    setManualAttributeBoosts([]);

    setSelectedWeapon(null);
    setSelectedArmor(null);
    setSelectedShield(null);
    setActiveRecordId(null);

    setCurrentScreen("manual");
  };

  const handleStatDistributionChange = (poolStr: string) => {
    playClick();
    setStatDistribution(poolStr);
    setStatDicePool(parseDiceStr(poolStr));
    setStatAssignments({});

    // Dynamic, language-agnostic attribute stats keys
    const initialStats = strings.attributeOrder.reduce((acc, key) => {
      acc[key] = 8;
      return acc;
    }, {} as AttributeStats);
    setAssignedStats(initialStats);
  };

  const handleAssignDie = (statName: string, dieValue: number, poolIndex: number) => {
    playConfirm();
    const updatedAssignments = { ...statAssignments, [statName]: dieValue };
    setStatAssignments(updatedAssignments);
    setAssignedStats({
      ...assignedStats,
      [statName]: dieValue,
    });
    // Remove used die
    setStatDicePool(statDicePool.filter((_, idx) => idx !== poolIndex));
  };

  const resetStatAssignments = () => {
    playCancel();
    setStatDicePool(parseDiceStr(statDistribution));
    setStatAssignments({});

    // Dynamic, language-agnostic attribute stats keys
    const initialStats = strings.attributeOrder.reduce((acc, key) => {
      acc[key] = 8;
      return acc;
    }, {} as AttributeStats);
    setAssignedStats(initialStats);
  };

  const handleToggleClass = (rpgClass: RpgClass) => {
    const isSelected = selectedClasses.some((c) => c.name === rpgClass.name);
    if (isSelected) {
      playCancel();
      const nextClasses = selectedClasses.filter((c) => c.name !== rpgClass.name);
      setSelectedClasses(nextClasses);
      const updatedLevels = { ...classLevels };
      delete updatedLevels[rpgClass.name];
      setClassLevels(updatedLevels);
      setSelectedPowers([]);
      setSelectedSpells([]);
      setManualHeroicPowers([]);
    } else {
      if (selectedClasses.length >= classCount) {
        playCancel();
        return; // Max reached
      }
      playConfirm();
      setSelectedClasses([...selectedClasses, rpgClass]);
      setClassLevels({ ...classLevels, [rpgClass.name]: 1 });
      setSelectedPowers([]);
      setSelectedSpells([]);
    }
  };

  const updateClassLevel = (className: string, level: number) => {
    playClick();
    setClassLevels({ ...classLevels, [className]: level });
    // Powers and spells are tied to class levels. A level change invalidates the
    // previous choices and makes the user review the available slots again.
    setSelectedPowers([]);
    setSelectedSpells([]);
    // Mastery (level 10) also changes which Heroic Powers are owed.
    setManualHeroicPowers([]);
  };

  // Total levels allocated so far in the manual wizard
  const sumLevels = () => Object.values(classLevels).reduce((acc, l) => acc + l, 0);

  // --- Manual high level allocation ---
  const manualClassEntries: SelectedClass[] = selectedClasses.map((rc) => ({
    rpgClass: rc,
    level: classLevels[rc.name] || 1,
  }));
  const manualMaxClasses = maxStartingClasses(manualTargetLevel, gameData.classes.length);
  const manualMasteredEntries = manualClassEntries.filter((entry) => entry.level >= MAX_CLASS_LEVEL);
  const manualActiveNonMastered = manualClassEntries.filter((entry) => entry.level < MAX_CLASS_LEVEL).length;
  const manualAllocationValid = isLevelAllocationValid(
    manualClassEntries.map((entry) => entry.level),
    manualTargetLevel,
  );
  const manualBoostCount = attributeBoostCountForLevel(manualTargetLevel);
  const manualBoostedAttributes = applyAttributeBoosts(assignedStats, manualAttributeBoosts);
  const manualHeroicPowersComplete = manualMasteredEntries.every((entry) =>
    manualHeroicPowers.some((choice) => choice.source === entry.rpgClass.name),
  );
  const manualBoostsComplete = manualAttributeBoosts.length === manualBoostCount;

  /** Changes the manual starting level, trimming class picks that no longer fit. */
  const handleManualTargetLevelChange = (level: number) => {
    const bounded = Math.max(MIN_STARTING_LEVEL, Math.min(MAX_CHARACTER_LEVEL, level));
    setManualTargetLevel(bounded);
    setManualHeroicPowers([]);
    setManualAttributeBoosts([]);

    const allowed = maxStartingClasses(bounded, gameData.classes.length);
    if (classCount > allowed) {
      const kept = selectedClasses.slice(0, allowed);
      const keptLevels: Record<string, number> = {};
      kept.forEach((rc) => {
        keptLevels[rc.name] = Math.min(classLevels[rc.name] ?? 1, MAX_CLASS_LEVEL);
      });
      setClassCount(allowed);
      setSelectedClasses(kept);
      setClassLevels(keptLevels);
      setSelectedPowers([]);
      setSelectedSpells([]);
    }
  };

  /** Randomly reallocates the whole level budget across the chosen classes. */
  const handleAutoDistributeLevels = () => {
    playConfirm();
    if (selectedClasses.length === 0) return;
    const levels = distributeStartingLevels(selectedClasses.length, manualTargetLevel);
    const nextLevels: Record<string, number> = {};
    selectedClasses.forEach((rc, index) => {
      nextLevels[rc.name] = levels[index] ?? 1;
    });
    setClassLevels(nextLevels);
    setSelectedPowers([]);
    setSelectedSpells([]);
    setManualHeroicPowers([]);
    setManualAttributeBoosts([]);
  };

  const handleAdjustPowerRank = (className: string, power: ClassPower, delta: number, classLevel: number) => {
    playConfirm();
    const updatedPowers = adjustRank(selectedPowers, className, power, delta, classLevel);
    setSelectedPowers(updatedPowers);
    setSelectedSpells(trimSpellsForPowerRanks(selectedSpells, updatedPowers));
  };

  const handleSelectSpell = (className: string, grantedByPower: string, grantIndex: number, spell: Spell) => {
    playConfirm();
    const filteredSpells = selectedSpells.filter(
      (s) => !(s.className === className && s.grantedByPower === grantedByPower && s.grantIndex === grantIndex),
    );
    setSelectedSpells([...filteredSpells, { spell, className, grantedByPower, grantIndex }]);
  };

  /** Picks the Heroic Power granted by a mastered class in the manual wizard. */
  const handleSelectHeroicPower = (sourceClass: string, powerName: string) => {
    playConfirm();
    const rpgClass = selectedClasses.find((rc) => rc.name === sourceClass);
    if (!rpgClass) return;
    const option = heroicPowerOptions(rpgClass, gameData.universalHeroicPowers ?? []).find(
      (entry) => entry.power.name === powerName,
    );
    if (!option) return;
    setManualHeroicPowers([
      ...manualHeroicPowers.filter((choice) => choice.source !== sourceClass),
      option,
    ]);
  };

  /** Adds or removes one level 20/40 attribute step-up, respecting the d12 ceiling. */
  const handleToggleAttributeBoost = (key: string) => {
    playClick();
    const steps = manualAttributeBoosts.filter((entry) => entry === key).length;
    const baseValue = assignedStats[key] ?? 8;
    const currentValue = Array.from({ length: steps }).reduce<number>(
      (value) => stepUpAttribute(value),
      baseValue,
    );
    const existingIndex = manualAttributeBoosts.lastIndexOf(key);

    if (currentValue >= 12 || manualAttributeBoosts.length >= manualBoostCount) {
      if (existingIndex >= 0) {
        setManualAttributeBoosts(manualAttributeBoosts.filter((_, index) => index !== existingIndex));
      }
      return;
    }
    setManualAttributeBoosts([...manualAttributeBoosts, key]);
  };

  /** Spends every class level on randomly picked class powers. */
  const handleRandomizePowers = () => {
    playConfirm();
    const entries: SelectedClass[] = selectedClasses.map((rc) => ({
      rpgClass: rc,
      level: classLevels[rc.name] || 1,
    }));
    const powers = purchaseRandomPowers(entries, { next: () => Math.random() });
    setSelectedPowers(powers);
    setSelectedSpells(trimSpellsForPowerRanks(selectedSpells, powers));
  };

  /** Fills every pending spell slot with a random spell from the owning class. */
  const handleRandomizeSpells = () => {
    playConfirm();
    const spells = selectSpellsForRanks(
      selectedPowers,
      selectedClasses,
      (available) => available[Math.floor(Math.random() * available.length)] ?? available[0]!,
    );
    setSelectedSpells(spells);
  };

  const handleFinishManualCharacter = () => {
    playConfirm();

    // Assemble character sheet
    const finalClasses: SelectedClass[] = selectedClasses.map((rc) => ({
      rpgClass: rc,
      level: classLevels[rc.name] || 1,
    }));

    // Total level equals the sum of the levels invested in each class
    const totalLevel = finalClasses.reduce((total, entry) => total + entry.level, 0);
    // Level 20/40 step-ups picked in the power step are applied to the final dice
    const finalAttributes = applyAttributeBoosts(assignedStats, manualAttributeBoosts);

    // Clean up powers
    const finalPowers = [...selectedPowers];

    // Spells
    const finalSpells = [...selectedSpells];

    // Equip
    const equipSelection = {
      weapon: selectedWeapon || gameData.equipmentCatalog.weapons.find((w) => w.cost === 0)!,
      armor: selectedArmor,
      shield: selectedShield,
    };

    const purchaseResult = buildEquipmentPurchaseResult(equipSelection, gameData.startingBudget);
    const derivedStats = calculateDerivedStats(
      finalAttributes,
      selectedClasses,
      purchaseResult.equipment,
      totalLevel,
      strings,
    );

    const sheet: CharacterSheet = {
      name: name || strings.defaults.randomHeroName,
      identity: `${adjective} ${concept} ${detail}`,
      theme,
      level: totalLevel,
      classes: finalClasses,
      powers: finalPowers,
      spells: finalSpells,
      heroicPowers: manualHeroicPowers,
      attributes: finalAttributes,
      equipment: purchaseResult.equipment,
      derivedStats,
      equipmentSpent: purchaseResult.equipmentSpent,
      money: purchaseResult.money,
      moneyRoll: purchaseResult.moneyRoll,
    };

    setActiveSheet(sheet);
    setActiveRecordId(null);
    setCurrentScreen("sheet");
    setTimeout(() => {
      playLevelUp();
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }, 150);
  };

  // Format Helper for attacks
  const formatWeaponAttackString = (weapon: Weapon, attrs: AttributeStats) => {
    const [attr1, attr2] = weapon.accuracyAttributes;
    const roll1 = attrs[attr1] || 8;
    const roll2 = attrs[attr2] || 8;
    return `⚔️  [${attr1} + ${attr2}] (d${roll1} + d${roll2}) ➔ ${strings.sheet.weaponAttack({
      weaponName: "",
      attr1,
      attr2,
      roll1,
      roll2,
      damageBonus: weapon.damageBonus,
      damageType: weapon.damageType,
    }).split(" ➔ ")[1]}`;
  };

  // Import JSON Character Sheet
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== "string") throw new Error("Invalid file contents");
        const sheet = parseCharacterSheet(result);
        if (sheet.name && sheet.identity) {
          playLevelUp();
          setActiveSheet(normalizeSheet(sheet));
          setActiveRecordId(null);
          setCurrentScreen("sheet");
          confetti({ particleCount: 50, spread: 40 });
          setSuccessModal({
            title: locale === "pt" ? "Importação concluída" : "Import completed",
            message: locale === "pt"
              ? `A ficha de ${sheet.name} foi importada com sucesso.`
              : `${sheet.name}'s character sheet was imported successfully.`,
          });
        } else {
          alert("Ficha inválida! Formato incorreto.");
          playCancel();
        }
      } catch {
        alert("Erro ao decodificar JSON.");
        playCancel();
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Export JSON Character Sheet
  const handleExportJson = async (sheet: CharacterSheet) => {
    playConfirm();

    try {
      const fileName = await exportCharacterSheet(sheet);

      setSuccessModal({
        title: locale === "pt" ? "Exportação concluída" : "Export completed",
        message: locale === "pt"
          ? `A ficha foi salva como ${fileName}.`
          : `The character sheet was saved as ${fileName}.`,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to export character sheet:", err);
      alert(locale === "pt" ? "Não foi possível exportar a ficha." : "The character sheet could not be exported.");
      playCancel();
    }
  };

  // Formatted identity permissions
  const shopPermissions = selectedClasses.length > 0
    ? deriveEquipmentPermissions(selectedClasses, strings.equipmentBenefitPatterns)
    : { basicMelee: true, martialMelee: false, ranged: false, arcane: true, lightArmor: true, heavyArmor: false, martialShields: false };

  const filteredCatalog = filterCatalogByPermissions(gameData.equipmentCatalog, shopPermissions);

  return (
    <div className="min-h-screen text-white bg-[#030310] relative flex flex-col overflow-x-hidden select-none">
      {/* Background Retro Grid / Space Effects */}
      <div className="absolute inset-0 bg-radial-gradient from-blue-950/20 via-black to-black opacity-80 pointer-events-none"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none"></div>

      {/* Retro HUD Panel - Header */}
      <AppHeader
        locale={locale}
        soundOn={soundOn}
        onSoundToggle={() => { setSoundOn(!soundOn); sounds.playClick(); }}
        onLocaleToggle={() => { setLocale(locale === "pt" ? "en" : "pt"); sounds.playClick(); }}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 max-w-5xl w-full mx-auto my-4">
        {/* ==================== TITLE SCREEN ==================== */}
        {currentScreen === "title" && (
          <>
            <TitleScreen
              strings={strings}
              locale={locale}
              localeLabel={locale === "pt" ? "Galeria de Heróis" : "Hero Gallery"}
              savedCharacterCount={savedCharacters.length}
              randomTargetLevel={randomTargetLevel}
              onRandomTargetLevelChange={setRandomTargetLevel}
              onManualCreation={startManualCreation}
              onRandomCreation={() => handleRandomCreation(randomTargetLevel)}
              onGallery={() => { playConfirm(); setCurrentScreen("gallery"); }}
              onImport={handleImportJson}
            />
          </>
        )}

        {/* ==================== HERO GALLERY ==================== */}
        {currentScreen === "gallery" && (
          <HeroGallery
            locale={locale}
            records={savedCharacters}
            onBack={() => { playCancel(); setCurrentScreen("title"); }}
            onCreateFirst={startManualCreation}
            onOpen={(sheet, recordId) => {
              playConfirm();
              setActiveSheet(normalizeSheet(sheet));
              setActiveRecordId(recordId);
              setCurrentScreen("sheet");
            }}
            onLevelUp={(sheet, recordId) => {
              playConfirm();
              setActiveSheet(normalizeSheet(sheet));
              setActiveRecordId(recordId);
              setLevelUpTargetClass("");
              setLevelUpTargetPower("");
              setShowLevelUpModal(true);
            }}
            onExport={handleExportJson}
            onDelete={(id) => {
              playCancel();
              if (confirm(locale === "pt" ? "Tem certeza que deseja apagar este herói?" : "Are you sure you want to delete this hero?")) {
                void deleteCharacterFromDb(id);
              }
            }}
          />
        )}

        {/* ==================== MANUAL CREATION WIZARD ==================== */}
        {currentScreen === "manual" && (
          <div className="w-full max-w-3xl jrpg-container p-6 space-y-6">
            {/* Header with Steps */}
            <div className="flex justify-between items-center border-b-2 border-white/20 pb-4">
              <div>
                <span className="pixel-font text-[10px] text-blue-400 block tracking-widest uppercase">
                  Step {manualStep} of 6
                </span>
                <h2 className="pixel-font text-xs text-yellow-300">
                  {manualStep === 1 && (locale === "pt" ? "👤 IDENTIDADE DO HERÓI" : "👤 HERO IDENTITY")}
                  {manualStep === 2 && (locale === "pt" ? "📊 DISTRIBUIÇÃO DE ATRIBUTOS" : "📊 ATTRIBUTE DISTRIBUTION")}
                  {manualStep === 3 && (locale === "pt" ? "🛡️ SELEÇÃO DE CLASSES" : "🛡️ CLASS SELECTION")}
                  {manualStep === 4 && (locale === "pt" ? "✨ ESCOLHA DE PODERES" : "✨ POWER SELECTION")}
                  {manualStep === 5 && (locale === "pt" ? "🔮 MAGIAS DISPONÍVEIS" : "🔮 AVAILABLE SPELLS")}
                  {manualStep === 6 && (locale === "pt" ? "🛒 BAZAR DE EQUIPAMENTOS" : "🛒 EQUIPMENT SHOP")}
                </h2>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    playCancel();
                    if (manualStep === 1) {
                      setCurrentScreen("title");
                    } else {
                      setManualStep(manualStep - 1);
                    }
                  }}
                  className="jrpg-button px-3 py-1.5 text-[10px]"
                >
                  {locale === "pt" ? "Voltar" : "Back"}
                </button>

                {manualStep < 6 && (
                  <button
                    onClick={() => {
                      playConfirm();
                      setManualStep(manualStep + 1);
                    }}
                    disabled={
                      (manualStep === 1 && !name) ||
                      (manualStep === 2 && statDicePool.length > 0) ||
                      (manualStep === 3 && !manualAllocationValid) ||
                      (manualStep === 4 &&
                        (!areClassPowerBudgetsSpent(manualClassEntries, selectedPowers) ||
                          !manualHeroicPowersComplete ||
                          !manualBoostsComplete)) ||
                      (manualStep === 5 && spellGrantSlots(selectedPowers).length > selectedSpells.length)
                    }
                    className="jrpg-button px-3 py-1.5 text-[10px] disabled:opacity-50"
                  >
                    {locale === "pt" ? "Avançar" : "Next"}
                  </button>
                )}

                {manualStep === 6 && (
                  <button
                    onClick={handleFinishManualCharacter}
                    className="jrpg-button px-3 py-1.5 text-[10px] bg-green-900 border-green-400 hover:bg-green-700 text-white"
                  >
                    {locale === "pt" ? "CONCLUIR!" : "FORGE HERO!"}
                  </button>
                )}
              </div>
            </div>

            {/* STEP 1: Name, Identity Details & Theme */}
            {manualStep === 1 && (
              <div className="space-y-4 font-mono">
                {/* Name Input */}
                <div className="space-y-2">
                  <label className="block text-xs text-yellow-300 pixel-font">
                    {strings.prompts.heroName}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={strings.prompts.heroNamePlaceholder}
                    className="w-full bg-[#07071f] border-2 border-white p-3 text-sm focus:outline-none focus:border-yellow-300"
                  />
                </div>

                {/* Concept Adjective Detail */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs text-blue-300 pixel-font">
                      {strings.prompts.identityConcept}
                    </label>
                    <select
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      className="jrpg-select w-full border-2 border-white p-3 text-xs outline-none"
                    >
                      {gameData.identityTables.concepts.map((c, i) => (
                        <option key={i} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-blue-300 pixel-font">
                      {strings.prompts.identityAdjective}
                    </label>
                    <select
                      value={adjective}
                      onChange={(e) => setAdjective(e.target.value)}
                      className="jrpg-select w-full border-2 border-white p-3 text-xs outline-none"
                    >
                      {gameData.identityTables.adjectives.map((a, i) => (
                        <option key={i} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-blue-300 pixel-font">
                      {strings.prompts.identityDetail}
                    </label>
                    <select
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                      className="jrpg-select w-full border-2 border-white p-3 text-xs outline-none"
                    >
                      {gameData.identityTables.details.map((d, i) => (
                        <option key={i} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Identity Preview Box */}
                <div className="jrpg-panel p-4 text-center">
                  <span className="text-[10px] text-gray-400 block uppercase tracking-widest mb-1">
                    {locale === "pt" ? "Visualização da Identidade" : "Identity Preview"}
                  </span>
                  <p className="text-sm italic text-cyan-200">
                    "{adjective} {concept} {detail}"
                  </p>
                </div>

                {/* Core Theme Selection */}
                <div className="space-y-2">
                  <label className="block text-xs text-yellow-300 pixel-font">
                    {strings.prompts.coreTheme}
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="jrpg-select w-full border-2 border-white p-3 text-xs outline-none"
                  >
                    {gameData.themes.map((t, i) => (
                      <option key={i} value={t.name}>
                        {t.name} - {t.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 2: Attributes Dice Assign Grid */}
            {manualStep === 2 && (
              <div className="space-y-6">
                {/* Dice distribution presets */}
                <div className="space-y-2">
                  <label className="block text-xs text-yellow-300 pixel-font">
                    {strings.prompts.attributeDistribution}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {gameData.attributes.arrays.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleStatDistributionChange(preset.values)}
                        className={`p-2 border-2 text-xs font-mono transition ${
                          statDistribution === preset.values
                            ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                            : "border-white/20 hover:border-white"
                        }`}
                      >
                        {preset.description} ({preset.values})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Unassigned dice pool */}
                <div className="jrpg-panel p-4 flex flex-col items-center gap-3 text-center">
                  <p className="text-xs text-blue-300 pixel-font">
                    {locale === "pt" ? "Dados Disponíveis" : "Available Dice"}
                  </p>

                  <div className="flex gap-4">
                    {statDicePool.length === 0 ? (
                      <span className="text-xs text-green-400 font-mono">
                        {locale === "pt" ? "✓ Todos os dados atribuídos!" : "✓ All dice assigned!"}
                      </span>
                    ) : (
                      statDicePool.map((dieValue, idx) => (
                        <div
                          key={idx}
                          className="w-12 h-12 flex items-center justify-center border-2 border-white bg-blue-950 font-bold text-sm text-yellow-200 shadow-[2px_2px_0px_rgba(0,0,0,0.5)] animate-pulse"
                        >
                          d{dieValue}
                        </div>
                      ))
                    )}
                  </div>

                  {statDicePool.length > 0 && (
                    <p className="text-[10px] text-gray-400">
                      {locale === "pt" ? "Clique nas estatísticas abaixo para atribuir o primeiro dado" : "Click on stats below to assign the first die"}
                    </p>
                  )}

                  {Object.keys(statAssignments).length > 0 && (
                    <button
                      onClick={resetStatAssignments}
                      className="text-xs font-mono flex items-center gap-1.5 text-red-400 hover:text-red-300"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {locale === "pt" ? "Resetar Atribuição" : "Reset Assignment"}
                    </button>
                  )}
                </div>

                {/* Assignment stats grid */}
                <div className="grid grid-cols-2 gap-4">
                  {strings.attributeOrder.map((statKey) => {
                    const assignedValue = statAssignments[statKey];
                    const label = strings.attributeLabels[statKey] || statKey;

                    return (
                      <div
                        key={statKey}
                        onClick={() => {
                          if (assignedValue !== undefined) return;
                          if (statDicePool.length === 0) return;
                          handleAssignDie(statKey, statDicePool[0], 0);
                        }}
                        className={`jrpg-panel p-4 flex justify-between items-center transition ${
                          assignedValue === undefined && statDicePool.length > 0
                            ? "hover:border-yellow-400 cursor-pointer animate-pulse"
                            : ""
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="text-xs pixel-font">{statKey}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{label}</p>
                        </div>

                        <div className="w-14 h-14 flex items-center justify-center border-2 border-white/40 font-mono text-base font-bold bg-black/40">
                          {assignedValue !== undefined ? `d${assignedValue}` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: Class Selection & Level Distribution */}
            {manualStep === 3 && (
              <div className="space-y-6">
                {/* Starting level budget */}
                <div className="space-y-3 border-b border-white/10 pb-4">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="pixel-font text-yellow-300">
                      {locale === "pt" ? "Nível inicial do herói" : "Hero starting level"}
                    </span>
                    <span className="text-yellow-300 font-bold px-2 py-0.5 bg-yellow-950/40 border border-yellow-500/40">
                      {locale === "pt" ? `Nv. ${manualTargetLevel}` : `Lv. ${manualTargetLevel}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN_STARTING_LEVEL}
                    max={MAX_CHARACTER_LEVEL}
                    step={1}
                    value={manualTargetLevel}
                    onChange={(e) => handleManualTargetLevelChange(Number(e.target.value))}
                    className="w-full accent-yellow-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                    <span>{MIN_STARTING_LEVEL}</span>
                    <span className="text-cyan-500/70">20 · +1 atributo</span>
                    <span className="text-purple-500/70">40 · +1 atributo</span>
                    <span>{MAX_CHARACTER_LEVEL}</span>
                  </div>
                  <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                    {locale === "pt"
                      ? `Orçamento: ${manualTargetLevel} níveis · até ${MAX_CLASS_LEVEL} por classe · máx. 3 classes ativas sem maestria (${manualActiveNonMastered}/3)`
                      : `Budget: ${manualTargetLevel} levels · up to ${MAX_CLASS_LEVEL} per class · max 3 active non-mastered classes (${manualActiveNonMastered}/3)`}
                  </p>
                  <p className="text-[10px] font-mono text-yellow-300/80 leading-relaxed">
                    {locale === "pt"
                      ? `Maestrias neste build: ${manualMasteredEntries.length} · Poderes Heróicos exigidos: ${manualMasteredEntries.length} · Aumentos de atributo: ${manualBoostCount}`
                      : `Masteries in this build: ${manualMasteredEntries.length} · Required Heroic Powers: ${manualMasteredEntries.length} · Attribute boosts: ${manualBoostCount}`}
                  </p>
                </div>

                {/* Number of classes to select */}
                <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-4">
                  <span className="text-xs pixel-font text-yellow-300">
                    {locale === "pt" ? "Quantas classes deseja forjar?" : "How many classes to select?"}
                  </span>

                  <div className="flex gap-2">
                    {Array.from({ length: manualMaxClasses - 1 }, (_, index) => index + 2).map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          playClick();
                          setClassCount(num);
                          // Growing the roster keeps the work already done; shrinking
                          // drops the classes that no longer fit.
                          if (num < selectedClasses.length) {
                            const kept = selectedClasses.slice(0, num);
                            const keptLevels: Record<string, number> = {};
                            kept.forEach((rc) => {
                              keptLevels[rc.name] = Math.min(classLevels[rc.name] ?? 1, MAX_CLASS_LEVEL);
                            });
                            setSelectedClasses(kept);
                            setClassLevels(keptLevels);
                            setSelectedPowers([]);
                            setSelectedSpells([]);
                            setManualHeroicPowers([]);
                          }
                        }}
                        className={`w-8 h-8 flex items-center justify-center border-2 text-xs font-mono ${
                          classCount === num
                            ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                            : "border-white/20 hover:border-white"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleAutoDistributeLevels}
                    disabled={selectedClasses.length === 0}
                    className="jrpg-button px-3 py-1.5 text-[10px] disabled:opacity-40"
                  >
                    🎲 {locale === "pt" ? "Distribuir níveis" : "Distribute levels"}
                  </button>
                </div>

                {/* Selected Classes Summary & Level Allocation */}
                <div className="jrpg-panel p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs pixel-font text-blue-300">
                      {locale === "pt" ? "Classes Atuais & Níveis" : "Active Classes & Levels"}
                    </p>
                    <span className={`text-xs font-mono ${sumLevels() === manualTargetLevel ? "text-green-400" : "text-cyan-400"}`}>
                      Level Sum: {sumLevels()} / {manualTargetLevel}
                    </span>
                  </div>

                  {selectedClasses.length === 0 ? (
                    <p className="text-xs font-mono italic text-white/40">
                      {locale === "pt" ? "Nenhuma classe escolhida ainda..." : "No classes chosen yet..."}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedClasses.map((rc) => {
                        const lvl = classLevels[rc.name] || 1;
                        const isMastered = lvl >= MAX_CLASS_LEVEL;
                        return (
                          <div key={rc.name} className="flex items-center justify-between bg-black/30 p-2 border border-white/10 font-mono">
                            <span className="text-xs font-bold text-yellow-300 flex items-center gap-2">
                              {rc.name}
                              {isMastered && (
                                <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 border border-yellow-400/40">
                                  {locale === "pt" ? "MESTRE" : "MASTER"}
                                </span>
                              )}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                disabled={lvl <= 1}
                                onClick={() => updateClassLevel(rc.name, lvl - 1)}
                                className="w-6 h-6 flex items-center justify-center border border-white/30 text-xs hover:border-white disabled:opacity-30"
                              >
                                -
                              </button>
                              <span className="text-xs px-2">
                                {lvl}/{MAX_CLASS_LEVEL}
                              </span>
                              <button
                                disabled={lvl >= MAX_CLASS_LEVEL || sumLevels() >= manualTargetLevel}
                                onClick={() => updateClassLevel(rc.name, lvl + 1)}
                                className="w-6 h-6 flex items-center justify-center border border-white/30 text-xs hover:border-white disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedClasses.length > 0 && (
                    <div className="space-y-1 text-[10px] font-mono">
                      {sumLevels() < manualTargetLevel && (
                        <p className="text-cyan-300">
                          {locale === "pt"
                            ? `Faltam ${manualTargetLevel - sumLevels()} níveis para distribuir (use + ou o botão de distribuir aleatoriamente).`
                            : `${manualTargetLevel - sumLevels()} levels still to distribute (use + or the random distribute button).`}
                        </p>
                      )}
                      {sumLevels() < manualTargetLevel &&
                        manualClassEntries.length > 0 &&
                        manualClassEntries.every((entry) => entry.level >= MAX_CLASS_LEVEL) && (
                          <p className="text-yellow-300">
                            {locale === "pt"
                              ? `Todas as classes escolhidas já estão dominadas (nível ${MAX_CLASS_LEVEL}). Aumente a quantidade de classes e escolha novas no catálogo abaixo para investir os ${manualTargetLevel - sumLevels()} níveis restantes.`
                              : `Every chosen class is already mastered (level ${MAX_CLASS_LEVEL}). Increase the class count and pick new ones in the catalog below to invest the remaining ${manualTargetLevel - sumLevels()} levels.`}
                          </p>
                        )}
                      {manualMasteredEntries.length > 0 && selectedClasses.length < manualMaxClasses && (
                        <p className="text-green-300">
                          {locale === "pt"
                            ? `Classes dominadas não ocupam o limite de 3 ativas — você pode forjar até ${manualMaxClasses} classes neste nível.`
                            : `Mastered classes do not occupy the 3-active limit — you may forge up to ${manualMaxClasses} classes at this level.`}
                        </p>
                      )}
                      {sumLevels() > manualTargetLevel && (
                        <p className="text-red-400">
                          {locale === "pt"
                            ? `Você excedeu o orçamento em ${sumLevels() - manualTargetLevel} níveis.`
                            : `You exceeded the budget by ${sumLevels() - manualTargetLevel} levels.`}
                        </p>
                      )}
                      {selectedClasses.length < 2 && (
                        <p className="text-red-400">
                          {locale === "pt"
                            ? "Escolha pelo menos 2 classes."
                            : "Choose at least 2 classes."}
                        </p>
                      )}
                      {manualActiveNonMastered > 3 && (
                        <p className="text-red-400">
                          {locale === "pt"
                            ? `Classes ativas sem maestria: ${manualActiveNonMastered}/3. Leve uma classe ao nível ${MAX_CLASS_LEVEL} para dominá-la e liberar espaço.`
                            : `Active non-mastered classes: ${manualActiveNonMastered}/3. Take one class to level ${MAX_CLASS_LEVEL} to master it and free a slot.`}
                        </p>
                      )}
                      {manualTargetLevel > selectedClasses.length * MAX_CLASS_LEVEL && (
                        <p className="text-yellow-300">
                          {locale === "pt"
                            ? `Com ${selectedClasses.length} classe(s) o máximo alcançável é ${selectedClasses.length * MAX_CLASS_LEVEL} níveis. Adicione mais classes para chegar ao nível ${manualTargetLevel}.`
                            : `With ${selectedClasses.length} class(es) the maximum reachable is ${selectedClasses.length * MAX_CLASS_LEVEL} levels. Add more classes to reach level ${manualTargetLevel}.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Catalog of classes */}
                <div className="space-y-3">
                  <p className="text-xs pixel-font text-yellow-300">
                    {locale === "pt" ? "Lista de Classes Disponíveis" : "Available Class Registry"}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {gameData.classes.map((rc) => {
                      const isSelected = selectedClasses.some((c) => c.name === rc.name);
                      return (
                        <div
                          key={rc.name}
                          onClick={() => handleToggleClass(rc)}
                          className={`p-3 border-2 text-left cursor-pointer transition ${
                            isSelected
                              ? "border-yellow-400 bg-yellow-400/5 text-yellow-300"
                              : "border-white/10 hover:border-white hover:bg-white/5"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold font-mono">{rc.name}</span>
                            {isSelected && <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 font-bold">ACTIVE</span>}
                          </div>
                          <p className="text-[10px] text-white/60 font-mono mt-1 line-clamp-2">
                            {rc.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Choose Powers per level */}
            {manualStep === 4 && (
              <div className="space-y-6">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <p className="text-xs font-mono text-blue-300">
                    {strings.prompts.choosePowersHint}
                  </p>
                  <span className="text-[10px] font-mono text-cyan-300">
                    {locale === "pt"
                      ? `Ranks alocados: ${sumRanks(selectedPowers)} / ${sumLevels()}`
                      : `Allocated ranks: ${sumRanks(selectedPowers)} / ${sumLevels()}`}
                  </span>
                  <button
                    onClick={handleRandomizePowers}
                    disabled={selectedClasses.length === 0}
                    className="jrpg-button px-3 py-1.5 text-[10px] disabled:opacity-40"
                  >
                    🎲 {locale === "pt" ? "Preencher aleatoriamente" : "Random fill"}
                  </button>
                </div>

                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {selectedClasses.map((rc) => {
                    const classLevel = classLevels[rc.name] || 1;
                    const remaining = remainingPurchases(classLevel, selectedPowers, rc.name);

                    return (
                      <div key={rc.name} className="space-y-3 bg-black/20 p-4 border border-white/10">
                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                          <h3 className="pixel-font text-xs text-yellow-300">
                            {rc.name} (Lvl {classLevel})
                          </h3>
                          <span className="text-[10px] font-mono text-cyan-300 font-bold">
                            {strings.prompts.remainingPurchases(remaining, classLevel)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {rc.powers.map((power) => {
                            const currentRank = rankOf(selectedPowers, rc.name, power.name);
                            const canInc = canIncrease(power, currentRank, remaining);
                            const canDec = canDecrease(currentRank);

                            return (
                              <div
                                key={power.name}
                                className={`p-2.5 border font-mono text-xs flex justify-between items-center transition ${
                                  currentRank > 0
                                    ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                                    : "border-white/10 hover:border-white/50"
                                }`}
                              >
                                <div>
                                  <p className="font-bold text-[11px]">{power.name}</p>
                                  <p className="text-[10px] text-white/60 mt-0.5">
                                    {power.description}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                  <span className="text-xs font-bold px-1.5 py-0.5 bg-black/40 border border-white/20">
                                    {strings.sheet.powerRank(currentRank, power.maxLevel)}
                                  </span>
                                  <button
                                    disabled={!canDec}
                                    onClick={() => handleAdjustPowerRank(rc.name, power, -1, classLevel)}
                                    className="w-7 h-7 flex items-center justify-center border border-white/30 text-xs font-bold hover:border-white disabled:opacity-30"
                                  >
                                    -
                                  </button>
                                  <button
                                    disabled={!canInc}
                                    onClick={() => handleAdjustPowerRank(rc.name, power, 1, classLevel)}
                                    className="w-7 h-7 flex items-center justify-center border border-white/30 text-xs font-bold hover:border-white disabled:opacity-30"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mastery: one Heroic Power per class taken to level 10 */}
                {manualMasteredEntries.length > 0 && (
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <div className="flex justify-between items-center">
                      <p className="text-xs pixel-font text-yellow-300">
                        👑 {locale === "pt" ? "PODERES HERÓICOS (MAESTRIA)" : "HEROIC POWERS (MASTERY)"}
                      </p>
                      <span className={`text-[10px] font-mono ${manualHeroicPowersComplete ? "text-green-400" : "text-cyan-300"}`}>
                        {manualHeroicPowers.length}/{manualMasteredEntries.length}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-white/60">
                      {locale === "pt"
                        ? `Cada classe dominada (nível ${MAX_CLASS_LEVEL}) concede 1 Poder Heroico, de classe ou universal.`
                        : `Every mastered class (level ${MAX_CLASS_LEVEL}) grants 1 Heroic Power, class-specific or universal.`}
                    </p>

                    {manualMasteredEntries.map((entry) => {
                      const chosen = manualHeroicPowers.find(
                        (choice) => choice.source === entry.rpgClass.name,
                      );
                      const options = heroicPowerOptions(
                        entry.rpgClass,
                        gameData.universalHeroicPowers ?? [],
                      ).filter(
                        (option) =>
                          !manualHeroicPowers.some(
                            (choice) =>
                              choice.power.name === option.power.name &&
                              choice.source !== entry.rpgClass.name,
                          ),
                      );

                      return (
                        <div
                          key={entry.rpgClass.name}
                          className="space-y-2 bg-black/20 p-3 border border-yellow-500/30"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold font-mono text-yellow-200">
                              {entry.rpgClass.name} · Lvl {entry.level}
                            </span>
                            <button
                              onClick={() => {
                                const available = options.filter(
                                  (option) => option.power.name !== chosen?.power.name,
                                );
                                const pool = available.length > 0 ? available : options;
                                const picked = pool[Math.floor(Math.random() * pool.length)];
                                if (picked) {
                                  handleSelectHeroicPower(entry.rpgClass.name, picked.power.name);
                                }
                              }}
                              className="jrpg-button px-2 py-1 text-[9px]"
                            >
                              🎲 {locale === "pt" ? "Aleatório" : "Random"}
                            </button>
                          </div>

                          <select
                            value={chosen?.power.name ?? ""}
                            onChange={(e) => handleSelectHeroicPower(entry.rpgClass.name, e.target.value)}
                            className="jrpg-select w-full border-2 border-white p-2 text-xs outline-none"
                          >
                            <option value="">
                              {locale === "pt" ? "-- escolha um poder heroico --" : "-- choose a heroic power --"}
                            </option>
                            {options.map((option) => (
                              <option key={`${option.source}-${option.power.name}`} value={option.power.name}>
                                [{option.source}] {option.power.name}
                              </option>
                            ))}
                          </select>

                          {chosen && (
                            <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                              {chosen.power.mechanics || chosen.power.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Level 20 and 40 attribute step-ups */}
                {manualBoostCount > 0 && (
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <div className="flex justify-between items-center">
                      <p className="text-xs pixel-font text-cyan-300">
                        📈 {locale === "pt" ? "AUMENTOS DE ATRIBUTO (NV 20/40)" : "ATTRIBUTE BOOSTS (LV 20/40)"}
                      </p>
                      <span className={`text-[10px] font-mono ${manualBoostsComplete ? "text-green-400" : "text-cyan-300"}`}>
                        {manualAttributeBoosts.length}/{manualBoostCount}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-white/60">
                      {locale === "pt"
                        ? "Cada aumento sobe um dado em um passo (d6→d8→d10→d12). Clique para aplicar ou desfazer."
                        : "Each boost raises one die by a step (d6→d8→d10→d12). Click to apply or undo."}
                    </p>

                    <div className="grid grid-cols-2 gap-2 font-mono">
                      {strings.attributeOrder.map((key) => {
                        const base = assignedStats[key] ?? 8;
                        const current = manualBoostedAttributes[key] ?? base;
                        const steps = manualAttributeBoosts.filter((entry) => entry === key).length;
                        return (
                          <button
                            key={key}
                            onClick={() => handleToggleAttributeBoost(key)}
                            className={`p-2 border text-left text-[11px] flex justify-between items-center transition ${
                              steps > 0
                                ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                                : "border-white/10 hover:border-white/50"
                            }`}
                          >
                            <span className="font-bold">{strings.attributeLabels[key] ?? key}</span>
                            <span>
                              d{base}
                              {steps > 0 ? ` → d${current}` : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: Spells Selection */}
            {manualStep === 5 && (
              <div className="space-y-6">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <p className="text-xs font-mono text-blue-300">
                    {locale === "pt"
                      ? "Para cada nível de um poder de conjuração, escolha uma magia correspondente"
                      : "For each rank of a spell-granting power, select a corresponding spell"}
                  </p>
                  {spellGrantSlots(selectedPowers).length > 0 && (
                    <button
                      onClick={handleRandomizeSpells}
                      className="jrpg-button px-3 py-1.5 text-[10px]"
                    >
                      🎲 {locale === "pt" ? "Preencher aleatoriamente" : "Random fill"}
                    </button>
                  )}
                </div>

                {(() => {
                  const slots = spellGrantSlots(selectedPowers);

                  if (slots.length === 0) {
                    return (
                      <div className="jrpg-panel p-6 text-center text-green-400 font-mono text-xs">
                        {locale === "pt"
                          ? "✓ Nenhuma de suas classes exige escolha de magias. Pode avançar!"
                          : "✓ None of your selected classes require spell selection. You may proceed!"}
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {slots.map((slot, idx) => {
                        const rc = selectedClasses.find((c) => c.name === slot.className);
                        const spells = rc?.spells || [];
                        const ownerPower = selectedPowers.find(
                          (entry) => entry.className === slot.className && entry.power.name === slot.powerName,
                        );
                        const totalRank = ownerPower?.rank ?? 1;
                        const chosenSpell = selectedSpells.find(
                          (s) =>
                            s.className === slot.className &&
                            s.grantedByPower === slot.powerName &&
                            s.grantIndex === slot.grantIndex,
                        );

                        return (
                          <div key={idx} className="space-y-3 bg-black/20 p-4 border border-white/10">
                            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                              <span className="pixel-font text-xs text-yellow-300">
                                {strings.prompts.selectSpell(slot.className, slot.powerName, slot.grantIndex + 1, totalRank)}
                              </span>
                              <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-widest">
                                {slot.powerName} #{slot.grantIndex + 1}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {spells.map((spell) => {
                                const isSelected = chosenSpell?.spell.name === spell.name;
                                return (
                                  <button
                                    key={spell.name}
                                    onClick={() => handleSelectSpell(slot.className, slot.powerName, slot.grantIndex, spell)}
                                    className={`p-3 border text-left font-mono text-xs flex flex-col gap-1 transition ${
                                      isSelected
                                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                                        : "border-white/10 hover:border-white/50"
                                    }`}
                                  >
                                    <div className="flex justify-between items-center w-full">
                                      <span className="font-bold text-[11px] text-yellow-200">{spell.name}</span>
                                      <span className="text-[9px] bg-blue-950 text-cyan-300 px-1.5 py-0.5 border border-cyan-400/30">
                                        {spell.pmCost} PM · {spell.target}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-white/70">{spell.mechanics}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* STEP 6: Equipment Purchase Shop */}
            {manualStep === 6 && (
              <div className="space-y-6">
                <div className="jrpg-panel p-4 flex justify-between items-center">
                  <span className="text-xs pixel-font text-yellow-300">
                    {locale === "pt" ? "🛒 ORÇAMENTO DISPONÍVEL:" : "🛒 SHOPPING BUDGET:"}
                  </span>
                  <span className="pixel-font text-sm text-green-300">
                    {gameData.startingBudget}z
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                  {/* Weapons */}
                  <div className="space-y-3">
                    <p className="pixel-font text-[10px] text-yellow-300 border-b border-white/20 pb-1 uppercase">
                      {locale === "pt" ? "Armas Permitidas" : "Weapons"}
                    </p>
                    <div className="space-y-2">
                      {filteredCatalog.weapons.map((w) => {
                        const isSelected = selectedWeapon?.name === w.name;
                        return (
                          <div
                            key={w.name}
                            onClick={() => {
                              playClick();
                              setSelectedWeapon(w);
                            }}
                            className={`p-2 border cursor-pointer transition ${
                              isSelected
                                ? "border-yellow-400 bg-yellow-400/5 text-yellow-300"
                                : "border-white/10 hover:border-white/50"
                            }`}
                          >
                            <p className="font-bold text-[11px]">{w.name}</p>
                            <p className="text-[10px] text-green-300 mt-0.5 font-bold">{w.cost}z</p>
                            <p className="text-[9px] text-white/50 leading-relaxed mt-1">
                              {formatWeaponAttackString(w, assignedStats)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Armors */}
                  <div className="space-y-3">
                    <p className="pixel-font text-[10px] text-yellow-300 border-b border-white/20 pb-1 uppercase">
                      {locale === "pt" ? "Armaduras" : "Armor"}
                    </p>
                    <div className="space-y-2">
                      <div
                        onClick={() => {
                          playClick();
                          setSelectedArmor(null);
                        }}
                        className={`p-2 border cursor-pointer transition ${
                          selectedArmor === null
                            ? "border-yellow-400 bg-yellow-400/5 text-yellow-300"
                            : "border-white/10 hover:border-white/50"
                        }`}
                      >
                        <p className="font-bold text-[11px]">{locale === "pt" ? "Sem Armadura" : "No Armor"}</p>
                        <p className="text-[10px] text-green-300 mt-0.5">0z</p>
                      </div>

                      {filteredCatalog.armors.map((a) => {
                        const isSelected = selectedArmor?.name === a.name;
                        return (
                          <div
                            key={a.name}
                            onClick={() => {
                              playClick();
                              setSelectedArmor(a);
                            }}
                            className={`p-2 border cursor-pointer transition ${
                              isSelected
                                ? "border-yellow-400 bg-yellow-400/5 text-yellow-300"
                                : "border-white/10 hover:border-white/50"
                            }`}
                          >
                            <p className="font-bold text-[11px]">{a.name}</p>
                            <p className="text-[10px] text-green-300 mt-0.5 font-bold">{a.cost}z</p>
                            <p className="text-[9px] text-white/50 mt-1">
                              Def: +{a.baseDefense || 0} | MDef: +{a.baseMagicDefense || 0}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Shields */}
                  <div className="space-y-3">
                    <p className="pixel-font text-[10px] text-yellow-300 border-b border-white/20 pb-1 uppercase">
                      {locale === "pt" ? "Escudos" : "Shields"}
                    </p>
                    <div className="space-y-2">
                      <div
                        onClick={() => {
                          playClick();
                          setSelectedShield(null);
                        }}
                        className={`p-2 border cursor-pointer transition ${
                          selectedShield === null
                            ? "border-yellow-400 bg-yellow-400/5 text-yellow-300"
                            : "border-white/10 hover:border-white/50"
                        }`}
                      >
                        <p className="font-bold text-[11px]">{locale === "pt" ? "Sem Escudo" : "No Shield"}</p>
                        <p className="text-[10px] text-green-300 mt-0.5">0z</p>
                      </div>

                      {filteredCatalog.shields.map((s) => {
                        const isSelected = selectedShield?.name === s.name;
                        return (
                          <div
                            key={s.name}
                            onClick={() => {
                              playClick();
                              setSelectedShield(s);
                            }}
                            className={`p-2 border cursor-pointer transition ${
                              isSelected
                                ? "border-yellow-400 bg-yellow-400/5 text-yellow-300"
                                : "border-white/10 hover:border-white/50"
                            }`}
                          >
                            <p className="font-bold text-[11px]">{s.name}</p>
                            <p className="text-[10px] text-green-300 mt-0.5 font-bold">{s.cost}z</p>
                            <p className="text-[9px] text-white/50 mt-1">
                              Def: +{s.defenseBonus} | MDef: +{s.magicDefenseBonus}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentScreen === "sheet" && activeSheet && (
          <CharacterSheetView
            locale={locale}
            strings={strings}
            sheet={activeSheet}
            onSave={(sheet) => {
              void saveCharacterToDb(sheet);
              playConfirm();
              alert(locale === "pt" ? "Herói salvo com sucesso no banco de dados!" : "Hero successfully saved to SQLite database!");
            }}
            onExport={handleExportJson}
            onBack={() => {
              playCancel();
              setCurrentScreen("title");
            }}
            onLevelUp={() => setShowLevelUpModal(true)}
            formatWeaponAttack={formatWeaponAttackString}
          />
        )}

        {/* ==================== LEVEL UP MODAL ==================== */}
        {showLevelUpModal && activeSheet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="jrpg-panel max-w-md w-full p-6 space-y-5 border-2 border-yellow-400 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/20 pb-3">
                <h3 className="pixel-font text-sm text-yellow-300">⭐ {locale === "pt" ? "SUBIR NÍVEL" : "LEVEL UP"}</h3>
                <button onClick={() => setShowLevelUpModal(false)} className="text-gray-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="font-mono text-xs text-gray-300">
                {locale === "pt"
                  ? `Nível atual: ${activeSheet.level}. Escolha como evoluir seu herói.`
                  : `Current level: ${activeSheet.level}. Choose how to evolve your hero.`}
              </p>

              {/* Optional manual progression: pick the class and the power to learn */}
              <div className="space-y-3 font-mono border border-white/10 p-3 bg-black/20">
                <p className="text-[10px] pixel-font text-yellow-300">
                  {locale === "pt" ? "EVOLUÇÃO MANUAL (OPCIONAL)" : "MANUAL PROGRESSION (OPTIONAL)"}
                </p>

                <div className="space-y-1">
                  <span className="text-[10px] text-white/60">
                    {locale === "pt" ? "Classe a evoluir" : "Class to advance"}
                  </span>
                  <select
                    value={levelUpTargetClass}
                    onChange={(e) => {
                      playClick();
                      setLevelUpTargetClass(e.target.value);
                      setLevelUpTargetPower("");
                    }}
                    className="jrpg-select w-full border-2 border-white p-2 text-xs outline-none"
                  >
                    <option value="">{locale === "pt" ? "Automático (aleatório)" : "Automatic (random)"}</option>
                    {levelUpClassOptions.map((className) => (
                      <option key={className} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                </div>

                {levelUpTargetClass !== "" && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/60">
                      {locale === "pt" ? "Poder a aprender (opcional)" : "Power to learn (optional)"}
                    </span>
                    <select
                      value={levelUpTargetPower}
                      onChange={(e) => {
                        playClick();
                        setLevelUpTargetPower(e.target.value);
                      }}
                      className="jrpg-select w-full border-2 border-white p-2 text-xs outline-none"
                    >
                      <option value="">{locale === "pt" ? "Automático (aleatório)" : "Automatic (random)"}</option>
                      {levelUpPowerOptions.map((powerName) => (
                        <option key={powerName} value={powerName}>
                          {powerName}
                        </option>
                      ))}
                    </select>
                    {levelUpPowerOptions.length === 0 && (
                      <p className="text-[10px] text-white/50">
                        {locale === "pt"
                          ? "Todos os poderes desta classe já estão no rank máximo."
                          : "Every power of this class is already at max rank."}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 font-mono">
                <button
                  onClick={() => {
                    try {
                      const evolved = levelUpCharacterStep(
                        activeSheet,
                        gameData.classes,
                        strings,
                        gameData.universalHeroicPowers ?? [],
                        levelUpTargetClass === "" ? undefined : levelUpTargetClass,
                        levelUpTargetPower === "" ? undefined : levelUpTargetPower,
                      );
                      applyLevelUpResult(evolved);
                    } catch (e) {
                      alert(locale === "pt"
                        ? "Não foi possível subir de nível: " + String(e)
                        : "Could not level up: " + String(e));
                    }
                  }}
                  className="w-full jrpg-button p-3 text-left flex items-start gap-3 hover:border-yellow-300 group"
                >
                  <span className="text-yellow-400 text-lg">🎲</span>
                  <div>
                    <div className="text-xs font-bold text-yellow-200">
                      {levelUpTargetClass === ""
                        ? (locale === "pt" ? "Subir 1 Nível (Aleatório)" : "Gain 1 Level (Random)")
                        : (locale === "pt" ? `Subir 1 Nível em ${levelUpTargetClass}` : `Gain 1 Level in ${levelUpTargetClass}`)}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5 leading-normal">
                      {levelUpTargetClass === ""
                        ? (locale === "pt"
                          ? "Evolui o personagem automaticamente respeitando todas as regras."
                          : "Automatically advances the character following all rules.")
                        : (locale === "pt"
                          ? "Investe o nível na classe escolhida e concede o poder selecionado."
                          : "Invests the level in the chosen class and grants the selected power.")}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const targetStr = prompt(
                      locale === "pt"
                        ? `Nível alvo (atual: ${activeSheet.level}, máx: ${MAX_CHARACTER_LEVEL}):`
                        : `Target level (current: ${activeSheet.level}, max: ${MAX_CHARACTER_LEVEL}):`,
                      String(Math.min(activeSheet.level + 5, MAX_CHARACTER_LEVEL))
                    );
                    if (!targetStr) return;
                    const target = parseInt(targetStr, 10);
                    if (isNaN(target) || target <= activeSheet.level || target > MAX_CHARACTER_LEVEL) {
                      alert(locale === "pt" ? "Nível inválido." : "Invalid level.");
                      return;
                    }
                    try {
                      let sheet = activeSheet;
                      let firstStep = true;
                      while (sheet.level < target) {
                        sheet = levelUpCharacterStep(
                          sheet,
                          gameData.classes,
                          strings,
                          gameData.universalHeroicPowers ?? [],
                          levelUpTargetClass === "" ? undefined : levelUpTargetClass,
                          firstStep && levelUpTargetPower !== "" ? levelUpTargetPower : undefined,
                        );
                        firstStep = false;
                      }
                      applyLevelUpResult(sheet);
                    } catch (e) {
                      alert(locale === "pt"
                        ? "Não foi possível subir de nível: " + String(e)
                        : "Could not level up: " + String(e));
                    }
                  }}
                  className="w-full jrpg-button p-3 text-left flex items-start gap-3 hover:border-cyan-300 group"
                >
                  <span className="text-cyan-400 text-lg">⚡</span>
                  <div>
                    <div className="text-xs font-bold text-cyan-200">
                      {locale === "pt" ? "Ir para Nível X (Aleatório)" : "Jump to Level X (Random)"}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5 leading-normal">
                      {locale === "pt"
                        ? "Sobe vários níveis de uma vez, simulando toda a progressão."
                        : "Levels up multiple times at once, simulating full progression."}
                    </div>
                  </div>
                </button>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-white/10">
                {activeRecordId !== null && (
                  <button
                    onClick={() => {
                      playConfirm();
                      setShowLevelUpModal(false);
                      setCurrentScreen("sheet");
                    }}
                    className="jrpg-button px-3 py-1.5 text-[10px] text-cyan-300 border-cyan-400/50"
                  >
                    {locale === "pt" ? "Ver ficha →" : "View sheet →"}
                  </button>
                )}
                <button
                  onClick={() => {
                    playCancel();
                    setLevelUpTargetClass("");
                    setLevelUpTargetPower("");
                    setShowLevelUpModal(false);
                  }}
                  className="jrpg-button px-4 py-1.5 text-[10px] ml-auto"
                >
                  {locale === "pt" ? "Cancelar" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="jrpg-container w-full max-w-md p-6 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
            <h2 className="pixel-font text-sm text-yellow-300">{successModal.title}</h2>
            <p className="font-mono text-xs text-white/80">{successModal.message}</p>
            <button
              onClick={() => {
                playClick();
                setSuccessModal(null);
              }}
              className="jrpg-button mx-auto flex items-center gap-2 px-4 py-2 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              {locale === "pt" ? "Fechar" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
