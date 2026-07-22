import { Download, Trash2 } from "lucide-react";
import type { Locale } from "../i18n/types";
import type { CharacterSheet } from "../types";
import type { SavedCharacterRecord } from "../services/characterRepository";
import { parseCharacterSheet } from "../services/characterFileService";

interface HeroGalleryProps {
  locale: Locale;
  records: SavedCharacterRecord[];
  onBack: () => void;
  onCreateFirst: () => void;
  onOpen: (sheet: CharacterSheet) => void;
  onExport: (sheet: CharacterSheet) => void;
  onDelete: (id: number) => void;
}

/** Renders persisted character sheets and delegates all side effects to the parent. */
export const HeroGallery = ({
  locale,
  records,
  onBack,
  onCreateFirst,
  onOpen,
  onExport,
  onDelete,
}: HeroGalleryProps) => (
  <div className="w-full max-w-3xl jrpg-container p-6 space-y-6">
    <div className="flex justify-between items-center border-b-2 border-white/20 pb-4">
      <h2 className="pixel-font text-xs sm:text-sm text-yellow-300">
        {locale === "pt" ? "🏆 GALERIA DE HERÓIS" : "🏆 HERO GALLERY"}
      </h2>
      <button onClick={onBack} className="jrpg-button px-4 py-2">
        {locale === "pt" ? "Voltar" : "Back"}
      </button>
    </div>

    {records.length === 0 ? (
      <div className="text-center py-12 text-white/50 space-y-4">
        <p className="pixel-font text-xs">
          {locale === "pt" ? "Nenhum herói forjado ainda..." : "No heroes forged yet..."}
        </p>
        <button onClick={onCreateFirst} className="jrpg-button px-4 py-2 mt-2">
          {locale === "pt" ? "Criar Primeiro Herói" : "Create First Hero"}
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar font-mono">
        {records.map((record) => {
          let sheet: CharacterSheet;
          try {
            sheet = parseCharacterSheet(record.sheet_json);
          } catch {
            return null;
          }

          const classSummary = sheet.classes
            .map((selectedClass) => `${selectedClass.rpgClass.name} (Lvl ${selectedClass.level})`)
            .join(", ");

          return (
            <div key={record.id} className="jrpg-panel p-4 flex flex-col justify-between hover:border-yellow-400 cursor-pointer transition relative group">
              <button onClick={() => onOpen(sheet)} className="space-y-2 flex-1 text-left w-full">
                <p className="pixel-font text-xs text-yellow-300 group-hover:text-yellow-200">{sheet.name}</p>
                <p className="text-xs text-white/70 italic line-clamp-1">{sheet.identity}</p>
                <p className="text-xs text-blue-300 line-clamp-1">{classSummary}</p>
              </button>

              <div className="flex justify-end gap-2 mt-4 border-t border-white/10 pt-2">
                <button
                  onClick={() => onExport(sheet)}
                  className="p-1.5 border border-white/20 hover:border-white text-xs hover:bg-white/10"
                  title="Export JSON"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                </button>
                <button
                  onClick={() => onDelete(record.id)}
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
);