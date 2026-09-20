import type { CharacterSheet } from "../types";

export interface SavedCharacterRecord {
  id: number;
  name: string;
  created_at: string;
  sheet_json: string;
  photo_path?: string | null;
}

/** Persistence boundary used by the gallery and character sheet. */
export interface CharacterRepository {
  load: () => Promise<SavedCharacterRecord[]>;
  /** Inserts a new sheet and returns the created record id. */
  save: (sheet: CharacterSheet) => Promise<number>;
  /** Overwrites an existing record, preserving its id and creation date. */
  update: (id: number, sheet: CharacterSheet) => Promise<void>;
  delete: (id: number) => Promise<void>;
  /** Stores raw base64 image bytes for a record (the backend writes the file). */
  savePhoto: (id: number, base64Data: string) => Promise<void>;
  /** Clears the photo of a record, deleting the file on disk. */
  deletePhoto: (id: number) => Promise<void>;
  /** Returns the photo as a data URI, or null when the hero has none. */
  getPhoto: (id: number) => Promise<string | null>;
}