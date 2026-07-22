/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#09060f',
        plum: '#190821',
        glass: 'rgba(255,255,255,0.08)',
        neonPink: '#ff2f9f',
        neonCyan: '#2fe7ff',
        acid: '#b7ff4a',
        amber: '#ffb84d',
        muted: '#9f93ad',
      },
    },
  },
  plugins: [],
};
