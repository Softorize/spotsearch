import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { resolve, join } from 'path';
import { copyFileSync } from 'fs';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'SpotSearch',
    icon: resolve(__dirname, 'assets/icons/app-icon'),
    appBundleId: 'com.spotsearch.app',
    osxSign: {},
    darwinDarkModeSupport: true,
    extraResource: ['./assets/icons'],
    extendInfo: {
      LSUIElement: true,
    },
  },
  hooks: {
    postPackage: async (_config, result) => {
      // Replace default electron.icns with our app icon
      for (const outputPath of result.outputPaths) {
        const icnsSource = resolve(__dirname, 'assets/icons/app-icon.icns');
        const icnsDest = join(outputPath, 'SpotSearch.app/Contents/Resources/electron.icns');
        try {
          copyFileSync(icnsSource, icnsDest);
          console.log('Replaced electron.icns with app-icon.icns');
        } catch (e) {
          console.error('Failed to replace icon:', e);
        }
      }
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      format: 'ULFO',
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
