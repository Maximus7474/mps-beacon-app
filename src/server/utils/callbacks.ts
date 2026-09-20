const registeredCallbacks = new Map<string, (...args: any[]) => Promise<any>>();

const resourceName = GetCurrentResourceName();

export const RegisterServerCallback = <T = any>(name: string, handler: (src: number, data: any) => Promise<T>) => {
  registeredCallbacks.set(name, handler);
};

onNet(`${resourceName}:server:triggerCallback`, async (name: string, requestId: string, data: any) => {
  const src = global.source;
  const callback = registeredCallbacks.get(name);

  if (!callback) {
    emitNet(`${resourceName}:client:callbackResponse`, src, requestId, {
      success: false,
      error: `Callback '${name}' not found.`,
    });
    return;
  }

  try {
    const result = await callback(src, data);
    emitNet(`${resourceName}:client:callbackResponse`, src, requestId, {
      success: true,
      data: result,
    });
  } catch (err) {
    emitNet(`${resourceName}:client:callbackResponse`, src, requestId, {
      success: false,
      error: (err as Error).message,
    });
  }
});
