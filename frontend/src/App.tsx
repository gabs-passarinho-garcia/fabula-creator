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
import { generateRandomCharacter } from "./domain/characterCreation";
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
    await repository.save(sheet);
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

  // Mode selections
  const handleRandomCreation = () => {
    playConfirm();
    const sheet = generateRandomCharacter(gameData, strings);

    setActiveSheet(sheet);
    setCurrentScreen("sheet");
    setTimeout(() => {
      playLevelUp();
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }, 150);
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
    const derivedStats = calculateDerivedStats(
      assignedStats,
      selectedClasses,
      purchaseResult.equipment,
      5,
      strings,
    );

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
          <TitleScreen
            strings={strings}
            locale={locale}
            localeLabel={locale === "pt" ? "Galeria de Heróis" : "Hero Gallery"}
            savedCharacterCount={savedCharacters.length}
            onManualCreation={startManualCreation}
            onRandomCreation={handleRandomCreation}
            onGallery={() => { playConfirm(); setCurrentScreen("gallery"); }}
            onImport={handleImportJson}
          />
        )}

        {/* ==================== HERO GALLERY ==================== */}
        {currentScreen === "gallery" && (
          <HeroGallery
            locale={locale}
            records={savedCharacters}
            onBack={() => { playCancel(); setCurrentScreen("title"); }}
            onCreateFirst={startManualCreation}
            onOpen={(sheet) => { playConfirm(); setActiveSheet(sheet); setCurrentScreen("sheet"); }}
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
            formatWeaponAttack={formatWeaponAttackString}
          />
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
