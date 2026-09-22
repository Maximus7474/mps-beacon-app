import Config from '@common/config';
import { waitForResourceStarted } from '@common/utils';

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
    ? `${url}/public/icon.png`
    : `https://cfx-nui-${GetCurrentResourceName()}/dist/web/icon.png`,

  fixBlur: true,
};

const loadApplication = () => {
  const response = exports['lb-phone'].AddCustomApp(appConfig) as [boolean, string?];

  const added = Array.isArray(response) ? response[0] : response;

  if (!added) {
    console.log(`[^1ERROR^7] Unable to add "^5${appConfig.name}^7" to lb-phone: ${response[1]}`);
  }
};

waitForResourceStarted(lbPhone).then(loadApplication);

on('onResourceStart', (resource: string) => {
  if (resource !== lbPhone) return;

  loadApplication();
});
