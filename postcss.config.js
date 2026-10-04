module.exports = {
  plugins: {
    tailwindcss: {},
    // Pixel sizes become the design unit, so the design can draw 10% smaller on big screens (see the file).
    "./scripts/postcss-design-unit.js": {},
    autoprefixer: {},
  },
};
