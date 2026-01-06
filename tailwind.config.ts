import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'card': '0px 4px 12px rgba(0, 0, 0, 0.05)',
        'card-hover': '0px 6px 16px rgba(0, 0, 0, 0.08)',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        status: {
          pending: "hsl(var(--status-pending))",
          "in-progress": "hsl(var(--status-in-progress))",
          review: "hsl(var(--status-review))",
          completed: "hsl(var(--status-completed))",
          blocked: "hsl(var(--status-blocked))",
        },
        phase: {
          preproduction: "hsl(var(--phase-preproduction))",
          production: "hsl(var(--phase-production))",
          postproduction: "hsl(var(--phase-postproduction))",
          delivery: "hsl(var(--phase-delivery))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "spring-settle": {
          "0%": { transform: "translateY(-50%) scale(1.05)" },
          "40%": { transform: "translateY(-50%) scale(0.97)" },
          "70%": { transform: "translateY(-50%) scale(1.02)" },
          "100%": { transform: "translateY(-50%) scale(1)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-right-alt": {
          "0%": { opacity: "0", transform: "translateX(-30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Drag and drop animations
        "drag-lift": {
          "0%": { transform: "translateY(-50%) scale(1)", boxShadow: "0 4px 12px hsl(24 95% 53% / 0.4)" },
          "100%": { transform: "translateY(-50%) scale(1.02)", boxShadow: "0 12px 28px hsl(24 95% 53% / 0.5)" },
        },
        "drop-settle": {
          "0%": { transform: "translateY(-50%) scale(1.02)", boxShadow: "0 12px 28px hsl(24 95% 53% / 0.5)" },
          "40%": { transform: "translateY(-50%) scale(0.98)", boxShadow: "0 4px 12px hsl(24 95% 53% / 0.4)" },
          "70%": { transform: "translateY(-50%) scale(1.01)", boxShadow: "0 6px 16px hsl(24 95% 53% / 0.45)" },
          "100%": { transform: "translateY(-50%) scale(1)", boxShadow: "0 4px 12px hsl(24 95% 53% / 0.4)" },
        },
        "rubber-band": {
          "0%": { transform: "scaleX(1)" },
          "30%": { transform: "scaleX(1.05)" },
          "40%": { transform: "scaleX(0.98)" },
          "50%": { transform: "scaleX(1.02)" },
          "65%": { transform: "scaleX(0.99)" },
          "75%": { transform: "scaleX(1.01)" },
          "100%": { transform: "scaleX(1)" },
        },
        "tooltip-pop": {
          "0%": { opacity: "0", transform: "translateX(-50%) translateY(4px) scale(0.95)" },
          "100%": { opacity: "1", transform: "translateX(-50%) translateY(0) scale(1)" },
        },
        "resize-pulse": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.3)" },
        },
        "ghost-fade": {
          "0%": { opacity: "0.4" },
          "100%": { opacity: "0.15" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "spring-settle": "spring-settle 0.4s ease-out",
        "slide-left": "slide-in-left 0.3s ease-out",
        "slide-right": "slide-in-right-alt 0.3s ease-out",
        // Drag and drop animations
        "drag-lift": "drag-lift 0.15s ease-out forwards",
        "drop-settle": "drop-settle 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "rubber-band": "rubber-band 0.4s ease-out",
        "tooltip-pop": "tooltip-pop 0.2s ease-out forwards",
        "resize-pulse": "resize-pulse 1s ease-in-out infinite",
        "ghost-fade": "ghost-fade 0.3s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
