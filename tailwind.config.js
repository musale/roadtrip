/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", ":root:not(.light)"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: { center: true, screens: { xl: "1200px" } },
    extend: {
      fontFamily: {
        display: ["Orbitron", "ui-sans-serif", "system-ui"],
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo"],
      },
      colors: {
        // Neon Velocity Design System Colors
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        surfaceStrong: "var(--color-surface-strong)",
        border: "var(--color-border)",
        brand: "var(--color-brand)",
        accent: "var(--color-accent)",
        text: {
          DEFAULT: "var(--color-text-primary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },
        state: {
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          danger: "var(--color-danger)",
        },
        // Legacy colors for backward compatibility
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        recording: {
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        success: {
          500: '#10b981',
          600: '#059669',
        },
        gps: {
          good: '#10b981',
          poor: '#f59e0b',
          none: '#ef4444',
        }
      },
      borderRadius: {
        sm: "var(--nv-radius-sm)",
        md: "var(--nv-radius-md)",
        lg: "var(--nv-radius-lg)",
        full: "var(--nv-radius-full)",
      },
      boxShadow: {
        nv1: "var(--nv-shadow-1)",
        nv2: "var(--nv-shadow-2)",
        nv3: "var(--nv-shadow-3)",
        focus: "var(--focus-ring)",
      },
      spacing: {
        1: "var(--nv-space-1)",
        2: "var(--nv-space-2)",
        3: "var(--nv-space-3)",
        4: "var(--nv-space-4)",
        5: "var(--nv-space-5)",
        6: "var(--nv-space-6)",
        8: "var(--nv-space-8)",
        10: "var(--nv-space-10)",
        // Legacy spacing
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      keyframes: {
        glowPulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(0,245,212,0.2)" },
          "70%": { boxShadow: "0 0 0 8px rgba(0,245,212,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(0,245,212,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glitchIn: {
          "0%": {
            opacity: 0,
            transform: "translate3d(-2px,0,0) skewX(-10deg)",
          },
          "50%": {
            opacity: 0.9,
            transform: "translate3d(2px,0,0) skewX(10deg)",
          },
          "100%": { opacity: 1, transform: "translate3d(0,0,0) skewX(0)" },
        },
        // Legacy animations
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        glowPulse: "glowPulse 1.6s var(--nv-ease-glow) infinite",
        shimmer: "shimmer 1.2s linear infinite",
        glitchIn: "glitchIn var(--nv-dur-med) steps(20, end) 1",
        // Legacy animations
        'pulse-recording': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      transitionTimingFunction: {
        nvIn: "var(--nv-ease-in)",
        nvOut: "var(--nv-ease-out)",
        nv: "var(--nv-ease-in-out)",
        glow: "var(--nv-ease-glow)",
      },
      transitionDuration: {
        fast: "var(--nv-dur-fast)",
        med: "var(--nv-dur-med)",
        slow: "var(--nv-dur-slow)",
      },
      screens: {
        'xs': '475px',
      },
      height: {
        'screen-dynamic': '100dvh',
      },
      minHeight: {
        'screen-dynamic': '100dvh',
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant("hocus", ["&:hover", "&:focus-visible"]);
      addVariant("reduced-motion", "@media (prefers-reduced-motion: reduce) &");
    },
  ],
}