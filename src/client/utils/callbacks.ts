import { debuglog } from '@common/debug';
import type { CallbackResponse } from '@common/types';

type CallbackHandler = (response: any) => void;
const pendingCallbacks = new Map<string, CallbackHandler>();

const resourceName = GetCurrentResourceName();

const generateUUID = (): string => {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
};

export const triggerServerCallback = <T = any>(name: string, data?: any): Promise<T> => {
  debuglog(`[beaconapp:callbacks] -> ${name}`);
  return new Promise((resolve, reject) => {
    const id = generateUUID();

    pendingCallbacks.set(id, (res) => {
      if (res.success) resolve(res.data as T);
      else reject(res.error);
    });

    emitNet(`${resourceName}:server:triggerCallback`, name, id, data);
  });
};

onNet(`${resourceName}:client:callbackResponse`, (requestId: string, response: CallbackResponse) => {
  const cb = pendingCallbacks.get(requestId);

  if (cb) {
    if (response.success) {
      debuglog(`[beaconapp:callbacks] <- ${requestId} ok`);
    } else if ('error' in response) {
      debuglog(`[beaconapp:callbacks] <- ${requestId} error: ${response.error}`);
    }
    cb(response);
    pendingCallbacks.delete(requestId);
  } else {
    debuglog(`[beaconapp:callbacks] <- ${requestId} arrived with no pending handler`);
  }
});
