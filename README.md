# Japan Tax Calculator / 日本税金計算機

A web-based calculator for Japanese income tax, social insurance, and residence tax. Supports salary and business income, multiple income sources, dependents, deductions, and home loan tax credits.

給与所得・事業所得に対する所得税・住民税・社会保険料を計算するWebアプリケーションです。複数の収入源、配偶者・扶養控除、各種所得控除、住宅ローン控除に対応しています。

**Live:** [xuanruiqi.com/japan-tax-calculator](https://www.xuanruiqi.com/japan-tax-calculator/)

---

## Features

- Income tax (所得税), residence tax (住民税), and social insurance (社会保険料) calculation
- Salary and business (self-employed) income support
- Multiple income sources
- Spouse and dependent deductions
- Custom deduction entries (iDeCo, furusato nozei, medical expenses, etc.)
- Home loan tax credit (住宅ローン控除) wizard
- National Health Insurance (国民健康保険) estimation for supported municipalities
- English and Japanese UI

## 機能

- 所得税・住民税・社会保険料の計算
- 給与所得・事業所得（自営業）への対応
- 複数収入源のサポート
- 配偶者控除・扶養控除
- 各種所得控除（iDeCo、ふるさと納税、医療費控除など）
- 住宅ローン控除ウィザード
- 対応自治体の国民健康保険料の試算
- 日本語・英語UI切り替え

---

## Running Locally

**Prerequisites:** Node.js ≥ 20.19 and [Corepack](https://nodejs.org/api/corepack.html) enabled (`corepack enable`).

```sh
# Install dependencies
yarn

# Start development server
yarn dev

# Type-check, build for production
yarn build

# Preview production build
yarn preview

# Lint
yarn lint
```

---

## Contributing

Contributions are welcome — bug fixes, accuracy improvements, new municipality NHI support, and UI enhancements are all appreciated.

1. Fork the repository and create a branch from `main`.
2. Make your changes. If you are adding a new feature, please make sure it works correctly before submitting.
3. Open a pull request against `main` with a clear description of what you changed and why.

For larger changes, please open an issue first to discuss the approach.

> **Note on tax accuracy:** This calculator is a best-effort estimate. If you find a calculation that is incorrect, please open an issue with a reference to the relevant regulation or official source.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Copyright (c) 2026 Xuanrui Qi
