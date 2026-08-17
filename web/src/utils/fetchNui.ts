import { devMode } from './utils';

/*

    Credit to: @project-error   -   https://github.com/project-error
    Code Source: https://github.com/project-error/fivem-react-boilerplate-lua/blob/master/web/src/utils/fetchNui.ts

*/

/**
 * Simple wrapper around fetch API tailored for CEF/NUI use. This abstraction
 * can be extended to include AbortController if needed or if the response isn't
 * JSON. Tailor it to your needs.
 *
 * @param eventName - The endpoint eventname to target
 * @param data - Data you wish to send in the NUI Callback
 * @param mockData - Mock data to be returned if in the browser
 *
 * @return returnData - A promise for the data sent back by the NuiCallbacks CB argument
 */
export async function fetchNui<T = unknown>(eventName: string, data?: unknown, mockData?: T): Promise<T> {
  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(data),
  };

  if (devMode && mockData) return mockData;

  const resourceName = (window as any).resourceName ?? 'mps-lb-fleecanow';

  try {
    const resp = await fetch(`https://${resourceName}/${eventName}`, options);

    if (!resp.ok) throw Error(`${resp.status} - ${resp.statusText}`);

    const respFormatted = await resp.json();

    return respFormatted;
  } catch (error: any) {
    console.error('^1Unable to fetch from NUI^7, details:');
    console.error(`- ^4Event^7: ${eventName}`);
    console.error(`- ^4Data^7: ${data ? JSON.stringify(data, null, 2) : '^3no data^7'}`);
    console.error(`- ^4Response^7: ${error.message ?? '^1No details^7'}`);
    throw Error('Unable to fetch !');
  }
}
