import type { CharacterSheet } from "../types";
import { invokeTauri } from "../shared/tauri";
import type { CharacterRepository, SavedCharacterRecord } from "./characterRepository";

/** Creates a repository backed by the Rust SQLite commands. */
export const createTauriCharacterRepository = (): CharacterRepository => ({
  load: (): Promise<SavedCharacterRecord[]> => invokeTauri<SavedCharacterRecord[]>("load_characters"),
  save: (sheet: CharacterSheet): Promise<number> =>
    invokeTauri<number>("save_character", { name: sheet.name, sheetJson: JSON.stringify(sheet) }),
  update: async (id: number, sheet: CharacterSheet): Promise<void> => {
    await invokeTauri<void>("update_character", {
      id,
      name: sheet.name,
      sheetJson: JSON.stringify(sheet),
    });
  },
  delete: async (id: number): Promise<void> => {
    await invokeTauri<void>("delete_character", { id });
  },
  savePhoto: async (id: number, base64Data: string): Promise<void> => {
    await invokeTauri<void>("save_character_photo", { id, base64Data });
  },
  deletePhoto: async (id: number): Promise<void> => {
    await invokeTauri<void>("delete_character_photo", { id });
  },
  getPhoto: (id: number): Promise<string | null> =>
    invokeTauri<string | null>("get_character_photo", { id }),
});