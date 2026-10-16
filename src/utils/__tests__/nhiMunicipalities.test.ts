// Run: node --experimental-strip-types --test src/utils/__tests__/*.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { CITY_NAMES, RESIDENT_TAX_RATES } from '../../data/taxRates.ts'
import {
  calculateMunicipalityChildSupport,
  calculateMunicipalityNhi,
  computeNhiIncomes,
  getMunicipalityChildSupportRates,
  isMunicipalitySupported,
  type NhiBreakdown,
} from '../nhiCalculation.ts'

interface MunicipalityCase {
  city: string
  prefecture: string
  childRate: number
  adultChildLevy: number
  householdChildLevy?: number
  // Medical, elderly support, care, and child support, respectively.
  atMillionBase: number[]
  caps: number[]
  atReductionThresholds: number[][]
}

// Independent fixtures from the official FY2026 tables/calculation sheets
// linked in README.md. All amounts assume one adult insured for twelve months.
const cases: MunicipalityCase[] = [
  {
    city: 'tachikawa',
    prefecture: 'tokyo',
    childRate: 0.0031,
    adultChildLevy: 2000,
    atMillionBase: [102700, 35100, 32100, 5100],
    caps: [660000, 250000, 170000, 30000],
    atReductionThresholds: [
      [10200, 3600, 4400, 600],
      [38300, 13100, 12700, 1900],
      [66400, 22800, 21700, 3300],
    ],
  },
  {
    city: 'chofu',
    prefecture: 'tokyo',
    childRate: 0.003,
    adultChildLevy: 2000,
    atMillionBase: [88500, 31700, 31000, 5000],
    caps: [660000, 260000, 170000, 30000],
    atReductionThresholds: [
      [9100, 3200, 3700, 600],
      [33200, 11800, 12000, 1900],
      [57400, 20500, 20500, 3300],
    ],
  },
  {
    city: 'hachioji',
    prefecture: 'tokyo',
    childRate: 0.003,
    adultChildLevy: 1900,
    atMillionBase: [116700, 46300, 42100, 4900],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [12700, 5300, 5400, 500],
      [44200, 17700, 16400, 1800],
      [76200, 30400, 28100, 3200],
    ],
  },
  {
    city: 'mitaka',
    prefecture: 'tokyo',
    childRate: 0.003,
    adultChildLevy: 1944,
    atMillionBase: [90000, 34800, 29400, 4900],
    caps: [660000, 260000, 170000, 30000],
    atReductionThresholds: [
      [8700, 3500, 4000, 500],
      [33400, 13000, 11600, 1900],
      [57900, 22500, 19800, 3200],
    ],
  },
  {
    city: 'saitama_city',
    prefecture: 'saitama',
    childRate: 0.0026,
    adultChildLevy: 1700,
    atMillionBase: [119700, 42200, 39800, 4300],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [12900, 4400, 4800, 500],
      [45300, 15900, 15300, 1600],
      [78100, 27400, 26300, 2800],
    ],
  },
  {
    city: 'kawasaki',
    prefecture: 'kanagawa',
    childRate: 0.0032,
    adultChildLevy: 1742,
    atMillionBase: [125860, 44200, 42520, 4940],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [12970, 4590, 4740, 520],
      [47230, 16610, 16190, 1860],
      [81690, 28710, 27880, 3210],
    ],
  },
  {
    city: 'chiba_city',
    prefecture: 'chiba',
    childRate: 0.0031,
    adultChildLevy: 1800,
    atMillionBase: [122020, 47700, 42260, 4900],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [14970, 5760, 4960, 540],
      [47310, 18430, 16240, 1860],
      [81030, 31600, 27890, 3200],
    ],
  },
  {
    city: 'funabashi',
    prefecture: 'chiba',
    childRate: 0.0027,
    adultChildLevy: 1800,
    atMillionBase: [109800, 40100, 32700, 4500],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [11790, 3810, 4170, 540],
      [41500, 14840, 12770, 1730],
      [71620, 25770, 21830, 2970],
    ],
  },
  {
    city: 'osaka_city',
    prefecture: 'osaka',
    childRate: 0.0028,
    adultChildLevy: 1841,
    atMillionBase: [163898, 52636, 44682, 4641],
    caps: [660000, 260000, 170000, 30000],
    atReductionThresholds: [
      [20669, 6610, 5604, 552],
      [63899, 20503, 17401, 1788],
      [109268, 35070, 29765, 3068],
    ],
  },
  {
    city: 'kyoto_city',
    prefecture: 'kyoto',
    childRate: 0.0028,
    adultChildLevy: 1170,
    householdChildLevy: 660,
    atMillionBase: [127410, 43140, 41560, 4630],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [14403, 4962, 4938, 549],
      [48615, 16510, 16010, 1775],
      [83658, 28392, 27468, 3054],
    ],
  },
  {
    city: 'kobe',
    prefecture: 'hyogo',
    childRate: 0.0026,
    adultChildLevy: 1330,
    householdChildLevy: 830,
    atMillionBase: [129300, 51950, 48650, 4760],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [16650, 6670, 6250, 630],
      [50620, 20320, 19030, 1870],
      [86460, 34710, 32510, 3200],
    ],
  },
  {
    city: 'nagoya',
    prefecture: 'aichi',
    childRate: 0.0026,
    adultChildLevy: 1863,
    atMillionBase: [138890, 41580, 39520, 4460],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [13170, 4730, 4830, 550],
      [50660, 15890, 15310, 1730],
      [88800, 27330, 26230, 2970],
    ],
  },
  {
    city: 'sapporo',
    prefecture: 'hokkaido',
    childRate: 0.0029,
    adultChildLevy: 1100,
    householdChildLevy: 1000,
    atMillionBase: [139190, 41940, 36870, 5000],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [15920, 4900, 4070, 630],
      [53230, 16100, 14000, 1940],
      [91540, 27660, 24130, 3330],
    ],
  },
  {
    city: 'fukuoka_city',
    prefecture: 'fukuoka',
    childRate: 0.0028,
    adultChildLevy: 1039,
    householdChildLevy: 911,
    atMillionBase: [94200, 51600, 44000, 4700],
    caps: [670000, 260000, 170000, 30000],
    atReductionThresholds: [
      [11500, 6000, 5300, 500],
      [36500, 19800, 17000, 1800],
      [62500, 34100, 29200, 3100],
    ],
  },
]

