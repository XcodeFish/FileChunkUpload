module.exports = {
  // 正确引用根目录的配置文件
  extends: ['../../.eslintrc.cjs'],
  rules: {
    // 为示例代码临时放宽规则
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
  },
  overrides: [
    {
      // 对示例目录特别宽松
      files: ['examples/**/*.ts', 'examples/**/*.js'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
