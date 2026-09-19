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
  /** Inserts a new sheet and returns the created record id. */
  save: (sheet: CharacterSheet) => Promise<number>;
  /** Overwrites an existing record, preserving its id and creation date. */
  update: (id: number, sheet: CharacterSheet) => Promise<void>;
  delete: (id: number) => Promise<void>;
}