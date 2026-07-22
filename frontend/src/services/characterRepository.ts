import type { CharacterSheet } from "../types";

export interface SavedCharacterRecord {
  id: number;
  name: string;
  created_at: string;
  sheet_json: string;
}

/** Persistence boundary used by the gallery and character sheet. */
export interface CharacterRepository {
  load: () => Promise<SavedCharacterRecord[]>;
  save: (sheet: CharacterSheet) => Promise<void>;
  delete: (id: number) => Promise<void>;
}