const v = n => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      brand: { 50: '#f5f3ff', 100: '#ede9fe', 500: '#7c3aed', 600: '#6d28d9', 700: '#5b21b6', 900: '#2e1065' },
      // skala slate memakai variabel CSS (lihat src/index.css) agar otomatis berganti terang/gelap
      slate: { 50: v('s50'), 100: v('s100'), 200: v('s200'), 300: v('s300'), 400: v('s400'), 500: v('s500'), 600: v('s600'), 700: v('s700'), 800: v('s800') },
    },
    borderColor: { DEFAULT: v('border') },
  } },
  plugins: [],
};
