// Run with Node 22.6+: node --experimental-strip-types --test src/utils/__tests__/nhiCalculation.test.ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateMunicipalityChildSupport,
  calculateMunicipalityNhi,
  getMunicipalityChildSupportRates,
  isMunicipalitySupported,
} from '../nhiCalculation.ts'

interface MunicipalityCase {
  city: string
  incomeRate: number
  perCapita: number
  atMillionBase: number
  reducedAmounts: number[]
}

// Official FY2026 tables linked by getMunicipalityChildSupportRates.
const cases: MunicipalityCase[] = [
  {
    city: 'tokyo_23ku',
    incomeRate: 0.0027,
    perCapita: 1873,
    atMillionBase: 4573,
    reducedAmounts: [562, 1774, 3037],
  },
  {
    city: 'musashino',
    incomeRate: 0.003,
    perCapita: 1900,
    atMillionBase: 4900,
    reducedAmounts: [570, 1880, 3230],
  },
  {
    city: 'yokohama',
    incomeRate: 0.0034,
    perCapita: 1770,
    atMillionBase: 5170,
    reducedAmounts: [531, 1939, 3354],
  },
  {
    city: 'tsukuba',
    incomeRate: 0.0029,
    perCapita: 1600,
    atMillionBase: 4500,
    reducedAmounts: [480, 1699, 2933],
  },
]

for (const c of cases) {
  test(`${c.city}: published income rate, adult flat charge, and annual cap`, () => {
    const rates = getMunicipalityChildSupportRates(c.city)
    assert.equal(rates?.incomeRate, c.incomeRate)
    assert.equal(rates?.annualPerCapita, c.perCapita)
    assert.equal(rates?.annualCap, 30000)
    assert.match(rates!.sourceUrl, /^https:\/\/www\.city\./)
    assert.equal(calculateMunicipalityChildSupport(c.city, 1430000, 1000000), c.atMillionBase)
    assert.equal(calculateMunicipalityChildSupport(c.city, 100430000, 100000000), 30000)
  })

  test(`${c.city}: 70%, 50%, and 20% fixed-charge reductions at threshold boundaries`, () => {
    for (const [index, income] of [430000, 740000, 1000000].entries()) {
      assert.equal(
        calculateMunicipalityChildSupport(c.city, income, Math.max(0, income - 430000)),
        c.reducedAmounts[index],
      )
    }
    assert.equal(
      calculateMunicipalityChildSupport(c.city, 1000001, 570001),
      Math.round(570001 * c.incomeRate) + c.perCapita,
    )
  })

  test(`${c.city}: full NHI total includes the same levy exactly once at every age group`, () => {
    for (const age of ['under40', '40to64', '65over'] as const) {
      const breakdown = calculateMunicipalityNhi(c.city, 1430000, 1000000, age)
      assert.equal(breakdown?.kodomo, c.atMillionBase)
      assert.equal(
        breakdown?.total,
        breakdown!.medical + breakdown!.support + breakdown!.kaigo + c.atMillionBase,
      )
    }
  })
}

test('unsupported municipality IDs do not supply automatic levy rates', () => {
  for (const city of ['standard', 'yubari', '__proto__', 'toString']) {
    assert.equal(isMunicipalitySupported(city), false)
    assert.equal(getMunicipalityChildSupportRates(city), null)
    assert.equal(calculateMunicipalityChildSupport(city, 1430000, 1000000), null)
    assert.equal(calculateMunicipalityNhi(city, 1430000, 1000000, 'under40'), null)
  }
})
