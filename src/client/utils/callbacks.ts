import type { CallbackResponse } from '@common/types';

type CallbackHandler = (response: any) => void;
const pendingCallbacks = new Map<string, CallbackHandler>();

const generateUUID = (): string => {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
};

export const triggerServerCallback = <T = any>(name: string, data?: any): Promise<T> => {
  return new Promise((resolve, reject) => {
    const id = generateUUID();

    pendingCallbacks.set(id, (res) => {
      if (res.success) resolve(res.data as T);
      else reject(res.error);
    });

    emitNet('myResource:server:triggerCallback', name, id, data);
  });
};

onNet('myResource:client:callbackResponse', (requestId: string, response: CallbackResponse) => {
  const cb = pendingCallbacks.get(requestId);

  if (cb) {
    cb(response);
    pendingCallbacks.delete(requestId);
  }
});
