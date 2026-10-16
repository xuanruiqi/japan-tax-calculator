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
| Chiba / 千葉県        | Chiba City / 千葉市, Funabashi / 船橋市                     |
| Tokyo / 東京都        | All 23 special wards / 東京23区, Musashino / 武蔵野市, Tachikawa / 立川市, Chofu / 調布市, Hachioji / 八王子市, Mitaka / 三鷹市 |
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
| Hokkaido / 北海道     | Sapporo / 札幌市                                     |
| Ibaraki / 茨城県      | Tsukuba / つくば市                                    |
| Saitama / 埼玉県      | Saitama City / さいたま市                             |
| Chiba / 千葉県        | Chiba City / 千葉市, Funabashi / 船橋市               |
| Tokyo / 東京都        | All 23 special wards / 東京23区, Musashino / 武蔵野市, Tachikawa / 立川市, Chofu / 調布市, Hachioji / 八王子市, Mitaka / 三鷹市 |
| Kanagawa / 神奈川県   | Yokohama / 横浜市, Kawasaki / 川崎市                  |
| Aichi / 愛知県        | Nagoya / 名古屋市                                    |
| Kyoto / 京都府        | Kyoto City / 京都市                                  |
| Osaka / 大阪府        | Osaka City / 大阪市                                  |
| Hyogo / 兵庫県        | Kobe / 神戸市                                        |
| Fukuoka / 福岡県      | Fukuoka City / 福岡市                                |

#### FY2026 NHI sources and calculation details

The fourteen additions below use enacted FY2026 (April 2026–March 2027) rates, checked on October 17, 2026. Each component includes its income levy, reduced fixed charges, and its own annual cap, including the new child and child-rearing support levy. Adult child-levy amounts include the separate age-18+ surcharge where applicable. Household charges are added once, including in the separate automatic child-levy calculation.

