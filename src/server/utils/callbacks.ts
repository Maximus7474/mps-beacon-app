const registeredCallbacks = new Map<string, (...args: any[]) => Promise<any>>();

export const RegisterServerCallback = <T = any>(name: string, handler: (src: number, data: any) => Promise<T>) => {
  registeredCallbacks.set(name, handler);
};

onNet('myResource:server:triggerCallback', async (name: string, requestId: string, data: any) => {
  const src = global.source;
  const callback = registeredCallbacks.get(name);

  if (!callback) {
    emitNet('myResource:client:callbackResponse', src, requestId, {
      success: false,
      error: `Callback '${name}' not found.`,
    });
    return;
  }

  try {
    const result = await callback(src, data);
    emitNet('myResource:client:callbackResponse', src, requestId, {
      success: true,
      data: result,
    });
  } catch (err) {
    emitNet('myResource:client:callbackResponse', src, requestId, {
      success: false,
      error: (err as Error).message,
    });
  }
});
