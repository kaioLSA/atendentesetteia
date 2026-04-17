/**
 * Browser-side simulation of the /shared_memory directory.
 *
 * In a real deployment, an agent worker (Node / Edge function) would
 * persist these JSON files to disk so that AI agents can read them.
 * Here we mirror writes to localStorage so other tabs / refreshes
 * see the same context. The console.log makes the "file write"
 * observable for debugging "vibe coding" iterations.
 */

const PREFIX = 'shared_memory/';

export function writeSharedMemory(key: string, value: unknown) {
  try {
    const serialized = JSON.stringify(value, null, 2);
    localStorage.setItem(PREFIX + key, serialized);
    // eslint-disable-next-line no-console
    console.info(`[shared_memory] wrote ${key}`, value);
  } catch (err) {
    console.warn('[shared_memory] failed to write', key, err);
  }
}

export function readSharedMemory<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function listSharedMemory(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k.replace(PREFIX, ''));
  }
  return keys;
}
