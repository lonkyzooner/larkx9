module.exports = {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': 'postcss-nesting',
    'tailwindcss': {},
    'autoprefixer': {},
    'postcss-preset-env': {
      features: { 'nesting-rules': false },
      stage: 1,
      preserve: false,
      browsers: ['> 1%', 'last 2 versions', 'Firefox ESR', 'not dead']
    }
  },
}
