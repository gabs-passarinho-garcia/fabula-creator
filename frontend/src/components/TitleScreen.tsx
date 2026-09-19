import { ChevronRight, Upload } from "lucide-react";
import type React from "react";
import type { LocaleStrings } from "../i18n/types";
import type { Locale } from "../i18n/types";

interface TitleScreenProps {
  strings: LocaleStrings;
  locale: Locale;
  localeLabel: string;
  savedCharacterCount: number;
  randomTargetLevel: number;
  onRandomTargetLevelChange: (level: number) => void;
  onManualCreation: () => void;
  onRandomCreation: () => void;
  onGallery: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Renders the main menu without owning navigation or creation state. */
export const TitleScreen = ({
  strings,
  locale,
  localeLabel,
  savedCharacterCount,
  randomTargetLevel,
  onRandomTargetLevelChange,
  onManualCreation,
  onRandomCreation,
  onGallery,
  onImport,
}: TitleScreenProps) => (
  <div className="w-full max-w-xl text-center space-y-8 my-8 flex flex-col items-center">
    <div className="jrpg-container p-6 sm:p-8 w-full">
      <h2 className="pixel-text-lg text-yellow-300 leading-normal animate-pulse text-center drop-shadow-md mb-2">
        {strings.introTitle}
      </h2>
      <p className="text-xs text-blue-300 tracking-widest pixel-font mt-4">LEGENDARY CHARACTER CREATOR v2</p>
    </div>

    <div className="flex flex-col gap-4 w-full max-w-md">
      <button onClick={onManualCreation} className="jrpg-button text-left p-4 rounded-none text-white hover:text-yellow-200 flex items-center justify-between">
        <span>⚔️ {strings.modeManual}</span><ChevronRight className="w-4 h-4 animate-bounce" />
      </button>

      {/* Random Creation with level selector */}
      <div className="jrpg-button p-4 space-y-3 border-white/30">
        <div
          onClick={onRandomCreation}
          className="flex items-center justify-between cursor-pointer hover:text-yellow-200 text-white"
        >
          <span>🎲 {strings.modeRandom}</span>
          <ChevronRight className="w-4 h-4" />
        </div>
        <div className="border-t border-white/10 pt-3 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-gray-400 uppercase tracking-widest">
              {locale === "pt" ? "Nível Inicial:" : "Starting Level:"}
            </span>
            <span className="text-yellow-300 font-bold px-2 py-0.5 bg-yellow-950/40 border border-yellow-500/40">
              {locale === "pt" ? `Nv. ${randomTargetLevel}` : `Lv. ${randomTargetLevel}`}
              {randomTargetLevel >= 10 && randomTargetLevel < 50 && (
                <span className="text-[8px] text-cyan-400 ml-1">
                  {locale === "pt" ? "(Maestria possível)" : "(Mastery possible)"}
                </span>
              )}
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={1}
            value={randomTargetLevel}
            onChange={(e) => onRandomTargetLevelChange(Number(e.target.value))}
            className="w-full accent-yellow-400 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex justify-between text-[9px] text-gray-500 font-mono">
            <span>5</span>
            <span className="text-cyan-500/60">20</span>
            <span className="text-purple-500/60">40</span>
            <span>50</span>
          </div>
        </div>
      </div>

      <button onClick={onGallery} className="jrpg-button text-left p-4 rounded-none text-white hover:text-yellow-200 flex items-center justify-between">
        <span>🏆 {localeLabel}</span>
        <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded border border-yellow-400/30">{savedCharacterCount}</span>
      </button>
      <label className="jrpg-button text-left p-4 rounded-none text-white hover:text-yellow-200 flex items-center justify-between cursor-pointer">
        <span>📂 {locale === "pt" ? "Importar Ficha (.json)" : "Import Sheet (.json)"}</span>
        <Upload className="w-4 h-4" />
        <input type="file" accept=".json" onChange={onImport} className="hidden" />
      </label>
    </div>

    <div className="text-center text-xs text-white/40 font-mono tracking-widest">INSPIRADO EM SEA OF STARS & FFIX • ESTILO PIXEL ART & JRPG</div>
  </div>
);