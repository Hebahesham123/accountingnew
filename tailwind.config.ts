import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Cairo", "Tajawal", "system-ui", "sans-serif"] },
      colors: {
        brand: {
          50: "#eef6ff", 100: "#d9eaff", 200: "#bcd9ff", 300: "#8ec0ff",
          400: "#599dff", 500: "#3478f6", 600: "#2160e0", 700: "#1b4cba",
          800: "#1c4197", 900: "#1c3a78",
        },
      },
    },
  },
  plugins: [],
};
export default config;
