const callExport = <T>(fn: string, ...args: unknown[]): T | undefined => {
  try {
    return global.exports['mps-beacon-app'][fn](...args) as T;
  } catch (err) {
    console.error(`[beaconapp] failed to read '${fn}' export`, err);
    return undefined;
  }
};

export const getPlayerName = (src: number): string => callExport<string>('getName', src) ?? GetPlayerName(String(src));

/** Job/group check via the bridge; deny on failure. */
export const hasJob = (src: number, job: string): boolean => callExport<boolean>('hasJob', src, job) ?? false;

export const getPlayerPhoneNumber = (src: number): string => global.exports['lb-phone'].GetEquippedPhoneNumber(src);
