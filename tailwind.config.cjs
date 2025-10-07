/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg': 'var(--color-bg)',
        'surface': 'var(--color-surface)',
        'text-primary': 'var(--color-text-primary)',
        'brand': 'var(--color-brand)',
        'accent': 'var(--color-accent)',
      },
      boxShadow: {
        'neon': 'var(--shadow-neon)',
      },
      borderRadius: {
        'DEFAULT': 'var(--radius-default)',
      },
      animation: {
        'glowPulse': 'glowPulse var(--timing-glowPulse) infinite alternate',
        'glitchIn': 'glitchIn var(--timing-glitchIn) forwards',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { textShadow: '0 0 5px var(--color-brand), 0 0 10px var(--color-brand), 0 0 15px var(--color-brand), 0 0 20px var(--color-brand)' },
          '50%': { textShadow: '0 0 10px var(--color-brand), 0 0 20px var(--color-brand), 0 0 30px var(--color-brand), 0 0 40px var(--color-brand)' },
        },
        glitchIn: {
          '0%': { transform: 'translate(-2px, 2px) scaleY(1.05)', opacity: '0' },
          '20%': { transform: 'translate(2px, -2px) scaleY(0.95)', opacity: '1' },
          '40%': { transform: 'translate(-1px, 1px) scaleY(1.02)' },
          '60%': { transform: 'translate(1px, -1px) scaleY(0.98)' },
          '80%': { transform: 'translate(-0.5px, 0.5px) scaleY(1.01)' },
          '100%': { transform: 'translate(0, 0) scaleY(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}