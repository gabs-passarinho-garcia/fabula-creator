import type { CharacterSheet } from "../types";

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}

interface SaveFileHandle {
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface FilePickerWindow extends Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFileHandle>;
}

/** Exports a character sheet using the native picker or browser download fallback. */
export const exportCharacterSheet = async (sheet: CharacterSheet): Promise<string> => {
  const fileName = `${sheet.name.toLowerCase().replace(/\s+/g, "_")}_ficha.json`;
  const json = JSON.stringify(sheet, null, 2);
  const pickerWindow = window as FilePickerWindow;

  if (pickerWindow.showSaveFilePicker) {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "JSON character sheet", accept: { "application/json": [".json"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
  } else {
    const anchor = document.createElement("a");
    anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return fileName;
};

/** Parses and minimally validates an imported character sheet JSON payload. */
export const parseCharacterSheet = (json: string): CharacterSheet => {
  const sheet: unknown = JSON.parse(json);
  if (!isCharacterSheet(sheet)) throw new Error("Invalid character sheet");
  return sheet;
};

const isCharacterSheet = (value: unknown): value is CharacterSheet => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CharacterSheet>;
  return typeof candidate.name === "string" && typeof candidate.identity === "string";
};