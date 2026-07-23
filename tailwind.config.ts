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
          orange: "#F46036",
          "orange-dark": "#D6491F",
          "orange-light": "#FF8C61",
          blue: "#6CD4FF",
          "blue-dark": "#2FA8D9",
          "blue-light": "#C7EEFF",
          ink: "#173A45",
          cream: "#FBF8F3",
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
