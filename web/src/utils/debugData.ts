import { devMode } from './utils';

/*
  Credit to: @project-error   -   https://github.com/project-error
  Code Source:
    https://github.com/project-error/fivem-react-boilerplate-lua/blob/master/web/src/utils/debugData.ts
*/

interface DebugEvent<T = unknown> {
  action: string;
  data: T;
}

/**
 * Emulates dispatching an event using SendNuiMessage in the lua scripts.
 * This is used when developing in browser
 *
 * @param events - The event you want to cover
 * @param timer - How long until it should trigger (ms)
 */
export const debugData = <P>(events: DebugEvent<P>[], timer = 1000): void => {
  if (devMode) {
    for (const event of events) {
      setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              action: event.action,
              data: event.data,
            },
          }),
        );
      }, timer);
    }
  }
};
