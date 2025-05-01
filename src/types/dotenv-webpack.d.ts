declare module 'dotenv-webpack' {
  import { Plugin } from 'webpack';

  interface DotenvPluginOptions {
    path?: string;
    safe?: boolean;
    systemvars?: boolean;
    silent?: boolean;
    defaults?: boolean;
  }

  class DotenvPlugin extends Plugin {
    constructor(options?: DotenvPluginOptions);
  }

  export = DotenvPlugin;
} 