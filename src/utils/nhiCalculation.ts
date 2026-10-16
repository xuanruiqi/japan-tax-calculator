// National Health Insurance (国民健康保険) calculation logic
// Each municipality has its own rates; register new cities in MUNICIPALITY_RATES.

export type AgeGroup = 'under40' | '40to64' | '65over'

export interface NhiBreakdown {
  medical: number
  support: number
  kaigo: number // 0 unless age 40–64
  kodomo: number
  total: number
  reduction: 0.7 | 0.5 | 0.2 | 0 // 均等割軽減率 applied
}

/**
 * Compute both the NHI total income (総所得金額等) and assessment base (算定基礎額).
 * - totalIncome is used for 均等割軽減 threshold checks
 * - base = max(0, totalIncome − 基礎控除 430,000) is used for 所得割
 *
 * @param salaryGross  Total gross salary across all salary income entries
 * @param bizIncome    Total net business/misc income (revenue − expenses)
 */
export function computeNhiIncomes(
  salaryGross: number,
  bizIncome: number,
): { totalIncome: number; base: number } {
  let empDeduction = 0
  // FY2026 NHI uses calendar-2025 income (not the calendar-2026 income-tax table).
  // https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm
  if (salaryGross <= 1900000) empDeduction = Math.min(salaryGross, 650000)
  else if (salaryGross <= 3600000) empDeduction = salaryGross * 0.3 + 80000
  else if (salaryGross <= 6600000) empDeduction = salaryGross * 0.2 + 440000
  else if (salaryGross <= 8500000) empDeduction = salaryGross * 0.1 + 1100000
  else empDeduction = 1950000
  const empIncome = Math.max(0, salaryGross - empDeduction)
  const totalIncome = empIncome + bizIncome
  const base = Math.max(0, totalIncome - 430000)
  return { totalIncome, base }
}

/** Manual income-based levy estimate. Rate is entered as a percentage, e.g. 0.3. */
export function calculateNhiChildSupportContribution(base: number, ratePercent: number): number {
  if (!Number.isFinite(ratePercent)) return 0
  return Math.floor((Math.max(0, base) * Math.max(0, ratePercent)) / 100)
}

/** @deprecated Use computeNhiIncomes instead. */
export function computeNhiBase(salaryGross: number, bizIncome: number): number {
  return computeNhiIncomes(salaryGross, bizIncome).base
}

// ─────────────────────────────────────────────────────────────────────────────
// 均等割額の軽減 (per-capita levy reduction for low-income households)
// Assumes single-person household (insured count = 1, wage earner count = 1).
// Source: https://www.city.chiyoda.lg.jp/koho/kurashi/hoken/kenkohoken/kesan.html
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the 均等割 reduction rate for a single-person household.
 * Thresholds (single wage-earner, 1 insured):
 *   7割軽減: totalIncome ≤ 430,000
 *   5割軽減: totalIncome ≤ 430,000 + 310,000 × 1 = 740,000
 *   2割軽減: totalIncome ≤ 430,000 + 570,000 × 1 = 1,000,000
 */
function kintowariReduction(totalIncome: number): 0.7 | 0.5 | 0.2 | 0 {
  if (totalIncome <= 430000) return 0.7
  if (totalIncome <= 740000) return 0.5
  if (totalIncome <= 1000000) return 0.2
  return 0
}

function applyReduction(amount: number, reduction: number): number {
  return Math.round(amount * (1 - reduction))
}

// ─────────────────────────────────────────────────────────────────────────────
// Municipality rate tables
// ─────────────────────────────────────────────────────────────────────────────

/** FY2026 rates for the existing single-adult NHI estimate. Verified 2026-10-17. */
export interface NhiChildSupportRates {
  incomeRate: number
  annualPerCapita: number
  annualHousehold: number
  annualCap: number
  sourceUrl: string
}

interface NhiRounding {
  componentUnit: 1 | 10 | 100
  baseUnit?: 100
  // Applied before fixed charges (Kyoto and Kobe).
  incomeUnit?: 10
  // Round the reduction amount up, then subtract it from each fixed charge.
  reductionUnit?: 10
}

