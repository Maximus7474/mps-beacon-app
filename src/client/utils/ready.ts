import { sleep } from "@common/utils";

let ready = false;

on('beaconapp:client:ready', () => {
  ready = true;
});

export const waitForClientReady = async (timeoutMs = 30000): Promise<void> => {
  if (ready) return;

  const deadline = GetGameTimer() + timeoutMs;
  while (!ready && GetGameTimer() < deadline) {
    await sleep(50);
  }

  if (!ready) {
    console.warn('[beaconapp] bridge ready event not received in time, continuing anyway');
  }
};
