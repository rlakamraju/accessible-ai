declare module '*.css';

declare module '*.css?raw' {
  const content: string;
  export default content;
}

/** Injected at build time via webpack's DefinePlugin (see webpack.config.ts). */
declare const __LICENSE_SECRET__: string;
