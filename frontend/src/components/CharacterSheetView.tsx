import { useState } from "react";
import type { Locale } from "../i18n/types";
import type { LocaleStrings } from "../i18n/types";
import type { AttributeStats, CharacterSheet, Weapon } from "../types";
import { Download, FileText, Printer, Save, X } from "lucide-react";
import { printCharacterSheetPDF } from "../services/characterFileService";

interface CharacterSheetViewProps {
  locale: Locale;
  strings: LocaleStrings;
  sheet: CharacterSheet;
  onSave: (sheet: CharacterSheet) => void;
  onExport: (sheet: CharacterSheet) => void;
  onBack: () => void;
  formatWeaponAttack: (weapon: Weapon, attributes: AttributeStats) => string;
}

/** Renders a character sheet while delegating persistence, export, and navigation to the parent. */
export const CharacterSheetView = ({
  locale,
  strings,
  sheet,
  onSave,
  onExport,
  onBack,
  formatWeaponAttack,
}: CharacterSheetViewProps) => {
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <div className="w-full max-w-3xl jrpg-container p-6 space-y-6 animate-[fadeIn_0.3s_ease-out] relative">
      <div className="flex justify-between items-center border-b-2 border-white/20 pb-4 no-print">
        <h2 className="pixel-font text-xs sm:text-sm text-yellow-300">
          {strings.sheet.title}
        </h2>

        <div className="flex gap-2">
          <button
            onClick={() => {
              onSave(sheet);
              alert(locale === "pt" ? "Herói salvo com sucesso no banco de dados!" : "Hero successfully saved to SQLite database!");
            }}
            className="jrpg-button px-3 py-1.5 text-[10px] flex items-center gap-1.5"
          >
            <Save className="w-3 h-3 text-green-400" />
            {locale === "pt" ? "Salvar Herói" : "Save Hero"}
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="jrpg-button px-3 py-1.5 text-[10px] flex items-center gap-1.5"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            {locale === "pt" ? "Exportar" : "Export"}
          </button>

          <button
            onClick={() => {
              onBack();
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
                  <p className="text-sm font-bold text-yellow-300">{sheet.name}</p>

                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">{strings.sheet.identity}</p>
                  <p className="text-xs italic text-cyan-200">"{sheet.identity}"</p>

                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">{strings.sheet.theme}</p>
                  <p className="text-xs text-white">{sheet.theme}</p>
                </div>

                <div className="jrpg-panel p-4 space-y-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{strings.sheet.classesHeading}</p>
                  <p className="text-[11px] text-yellow-300 font-bold">
                    {strings.sheet.formatClassSummary(
                      sheet.classes.map((c) => c.rpgClass.name),
                      sheet.classes.map((c) => c.level)
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
                        <span className="font-bold text-yellow-100">d{sheet.attributes[key] || 8}</span>
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
                      <span className="font-bold text-red-200">{sheet.derivedStats.hp}</span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-950/20 p-2 border border-blue-900/30">
                      <span className="font-bold text-blue-400">{strings.sheet.mp}:</span>
                      <span className="font-bold text-blue-200">{sheet.derivedStats.mp}</span>
                    </div>
                    <div className="flex justify-between items-center bg-green-950/20 p-2 border border-green-900/30 col-span-2">
                      <span className="font-bold text-green-400">{strings.sheet.ip}:</span>
                      <span className="font-bold text-green-200">{sheet.derivedStats.ip}</span>
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
                      <span className="font-bold text-yellow-300">{sheet.derivedStats.defense}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{strings.sheet.magicDefense}:</span>
                      <span className="font-bold text-yellow-300">{sheet.derivedStats.magicDefense}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{strings.sheet.initiative}:</span>
                      <span className="font-bold text-yellow-300">
                        {sheet.derivedStats.initiative >= 0 ? "+" : ""}
                        {sheet.derivedStats.initiative}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="jrpg-panel p-4 space-y-1.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-white/10 pb-1">
                    {locale === "pt" ? "PROTEÇÕES EQUIPADAS" : "EQUIPPED ARMOR"}
                  </p>
                  <p className="text-[10px] text-cyan-300 leading-normal">
                    🛡️ {sheet.equipment.armor?.name || strings.sheet.noArmor} <br />
                    🛡️ {sheet.equipment.shield?.name || strings.sheet.noShield}
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
                {sheet.equipment.weapons.map((w, idx) => (
                  <div key={idx} className="bg-black/30 p-2.5 border border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <span className="font-bold text-yellow-200 text-sm">{w.name}</span>
                      <span className="text-[10px] text-gray-400 block sm:inline sm:ml-2">({w.type === "melee" ? "Melee" : "Ranged"})</span>
                    </div>
                    <div className="text-[11px] text-cyan-300">
                      {formatWeaponAttack(w, sheet.attributes)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-[10px] text-gray-400 flex flex-col sm:flex-row justify-between border-t border-white/5 gap-2">
                <span>
                  {strings.sheet.equipmentSpent} {sheet.equipmentSpent}z
                </span>
                <span>
                  💰 {strings.sheet.money} {sheet.money}z{" "}
                  {strings.sheet.moneyRoll(
                    sheet.moneyRoll.dice,
                    sheet.moneyRoll.bonus,
                    sheet.money - sheet.moneyRoll.bonus
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
                {sheet.powers.map((p, idx) => (
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
            {sheet.spells.length > 0 && (
              <div className="jrpg-panel p-4 space-y-4 font-mono text-xs">
                <p className="text-[10px] text-yellow-300 font-bold border-b border-white/10 pb-1 mb-2 uppercase">
                  🔮 {strings.sheet.spellsHeading}
                </p>

                <div className="space-y-3">
                  {sheet.spells.map((s, idx) => {
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

      {/* Export Options Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 no-print animate-[fadeIn_0.15s_ease-out]">
          <div className="jrpg-panel max-w-sm w-full p-5 space-y-4 shadow-2xl relative border-2 border-yellow-300">
            <div className="flex justify-between items-center border-b border-white/20 pb-2">
              <h3 className="pixel-font text-xs text-yellow-300 flex items-center gap-2">
                <Download className="w-4 h-4 text-cyan-400" />
                {locale === "pt" ? "EXPORTAR HERÓI" : "EXPORT HERO"}
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-gray-300 font-mono">
              {locale === "pt"
                ? "Escolha como deseja exportar esta ficha:"
                : "Choose how to export this character sheet:"}
            </p>

            <div className="space-y-2.5 font-mono">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  printCharacterSheetPDF(sheet);
                }}
                className="w-full jrpg-button p-3 text-left flex items-start gap-3 hover:border-yellow-300 group cursor-pointer"
              >
                <Printer className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-yellow-200 group-hover:text-white">
                    {locale === "pt" ? "📄 Exportar como PDF (Visual)" : "📄 Export as PDF (Visual)"}
                  </div>
                  <div className="text-[10px] text-gray-400 font-sans mt-0.5 leading-normal">
                    {locale === "pt"
                      ? "Gera um PDF formatado com layout A4 nítido pronto para impressão ou guardar no disco."
                      : "Generates a clean visual PDF formatted for A4 printing."}
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowExportModal(false);
                  onExport(sheet);
                }}
                className="w-full jrpg-button p-3 text-left flex items-start gap-3 hover:border-cyan-300 group cursor-pointer"
              >
                <FileText className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-cyan-200 group-hover:text-white">
                    {locale === "pt" ? "💾 Exportar como JSON (Dados)" : "💾 Export as JSON (Data)"}
                  </div>
                  <div className="text-[10px] text-gray-400 font-sans mt-0.5 leading-normal">
                    {locale === "pt"
                      ? "Baixa o arquivo .json de dados para fazer backup e reimportar no futuro."
                      : "Downloads a .json file for backup and re-importing later."}
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowExportModal(false)}
                className="jrpg-button px-3 py-1 text-[10px]"
              >
                {locale === "pt" ? "Cancelar" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

