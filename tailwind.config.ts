import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        court: {
          orange: "rgb(var(--color-orange) / <alpha-value>)",
          "orange-dark": "rgb(var(--color-orange-dark) / <alpha-value>)",
          "orange-light": "rgb(var(--color-orange-light) / <alpha-value>)",
          blue: "rgb(var(--color-blue) / <alpha-value>)",
          "blue-dark": "rgb(var(--color-blue-dark) / <alpha-value>)",
          "blue-light": "rgb(var(--color-blue-light) / <alpha-value>)",
          ink: "rgb(var(--color-ink) / <alpha-value>)",
          cream: "rgb(var(--color-cream) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        "dink-pattern":
          "radial-gradient(circle, rgba(244,96,54,0.07) 1.5px, transparent 1.5px)",
      },
      boxShadow: {
        court: "0 8px 30px rgba(23,58,69,0.08)",
        "court-lg": "0 20px 50px rgba(23,58,69,0.14)",
      },
      borderRadius: {
        court: "1.25rem",
      },
      keyframes: {
        bounce_ball: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "bounce-ball": "bounce_ball 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
