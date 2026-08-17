//@ts-check

import { exists, exec, getFiles } from './utils.js';
import { createBuilder, createFxmanifest } from '@communityox/fx-utils';

const watch = process.argv.includes('--watch');
const web = await exists('./web');
const dropLabels = ['$BROWSER'];

if (!watch) dropLabels.push('$DEV');

createBuilder(
  watch,
  {
    keepNames: true,
    legalComments: 'inline',
    bundle: true,
    treeShaking: true,
  },
  [
    {
      name: 'server',
      options: {
        platform: 'node',
        target: ['node22'],
        format: 'cjs',
        dropLabels: [...dropLabels, '$CLIENT'],
        external: ['shared'],
      },
    },
    {
      name: 'client',
      options: {
        platform: 'browser',
        target: ['es2021'], 
        format: 'iife',
        dropLabels: [...dropLabels, '$SERVER'],
        external: ['shared'],
      },
    },
  ],
  async (outfiles) => {
    const files = await getFiles('dist/web', 'static');
    await createFxmanifest({
      client_scripts: [outfiles.client, 'bridge/utils.lua', 'bridge/**/client.lua'],
      server_scripts: [outfiles.server, 'bridge/utils.lua', 'bridge/**/server.lua'],
      files: ['locales/*.json', ...files],
      dependencies: ['/server:13068', '/onesync'],
      metadata: {
        lua54: 'yes',
        ui_page: 'dist/web/index.html',
        node_version: '22'
      },
    });

    if (web && !watch) await exec("cd ./web && vite build");
  }
);

if (web && watch) await exec("cd ./web && vite build --watch");
