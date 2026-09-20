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
  onLevelUp?: () => void;
  formatWeaponAttack: (weapon: Weapon, attributes: AttributeStats) => string;
  /** Data URI of the hero photo, or null when there is none. */
  photoBase64?: string | null;
  /** Opens the file picker to attach/replace the hero photo (only for saved heroes). */
  onChangePhoto?: () => void;
  /** True when a saved hero is being edited (gallery reopen). */
  isEditing?: boolean;
  /** Updates a sheet field inline (only wired when editing a saved hero). */
  onEditField?: (field: "name" | "identity" | "theme", value: string) => void;
}

/** Renders a character sheet while delegating persistence, export, and navigation to the parent. */
export const CharacterSheetView = ({
  locale,
  strings,
  sheet,
  onSave,
  onExport,
  onBack,
  onLevelUp,
  formatWeaponAttack,
  photoBase64,
  onChangePhoto,
  isEditing,
  onEditField,
}: CharacterSheetViewProps) => {
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <div className="w-full max-w-3xl jrpg-container p-6 space-y-6 animate-[fadeIn_0.3s_ease-out] relative">
      <div className="flex justify-between items-center border-b-2 border-white/20 pb-4 no-print">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {photoBase64 ? (
              <img
                src={photoBase64}
                alt={strings.sheet.photoPlaceholder}
                className="w-16 h-16 rounded-sm object-cover border-2 border-white/30 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]"
              />
            ) : (
              <div className="w-16 h-16 rounded-sm border-2 border-dashed border-white/30 bg-black/40 flex items-center justify-center text-white/40 text-[8px] font-mono uppercase tracking-wider text-center px-1">
                {strings.sheet.noPhoto}
              </div>
            )}
            {isEditing && onChangePhoto && (
              <button
                type="button"
                onClick={onChangePhoto}
                title={strings.sheet.changePhoto}
                className="absolute -top-2 -right-2 px-1 py-0.5 bg-yellow-300 text-black text-[9px] font-bold rounded border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,0.4)] hover:bg-yellow-200"
              >
                📷
              </button>
            )}
          </div>
          <div>
            <h2 className="pixel-font text-xs sm:text-sm text-yellow-300">
              {strings.sheet.title}
            </h2>
            {isEditing && (
              <p className="text-[9px] text-yellow-400/80 font-mono mt-0.5">
                ● {strings.sheet.editingSavedHero}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {onLevelUp && sheet.level < 50 && (
            <button
              onClick={onLevelUp}
              className="jrpg-button px-3 py-1.5 text-[10px] flex items-center gap-1.5 border-yellow-400 bg-yellow-950/40 text-yellow-300 hover:bg-yellow-900/60"
            >
              ⭐ {locale === "pt" ? "Subir Nível (Level Up)" : "Level Up"}
            </button>
          )}

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
                  {isEditing && onEditField ? (
                    <input
                      type="text"
                      value={sheet.name}
                      onChange={(event) => onEditField("name", event.target.value)}
                      className="w-full bg-black/50 border border-white/30 rounded px-2 py-1 text-sm font-bold text-yellow-300 focus:border-yellow-400 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm font-bold text-yellow-300">{sheet.name}</p>
                  )}

                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">{strings.sheet.identity}</p>
                  {isEditing && onEditField ? (
                    <input
                      type="text"
                      value={sheet.identity}
                      onChange={(event) => onEditField("identity", event.target.value)}
                      className="w-full bg-black/50 border border-white/30 rounded px-2 py-1 text-xs italic text-cyan-200 focus:border-cyan-300 focus:outline-none"
                    />
                  ) : (
                    <p className="text-xs italic text-cyan-200">"{sheet.identity}"</p>
                  )}

                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">{strings.sheet.theme}</p>
                  {isEditing && onEditField ? (
                    <input
                      type="text"
                      value={sheet.theme}
                      onChange={(event) => onEditField("theme", event.target.value)}
                      className="w-full bg-black/50 border border-white/30 rounded px-2 py-1 text-xs text-white focus:border-white focus:outline-none"
                    />
                  ) : (
                    <p className="text-xs text-white">{sheet.theme}</p>
                  )}
                </div>

                <div className="jrpg-panel p-4 space-y-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{strings.sheet.classesHeading}</p>
                  <p className="text-[11px] text-yellow-300 font-bold">
                    {strings.sheet.formatClassSummary(
                      sheet.classes.map((c) => c.rpgClass.name),
                      sheet.classes.map((c) => c.level)
                    )}
                  </p>
                  <p className="text-[10px] text-cyan-400 font-bold">
                    {locale === "pt" ? `Nível Total: ${sheet.level}` : `Total Level: ${sheet.level}`}
                  </p>
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

            {/* Heroic Powers list */}
            {sheet.heroicPowers && sheet.heroicPowers.length > 0 && (
              <div className="jrpg-panel p-4 space-y-4 font-mono text-xs border border-yellow-500/40">
                <p className="text-[10px] text-yellow-300 font-bold border-b border-white/10 pb-1 mb-2 uppercase">
                  👑 {locale === "pt" ? "PODERES HERÓICOS" : "HEROIC POWERS"}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sheet.heroicPowers.map((hp, idx) => (
                    <div key={idx} className="bg-yellow-950/20 p-3 border border-yellow-500/30 space-y-1">
                      <div className="flex justify-between items-center border-b border-yellow-500/20 pb-1">
                        <span className="font-bold text-yellow-200">{hp.power.name}</span>
                        <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 border border-yellow-400/30">
                          {hp.source}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/80 leading-relaxed pt-1">
                        {hp.power.mechanics || hp.power.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Powers list */}
            <div className="jrpg-panel p-4 space-y-4 font-mono text-xs">
              <p className="text-[10px] text-yellow-300 font-bold border-b border-white/10 pb-1 mb-2 uppercase">
                ✨ {locale === "pt" ? "CLASSES & SEUS PODERES" : "POWERS REGISTRY"}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sheet.powers.map((p, idx) => (
                  <div key={idx} className="bg-black/20 p-3 border border-white/5 space-y-1">
                    <div className="flex justify-between items-center border-b border-white/5 pb-1">
                      <span className="font-bold text-yellow-100">{p.power.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 border border-yellow-400/30">
                          {p.className}
                        </span>
                        <span className="text-[9px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 border border-cyan-400/30 font-bold">
                          {strings.sheet.powerRank(p.rank, p.power.maxLevel)}
                        </span>
                      </div>
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