function components(result: NhiBreakdown | null): number[] {
  assert.ok(result)
  assert.equal(result.total, result.medical + result.support + result.kaigo + result.kodomo)
  return [result.medical, result.support, result.kaigo, result.kodomo]
}

for (const c of cases) {
  test(`${c.city}: selectable in its prefecture with both localized names`, () => {
    assert.ok(RESIDENT_TAX_RATES[c.prefecture]?.cities[c.city])
    assert.ok(CITY_NAMES[c.city]?.en)
    assert.ok(CITY_NAMES[c.city]?.ja)
    assert.equal(isMunicipalitySupported(c.city), true)
  })

  test(`${c.city}: all four FY2026 components and age eligibility`, () => {
    for (const age of ['under40', '40to64', '65over'] as const) {
      const expected = [...c.atMillionBase]
      if (age !== '40to64') expected[2] = 0
      assert.deepEqual(
        components(calculateMunicipalityNhi(c.city, 1430000, 1000000, age)),
        expected,
      )
    }
    assert.deepEqual(
      components(calculateMunicipalityNhi(c.city, 100430000, 100000000, '40to64')),
      c.caps,
    )
  })

  test(`${c.city}: low-income reductions include each fixed charge`, () => {
    for (const [index, income] of [430000, 740000, 1000000].entries()) {
      const result = calculateMunicipalityNhi(
        c.city,
        income,
        Math.max(0, income - 430000),
        '40to64',
      )
      assert.deepEqual(components(result), c.atReductionThresholds[index])
      assert.equal(result?.reduction, [0.7, 0.5, 0.2][index])
      const above = income + 1
      assert.equal(
        calculateMunicipalityNhi(c.city, above, above - 430000, '40to64')?.reduction,
        [0.5, 0.2, 0][index],
      )
    }
  })

  test(`${c.city}: separate child levy uses the same rounding, reductions, and cap`, () => {
    const rates = getMunicipalityChildSupportRates(c.city)
    assert.equal(rates?.incomeRate, c.childRate)
    assert.equal(rates?.annualPerCapita, c.adultChildLevy)
    assert.equal(rates?.annualHousehold, c.householdChildLevy ?? 0)
    assert.equal(rates?.annualCap, 30000)
    assert.match(rates!.sourceUrl, /^https:\/\/www\.city\./)
    for (const income of [
      0, 430000, 430001, 740000, 740001, 1000000, 1000001, 1430000, 100430000,
    ]) {
      const base = Math.max(0, income - 430000)
      assert.equal(
        calculateMunicipalityChildSupport(c.city, income, base),
        calculateMunicipalityNhi(c.city, income, base, '40to64')?.kodomo,
      )
    }
  })
}

