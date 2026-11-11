module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)"],
        serif: ["var(--font-heading)"],
      },
      colors: {
        pt: {
          blue1: "rgb(var(--theme-primary-rgb) / <alpha-value>)",
          yellow1: "rgb(var(--theme-accent-rgb) / <alpha-value>)",
          blue2: "rgb(var(--theme-primaryDeep-rgb) / <alpha-value>)",
          blue3: "rgb(var(--theme-primaryMedium-rgb) / <alpha-value>)",
          blue4: "rgb(var(--theme-primaryBright-rgb) / <alpha-value>)",
          yellow2: "rgb(var(--theme-accentMuted-rgb) / <alpha-value>)",
          yellow3: "rgb(var(--theme-accentHover-rgb) / <alpha-value>)",
          yellow4: "rgb(var(--theme-accentSoft-rgb) / <alpha-value>)",
          offwhite: "rgb(var(--theme-paper-rgb) / <alpha-value>)",
          dark: "rgb(var(--theme-night-rgb) / <alpha-value>)",
        },
      },
      borderRadius: { pt: "16px" },
      boxShadow: {
        "pt-glow": "0 0 25px -5px rgba(var(--theme-accent-channels),0.45)",
        "pt-card":
          "0 10px 30px -10px rgba(var(--theme-primary-channels),0.08), 0 4px 6px -2px rgba(var(--theme-primary-channels),0.03)",
        "pt-float": "0 20px 40px -15px rgba(1, 15, 74, 0.25)",
      },
    },
  },
  content: ["./index.html", "./app.jsx"],
};
