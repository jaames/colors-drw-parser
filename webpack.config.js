const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const GitRevisionPlugin = require('git-revision-webpack-plugin');
const version = require('./package.json').version;
const git = new GitRevisionPlugin();

module.exports = function(env, argv) {

  const mode = argv.mode;
  const prod = mode === 'production';
  const devserver = argv.hasOwnProperty('host');

  return {
    mode,
    context: path.resolve(__dirname, 'src'),
    entry: {
      colors: devserver ? './test.ts' : './index.ts',
      // node: './node.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: prod ? '[name].min.js' : '[name].js',
      library: 'colors',
      libraryExport: 'default',
      libraryTarget: 'umd',
      globalObject: 'this',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      // alias: {
      //   'webgl': path.resolve(__dirname, 'src/webgl/'),
      //   'parser': path.resolve(__dirname, 'src/parser/'),
      //   'encoders': path.resolve(__dirname, 'src/encoders/'),
      //   'utils': path.resolve(__dirname, 'src/utils/'),
      //   'loader': path.resolve(__dirname, 'src/loader/'),
      //   'player': path.resolve(__dirname, 'src/player/'),
      // }
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader'
          }
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: 'ts-loader',
        },
        {
          test: /\.(png|jpe?g|gif|drw)$/i,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: 'data/[name].[hash:8].[ext]',
              },
            },
          ],
        },
        {
          test: /\.(glsl|frag|vert)?$/,
          exclude: /node_modules/,
          use: [
            { loader: 'raw-loader' },
          ]
        }
      ]
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: [
          'Colors! Painting Renderer v' + version,
          '(unofficial) parser/renderer for the painting format used by the Colors! art application',
          'Written by James Daniel (https://jamesdaniel.dev)',
          'Special thanks to Jens Andersson from Collecting Smiles for providing format information :)',
          'Colors! is (c) Collecting Smiles (http://collectingsmiles.com/)',
          'http://colorslive.com/',
          '-------',
          'Commit: ' + git.commithash(),
          'Build date: ' + new Date().toUTCString(),
          'Source: https://github.com/jaames/colors-drw-parser',
        ].join('\n')
      }),
      new webpack.DefinePlugin({
        VERSION: JSON.stringify(version),
        IS_PROD: prod,
        IS_DEV_SERVER: devserver,
      }),
      devserver ? new CopyWebpackPlugin([{from: 'demofiles/*'}]) : false,
      devserver ? new HtmlWebpackPlugin() : false
    ].filter(Boolean),
    devtool: 'source-map',
  }

}