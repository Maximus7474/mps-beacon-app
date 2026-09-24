let debugEnabled = GetConvarInt('beaconapp:debug', 0) === 1;

/**
 * Registered by the client sync module: the shared debug module cannot reach
 * the NUI itself (lb-phone custom apps do not receive SendNUIMessage — pushes
 * must go through SendCustomAppMessage, see src/client/sync.ts), so the sync
 * layer registers itself here to forward convar flips to the web app.
 */
type DebugPushListener = (enabled: boolean) => void;
let pushListener: DebugPushListener | null = null;
export const setDebugPushListener = (listener: DebugPushListener): void => {
  pushListener = listener;
};

AddConvarChangeListener('beaconapp:debug', (_name: string, _reserved: unknown) => {
  debugEnabled = GetConvarInt('beaconapp:debug', 0) === 1;

  if (!IsDuplicityVersion()) pushListener?.(debugEnabled);

  console.log(`Debug mode ${debugEnabled ? '^2Enabled' : '^1Disabled'}^7`);
});

export function debuglog(...args: any[]) {
  if (!debugEnabled) return;
  console.log(GetGameTimer(), ...args);
}

/** Current gate state, so callers (NUI callbacks, the web app) can read it. */
export const isDebugEnabled = (): boolean => debugEnabled;

debuglog('[beaconapp:debug] shared debug module loaded');
