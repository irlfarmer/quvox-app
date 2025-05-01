import type { Configuration } from 'webpack';
import path from 'path';
import webpack from 'webpack';
import * as dotenv from 'dotenv';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const rendererConfig: Configuration = {
  module: {
    rules: [
      ...rules,
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  tailwindcss,
                  autoprefixer,
                ],
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    ...plugins,
    new webpack.DefinePlugin({
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
      'process.env.ENABLE_DEBUG_MODE': JSON.stringify(process.env.ENABLE_DEBUG_MODE),
      'process.env.SCREENSHOT_STORAGE_PATH': JSON.stringify(process.env.SCREENSHOT_STORAGE_PATH),
      'process.env.DEFAULT_CAPTURE_INTERVAL': JSON.stringify(process.env.DEFAULT_CAPTURE_INTERVAL),
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    fallback: {
      path: 'path-browserify',
      os: 'os-browserify/browser',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      buffer: 'buffer/',
      util: 'util/',
      assert: 'assert/',
      constants: 'constants-browserify',
      vm: 'vm-browserify',
      fs: false,
      net: false,
      tls: false,
      zlib: false,
      http: false,
      https: false,
      child_process: false,
    },
  },
  target: 'web',
  externals: {
    electron: 'commonjs2 electron',
  },
};