interface MunicipalityRates {
  childSupportSourceUrl: string
  shotokuMedical: number
  shotokuSupport: number
  shotokuKaigo: number
  shotokuKodomo: number
  kintowariMedical: number
  kintowariSupport: number
  kintowariKaigo: number
  kintowariKodomo: number
  capMedical: number
  capSupport: number
  capKaigo: number
  capKodomo: number
  householdMedical?: number
  householdSupport?: number
  householdKaigo?: number
  householdKodomo?: number
  // Additional deduction after the statutory fixed-charge reduction (Nagoya).
  medicalLowIncomeDiscount?: number
  // The adult surcharge is reduced separately from the ordinary child levy.
  kodomoAdultSurcharge?: number
  rounding?: NhiRounding
}

/** Single-adult component, including any reduced household charge. */
function calculateNhiComponent(
  base: number,
  incomeRate: number,
  fixedCharges: number[],
  cap: number,
  reduction: NhiBreakdown['reduction'],
  rounding?: NhiRounding,
  fixedDiscount = 0,
): number {
  if (!rounding) {
    return Math.min(
      Math.round(base * incomeRate) +
        fixedCharges.reduce((sum, amount) => sum + applyReduction(amount, reduction), 0),
      cap,
    )
  }
  const baseUnit = rounding.baseUnit ?? 1
  const assessmentBase = Math.floor(Math.max(0, base) / baseUnit) * baseUnit
  // Rates are published to 0.01%. Integer basis points avoid floating-point
  // underflow at exact yen boundaries before truncation.
  const incomeUnit = rounding.incomeUnit ?? 1
  const incomeLevy =
    Math.floor((assessmentBase * Math.round(incomeRate * 10000)) / (10000 * incomeUnit)) *
    incomeUnit
  const reductionUnit = rounding.reductionUnit ?? 1
  const fixedLevy = fixedCharges.reduce(
    (sum, amount) =>
      sum + amount - Math.ceil((amount * (reduction * 10)) / (10 * reductionUnit)) * reductionUnit,
    0,
  )
  return (
    Math.floor(
      Math.min(Math.max(0, incomeLevy + fixedLevy - fixedDiscount), cap) / rounding.componentUnit,
    ) * rounding.componentUnit
  )
}

function calculateNhiFromRates(
  totalIncome: number,
  base: number,
  ageGroup: AgeGroup,
  rates: MunicipalityRates,
): NhiBreakdown {
  const reduction = kintowariReduction(totalIncome)
  const medical = calculateNhiComponent(
    base,
    rates.shotokuMedical,
    [rates.kintowariMedical, rates.householdMedical ?? 0],
    rates.capMedical,
    reduction,
    rates.rounding,
    reduction > 0 ? (rates.medicalLowIncomeDiscount ?? 0) : 0,
  )
  const support = calculateNhiComponent(
    base,
    rates.shotokuSupport,
    [rates.kintowariSupport, rates.householdSupport ?? 0],
    rates.capSupport,
    reduction,
    rates.rounding,
  )
  const kaigo =
    ageGroup === '40to64'
      ? calculateNhiComponent(
          base,
          rates.shotokuKaigo,
          [rates.kintowariKaigo, rates.householdKaigo ?? 0],
          rates.capKaigo,
          reduction,
          rates.rounding,
        )
      : 0
  const kodomo = calculateChildSupportFromRates(base, reduction, rates)
  return { medical, support, kaigo, kodomo, total: medical + support + kaigo + kodomo, reduction }
}

/**
 * 東京23区共通レート — 令和8年度 (FY2026)
 * All 23 special wards share the same NHI rates set by Tokyo Metropolitan Government.
 * Sources:
 *   千代田区: https://www.city.chiyoda.lg.jp/koho/kurashi/hoken/kenkohoken/kesan.html
 *   港区:     https://www.city.minato.tokyo.jp/shikaku/kurashi/hoken/kenkohoken/hokenryo.html
 */
