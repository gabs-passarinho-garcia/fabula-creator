import type { CharacterSheet } from "../types";
import type { CharacterRepository, SavedCharacterRecord } from "./characterRepository";

const STORAGE_KEY = "fabula_characters";

/** Creates a browser repository backed by LocalStorage. */
export const createLocalStorageCharacterRepository = (
  storage: Storage = localStorage,
  now: () => number = () => Date.now(),
): CharacterRepository => ({
  async load(): Promise<SavedCharacterRecord[]> {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as SavedCharacterRecord[];
    } catch {
      return [];
    }
  },
  async save(sheet: CharacterSheet): Promise<void> {
    const records = await this.load();
    const record: SavedCharacterRecord = {
      id: now(),
      name: sheet.name,
      created_at: new Date(now()).toISOString(),
      sheet_json: JSON.stringify(sheet),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify([record, ...records]));
  },
  async delete(id: number): Promise<void> {
    const records = await this.load();
    storage.setItem(STORAGE_KEY, JSON.stringify(records.filter((record) => record.id !== id)));
  },
});