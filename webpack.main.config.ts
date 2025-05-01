import type { Configuration } from 'webpack';
import path from 'path';
import webpack from 'webpack';
import * as dotenv from 'dotenv';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',
  // Put your normal webpack config below here
  module: {
    rules,
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
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  target: 'electron-main',
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    electron: 'commonjs2 electron',
  },
};
