/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  plugins: ['prettier-plugin-astro', 'prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/styles/global.css',
  overrides: [
    {
      files: '*.jsonc',
      options: { trailingComma: 'none' },
    },
    {
      files: '*.astro',
      options: { parser: 'astro' },
    },
  ],
};
