import path from 'node:path';
import webpack, { type Configuration } from 'webpack';
import CopyPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const config: Configuration = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'source-map',
  entry: {
    'background/service-worker': './src/background/service-worker.ts',
    'content/injector': './src/content/injector.ts',
    'popup/popup': './src/popup/popup.tsx',
    'sidepanel/sidepanel': './src/sidepanel/sidepanel.tsx',
    'devtools/devtools': './src/devtools/devtools.ts',
    'devtools/panel/panel': './src/devtools/panel/panel.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    // @accessible-ai/standards imports node:crypto (Node-only license signing path); it's never
    // called from browser code, but webpack still needs to resolve the import to bundle successfully.
    fallback: {
      crypto: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        oneOf: [
          // `import css from './x.css?raw'` — used by the content-script overlay, which renders
          // inside a Shadow DOM and can't rely on style-loader's document-head injection.
          { resourceQuery: /raw/, type: 'asset/source' },
          { use: ['style-loader', 'css-loader'] },
        ],
      },
    ],
  },
  plugins: [
    // Strip "node:" prefixes so bare-specifier fallbacks (e.g. resolve.fallback.crypto) still apply.
    new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
      resource.request = resource.request.replace(/^node:/, '');
    }),
    new webpack.DefinePlugin({
      __LICENSE_SECRET__: JSON.stringify(process.env.LICENSE_SECRET || 'accessible-ai-dev-secret-2026'),
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'assets', to: 'assets' },
        { from: require.resolve('axe-core/axe.min.js'), to: 'vendor/axe.min.js' },
      ],
    }),
    new HtmlWebpackPlugin({
      filename: 'popup/popup.html',
      template: './src/popup/popup.html',
      chunks: ['popup/popup'],
    }),
    new HtmlWebpackPlugin({
      filename: 'sidepanel/sidepanel.html',
      template: './src/sidepanel/sidepanel.html',
      chunks: ['sidepanel/sidepanel'],
    }),
    new HtmlWebpackPlugin({
      filename: 'devtools/devtools.html',
      template: './src/devtools/devtools.html',
      chunks: ['devtools/devtools'],
    }),
    new HtmlWebpackPlugin({
      filename: 'devtools/panel/panel.html',
      template: './src/devtools/panel/panel.html',
      chunks: ['devtools/panel/panel'],
    }),
  ],
};

export default config;
