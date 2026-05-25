/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pm: {
          accent: "var(--pm-accent)",
          "accent-hover": "var(--pm-accent-hover)",
          "accent-bg": "var(--pm-accent-bg)",
          orange: "var(--pm-orange)",
          "orange-hover": "var(--pm-orange-hover)",
          "orange-bg": "var(--pm-orange-bg)",
          bg: "var(--pm-bg)",
          surface: "var(--pm-surface)",
          "surface-alt": "var(--pm-surface-alt)",
          text: "var(--pm-text)",
          "text-mid": "var(--pm-text-mid)",
          "text-light": "var(--pm-text-light)",
          border: "var(--pm-border)",
        },
      },
      fontFamily: {
        sans: ["Lato", "sans-serif"],
        display: ["Passion One", "sans-serif"],
      },
      borderRadius: {
        xl: "var(--pm-radius-xl)",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