const TOKYO_WARD_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.chiyoda.lg.jp/koho/kurashi/hoken/kenkohoken/kesan.html',
  shotokuMedical: 0.0751,
  kintowariMedical: 47600,
  capMedical: 670000,
  shotokuSupport: 0.028,
  kintowariSupport: 17600,
  capSupport: 260000,
  shotokuKaigo: 0.0243,
  kintowariKaigo: 17800,
  capKaigo: 170000,
  shotokuKodomo: 0.0027,
  kintowariKodomo: 1873,
  capKodomo: 30000,
}

/**
 * 武蔵野市 (Musashino) — 令和8年度 (FY2026)
 * Source: https://www.city.musashino.lg.jp/kurashi_tetsuzuki/kokuminkenkouhoken_kokuminnenkin/kokuminkenkohoken/1052169/1004710.html
 */
const MUSASHINO_RATES: MunicipalityRates = {
  childSupportSourceUrl:
    'https://www.city.musashino.lg.jp/kurashi_tetsuzuki/kokuminkenkouhoken_kokuminnenkin/kokuminkenkohoken/1052169/1004710.html',
  shotokuMedical: 0.0579,
  kintowariMedical: 33000,
  capMedical: 660000,
  shotokuSupport: 0.0209,
  kintowariSupport: 12500,
  capSupport: 260000,
  shotokuKaigo: 0.0184,
  kintowariKaigo: 15000,
  capKaigo: 170000,
  shotokuKodomo: 0.003,
  kintowariKodomo: 1900,
  capKodomo: 30000,
}

/**
 * つくば市 (Tsukuba) — 令和8年度 (FY2026)
 * 子ども分 均等割: ¥1,400 base + ¥200 age-18+ surcharge; adults pay ¥1,600.
 * Source: https://www.city.tsukuba.lg.jp/kenko_iryo_fukushi/hoken/kenpo/1001243.html
 */
const TSUKUBA_RATES: MunicipalityRates = {
  childSupportSourceUrl:
    'https://www.city.tsukuba.lg.jp/kenko_iryo_fukushi/hoken/kenpo/1001243.html',
  shotokuMedical: 0.077,
  kintowariMedical: 38500,
  capMedical: 670000,
  shotokuSupport: 0.0315,
  kintowariSupport: 15500,
  capSupport: 260000,
  shotokuKaigo: 0.025,
  kintowariKaigo: 15500,
  capKaigo: 170000,
  shotokuKodomo: 0.0029,
  kintowariKodomo: 1600,
  capKodomo: 30000,
}

/**
 * 横浜市 (Yokohama) — 令和8年度 (FY2026)
 * 子ども分 均等割 = ¥1,690 base + ¥80 age-18+ surcharge; adults pay ¥1,770.
 * Source: https://www.city.yokohama.lg.jp/kurashi/koseki-zei-hoken/kokuho/hokenryo/r7hokennryouritu.html
 */
const YOKOHAMA_RATES: MunicipalityRates = {
  childSupportSourceUrl:
    'https://www.city.yokohama.lg.jp/kurashi/koseki-zei-hoken/kokuho/hokenryo/r7hokennryouritu.html',
  shotokuMedical: 0.0833,
  kintowariMedical: 40870,
  capMedical: 670000,
  shotokuSupport: 0.0262,
  kintowariSupport: 13380,
  capSupport: 260000,
  shotokuKaigo: 0.0284,
  kintowariKaigo: 16200,
  capKaigo: 170000,
  shotokuKodomo: 0.0034,
  kintowariKodomo: 1770,
  capKodomo: 30000,
}

// FY2026 municipal tables, verified 2026-10-17. Child per-capita amounts include
// the age-18+ surcharge. See README.md for calculation sheets and scope.
const TACHIKAWA_RATES: MunicipalityRates = {
  childSupportSourceUrl:
    'https://www.city.tachikawa.lg.jp/kurashi/nenkin/1002478/1002510/1002554/1002560.html',
  shotokuMedical: 0.0685,
  kintowariMedical: 34200,
  capMedical: 660000,
  shotokuSupport: 0.0229,
  kintowariSupport: 12200,
  capSupport: 250000,
  shotokuKaigo: 0.0173,
  kintowariKaigo: 14800,
  capKaigo: 170000,
  shotokuKodomo: 0.0031,
  kintowariKodomo: 2000,
  capKodomo: 30000,
  kodomoAdultSurcharge: 110,
  rounding: { componentUnit: 100 },
}

