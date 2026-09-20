import { Download, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale } from "../i18n/types";
import type { CharacterSheet } from "../types";
import type { SavedCharacterRecord } from "../services/characterRepository";
import { parseCharacterSheet } from "../services/characterFileService";

interface HeroGalleryProps {
  locale: Locale;
  records: SavedCharacterRecord[];
  onBack: () => void;
  onCreateFirst: () => void;
  onOpen: (sheet: CharacterSheet, recordId: number) => void;
  onLevelUp: (sheet: CharacterSheet, recordId: number) => void;
  onExport: (sheet: CharacterSheet) => void;
  onDelete: (id: number) => void;
  /** Fetches a hero photo as a data URI, lazily, for thumbnails. */
  onLoadPhoto?: (recordId: number) => Promise<string | null>;
}

/** Lazily loads the hero photo for a single card thumbnail. */
const HeroPhotoThumb = ({
  recordId,
  hasPhoto,
  onLoadPhoto,
}: {
  recordId: number;
  hasPhoto: boolean;
  onLoadPhoto: (recordId: number) => Promise<string | null>;
}) => {
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto) return;
    let cancelled = false;
    onLoadPhoto(recordId)
      .then((dataUri) => {
        if (!cancelled) setPhoto(dataUri);
      })
      .catch(() => {
        if (!cancelled) setPhoto(null);
      });
    return () => {
      cancelled = true;
    };
  }, [recordId, hasPhoto, onLoadPhoto]);

  if (!photo) return null;
  return (
    <img
      src={photo}
      alt=""
      className="w-10 h-10 rounded-sm object-cover border border-white/30 shrink-0"
    />
  );
};

/** Renders persisted character sheets and delegates all side effects to the parent. */
export const HeroGallery = ({
  locale,
  records,
  onBack,
  onCreateFirst,
  onOpen,
  onLevelUp,
  onExport,
  onDelete,
  onLoadPhoto,
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

          // Retrocompatibility: old sheets may lack the level field
          const sheetLevel = (sheet.level ?? 5) as number;
          const classSummary = sheet.classes
            .map((selectedClass) => `${selectedClass.rpgClass.name} (Lvl ${selectedClass.level})`)
            .join(", ");

          return (
            <div key={record.id} className="jrpg-panel p-4 flex flex-col justify-between hover:border-yellow-400 transition relative group">
              <button onClick={() => onOpen(sheet, record.id)} className="space-y-2 flex-1 text-left w-full">
                <div className="flex items-center justify-between gap-2">
                  {onLoadPhoto && (
                    <HeroPhotoThumb
                      recordId={record.id}
                      hasPhoto={Boolean(record.photo_path)}
                      onLoadPhoto={onLoadPhoto}
                    />
                  )}
                  <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                    <p className="pixel-font text-xs text-yellow-300 group-hover:text-yellow-200">{sheet.name}</p>
                    <span className="text-[9px] px-1.5 py-0.5 bg-yellow-950/60 border border-yellow-500/40 text-yellow-400 font-mono font-bold shrink-0">
                      {locale === "pt" ? `Nv. ${sheetLevel}` : `Lv. ${sheetLevel}`}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-white/70 italic line-clamp-1">{sheet.identity}</p>
                <p className="text-xs text-blue-300 line-clamp-1">{classSummary}</p>
              </button>

              <div className="flex justify-end gap-2 mt-4 border-t border-white/10 pt-2">
                {sheetLevel < 50 && (
                  <button
                    onClick={() => onLevelUp(sheet, record.id)}
                    className="p-1.5 border border-yellow-500/40 hover:border-yellow-400 text-xs hover:bg-yellow-900/30"
                    title={locale === "pt" ? "Subir Nível" : "Level Up"}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
                  </button>
                )}
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