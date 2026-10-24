/** MIC rules for donations claimed on a tax return (not the one-stop exception). */
export const FURUSATO_RULES = {
  selfPayment: 2000,
  incomeDonationCap: 0.4,
  residentDonationCap: 0.3,
  residentBasicRate: 0.1,
  residentSpecialCap: 0.2,
  reconstructionMultiplier: 1.021,
  sourceUrl:
    'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/mechanism/deduction.html',
} as const

// NTA: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm
export const INCOME_TAX_BRACKETS = [
  { threshold: 40000000, rate: 0.45, deduction: 4796000 },
  { threshold: 18000000, rate: 0.4, deduction: 2796000 },
  { threshold: 9000000, rate: 0.33, deduction: 1536000 },
  { threshold: 6950000, rate: 0.23, deduction: 636000 },
  { threshold: 3300000, rate: 0.2, deduction: 427500 },
  { threshold: 1950000, rate: 0.1, deduction: 97500 },
  { threshold: 0, rate: 0.05, deduction: 0 },
] as const