const CHOFU_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.chofu.lg.jp/060080/p038109.html',
  shotokuMedical: 0.058,
  kintowariMedical: 30500,
  capMedical: 660000,
  shotokuSupport: 0.0208,
  kintowariSupport: 10900,
  capSupport: 260000,
  shotokuKaigo: 0.0184,
  kintowariKaigo: 12600,
  capKaigo: 170000,
  shotokuKodomo: 0.003,
  kintowariKodomo: 2000,
  capKodomo: 30000,
  kodomoAdultSurcharge: 100,
  rounding: { componentUnit: 100 },
}

const HACHIOJI_RATES: MunicipalityRates = {
  childSupportSourceUrl:
    'https://www.city.hachioji.tokyo.jp/kurashi/nenkin/001/003/001/p003504.html',
  shotokuMedical: 0.0742,
  kintowariMedical: 42500,
  capMedical: 670000,
  shotokuSupport: 0.0285,
  kintowariSupport: 17800,
  capSupport: 260000,
  shotokuKaigo: 0.0241,
  kintowariKaigo: 18000,
  capKaigo: 170000,
  shotokuKodomo: 0.003,
  kintowariKodomo: 1900,
  capKodomo: 30000,
  kodomoAdultSurcharge: 100,
  rounding: { componentUnit: 100 },
}

const MITAKA_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.mitaka.lg.jp/c_service/000/000431.html',
  shotokuMedical: 0.061,
  kintowariMedical: 29000,
  capMedical: 660000,
  shotokuSupport: 0.023,
  kintowariSupport: 11800,
  capSupport: 260000,
  shotokuKaigo: 0.016,
  kintowariKaigo: 13400,
  capKaigo: 170000,
  shotokuKodomo: 0.003,
  kintowariKodomo: 1944,
  capKodomo: 30000,
  kodomoAdultSurcharge: 98,
  rounding: { componentUnit: 100 },
}

const SAITAMA_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.saitama.lg.jp/001/153/002/004/p010020.html',
  shotokuMedical: 0.0764,
  kintowariMedical: 43300,
  capMedical: 670000,
  shotokuSupport: 0.0273,
  kintowariSupport: 14900,
  capSupport: 260000,
  shotokuKaigo: 0.0237,
  kintowariKaigo: 16100,
  capKaigo: 170000,
  shotokuKodomo: 0.0026,
  kintowariKodomo: 1700,
  capKodomo: 30000,
  kodomoAdultSurcharge: 100,
  rounding: { componentUnit: 100 },
}

const KAWASAKI_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.kawasaki.jp/350/page/0000187752.html',
  shotokuMedical: 0.0826,
  kintowariMedical: 43261,
  capMedical: 670000,
  shotokuSupport: 0.0289,
  kintowariSupport: 15306,
  capSupport: 260000,
  shotokuKaigo: 0.0267,
  kintowariKaigo: 15828,
  capKaigo: 170000,
  shotokuKodomo: 0.0032,
  kintowariKodomo: 1742,
  capKodomo: 30000,
  kodomoAdultSurcharge: 77,
  rounding: { componentUnit: 10 },
}

const CHIBA_RATES: MunicipalityRates = {
  childSupportSourceUrl:
    'https://www.city.chiba.jp/hokenfukushi/iryoeisei/hoken/hokenryou-ketteishimashita.html',
  shotokuMedical: 0.0721,
  kintowariMedical: 23280,
  capMedical: 670000,
  shotokuSupport: 0.0285,
  kintowariSupport: 8880,
  capSupport: 260000,
  shotokuKaigo: 0.0257,
  kintowariKaigo: 16560,
  capKaigo: 170000,
  shotokuKodomo: 0.0031,
  kintowariKodomo: 1800,
  capKodomo: 30000,
  householdMedical: 26640,
  householdSupport: 10320,
  kodomoAdultSurcharge: 120,
  rounding: { componentUnit: 10, baseUnit: 100 },
}

