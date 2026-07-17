# Product Guidelines: UAP AnalyticsBot

## 1. Visual & UX Design System
- **Theme**: Premium futuristic dark mode.
  - Background Base: `#0b0f19` (rich deep dark blue).
  - Surface: Translucent glassmorphism (`rgba(17, 24, 39, 0.7)`) with `backdrop-filter: blur(10px)`.
  - Border: Subtle white/translucent border (`rgba(255, 255, 255, 0.08)`).
- **Typography**:
  - Headings / Display: `'Outfit', sans-serif` for modern, clean structure.
  - Body Text: `'Inter', sans-serif` for legibility.
- **Accents & Brand Colors**:
  - Primary (Violet): `#8b5cf6` (used for primary headers, indicators, and brand glow).
  - Secondary (Cyan): `#06b6d4` (used for secondary metrics, selections, and subtle highlights).
  - Success: `#10b981` (Green)
  - Warning: `#f59e0b` (Amber)
  - Error: `#ef4444` (Red)
  - Info: `#3b82f6` (Blue)
- **Glow & Depth**: Strategic neon glowing shadows to separate interactive controls or main data cards (e.g., `0 0 15px rgba(139, 92, 246, 0.35)`).

## 2. Copywriting & Voice Guidelines
- **Tone**: Analytical, technical, concise, and professional.
- **Prose**: Focus on clarity and efficiency. Avoid flowery language or long-winded setup prompts.
- **CLI Outputs**: 
  - Format all CLI text structures using clean tables or structured JSON output when `--stream` or `--json` flags are active.
  - Use standard ANSI color indicators (e.g., red for errors, yellow for warnings, green for success) to highlight status markers.

## 3. Interaction Patterns
- **No Placeholders**: All dashboards, menus, and reporting files must contain live data or functional fallbacks.
- **Micro-animations**: Transition hover states on all interactive elements (buttons, side-panel files, dashboard charts) using a smooth ease-in-out transition: `transition: all 0.2s ease-in-out` to create a responsive, organic interface feel.
- **Offline First**: All user interfaces and workflows must default to offline assets, preventing assets from hanging on slow/unreachable CDN requests.
