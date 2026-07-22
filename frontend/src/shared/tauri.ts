import { invoke } from "@tauri-apps/api/core";

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: object;
}

/** Returns whether the application is running inside a Tauri webview. */
export const isTauriRuntime = (windowObject: Window = window): boolean =>
  typeof (windowObject as TauriWindow).__TAURI_INTERNALS__ !== "undefined";

/** Invokes a typed Tauri command. */
export const invokeTauri = <T>(command: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(command, args);