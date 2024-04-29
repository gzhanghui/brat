module.exports = {
  extends: ['eslint:recommended'],
  env: {
    browser: true,
    es6: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
  },
  rules: {
    "no-debugger": 0,
  },
};