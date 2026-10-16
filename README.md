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

## Supported Municipalities / 対応自治体

### Automatic resident tax (住民税の自動計算)

Resident tax is calculated automatically using the selected prefecture and municipality. All 47 prefectures have default rates; the following municipalities have explicit entries in the municipality selector. For other municipalities, select the prefecture's standard option to use its default rates; municipality-specific differences are not reflected.

住民税は、選択した都道府県・市区町村に応じて自動計算されます。全47都道府県の標準税率に対応しており、以下の自治体は市区町村の選択肢に個別登録されています。それ以外の自治体は、都道府県の標準の選択肢を選ぶと標準税率が適用されますが、自治体独自の税率等は反映されません。

| Prefecture / 都道府県 | Municipalities / 市区町村                                   |
| --------------------- | ----------------------------------------------------------- |
| Hokkaido / 北海道     | Sapporo / 札幌市, Yubari / 夕張市                           |
| Miyagi / 宮城県       | Sendai / 仙台市                                             |
| Ibaraki / 茨城県      | Tsukuba / つくば市                                          |
| Saitama / 埼玉県      | Saitama City / さいたま市                                   |
| Chiba / 千葉県        | Chiba City / 千葉市                                         |
| Tokyo / 東京都        | All 23 special wards / 東京23区, Musashino / 武蔵野市       |
| Kanagawa / 神奈川県   | Yokohama / 横浜市, Kawasaki / 川崎市, Sagamihara / 相模原市 |
| Niigata / 新潟県      | Niigata City / 新潟市                                       |
| Shizuoka / 静岡県     | Shizuoka City / 静岡市, Hamamatsu / 浜松市                  |
| Aichi / 愛知県        | Nagoya / 名古屋市                                           |
| Kyoto / 京都府        | Kyoto City / 京都市                                         |
| Osaka / 大阪府        | Osaka City / 大阪市, Sakai / 堺市                           |
| Hyogo / 兵庫県        | Kobe / 神戸市, Toyooka / 豊岡市                             |
| Okayama / 岡山県      | Okayama City / 岡山市                                       |
| Hiroshima / 広島県    | Hiroshima City / 広島市                                     |
| Fukuoka / 福岡県      | Fukuoka City / 福岡市, Kitakyushu / 北九州市                |
| Kumamoto / 熊本県     | Kumamoto City / 熊本市                                      |

### Automatic National Health Insurance (国民健康保険料の自動計算)

The NHI **Auto-calculate** option is available only for the municipalities below. Estimates assume one adult insured for a full fiscal year. For other municipalities, enter the annual NHI amount or supply the rates using **Calculate from rates**.

国民健康保険料の「自動計算」は、以下の自治体のみ対応しています。試算は成人1人が年度を通して加入する場合を想定しています。それ以外の自治体では、年間国保額を直接入力するか、「料率から計算」で料率等を入力してください。

| Prefecture / 都道府県 | Municipalities / 市区町村                             |
| --------------------- | ----------------------------------------------------- |
| Ibaraki / 茨城県      | Tsukuba / つくば市                                    |
| Tokyo / 東京都        | All 23 special wards / 東京23区, Musashino / 武蔵野市 |
| Kanagawa / 神奈川県   | Yokohama / 横浜市                                     |

Coverage is defined in [`src/data/taxRates.ts`](src/data/taxRates.ts) for resident tax and [`src/utils/nhiCalculation.ts`](src/utils/nhiCalculation.ts) for NHI. / 対応自治体の定義は、住民税は [`src/data/taxRates.ts`](src/data/taxRates.ts)、国民健康保険料は [`src/utils/nhiCalculation.ts`](src/utils/nhiCalculation.ts) を参照してください。

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
