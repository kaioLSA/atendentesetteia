/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep navy / pixel office palette
        bg: {
          900: '#05060d',
          800: '#0a0d1a',
          700: '#10142a',
          600: '#161a36',
        },
        accent: {
          purple: '#8b5cf6',
          violet: '#a78bfa',
          indigo: '#6366f1',
          cyan: '#22d3ee',
          green: '#34d399',
        },
        pixel: {
          floor: '#1c2040',
          floorAlt: '#171a36',
          wall: '#0c0e22',
          wood: '#8b5a2b',
          woodLight: '#c08552',
          chair: '#3b82f6',
          chairDark: '#1d4ed8',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(139, 92, 246, 0.35)',
        innerDark: 'inset 0 0 0 1px rgba(139, 92, 246, 0.25)',
      },
      keyframes: {
        blink: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
      },
      animation: {
        blink: 'blink 1s steps(1) infinite',
        float: 'float 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
