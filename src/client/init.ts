import Config from '@common/config';
import { debuglog } from '@common/debug';
import { waitForResourceStarted } from '@common/utils';
import { handleUiClosed, handleUiSync } from './sync';

const lbPhone = 'lb-phone';

interface AppConfig {
  // Basic metadata
  identifier: string;
  name: string;
  description: string;
  developer?: string;

  // UI and display
  ui: string;
  icon?: string;
  images?: string[];
  landscape?: boolean;
  fixBlur?: boolean;

  // App behavior
  defaultApp?: boolean;
  size?: number;
  price?: number;
  game?: boolean;

  // Lifecycle funcs
  onOpen?: () => void;
  onClose?: () => void;
  onDelete?: () => void;
}

const url: string = GetResourceMetadata(GetCurrentResourceName(), 'ui_page', 0);

const appConfig: AppConfig = {
  identifier: Config.Identifier,
  name: Config.AppName,
  description: Config.AppDescription,
  developer: Config.AppDeveloper,

  defaultApp: Config.DefaultApp,
  size: 59812,

  images: [
    `https://cfx-nui-${GetCurrentResourceName()}/dist/web/1.png`,
    `https://cfx-nui-${GetCurrentResourceName()}/dist/web/2.png`,
    `https://cfx-nui-${GetCurrentResourceName()}/dist/web/3.png`,
    `https://cfx-nui-${GetCurrentResourceName()}/dist/web/4.png`,
  ],

  ui: url.includes('http') ? url : `${GetCurrentResourceName()}/${url}`,
  icon: url.includes('http')
    ? `${url}/public/icon.webp`
    : `https://cfx-nui-${GetCurrentResourceName()}/dist/web/icon.webp`,

  fixBlur: true,

  // The app iframe is created on open and destroyed on close, so the phone's
  // own lifecycle hooks are the reliable signal for the client cache's
  // background work (the `beaconapp:client:sync` callback marks the open too).
  onOpen: () => {
    debuglog('[beaconapp:init] app onOpen (lb-phone)');
    void handleUiSync();
  },
  onClose: () => {
    debuglog('[beaconapp:init] app onClose (lb-phone)');
    handleUiClosed();
  },
};

const loadApplication = () => {
  debuglog(`[beaconapp:init] AddCustomApp for "${appConfig.name}" (ui: ${appConfig.ui})`);
  const response = exports['lb-phone'].AddCustomApp(appConfig) as [boolean, string?];

  const added = Array.isArray(response) ? response[0] : response;

  if (!added) {
    console.log(`[^1ERROR^7] Unable to add "^5${appConfig.name}^7" to lb-phone: ${response[1]}`);
  } else {
    debuglog(`[beaconapp:init] app "${appConfig.name}" registered with lb-phone`);
  }
};

waitForResourceStarted(lbPhone).then(loadApplication);

on('onResourceStart', (resource: string) => {
  if (resource !== lbPhone) return;

  loadApplication();
});
