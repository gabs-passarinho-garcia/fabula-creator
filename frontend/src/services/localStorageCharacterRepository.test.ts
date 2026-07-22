import { describe, expect, test } from "bun:test";
import { createLocalStorageCharacterRepository } from "./localStorageCharacterRepository";
import type { CharacterSheet } from "../types";

const setup = () => {
  const storage = new Map<string, string>();
  const fakeStorage: Storage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index) => Array.from(storage.keys())[index] ?? null,
    get length() { return storage.size; },
  };
  const sheet = { name: "Test Hero", identity: "A brave test hero" } as CharacterSheet;
  return { repository: createLocalStorageCharacterRepository(fakeStorage, () => 123), sheet };
};

describe("local storage character repository", () => {
  test("round-trips and deletes saved sheets", async () => {
    const { repository, sheet } = setup();
    await repository.save(sheet);
    const records = await repository.load();

    expect(records).toHaveLength(1);
    expect(records[0]?.name).toBe("Test Hero");
    expect(JSON.parse(records[0]?.sheet_json ?? "{}").name).toBe("Test Hero");

    await repository.delete(records[0]?.id ?? -1);
    expect(await repository.load()).toHaveLength(0);
  });
});