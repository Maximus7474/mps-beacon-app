/**
 * Mirrors the client's `beaconapp:debug` convar into the iframe.
 *
 * The client runtime pushes `debugupdate` whenever the convar changes (see
 * src/common/debug.ts); until one arrives the gate is off, so logs stay quiet
 * in normal play. Dev mode logs unconditionally — there is no game runtime to
 * toggle the convar there.
 */
import { devMode } from './utils';

let enabled = devMode;

/** Gate-checked console.log for the web app. */
export function debuglog(...args: unknown[]) {
  if (!enabled) return;
  console.log('[beaconapp:web]', ...args);
}

const listeners = new Set<(enabled: boolean) => void>();

export const isDebugEnabled = (): boolean => enabled;

export const onDebugChange = (listener: (enabled: boolean) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setDebugEnabled = (value: unknown): void => {
  const next = Boolean(value);

  if (next === enabled) return;
  enabled = next;

  // One gate line on every flip, so an unexpected silence is itself a signal.
  console.info(`[beaconapp:web] debug logging ${enabled ? 'enabled' : 'disabled'}`);

  for (const listener of listeners) listener(enabled);
};

if (devMode) {
  console.info('[beaconapp:web] dev mode: debug logging enabled');
}
