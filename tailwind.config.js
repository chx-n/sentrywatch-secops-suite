/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: '#04060A',
        obs: {
          1: '#090D14',
          2: '#0D1320',
          3: '#11192B',
          4: '#182237',
        },
        acid: {
          DEFAULT: '#39FF14',
          soft: '#a8ffaa',
          dim: 'rgba(57,255,20,0.15)',
        },
        ink: {
          1: '#F0F4FF',
          2: '#8899BB',
          3: '#4A5878',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
