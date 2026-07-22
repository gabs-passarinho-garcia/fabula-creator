import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { sounds } from "./sound";
import { getLocaleStrings, getGameData } from "./i18n";
import {
  deriveEquipmentPermissions,
  filterCatalogByPermissions,
  buildEquipmentPurchaseResult,
  selectRandomEquipment,
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
  AttributeStats,
  DerivedStats,
} from "./types";
import {
  Volume2,
  VolumeX,
  Languages,
  RotateCcw,
  Trash2,
  Download,
  Upload,
  Save,
  ChevronRight,
  Sparkle,
  CheckCircle2,
  X,
} from "lucide-react";
import confetti from "canvas-confetti";

interface SavedCharRecord {
  id: number;
  name: string;
  created_at: string;
  sheet_json: string;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface SaveFileHandle {
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface FilePickerWindow extends Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFileHandle>;
}

type SuccessModal = {
  title: string;
  message: string;
} | null;

export default function App() {
  const [locale, setLocale] = useState<Locale>("pt");
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<"title" | "random" | "manual" | "gallery" | "sheet">("title");

  // Gallery states
  const [savedCharacters, setSavedCharacters] = useState<SavedCharRecord[]>([]);

  // Active character sheet being viewed
  const [activeSheet, setActiveSheet] = useState<CharacterSheet | null>(null);
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
  const [classCount, setClassCount] = useState<number>(1);
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

  useEffect(() => {
    loadSavedCharacters();
  }, []);

  const isTauri = () => {
    return typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
  };

  const loadSavedCharacters = async () => {
    if (isTauri()) {
      try {
        const chars = await invoke<SavedCharRecord[]>("load_characters");
        setSavedCharacters(chars);
      } catch (err) {
        console.error("Failed to load from SQLite:", err);
      }
    } else {
      // Fallback: LocalStorage
      const stored = localStorage.getItem("fabula_characters");
      if (stored) {
        try {
          setSavedCharacters(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse characters from LocalStorage");
        }
      }
    }
  };

  const saveCharacterToDb = async (sheet: CharacterSheet) => {
    const sheetJson = JSON.stringify(sheet);
    if (isTauri()) {
      try {
        await invoke("save_character", { name: sheet.name, sheetJson });
        await loadSavedCharacters();
      } catch (err) {
        console.error("Failed to save to SQLite:", err);
      }
    } else {
      // Fallback LocalStorage with functional state update to prevent race conditions or stale state issues
      setSavedCharacters((prev) => {
        const newRecord: SavedCharRecord = {
          id: Date.now(),
          name: sheet.name,
          created_at: new Date().toISOString(),
          sheet_json: sheetJson,
        };
        const updated = [newRecord, ...prev];
        localStorage.setItem("fabula_characters", JSON.stringify(updated));
        return updated;
      });
    }
  };

  const deleteCharacterFromDb = async (id: number) => {
    if (isTauri()) {
      try {
        await invoke("delete_character", { id });
        await loadSavedCharacters();
      } catch (err) {
        console.error("Failed to delete from SQLite:", err);
      }
    } else {
      // Fallback LocalStorage with functional state update to prevent race conditions or stale state issues
      setSavedCharacters((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        localStorage.setItem("fabula_characters", JSON.stringify(updated));
        return updated;
      });
    }
  };

  // Sound triggers wrapping manager
  const playClick = () => sounds.playClick();
  const playConfirm = () => sounds.playConfirm();
  const playCancel = () => sounds.playCancel();
  const playLevelUp = () => sounds.playLevelUp();

  // Mode selections
  const handleRandomCreation = () => {
    playConfirm();
    // Identity randoms
    const randomConcept = gameData.identityTables.concepts[Math.floor(Math.random() * gameData.identityTables.concepts.length)];
    const randomAdjective = gameData.identityTables.adjectives[Math.floor(Math.random() * gameData.identityTables.adjectives.length)];
    const randomDetail = gameData.identityTables.details[Math.floor(Math.random() * gameData.identityTables.details.length)];
    const randomTheme = gameData.themes[Math.floor(Math.random() * gameData.themes.length)].name;

    // Attribute dice random allocation
    const diceProfileStr = gameData.attributes.arrays[Math.floor(Math.random() * gameData.attributes.arrays.length)].values;
    const diceArray = diceProfileStr.split(", ").map((d) => parseInt(d.replace("d", ""), 10));
    // Shuffle dice
    const shuffledDice = [...diceArray].sort(() => Math.random() - 0.5);

    // Dynamic, language-agnostic attribute stats keys
    const randAttributes: AttributeStats = {
      [strings.attributeOrder[0]]: shuffledDice[0] || 8,
      [strings.attributeOrder[1]]: shuffledDice[1] || 8,
      [strings.attributeOrder[2]]: shuffledDice[2] || 8,
      [strings.attributeOrder[3]]: shuffledDice[3] || 8,
    };

    // Class selection (1 to 3 classes)
    const randomClassCount = Math.floor(Math.random() * 3) + 1;
    // Shuffle classes
    const shuffledClasses = [...gameData.classes].sort(() => Math.random() - 0.5);
    const pickedClasses = shuffledClasses.slice(0, randomClassCount);

    // Distribute 5 levels
    const levels = Array.from({ length: randomClassCount }, () => 1);
    let remainingLevels = 5 - randomClassCount;
    while (remainingLevels > 0) {
      const idx = Math.floor(Math.random() * randomClassCount);
      levels[idx]++;
      remainingLevels--;
    }

    const selClasses: SelectedClass[] = pickedClasses.map((rc, index) => ({
      rpgClass: rc,
      level: levels[index],
    }));

    // Pick Powers (1 power per level)
    const randPowers: SelectedPower[] = [];
    selClasses.forEach(({ rpgClass, level }) => {
      const shuffledPowers = [...rpgClass.powers].sort(() => Math.random() - 0.5);
      const picked = shuffledPowers.slice(0, level);
      picked.forEach((power) => {
        randPowers.push({ power, className: rpgClass.name });
      });
    });

    // Pick Spells if any powers grant them
    const randSpells: SelectedSpell[] = [];
    const spellPowers = randPowers.filter((p) => p.power.grantsSpell);
    spellPowers.forEach(({ power, className }) => {
      const rc = pickedClasses.find((c) => c.name === className);
      if (rc && rc.spells && rc.spells.length > 0) {
        // Find unlearned
        const alreadyLearned = new Set(randSpells.map((s) => s.spell.name));
        const learnable = rc.spells.filter((s) => !alreadyLearned.has(s.name));
        const finalPool = learnable.length > 0 ? learnable : rc.spells;
        const randomSpell = finalPool[Math.floor(Math.random() * finalPool.length)];
        randSpells.push({ spell: randomSpell, className, grantedByPower: power.name });
      }
    });

    // Equipment shop calculations
    const purchase = selectRandomEquipment(
      gameData.equipmentCatalog,
      pickedClasses,
      gameData.startingBudget,
      strings.equipmentBenefitPatterns
    );

    // Calc stats
    const derivedStats = calculateStats(randAttributes, pickedClasses, purchase.equipment, 5);

    const sheet: CharacterSheet = {
      name: strings.defaults.randomHeroName,
      identity: `${randomAdjective} ${randomConcept} ${randomDetail}`,
      theme: randomTheme,
      classes: selClasses,
      powers: randPowers,
      spells: randSpells,
      attributes: randAttributes,
      equipment: purchase.equipment,
      derivedStats,
      equipmentSpent: purchase.equipmentSpent,
      money: purchase.money,
      moneyRoll: purchase.moneyRoll,
    };

    setActiveSheet(sheet);
    setCurrentScreen("sheet");
    setTimeout(() => {
      playLevelUp();
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }, 150);
  };

  const calculateStats = (
    attrs: AttributeStats,
    classes: RpgClass[],
    equip: any,
    level: number
  ): DerivedStats => {
    const hpBonus = classes.reduce(
      (acc, c) => acc + (c.startingBenefits.some((b) => strings.benefitPatterns.hp.test(b)) ? 5 : 0),
      0
    );
    const mpBonus = classes.reduce(
      (acc, c) => acc + (c.startingBenefits.some((b) => strings.benefitPatterns.mp.test(b)) ? 5 : 0),
      0
    );
    const ipBonus = classes.reduce(
      (acc, c) => acc + (c.startingBenefits.some((b) => strings.benefitPatterns.ip.test(b)) ? 2 : 0),
      0
    );

    const statMapping = strings.statMapping;
    const baseDef = (equip.armor?.baseDefense ?? 0) + (attrs[statMapping.defense] || 8);
    const baseMDef = (equip.armor?.baseMagicDefense ?? 0) + (attrs[statMapping.magicDefense] || 8);
    const shieldDef = equip.shield?.isEquipped ? equip.shield.defenseBonus : 0;
    const shieldMDef = equip.shield?.isEquipped ? equip.shield.magicDefenseBonus : 0;
    const armorInitiativePenalty = equip.armor?.initiativePenalty ?? 0;

    return {
      hp: level + (attrs[statMapping.hp] || 8) * 5 + hpBonus,
      mp: level + (attrs[statMapping.mp] || 8) * 5 + mpBonus,
      ip: 6 + ipBonus,
      defense: baseDef + shieldDef,
      magicDefense: baseMDef + shieldMDef,
      initiative: 0 - armorInitiativePenalty,
    };
  };

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

    setClassCount(1);
    setSelectedClasses([]);
    setClassLevels({});
    setSelectedPowers([]);
    setSelectedSpells([]);

    setSelectedWeapon(null);
    setSelectedArmor(null);
    setSelectedShield(null);

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
  };

  // Check if manually assigned levels sum up to 5
  const sumLevels = () => {
    return Object.values(classLevels).reduce((acc, l) => acc + l, 0);
  };

  const handleSelectPower = (className: string, power: ClassPower, levelIdx: number) => {
    playConfirm();

    // Check if power already chosen for this class
    const filteredPowers = selectedPowers.filter((p) => p.className === className && p.power.name === power.name);
    if (filteredPowers.length > 0) {
      return; // Already chosen
    }

    // Replace power for this specific slot if already exists, else append
    const cleanPowers = selectedPowers.filter((p) => !(p.className === className && p.power.maxLevel === levelIdx));
    setSelectedPowers([...cleanPowers, { power, className }]);
  };

  const handleSelectSpell = (className: string, grantedByPower: string, spell: Spell) => {
    playConfirm();
    // Remove previous spell for this class & power
    const filteredSpells = selectedSpells.filter(
      (s) => !(s.className === className && s.grantedByPower === grantedByPower)
    );
    setSelectedSpells([...filteredSpells, { spell, className, grantedByPower }]);
  };

  const handleFinishManualCharacter = () => {
    playConfirm();

    // Assemble character sheet
    const finalClasses: SelectedClass[] = selectedClasses.map((rc) => ({
      rpgClass: rc,
      level: classLevels[rc.name] || 1,
    }));

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
    const derivedStats = calculateStats(assignedStats, selectedClasses, purchaseResult.equipment, 5);

    const sheet: CharacterSheet = {
      name: name || strings.defaults.randomHeroName,
      identity: `${adjective} ${concept} ${detail}`,
      theme,
      classes: finalClasses,
      powers: finalPowers,
      spells: finalSpells,
      attributes: assignedStats,
      equipment: purchaseResult.equipment,
      derivedStats,
      equipmentSpent: purchaseResult.equipmentSpent,
      money: purchaseResult.money,
      moneyRoll: purchaseResult.moneyRoll,
    };

    setActiveSheet(sheet);
    setCurrentScreen("sheet");
    setTimeout(() => {
      playLevelUp();
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }, 150);
  };

  // Format Helper for attacks
  const formatWeaponAttackString = (weapon: any, attrs: AttributeStats) => {
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
        const sheet = JSON.parse(event.target?.result as string) as CharacterSheet;
        if (sheet && sheet.name && sheet.identity) {
          playLevelUp();
          setActiveSheet(sheet);
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
      } catch (err) {
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
    const fileName = `${sheet.name.toLowerCase().replace(/\s+/g, "_")}_ficha.json`;
    const json = JSON.stringify(sheet, null, 2);

    try {
      const pickerWindow = window as FilePickerWindow;
      if (pickerWindow.showSaveFilePicker) {
        const fileHandle = await pickerWindow.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "JSON character sheet", accept: { "application/json": [".json"] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
      } else {
        // Fallback for browsers/WebViews without the File System Access API.
        const dataStr = "data:application/json;charset=utf-8," + encodeURIComponent(json);
        const downloadAnchor = document.createElement("a");
        downloadAnchor.href = dataStr;
        downloadAnchor.download = fileName;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }

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
      <header className="relative z-10 p-4 flex justify-between items-center bg-[#07071f]/80 border-b-4 border-double border-white/20">
        <div className="flex items-center gap-3">
          <Sparkle className="text-yellow-400 w-6 h-6 animate-pulse" />
          <h1 className="pixel-font text-xs sm:text-sm tracking-wider text-yellow-300">
            FABULA ULTIMA
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Sound Toggle Button */}
          <button
            onClick={() => {
              setSoundOn(!soundOn);
              sounds.playClick();
            }}
            className="flex items-center justify-center p-2 rounded-md hover:bg-white/10 active:scale-95 transition"
            title={soundOn ? "Mute Retro Sounds" : "Unmute Retro Sounds"}
          >
            {soundOn ? (
              <Volume2 className="w-5 h-5 text-yellow-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {/* Language Toggle Button */}
          <button
            onClick={() => {
              setLocale(locale === "pt" ? "en" : "pt");
              sounds.playClick();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 border-white/20 text-xs pixel-font hover:bg-white/10"
          >
            <Languages className="w-4 h-4 text-cyan-400" />
            {locale === "pt" ? "PT" : "EN"}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 max-w-5xl w-full mx-auto my-4">
        {/* ==================== TITLE SCREEN ==================== */}
        {currentScreen === "title" && (
          <div className="w-full max-w-xl text-center space-y-8 my-8 flex flex-col items-center">
            {/* Title Pixel Box */}
            <div className="jrpg-container p-6 sm:p-8 w-full">
              <h2 className="pixel-text-lg text-yellow-300 leading-normal animate-pulse text-center drop-shadow-md mb-2">
                {strings.introTitle}
              </h2>
              <p className="text-xs text-blue-300 tracking-widest pixel-font mt-4">
                LEGENDARY CHARACTER CREATOR v2
              </p>
            </div>

            {/* Menu Buttons JRPG Style */}
            <div className="flex flex-col gap-4 w-full max-w-md">
              <button
                onClick={startManualCreation}
                className="jrpg-button text-left p-4 rounded-none text-white hover:text-yellow-200 flex items-center justify-between"
              >
                <span>⚔️ {strings.modeManual}</span>
                <ChevronRight className="w-4 h-4 animate-bounce" />
              </button>

              <button
                onClick={handleRandomCreation}
                className="jrpg-button text-left p-4 rounded-none text-white hover:text-yellow-200 flex items-center justify-between"
              >
                <span>🎲 {strings.modeRandom}</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  playConfirm();
                  setCurrentScreen("gallery");
                }}
                className="jrpg-button text-left p-4 rounded-none text-white hover:text-yellow-200 flex items-center justify-between"
              >
                <span>🏆 {locale === "pt" ? "Galeria de Heróis" : "Hero Gallery"}</span>
                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded border border-yellow-400/30">
                  {savedCharacters.length}
                </span>
              </button>

              {/* JSON Import Input Hidden */}
              <label className="jrpg-button text-left p-4 rounded-none text-white hover:text-yellow-200 flex items-center justify-between cursor-pointer">
                <span>📂 {locale === "pt" ? "Importar Ficha (.json)" : "Import Sheet (.json)"}</span>
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>

            {/* Retro Footer Credits */}
            <div className="text-center text-xs text-white/40 font-mono tracking-widest">
              INSPIRADO EM SEA OF STARS & FFIX • ESTILO PIXEL ART & JRPG
            </div>
          </div>
        )}

        {/* ==================== HERO GALLERY ==================== */}
        {currentScreen === "gallery" && (
          <div className="w-full max-w-3xl jrpg-container p-6 space-y-6">
            <div className="flex justify-between items-center border-b-2 border-white/20 pb-4">
              <h2 className="pixel-font text-xs sm:text-sm text-yellow-300">
                {locale === "pt" ? "🏆 GALERIA DE HERÓIS" : "🏆 HERO GALLERY"}
              </h2>
              <button
                onClick={() => {
                  playCancel();
                  setCurrentScreen("title");
                }}
                className="jrpg-button px-4 py-2"
              >
                {locale === "pt" ? "Voltar" : "Back"}
              </button>
            </div>

            {savedCharacters.length === 0 ? (
              <div className="text-center py-12 text-white/50 space-y-4">
                <p className="pixel-font text-xs">
                  {locale === "pt" ? "Nenhum herói forjado ainda..." : "No heroes forged yet..."}
                </p>
                <button
                  onClick={startManualCreation}
                  className="jrpg-button px-4 py-2 mt-2"
                >
                  {locale === "pt" ? "Criar Primeiro Herói" : "Create First Hero"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar font-mono">
                {savedCharacters.map((char) => {
                  let parsedSheet: CharacterSheet;
                  try {
                    parsedSheet = JSON.parse(char.sheet_json);
                  } catch (e) {
                    return null;
                  }

                  const classSummary = parsedSheet.classes
                    .map((c) => `${c.rpgClass.name} (Lvl ${c.level})`)
                    .join(", ");

                  return (
                    <div
                      key={char.id}
                      className="jrpg-panel p-4 flex flex-col justify-between hover:border-yellow-400 cursor-pointer transition relative group"
                    >
                      <div
                        onClick={() => {
                          playConfirm();
                          setActiveSheet(parsedSheet);
                          setCurrentScreen("sheet");
                        }}
                        className="space-y-2 flex-1"
                      >
                        <p className="pixel-font text-xs text-yellow-300 group-hover:text-yellow-200">
                          {parsedSheet.name}
                        </p>
                        <p className="text-xs text-white/70 italic line-clamp-1">
                          {parsedSheet.identity}
                        </p>
                        <p className="text-xs text-blue-300 line-clamp-1">
                          {classSummary}
                        </p>
                      </div>

                      <div className="flex justify-end gap-2 mt-4 border-t border-white/10 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportJson(parsedSheet);
                          }}
                          className="p-1.5 border border-white/20 hover:border-white text-xs hover:bg-white/10"
                          title="Export JSON"
                        >
                          <Download className="w-3.5 h-3.5 text-cyan-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playCancel();
                            if (confirm(locale === "pt" ? "Tem certeza que deseja apagar este herói?" : "Are you sure you want to delete this hero?")) {
                              deleteCharacterFromDb(char.id);
                            }
                          }}
                          className="p-1.5 border border-red-500/30 hover:border-red-500 text-xs hover:bg-red-500/10"
                          title="Delete Hero"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
                      (manualStep === 3 && (selectedClasses.length === 0 || sumLevels() !== 5)) ||
                      (manualStep === 4 && selectedPowers.length < sumLevels()) ||
                      (manualStep === 5 && selectedPowers.filter((p) => p.power.grantsSpell).length > selectedSpells.length)
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
                      className="w-full bg-[#07071f] border-2 border-white p-3 text-xs outline-none"
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
                      className="w-full bg-[#07071f] border-2 border-white p-3 text-xs outline-none"
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
                      className="w-full bg-[#07071f] border-2 border-white p-3 text-xs outline-none"
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
                    className="w-full bg-[#07071f] border-2 border-white p-3 text-xs outline-none"
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
                {/* Number of classes to select */}
                <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                  <span className="text-xs pixel-font text-yellow-300">
                    {locale === "pt" ? "Quantas classes deseja forjar?" : "How many classes to select?"}
                  </span>

                  <div className="flex gap-2">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          playClick();
                          setClassCount(num);
                          setSelectedClasses([]);
                          setClassLevels({});
                          setSelectedPowers([]);
                          setSelectedSpells([]);
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
                </div>

                {/* Selected Classes Summary & Level Allocation */}
                <div className="jrpg-panel p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs pixel-font text-blue-300">
                      {locale === "pt" ? "Classes Atuais & Níveis" : "Active Classes & Levels"}
                    </p>
                    <span className="text-xs font-mono text-cyan-400">
                      Level Sum: {sumLevels()} / 5
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
                        return (
                          <div key={rc.name} className="flex items-center justify-between bg-black/30 p-2 border border-white/10 font-mono">
                            <span className="text-xs font-bold text-yellow-300">{rc.name}</span>

                            <div className="flex items-center gap-2">
                              <button
                                disabled={lvl <= 1}
                                onClick={() => updateClassLevel(rc.name, lvl - 1)}
                                className="w-6 h-6 flex items-center justify-center border border-white/30 text-xs hover:border-white disabled:opacity-30"
                              >
                                -
                              </button>
                              <span className="text-xs px-2">{lvl}</span>
                              <button
                                disabled={sumLevels() >= 5}
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
                <p className="text-xs font-mono text-blue-300">
                  {locale === "pt"
                    ? "Escolha um poder único para cada nível de suas classes escolhidas"
                    : "Select a unique power for each of your selected class levels"}
                </p>

                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {selectedClasses.map((rc) => {
                    const lvl = classLevels[rc.name] || 1;

                    return (
                      <div key={rc.name} className="space-y-3 bg-black/20 p-4 border border-white/10">
                        <h3 className="pixel-font text-xs text-yellow-300">
                          {rc.name} (Lvl {lvl})
                        </h3>

                        {/* Slots for this class levels */}
                        {Array.from({ length: lvl }).map((_, levelIdx) => {
                          // Find chosen power for this slot
                          const currentChosen = selectedPowers.find(
                            (p) => p.className === rc.name && p.power.maxLevel === levelIdx
                          );

                          return (
                            <div key={levelIdx} className="space-y-2">
                              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">
                                Slot Power {levelIdx + 1}
                              </span>

                              <div className="grid grid-cols-1 gap-2">
                                {rc.powers.map((power) => {
                                  const isSelectedForClass = selectedPowers.some(
                                    (p) => p.className === rc.name && p.power.name === power.name
                                  );
                                  const isChosenThisSlot = currentChosen?.power.name === power.name;

                                  return (
                                    <button
                                      key={power.name}
                                      onClick={() => {
                                        const pToSave = { ...power, maxLevel: levelIdx };
                                        handleSelectPower(rc.name, pToSave, levelIdx);
                                      }}
                                      disabled={isSelectedForClass && !isChosenThisSlot}
                                      className={`p-2.5 border text-left font-mono text-xs flex justify-between items-start transition ${
                                        isChosenThisSlot
                                          ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                                          : isSelectedForClass
                                          ? "opacity-30 border-white/5 cursor-not-allowed"
                                          : "border-white/10 hover:border-white/50"
                                      }`}
                                    >
                                      <div>
                                        <p className="font-bold text-[11px]">{power.name}</p>
                                        <p className="text-[10px] text-white/60 mt-1">
                                          {power.description}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 5: Spells Selection */}
            {manualStep === 5 && (
              <div className="space-y-6">
                <p className="text-xs font-mono text-blue-300">
                  {locale === "pt"
                    ? "Para cada poder de conjuração que você adquiriu, escolha uma magia correspondente"
                    : "For each spell-granting power acquired, select a corresponding starting spell"}
                </p>

                {(() => {
                  const spellGrantingPowers = selectedPowers.filter((p) => p.power.grantsSpell);

                  if (spellGrantingPowers.length === 0) {
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
                      {spellGrantingPowers.map(({ power, className }, idx) => {
                        const rc = selectedClasses.find((c) => c.name === className);
                        const spells = rc?.spells || [];
                        const chosenSpell = selectedSpells.find(
                          (s) => s.className === className && s.grantedByPower === power.name
                        );

                        return (
                          <div key={idx} className="space-y-3 bg-black/20 p-4 border border-white/10">
                            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                              <span className="pixel-font text-xs text-yellow-300">{className}</span>
                              <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-widest">
                                Granted by: {power.name}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {spells.map((spell) => {
                                const isSelected = chosenSpell?.spell.name === spell.name;
                                return (
                                  <button
                                    key={spell.name}
                                    onClick={() => handleSelectSpell(className, power.name, spell)}
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

        {/* ==================== CHARACTER SHEET DISPLAY ==================== */}
        {currentScreen === "sheet" && activeSheet && (
          <div className="w-full max-w-3xl jrpg-container p-6 space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex justify-between items-center border-b-2 border-white/20 pb-4">
              <h2 className="pixel-font text-xs sm:text-sm text-yellow-300">
                {strings.sheet.title}
              </h2>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    saveCharacterToDb(activeSheet);
                    playConfirm();
                    alert(locale === "pt" ? "Herói salvo com sucesso no banco de dados!" : "Hero successfully saved to SQLite database!");
                  }}
                  className="jrpg-button px-3 py-1.5 text-[10px] flex items-center gap-1.5"
                >
                  <Save className="w-3 h-3 text-green-400" />
                  {locale === "pt" ? "Salvar Herói" : "Save Hero"}
                </button>

                <button
                  onClick={() => handleExportJson(activeSheet)}
                  className="jrpg-button px-3 py-1.5 text-[10px] flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  {locale === "pt" ? "Exportar" : "Export"}
                </button>

                <button
                  onClick={() => {
                    playCancel();
                    setCurrentScreen("title");
                  }}
                  className="jrpg-button px-3 py-1.5 text-[10px]"
                >
                  {locale === "pt" ? "Menu Principal" : "Main Menu"}
                </button>
              </div>
            </div>

            {/* Character Info Panels JRPG Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              {/* Left Column: Ident, Classes */}
              <div className="space-y-4">
                <div className="jrpg-panel p-4 space-y-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{strings.sheet.name}</p>
                  <p className="text-sm font-bold text-yellow-300">{activeSheet.name}</p>

                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">{strings.sheet.identity}</p>
                  <p className="text-xs italic text-cyan-200">"{activeSheet.identity}"</p>

                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">{strings.sheet.theme}</p>
                  <p className="text-xs text-white">{activeSheet.theme}</p>
                </div>

                <div className="jrpg-panel p-4 space-y-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{strings.sheet.classesHeading}</p>
                  <p className="text-[11px] text-yellow-300 font-bold">
                    {strings.sheet.formatClassSummary(
                      activeSheet.classes.map((c) => c.rpgClass.name),
                      activeSheet.classes.map((c) => c.level)
                    )}
                  </p>
                  <p className="text-[10px] text-cyan-400">Level 5 Hero</p>
                </div>
              </div>

              {/* Center Column: Stats & Derived */}
              <div className="space-y-4">
                <div className="jrpg-panel p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-white/10 pb-1 mb-2">
                    {strings.sheet.attributesHeading}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {strings.attributeOrder.map((key) => (
                      <div key={key} className="flex justify-between items-center bg-black/20 p-2 border border-white/5">
                        <span className="font-bold text-blue-300">{key}:</span>
                        <span className="font-bold text-yellow-100">d{activeSheet.attributes[key] || 8}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="jrpg-panel p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-white/10 pb-1 mb-2">
                    {strings.sheet.derivedStatsHeading}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between items-center bg-red-950/20 p-2 border border-red-900/30">
                      <span className="font-bold text-red-400">{strings.sheet.hp}:</span>
                      <span className="font-bold text-red-200">{activeSheet.derivedStats.hp}</span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-950/20 p-2 border border-blue-900/30">
                      <span className="font-bold text-blue-400">{strings.sheet.mp}:</span>
                      <span className="font-bold text-blue-200">{activeSheet.derivedStats.mp}</span>
                    </div>
                    <div className="flex justify-between items-center bg-green-950/20 p-2 border border-green-900/30 col-span-2">
                      <span className="font-bold text-green-400">{strings.sheet.ip}:</span>
                      <span className="font-bold text-green-200">{activeSheet.derivedStats.ip}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Combat / Protection */}
              <div className="space-y-4">
                <div className="jrpg-panel p-4 space-y-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-white/10 pb-1 mb-2">
                    {locale === "pt" ? "DEFESAS" : "DEFENSES"}
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-400">{strings.sheet.defense}:</span>
                      <span className="font-bold text-yellow-300">{activeSheet.derivedStats.defense}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{strings.sheet.magicDefense}:</span>
                      <span className="font-bold text-yellow-300">{activeSheet.derivedStats.magicDefense}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{strings.sheet.initiative}:</span>
                      <span className="font-bold text-yellow-300">
                        {activeSheet.derivedStats.initiative >= 0 ? "+" : ""}
                        {activeSheet.derivedStats.initiative}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="jrpg-panel p-4 space-y-1.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-white/10 pb-1">
                    {locale === "pt" ? "PROTEÇÕES EQUIPADAS" : "EQUIPPED ARMOR"}
                  </p>
                  <p className="text-[10px] text-cyan-300 leading-normal">
                    🛡️ {activeSheet.equipment.armor?.name || strings.sheet.noArmor} <br />
                    🛡️ {activeSheet.equipment.shield?.name || strings.sheet.noShield}
                  </p>
                </div>
              </div>
            </div>

            {/* Combat Actions & Weapons */}
            <div className="jrpg-panel p-4 space-y-3 font-mono text-xs">
              <p className="text-[10px] text-yellow-300 font-bold border-b border-white/10 pb-1 mb-2 uppercase">
                ⚔️ {strings.sheet.combatHeading}
              </p>

              <div className="space-y-2">
                {activeSheet.equipment.weapons.map((w, idx) => (
                  <div key={idx} className="bg-black/30 p-2.5 border border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <span className="font-bold text-yellow-200 text-sm">{w.name}</span>
                      <span className="text-[10px] text-gray-400 block sm:inline sm:ml-2">({w.type === "melee" ? "Melee" : "Ranged"})</span>
                    </div>
                    <div className="text-[11px] text-cyan-300">
                      {formatWeaponAttackString(w, activeSheet.attributes)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-[10px] text-gray-400 flex flex-col sm:flex-row justify-between border-t border-white/5 gap-2">
                <span>
                  {strings.sheet.equipmentSpent} {activeSheet.equipmentSpent}z
                </span>
                <span>
                  💰 {strings.sheet.money} {activeSheet.money}z{" "}
                  {strings.sheet.moneyRoll(
                    activeSheet.moneyRoll.dice,
                    activeSheet.moneyRoll.bonus,
                    activeSheet.money - activeSheet.moneyRoll.bonus
                  )}
                </span>
              </div>
            </div>

            {/* Powers list */}
            <div className="jrpg-panel p-4 space-y-4 font-mono text-xs">
              <p className="text-[10px] text-yellow-300 font-bold border-b border-white/10 pb-1 mb-2 uppercase">
                ✨ {locale === "pt" ? "CLASSES & SEUS PODERES" : "POWERS REGISTRY"}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSheet.powers.map((p, idx) => (
                  <div key={idx} className="bg-black/20 p-3 border border-white/5 space-y-1">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="font-bold text-yellow-100">{p.power.name}</span>
                      <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 border border-yellow-400/30">
                        {p.className}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/75 leading-relaxed pt-1">
                      {p.power.mechanics || p.power.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Spells section */}
            {activeSheet.spells.length > 0 && (
              <div className="jrpg-panel p-4 space-y-4 font-mono text-xs">
                <p className="text-[10px] text-yellow-300 font-bold border-b border-white/10 pb-1 mb-2 uppercase">
                  🔮 {strings.sheet.spellsHeading}
                </p>

                <div className="space-y-3">
                  {activeSheet.spells.map((s, idx) => {
                    const isOffensive = s.spell.isOffensive;
                    return (
                      <div key={idx} className="bg-black/20 p-3 border border-white/5 space-y-2">
                        <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                          <div>
                            <span className="font-bold text-cyan-200 text-sm">{s.spell.name}</span>
                            <span className={`text-[8px] px-1.5 py-0.5 ml-2 font-bold ${
                              isOffensive ? "bg-red-950/40 text-red-400 border border-red-500/30" : "bg-green-950/40 text-green-400 border border-green-500/30"
                            }`}>
                              {isOffensive ? strings.sheet.offensiveTag : strings.sheet.supportTag}
                            </span>
                          </div>

                          <span className="text-[9px] text-gray-400">
                            {s.className} · {s.grantedByPower}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10px] text-cyan-300 font-bold bg-black/40 p-1.5">
                          <span>{strings.sheet.spellCost(s.spell.pmCost)}</span>
                          <span>{strings.sheet.spellTarget(s.spell.target)}</span>
                          <span>Duração: {s.spell.duration}</span>
                        </div>

                        <p className="text-[10px] text-white/80 leading-relaxed">
                          {s.spell.mechanics}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
