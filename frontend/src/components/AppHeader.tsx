import { Languages, Sparkle, Volume2, VolumeX } from "lucide-react";
import type { Locale } from "../i18n/types";

interface AppHeaderProps {
  locale: Locale;
  soundOn: boolean;
  onLocaleToggle: () => void;
  onSoundToggle: () => void;
}

/** Renders the global retro HUD and its application-level controls. */
export const AppHeader = ({ locale, soundOn, onLocaleToggle, onSoundToggle }: AppHeaderProps) => (
  <header className="relative z-10 p-4 flex justify-between items-center bg-[#07071f]/80 border-b-4 border-double border-white/20">
    <div className="flex items-center gap-3">
      <Sparkle className="text-yellow-400 w-6 h-6 animate-pulse" />
      <h1 className="pixel-font text-xs sm:text-sm tracking-wider text-yellow-300">FABULA ULTIMA</h1>
    </div>

    <div className="flex items-center gap-4">
      <button
        onClick={onSoundToggle}
        className="flex items-center justify-center p-2 rounded-md hover:bg-white/10 active:scale-95 transition"
        title={soundOn ? "Mute Retro Sounds" : "Unmute Retro Sounds"}
      >
        {soundOn ? <Volume2 className="w-5 h-5 text-yellow-400" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
      </button>
      <button
        onClick={onLocaleToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 border-white/20 text-xs pixel-font hover:bg-white/10"
      >
        <Languages className="w-4 h-4 text-cyan-400" />
        {locale === "pt" ? "PT" : "EN"}
      </button>
    </div>
  </header>
);