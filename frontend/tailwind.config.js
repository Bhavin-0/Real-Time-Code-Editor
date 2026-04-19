/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-primary)',
        elevated: 'var(--bg-secondary)',
        foreground: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        accent: 'var(--accent)',
        outline: 'var(--border)',
      },
      borderRadius: {
        lg: '12px',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
};
