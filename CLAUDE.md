# CLAUDE.md

## Project Overview

Japan Tax Calculator — a client-side Vue 3 web app that calculates Japanese income tax, resident tax, and social insurance contributions. No backend; all calculations are deterministic and run in the browser.

Live at: `xuanruiqi.com/japan-tax-calculator/`

You may safely assume that a development server is running at `http://localhost:5173/japan-tax-calculator/` with hot reload. If you need to run it yourself, run `yarn dev` (see Commands below).

## Tech Stack

- **Vue 3.5** (Composition API, `<script setup>`)
- **TypeScript 6.0** (strict mode, `noUncheckedIndexedAccess`)
- **Vite 8** (base path: `/japan-tax-calculator/`)
- **Nuxt UI 4** + **TailwindCSS 4** for UI components and styling
- **Pinia** + **Vue Router** (present but mostly unused — state lives in App.vue)
- **Yarn 4** (via Corepack) as package manager

## Commands

```bash
yarn dev          # Dev server at http://localhost:5173/japan-tax-calculator/
yarn build        # Type-check + build to dist/
yarn build-only   # Build without type-check
yarn preview      # Preview production build
yarn lint         # Run oxlint + eslint (both with --fix)
yarn format       # Prettier over src/
yarn type-check   # vue-tsc --build
```

## Code Structure

```
src/
  App.vue                  # Main component — all app state lives here (~87KB)
  components/
    DonutChart.vue          # SVG donut chart with tooltips
    HomeLoanWizard.vue      # 4-step wizard for home loan tax credit
  data/
    taxRates.ts             # Prefecture/city rates, social insurance rates
    deductions.ts           # Deduction types, metadata, NTA links
    homeLoan.ts             # Home loan credit rules 2022–2025
  utils/
    taxCalculation.ts       # Core tax/insurance/deduction logic (pure functions)
    nhiCalculation.ts       # NHI (国民健康保険) per municipality
    kokunenCalculation.ts   # National Pension exemption tiers
  locales/index.ts          # EN/JA translation strings (no i18n framework)
```

## Key Conventions

- **Pure calculation functions** — all tax logic in `utils/` is side-effect free. Keep it that way.
- **Customizability and extensibility** — data-driven design allows for easy updates as tax laws change. Avoid hardcoding logic; instead, add new rules or rates to the relevant data files. Especially, new NHI calculation rules should be added to `nhiCalculation.ts` as new functions. All tax deduction rules should be added to `deductions.ts` as new entries in `DEDUCTION_DEFS`.
- **Data-driven deductions** — deduction types are string union types; metadata lives in `DEDUCTION_DEFS`. Add new deduction types there, not ad hoc.
- **i18n by object lookup** — translations are in `locales/index.ts`. All user-facing strings go through the `t` computed property.
- **No backend, no API calls** — all data is statutory and hardcoded in `data/`. Do not add network requests.
- **TypeScript interfaces for all data shapes** — use interface-based types for new calculation results.

## Formatting & Linting

- Prettier: `semi: false`, `singleQuote: true`, `printWidth: 100`
- Oxlint (primary, fast) + ESLint (Vue-specific rules)
- Run `yarn lint && yarn format` before committing
- Before finalizing any change, you must make sure that there are no type errors or linting errors.