const FUNABASHI_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.funabashi.lg.jp/kenkou/kokuho/002/p001880.html',
  shotokuMedical: 0.0705,
  kintowariMedical: 39300,
  capMedical: 670000,
  shotokuSupport: 0.0274,
  kintowariSupport: 12700,
  capSupport: 260000,
  shotokuKaigo: 0.0188,
  kintowariKaigo: 13900,
  capKaigo: 170000,
  shotokuKodomo: 0.0027,
  kintowariKodomo: 1800,
  capKodomo: 30000,
  rounding: { componentUnit: 10 },
}

const OSAKA_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.osaka.lg.jp/fukushi/page/0000624098.html',
  shotokuMedical: 0.095,
  kintowariMedical: 34990,
  capMedical: 660000,
  shotokuSupport: 0.0306,
  kintowariSupport: 11191,
  capSupport: 260000,
  shotokuKaigo: 0.026,
  kintowariKaigo: 18682,
  capKaigo: 170000,
  shotokuKodomo: 0.0028,
  kintowariKodomo: 1841,
  capKodomo: 30000,
  householdMedical: 33908,
  householdSupport: 10845,
  // The official Osaka worksheet reduces the combined adult child charge.
  rounding: { componentUnit: 1 },
}

const KYOTO_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.kyoto.lg.jp/hokenfukushi/page/0000351038.html',
  shotokuMedical: 0.0794,
  kintowariMedical: 30080,
  capMedical: 670000,
  shotokuSupport: 0.0266,
  kintowariSupport: 10360,
  capSupport: 260000,
  shotokuKaigo: 0.0251,
  kintowariKaigo: 11090,
  capKaigo: 170000,
  shotokuKodomo: 0.0028,
  kintowariKodomo: 1170,
  capKodomo: 30000,
  householdMedical: 17930,
  householdSupport: 6180,
  householdKaigo: 5370,
  householdKodomo: 660,
  kodomoAdultSurcharge: 60,
  rounding: { componentUnit: 1, incomeUnit: 10 },
}

const KOBE_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.kobe.lg.jp/a52670/kurashi/support/insurance/gaku.html',
  shotokuMedical: 0.0738,
  kintowariMedical: 33700,
  capMedical: 670000,
  shotokuSupport: 0.0297,
  kintowariSupport: 13510,
  capSupport: 260000,
  shotokuKaigo: 0.0278,
  kintowariKaigo: 13970,
  capKaigo: 170000,
  shotokuKodomo: 0.0026,
  kintowariKodomo: 1330,
  capKodomo: 30000,
  householdMedical: 21800,
  householdSupport: 8740,
  householdKaigo: 6880,
  householdKodomo: 830,
  kodomoAdultSurcharge: 50,
  rounding: { componentUnit: 10, incomeUnit: 10, reductionUnit: 10 },
}

const NAGOYA_RATES: MunicipalityRates = {
  childSupportSourceUrl:
    'https://www.city.nagoya.jp/kurashi/hoken/1011736/1011793/1011794/1011799.html',
  shotokuMedical: 0.0883,
  kintowariMedical: 50591,
  capMedical: 670000,
  shotokuSupport: 0.0258,
  kintowariSupport: 15784,
  capSupport: 260000,
  shotokuKaigo: 0.0234,
  kintowariKaigo: 16120,
  capKaigo: 170000,
  shotokuKodomo: 0.0026,
  kintowariKodomo: 1863,
  capKodomo: 30000,
  kodomoAdultSurcharge: 92,
  medicalLowIncomeDiscount: 2000,
  rounding: { componentUnit: 10 },
}

const SAPPORO_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.sapporo.jp/hoken-iryo/kokuho/fuka.html',
  shotokuMedical: 0.0861,
  kintowariMedical: 20550,
  capMedical: 670000,
  shotokuSupport: 0.0256,
  kintowariSupport: 6330,
  capSupport: 260000,
  shotokuKaigo: 0.0233,
  kintowariKaigo: 6020,
  capKaigo: 170000,
  shotokuKodomo: 0.0029,
  kintowariKodomo: 1100,
  capKodomo: 30000,
  householdMedical: 32540,
  householdSupport: 10010,
  householdKaigo: 7550,
  householdKodomo: 1000,
  kodomoAdultSurcharge: 100,
  rounding: { componentUnit: 10 },
}

