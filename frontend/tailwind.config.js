/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        mono: ["DM Mono", "monospace"],
        body: ["DM Sans", "sans-serif"],
      },
      animation: {
        "pulse-fast": "pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.4s ease-out forwards",
        "confetti-fall": "confettiFall 3s ease-in forwards",
        shake: "shake 0.4s ease-in-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        ticker: "ticker 0.3s ease-in-out",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255, 60, 0, 0.4)" },
          "50%": {
            boxShadow:
              "0 0 40px rgba(255, 60, 0, 0.8), 0 0 80px rgba(255, 60, 0, 0.3)",
          },
        },
        ticker: {
          "0%": { transform: "translateY(-100%)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
