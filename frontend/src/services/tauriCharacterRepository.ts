import type { CharacterSheet } from "../types";
import { invokeTauri } from "../shared/tauri";
import type { CharacterRepository, SavedCharacterRecord } from "./characterRepository";

/** Creates a repository backed by the Rust SQLite commands. */
export const createTauriCharacterRepository = (): CharacterRepository => ({
  load: (): Promise<SavedCharacterRecord[]> => invokeTauri<SavedCharacterRecord[]>("load_characters"),
  save: async (sheet: CharacterSheet): Promise<void> => {
    await invokeTauri<number>("save_character", { name: sheet.name, sheetJson: JSON.stringify(sheet) });
  },
  delete: async (id: number): Promise<void> => {
    await invokeTauri<void>("delete_character", { id });
  },
});