const FUKUOKA_RATES: MunicipalityRates = {
  childSupportSourceUrl: 'https://www.city.fukuoka.lg.jp/hofuku/kokuho/hp/seido/06-02.html',
  shotokuMedical: 0.0558,
  kintowariMedical: 19807,
  capMedical: 670000,
  shotokuSupport: 0.0314,
  kintowariSupport: 10441,
  capSupport: 260000,
  shotokuKaigo: 0.0261,
  kintowariKaigo: 10160,
  capKaigo: 170000,
  shotokuKodomo: 0.0028,
  kintowariKodomo: 1039,
  capKodomo: 30000,
  householdMedical: 18664,
  householdSupport: 9838,
  householdKaigo: 7751,
  householdKodomo: 911,
  kodomoAdultSurcharge: 72,
  rounding: { componentUnit: 100 },
}

// Dispatcher — add new cities here.
const MUNICIPALITY_RATES: Record<string, MunicipalityRates> = {
  tokyo_23ku: TOKYO_WARD_RATES,
  musashino: MUSASHINO_RATES,
  yokohama: YOKOHAMA_RATES,
  tsukuba: TSUKUBA_RATES,
  tachikawa: TACHIKAWA_RATES,
  chofu: CHOFU_RATES,
  hachioji: HACHIOJI_RATES,
  mitaka: MITAKA_RATES,
  saitama_city: SAITAMA_RATES,
  kawasaki: KAWASAKI_RATES,
  chiba_city: CHIBA_RATES,
  funabashi: FUNABASHI_RATES,
  osaka_city: OSAKA_RATES,
  kyoto_city: KYOTO_RATES,
  kobe: KOBE_RATES,
  nagoya: NAGOYA_RATES,
  sapporo: SAPPORO_RATES,
  fukuoka_city: FUKUOKA_RATES,
}

export function isMunicipalitySupported(city: string): boolean {
  return Object.hasOwn(MUNICIPALITY_RATES, city)
}

function childSupportRates(rates: MunicipalityRates): NhiChildSupportRates {
  return {
    incomeRate: rates.shotokuKodomo,
    annualPerCapita: rates.kintowariKodomo,
    annualHousehold: rates.householdKodomo ?? 0,
    annualCap: rates.capKodomo,
    sourceUrl: rates.childSupportSourceUrl,
  }
}

export function getMunicipalityChildSupportRates(city: string): NhiChildSupportRates | null {
  const rates = isMunicipalitySupported(city) ? MUNICIPALITY_RATES[city] : undefined
  return rates ? childSupportRates(rates) : null
}

function calculateChildSupportFromRates(
  base: number,
  reduction: NhiBreakdown['reduction'],
  rates: MunicipalityRates,
): number {
  const surcharge = rates.kodomoAdultSurcharge ?? 0
  return calculateNhiComponent(
    Math.max(0, base),
    rates.shotokuKodomo,
    [rates.kintowariKodomo - surcharge, surcharge, rates.householdKodomo ?? 0],
    rates.capKodomo,
    reduction,
    rates.rounding,
  )
}

/** Single adult, full fiscal year; includes the reduced adult per-capita levy and annual cap. */
export function calculateMunicipalityChildSupport(
  city: string,
  totalIncome: number,
  base: number,
): number | null {
  const rates = isMunicipalitySupported(city) ? MUNICIPALITY_RATES[city] : undefined
  return rates ? calculateChildSupportFromRates(base, kintowariReduction(totalIncome), rates) : null
}

/** Returns a breakdown for the given city, or null if the city is not supported. */
export function calculateMunicipalityNhi(
  city: string,
  totalIncome: number,
  base: number,
  ageGroup: AgeGroup,
): NhiBreakdown | null {
  const rates = isMunicipalitySupported(city) ? MUNICIPALITY_RATES[city] : undefined
  return rates ? calculateNhiFromRates(totalIncome, base, ageGroup, rates) : null
}
