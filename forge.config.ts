import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import webpack from 'webpack';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
              config: {
                module: {
                  rules: [
                    {
                      test: /\.ts$/,
                      exclude: /node_modules/,
                      use: {
                        loader: 'ts-loader',
                      },
                    },
                  ],
                },
                plugins: [
                  new webpack.DefinePlugin({
                    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
                    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
                    'process.env.ENABLE_DEBUG_MODE': JSON.stringify(process.env.ENABLE_DEBUG_MODE),
                    'process.env.SCREENSHOT_STORAGE_PATH': JSON.stringify(process.env.SCREENSHOT_STORAGE_PATH),
                    'process.env.DEFAULT_CAPTURE_INTERVAL': JSON.stringify(process.env.DEFAULT_CAPTURE_INTERVAL),
                  }),
                ],
                resolve: {
                  extensions: ['.js', '.ts'],
                  fallback: {
                    path: require.resolve('path-browserify'),
                    os: require.resolve('os-browserify/browser'),
                    crypto: require.resolve('crypto-browserify'),
                    stream: require.resolve('stream-browserify'),
                    buffer: require.resolve('buffer/'),
                    util: require.resolve('util/'),
                    assert: require.resolve('assert/'),
                    constants: require.resolve('constants-browserify'),
                    vm: require.resolve('vm-browserify'),
                    fs: false,
                    net: false,
                    tls: false,
                    zlib: false,
                    http: false,
                    https: false,
                    child_process: false,
                  },
                },
              },
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
