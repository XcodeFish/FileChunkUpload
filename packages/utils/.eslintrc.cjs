module.exports = {
  extends: ['../../.eslintrc.cjs'],
  rules: {
    // 允许在特定文件中使用this别名，主要用于防抖和节流函数
    '@typescript-eslint/no-this-alias': [
      'error',
      {
        allowDestructuring: true,
        allowedNames: ['self', 'context', 'lastContext'],
      },
    ],
  },
};
