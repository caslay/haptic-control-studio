/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary-color, #3b82f6)",
        secondary: "var(--secondary-color, #10b981)",
        dashboard: "var(--bg-color, #0f172a)",
        panel: "var(--panel-color, #1e293b)",
        textPrimary: "var(--text-primary-color, #f8fafc)",
        textSecondary: "var(--text-secondary-color, #94a3b8)",
      },
      fontFamily: {
        dashboard: ["var(--font-family, 'Outfit', 'Inter', sans-serif)", "sans-serif"],
      },
      fontSize: {
        dashboardBase: "var(--font-size-base, 16px)",
      },
      fontWeight: {
        dashboardNormal: "var(--font-weight-normal, 400)",
        dashboardBold: "var(--font-weight-bold, 700)",
      }
    },
  },
  plugins: [],
}
