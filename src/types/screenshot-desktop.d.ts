declare module 'screenshot-desktop' {
  function all(): Promise<Buffer>;
  function listDisplays(): Promise<string[]>;
  function capture(display?: string): Promise<Buffer>;
  export = { all, listDisplays, capture };
} 