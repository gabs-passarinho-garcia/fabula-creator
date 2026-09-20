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
  async save(sheet: CharacterSheet): Promise<number> {
    const records = await this.load();
    const record: SavedCharacterRecord = {
      id: now(),
      name: sheet.name,
      created_at: new Date(now()).toISOString(),
      sheet_json: JSON.stringify(sheet),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify([record, ...records]));
    return record.id;
  },
  async update(id: number, sheet: CharacterSheet): Promise<void> {
    const records = await this.load();
    const updated = records.map((record) =>
      record.id === id
        ? { ...record, name: sheet.name, sheet_json: JSON.stringify(sheet) }
        : record,
    );
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },
  async delete(id: number): Promise<void> {
    const records = await this.load();
    storage.setItem(STORAGE_KEY, JSON.stringify(records.filter((record) => record.id !== id)));
  },
  async savePhoto(id: number, base64Data: string): Promise<void> {
    const records = await this.load();
    const updated = records.map((record) =>
      record.id === id ? { ...record, photo_path: `photos/${id}.jpg` } : record,
    );
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Base64 bytes are kept alongside the path so getPhoto can serve them back.
    storage.setItem(`${STORAGE_KEY}_photo_${id}`, base64Data);
  },
  async deletePhoto(id: number): Promise<void> {
    const records = await this.load();
    const updated = records.map((record) =>
      record.id === id ? { ...record, photo_path: null } : record,
    );
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    storage.removeItem(`${STORAGE_KEY}_photo_${id}`);
  },
  async getPhoto(id: number): Promise<string | null> {
    return storage.getItem(`${STORAGE_KEY}_photo_${id}`);
  },
});