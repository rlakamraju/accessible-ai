import path from 'node:path';
import type { Configuration } from 'webpack';
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
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
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
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'assets', to: 'assets' },
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
  ],
};

export default config;