test('Saitama reproduces the official single-person, age-42 example', () => {
  // Official page: prior-year income ¥3,000,000; assessment base ¥2,570,000.
  assert.deepEqual(calculateMunicipalityNhi('saitama_city', 3000000, 2570000, '40to64'), {
    medical: 239600,
    support: 85000,
    kaigo: 77000,
    kodomo: 8300,
    total: 409900,
    reduction: 0,
  })
})

test('Chiba truncates the assessment base to ¥100 before applying rates', () => {
  assert.deepEqual(
    components(calculateMunicipalityNhi('chiba_city', 1430699, 1000699, '40to64')),
    [122060, 47710, 42270, 4900],
  )
})

test('Kawasaki truncates each reduced child fixed charge separately', () => {
  // At a 50% reduction: floor(1665/2) + floor(77/2) = 870, plus ¥329.
  // Reducing their combined ¥1,742 would incorrectly produce ¥1,200.
  assert.equal(calculateMunicipalityChildSupport('kawasaki', 532813, 102813), 1190)
})

test('Funabashi truncates after adding the fixed charge, before totaling components', () => {
  assert.deepEqual(
    components(calculateMunicipalityNhi('funabashi', 1430141, 1000141, '40to64')),
    [109800, 40100, 32700, 4500],
  )
})

test('FY2026 NHI uses calendar-2025 salary deductions before reduction checks', () => {
  for (const [salary, income] of [
    [650000, 0],
    [1080000, 430000],
    [1390000, 740000],
    [1650000, 1000000],
    [1900000, 1250000],
    [2000000, 1320000],
  ] as const) {
    const result = computeNhiIncomes(salary, 0)
    assert.equal(result.totalIncome, income)
    assert.equal(result.base, Math.max(0, income - 430000))
  }
  assert.deepEqual(computeNhiIncomes(1080000, 100000), { totalIncome: 530000, base: 100000 })
  const { totalIncome, base } = computeNhiIncomes(1080000, 0)
  assert.equal(
    calculateMunicipalityNhi('saitama_city', totalIncome, base, 'under40')?.reduction,
    0.7,
  )
})

test('Nagoya reproduces the official low-income single-person example, including its ¥2,000 discount', () => {
  assert.deepEqual(calculateMunicipalityNhi('nagoya', 200000, 0, 'under40'), {
    medical: 13170,
    support: 4730,
    kaigo: 0,
    kodomo: 550,
    total: 18450,
    reduction: 0.7,
  })
})

test('Nagoya reproduces the official age-51 example at ¥2.44 million income', () => {
  assert.deepEqual(calculateMunicipalityNhi('nagoya', 2440000, 2010000, '40to64'), {
    medical: 228070,
    support: 67640,
    kaigo: 63150,
    kodomo: 7080,
    total: 365940,
    reduction: 0,
  })
})

test('Kyoto truncates the income levy before adding fixed charges', () => {
  // The reduced care charge ends in ¥5 and must survive annual calculation.
  assert.deepEqual(
    components(calculateMunicipalityNhi('kyoto_city', 431234, 1234, '40to64')),
    [24095, 8300, 8260, 915],
  )
})

test('Nagoya stops its additional discount immediately above the 20% reduction threshold', () => {
  assert.equal(calculateMunicipalityNhi('nagoya', 1000000, 570000, 'under40')?.medical, 88800)
  assert.equal(calculateMunicipalityNhi('nagoya', 1000001, 570001, 'under40')?.medical, 100920)
})
