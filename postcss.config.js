const purgecss = require('@fullhuman/postcss-purgecss');
module.exports = {
  // Add you postcss configuration here
  // Learn more about it at https://github.com/webpack-contrib/postcss-loader#config-files
  plugins: [
    ['autoprefixer'],
    [
      purgecss({
        content: ['./src/**/*.js'],
        keyframes: true,
        variables: true,
        fontFace: true,
      }),
    ],
  ],
};