| Municipality | Official rate source | Calculation details |
| --- | --- | --- |
| Tachikawa / 立川市 | [FY2026 rates](https://www.city.tachikawa.lg.jp/kurashi/nenkin/1002478/1002510/1002554/1002560.html) | Medical cap ¥660,000; elderly-support cap ¥250,000. [Examples](https://www.city.tachikawa.lg.jp/kurashi/nenkin/1002478/1002510/1002554/1002559.html) truncate each component to ¥100. Adult child charge: ¥1,890 + ¥110. |
| Chofu / 調布市 | [FY2026 rates](https://www.city.chofu.lg.jp/060080/p038109.html) | Medical cap ¥660,000. [Calculation examples (PDF)](https://www.city.chofu.lg.jp/documents/11957/8kokuhozei_5.pdf) truncate each component to ¥100. Adult child charge: ¥1,900 + ¥100. |
| Hachioji / 八王子市 | [FY2026 amendments](https://www.city.hachioji.tokyo.jp/kurashi/nenkin/001/003/001/p003504.html), [calculation method](https://www.city.hachioji.tokyo.jp/kurashi/nenkin/001/003/001/p003505.html) | Components truncated to ¥100. Adult child charge: ¥1,800 + ¥100. [Official calculator entry point](https://www.city.hachioji.tokyo.jp/kurashi/nenkin/001/003/001/p035404.html). |
| Mitaka / 三鷹市 | [FY2026 rates](https://www.city.mitaka.lg.jp/c_service/000/000431.html) | Medical cap ¥660,000. [Examples](https://www.city.mitaka.lg.jp/c_service/020/020149.html) show ¥100 component truncation (the page's example heading still says FY2025). Adult child charge: ¥1,846 + ¥98. |
| Saitama City / さいたま市 | [FY2026 rates and example](https://www.city.saitama.lg.jp/001/153/002/004/p010020.html) | Components truncated to ¥100. Adult child charge: ¥1,600 + ¥100. The regression test reproduces the city's age-42, ¥3 million income example: ¥409,900/year. |
| Kawasaki / 川崎市 | [FY2026 rates](https://www.city.kawasaki.jp/350/page/0000187752.html) | [Calculation sheet (PDF)](https://www.city.kawasaki.jp/350/cmsfiles/contents/0000187/187752/R08keisanhyou.pdf) specifies ¥10 component truncation. Adult child charge: ¥1,665 + ¥77. |
| Chiba City / 千葉市 | [FY2026 rates](https://www.city.chiba.jp/hokenfukushi/iryoeisei/hoken/hokenryou-ketteishimashita.html), [official calculator](https://www.city.chiba.jp/hokenfukushi/iryoeisei/hoken/hokenryousisan.html) | The FY2026 workbook truncates the income base to ¥100 and components to ¥10. Medical and elderly-support household charges are ¥26,640 and ¥10,320; both receive low-income reductions. Adult child charge: ¥1,680 + ¥120. |
| Funabashi / 船橋市 | [FY2026 rates and examples](https://www.city.funabashi.lg.jp/kenkou/kokuho/002/p001880.html) | Components truncated to ¥10. Adult child charge: ¥1,800. |
| Osaka City / 大阪市 | [FY2026 city guidance](https://www.city.osaka.lg.jp/fukushi/page/0000624098.html), [prefecture-wide rates](https://www.pref.osaka.lg.jp/o100080/kokuho/iryouseido/hokenryouritsu/hokenryouritsu2.html) | Medical cap remains ¥660,000. The city's [FY2026 worksheet](https://www.city.osaka.lg.jp/fukushi/cmsfiles/contents/0000624/624098/sisan8.xlsm) truncates income and reduced fixed charges to whole yen and reduces the combined adult child charge of ¥1,841 (¥1,745 + ¥96). Medical/support household charges: ¥33,908/¥10,845. |
| Kyoto City / 京都市 | [FY2026 rates](https://www.city.kyoto.lg.jp/hokenfukushi/page/0000351038.html), [official worksheet](https://www.city.kyoto.lg.jp/hokenfukushi/cmsfiles/contents/0000351/351041/08_shisan.xlsx) | Income levies are truncated to ¥10 before adding reduced fixed charges; the final total retains whole yen. Medical/support/care/child household charges: ¥17,930/¥6,180/¥5,370/¥660. Adult child charge: ¥1,110 + ¥60. |
| Kobe / 神戸市 | [FY2026 rates](https://www.city.kobe.lg.jp/a52670/kurashi/support/insurance/gaku.html), [city-linked calculator](https://e-apps.nextbit.co.jp/kokuho-kobe2026/), [ordinance](https://www1.g-reiki.net/city.kobe/reiki_honbun/k302RG00000589.html) | Income levies and components are truncated to ¥10; each fixed-charge reduction is rounded up to ¥10. Medical/support/care/child household charges: ¥21,800/¥8,740/¥6,880/¥830. Adult child charge: ¥1,280 + ¥50. |
| Nagoya / 名古屋市 | [FY2026 rates and local deductions](https://www.city.nagoya.jp/kurashi/hoken/1011736/1011793/1011794/1011799.html), [official examples (PDF)](https://www.city.nagoya.jp/_res/projects/default_project/_page_/001/011/799/r8_keisanrei.pdf) | Components truncated to ¥10. Low-income reduction recipients also receive a ¥2,000 medical fixed-charge deduction. Adult child charge: ¥1,771 + ¥92. Tests reproduce the published ¥18,450 low-income example and ¥365,940 age-51 example. |
| Sapporo / 札幌市 | [FY2026 rates and rounding](https://www.city.sapporo.jp/hoken-iryo/kokuho/fuka.html), [reductions](https://www.city.sapporo.jp/hoken-iryo/kokuho/fuka-gengaku.html) | Components truncated to ¥10. Medical/support/care/child household charges: ¥32,540/¥10,010/¥7,550/¥1,000. Adult child charge: ¥1,000 + ¥100. |
| Fukuoka City / 福岡市 | [FY2026 rates](https://www.city.fukuoka.lg.jp/hofuku/kokuho/hp/seido/06-02.html), [official worksheet](https://www.city.fukuoka.lg.jp/hofuku/kokuho/hp/seido/documents/kokuhoryou08keisan.xlsx) | Components truncated to ¥100. Medical/support/care/child household charges: ¥18,664/¥9,838/¥7,751/¥911. Adult child charge: ¥967 + ¥72. |

For a single adult, the 70%, 50%, and 20% fixed-charge reductions apply at total income of at most ¥430,000, ¥740,000, and ¥1,000,000 respectively. Reductions use total income before the ¥430,000 basic deduction, while income levies use the assessment base after that deduction. Reductions apply to both per-person and household charges, with rounding as documented above. The ordinary child charge and adult surcharge are reduced separately, except for Osaka's combined-charge worksheet estimate.

FY2026 NHI is based on calendar-2025 income. Its salary-income estimate uses the [NTA's 2025 deduction table](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm), including the ¥650,000 minimum for gross salaries up to ¥1.9 million. Salary income is estimated using the rate formulas; the statutory salary-income lookup table below ¥6.6 million can produce small differences.

These estimates cover one adult's full-year NHI only. They do not model other household members, midyear enrollment or birthdays, pension-income adjustments, involuntary-unemployment relief, maternity exemptions, or special municipal relief (including [Kawasaki's disability/child-related base deductions](https://www.city.kawasaki.jp/350/page/0000187756.html), Nagoya's dependent/disability/widow/single-parent income-levy deductions, and Kobe's transitional relief for withdrawn local deductions). Nagoya's automatic ¥2,000 low-income fixed-charge deduction is included. Long-term care is included only for ages 40–64; ages 65+ pay it separately, and people aged 75+ generally move to a different health insurance system. Use a manual annual amount when these circumstances apply.

追加14市は令和8年度の公式料率に基づき、成人1人・通年加入として試算します。各市の平等割・低所得軽減・限度額・端数処理、子ども・子育て支援金、名古屋市の低所得者向け均等割独自控除（年2,000円）を含みます。世帯全員の保険料や年度途中の異動、特別な減免は対象外です。

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
