/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './contexts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
      },
      colors: {
        'retro-bg': '#0a0a0a',
        'retro-green': '#00ff00',
        'retro-cyan': '#00ffff',
        'retro-yellow': '#ffff00',
        'retro-red': '#ff0000',
      },
    },
  },
  plugins: [],
}



