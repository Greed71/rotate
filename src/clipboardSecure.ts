import { clear, writeText } from "@tauri-apps/plugin-clipboard-manager";

const CLEAR_MS = 30_000;
let clearTimer: ReturnType<typeof setTimeout> | undefined;

/** Copia negli appunti e programma la cancellazione (best-effort). */
export async function copySensitiveWithAutoClear(text: string): Promise<void> {
  if (clearTimer !== undefined) {
    clearTimeout(clearTimer);
    clearTimer = undefined;
  }
  await writeText(text);
  clearTimer = setTimeout(() => {
    void clear().catch(() => {});
    clearTimer = undefined;
  }, CLEAR_MS);
}
