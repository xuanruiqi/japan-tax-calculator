export interface TaxCalculationResult {
  annualGross: number;
  healthInsurance: number;
  kaigoInsurance: number;
  pension: number;
  incomeTax: number;
  marginalRate: number;        // base bracket rate, e.g. 20
  effectiveMarginalRate: number; // with 2.1% surtax, e.g. 20.42
  taxableIncome: number;       // 課税所得額 (after all deductions, before tax)
  employmentIncomeDeduction: number;  // 給与所得控除
  employmentIncome: number;           // 給与所得
  basicExemption: number;             // 基礎控除
  residentTax: number;
  residentTaxPrefectural: number;
  residentTaxMunicipal: number;
  furusatoIncomeTaxCredit: number;    // ふるさと納税 — income tax credit portion
  furusatoResidentTaxCredit: number;  // ふるさと納税 — resident tax credit portion
  homeLoanIncomeTaxCredit: number;    // 住宅ローン控除 — income tax credit portion
  homeLoanResidentTaxCredit: number;  // 住宅ローン控除 — resident tax credit portion
  totalDeductions: number;
  netPay: number;
  monthlyNet: number;
  bonusNet: number;
  employmentInsurance: number;
  nationalPension: number;
  nationalHealthInsurance: number;
  businessIncome: number;
  healthBracket: number;
  pensionBracket: number;
  healthStandardRemuneration: number;
  pensionStandardRemuneration: number;
}

const brackets = [
  { min: 0, max: 63000, value: 58000 },
  { min: 63000, max: 73000, value: 68000 },
  { min: 73000, max: 83000, value: 78000 },
  { min: 83000, max: 93000, value: 88000 },
  { min: 93000, max: 101000, value: 98000 },
  { min: 101000, max: 107000, value: 104000 },
  { min: 107000, max: 114000, value: 110000 },
  { min: 114000, max: 122000, value: 118000 },
  { min: 122000, max: 130000, value: 126000 },
  { min: 130000, max: 138000, value: 134000 },
  { min: 138000, max: 146000, value: 142000 },
  { min: 146000, max: 155000, value: 150000 },
  { min: 155000, max: 165000, value: 160000 },
  { min: 165000, max: 175000, value: 170000 },
  { min: 175000, max: 185000, value: 180000 },
  { min: 185000, max: 195000, value: 190000 },
  { min: 195000, max: 210000, value: 200000 },
  { min: 210000, max: 230000, value: 220000 },
  { min: 230000, max: 250000, value: 240000 },
  { min: 250000, max: 270000, value: 260000 },
  { min: 270000, max: 290000, value: 280000 },
  { min: 290000, max: 310000, value: 300000 },
  { min: 310000, max: 330000, value: 320000 },
  { min: 330000, max: 350000, value: 340000 },
  { min: 350000, max: 370000, value: 360000 },
  { min: 370000, max: 395000, value: 380000 },
  { min: 395000, max: 425000, value: 410000 },
  { min: 425000, max: 455000, value: 440000 },
  { min: 455000, max: 485000, value: 470000 },
  { min: 485000, max: 515000, value: 500000 },
  { min: 515000, max: 545000, value: 530000 },
  { min: 545000, max: 575000, value: 560000 },
  { min: 575000, max: 605000, value: 590000 },
  { min: 605000, max: 635000, value: 620000 },
  { min: 635000, max: 665000, value: 650000 },
  { min: 665000, max: 695000, value: 680000 },
  { min: 695000, max: 730000, value: 710000 },
  { min: 730000, max: 770000, value: 750000 },
  { min: 770000, max: 810000, value: 790000 },
  { min: 810000, max: 855000, value: 830000 },
  { min: 855000, max: 905000, value: 880000 },
  { min: 905000, max: 955000, value: 930000 },
  { min: 955000, max: 1005000, value: 980000 },
  { min: 1005000, max: 1060000, value: 1030000 },
  { min: 1060000, max: 1120000, value: 1090000 },
  { min: 1120000, max: 1180000, value: 1150000 },
  { min: 1180000, max: 1240000, value: 1210000 },
  { min: 1240000, max: 1300000, value: 1270000 },
  { min: 1300000, max: 1360000, value: 1330000 },
  { min: 1360000, max: Infinity, value: 1390000 }
];

export function getStandardRemunerationGrade(salary: number, maxBracketValue: number): { value: number, grade: number } {
  if (salary <= 0) return { value: 0, grade: 0 };
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    if (!bracket) continue;
    if (salary >= bracket.min && salary < bracket.max) {
      if (bracket.value >= maxBracketValue) {
        const maxIndex = brackets.findIndex(b => b.value === maxBracketValue);
        return { value: maxBracketValue, grade: maxIndex + 1 };
      }
      return { value: bracket.value, grade: i + 1 };
    }
  }
  const maxIndexFallback = brackets.findIndex(b => b.value === maxBracketValue);
  return { value: maxBracketValue, grade: maxIndexFallback + 1 }; 
}

export interface TaxCalculationOptions {
  previousYearGross?: number | null;
  healthInsuranceRate?: number;
  kaigoInsuranceRate?: number;
  pensionRate?: number;
  employmentInsuranceRate?: number;
  prefIncomeRate?: number;
  cityIncomeRate?: number;
  prefPerCapita?: number;
  cityPerCapita?: number;
  primaryJoinsSocialInsurance?: boolean; // whether primary job has SI enrollment (default true)
  nationalPensionAmount?: number;        // flat 国民年金 amount (when not in 厚生年金)
  nationalHealthInsuranceAmount?: number; // 国民健康保険 total (when not in 健康保険)
  additionalSalaryGross?: number; // gross salary from non-primary jobs
  additionalHealthInsurance?: number;  // health insurance from non-primary workplaces
  additionalKaigoInsurance?: number;   // kaigo insurance from non-primary workplaces
  additionalPension?: number;          // pension from non-primary workplaces
  businessIncome?: number;        // net 事業所得 (revenue - expenses), summed across all entries
  additionalDeductions?: number;  // sum of all 所得控除 entered by user (excludes furusato)
  furusatoNetDonation?: number;   // (donation - 2,000) — applied as direct tax credit, not income deduction
  homeLoanCredit?: number;        // 住宅ローン控除額 — applied before reconstruction surtax
}

export function calculateTaxesAndInsurance(monthlySalary: number, annualBonus: number, options: TaxCalculationOptions = {}): TaxCalculationResult {
  // --- Social Insurance ---
  const HEALTH_INS_RATE = options.healthInsuranceRate !== undefined ? options.healthInsuranceRate : 0.0499; // Default 9.98% / 2
  const KAIGO_RATE = options.kaigoInsuranceRate !== undefined ? options.kaigoInsuranceRate : 0.0;
  const PENSION_RATE = options.pensionRate !== undefined ? options.pensionRate : 0.0915;    // Default 18.3% / 2
  const EMP_INS_RATE = options.employmentInsuranceRate !== undefined ? options.employmentInsuranceRate : 0.006; // Default 0.6%
  const previousYearGross = options.previousYearGross ?? null;

  const primaryJoinsSI = options.primaryJoinsSocialInsurance !== false; // default true
  const siSalary = primaryJoinsSI ? monthlySalary : 0;
  const siBonus = primaryJoinsSI ? annualBonus : 0;

  const healthObj = getStandardRemunerationGrade(siSalary, 1390000);
  const pensionObj = getStandardRemunerationGrade(siSalary, 650000);

  const monthlyStandard = healthObj.value;
  const healthBracket = healthObj.grade;
  
  const monthlyStandardPension = pensionObj.value;
  // Pension grade starts at Health grade 4 (88,000 JPY), so Pension Grade = Health Grade - 3
  const pensionBracket = pensionObj.grade > 0 ? Math.max(1, pensionObj.grade - 3) : 0;

  const monthlyHealth = Math.floor(monthlyStandard * HEALTH_INS_RATE);
  const monthlyKaigo = Math.floor(monthlyStandard * KAIGO_RATE);
  const monthlyPension = Math.floor(monthlyStandardPension * PENSION_RATE);

  const bonusStandardHealth = Math.min(Math.floor(siBonus / 1000) * 1000, 5730000);
  const bonusStandardPension = Math.min(Math.floor(siBonus / 1000) * 1000, 1500000);

  const bonusHealth = Math.floor(bonusStandardHealth * HEALTH_INS_RATE);
  const bonusKaigo = Math.floor(bonusStandardHealth * KAIGO_RATE);
  const bonusPension = Math.floor(bonusStandardPension * PENSION_RATE);

  const primaryAnnualHealth = monthlyHealth * 12 + bonusHealth;
  const primaryAnnualKaigo = monthlyKaigo * 12 + bonusKaigo;
  const primaryAnnualPension = monthlyPension * 12 + bonusPension;

  const annualHealth = primaryAnnualHealth + (options.additionalHealthInsurance ?? 0);
  const annualKaigo = primaryAnnualKaigo + (options.additionalKaigoInsurance ?? 0);
  const annualPension = primaryAnnualPension + (options.additionalPension ?? 0);

  // --- Income ---
  const primarySalaryGross = monthlySalary * 12 + annualBonus;
  const additionalSalaryGross = options.additionalSalaryGross ?? 0;
  const totalSalaryGross = primarySalaryGross + additionalSalaryGross;
  const businessIncome = options.businessIncome ?? 0;
  const annualGross = totalSalaryGross + businessIncome;

  // --- Employment Insurance (雇用保険) — calculated on primary salary gross ---
  const annualEmploymentInsurance = Math.floor(primarySalaryGross * EMP_INS_RATE);
  const monthlyEmploymentInsurance = Math.floor(monthlySalary * EMP_INS_RATE);

  const nationalPension = options.nationalPensionAmount ?? 0;
  const nationalHealthInsurance = options.nationalHealthInsuranceAmount ?? 0;
  const totalSocialInsurance = annualHealth + annualKaigo + annualPension + nationalPension + nationalHealthInsurance + annualEmploymentInsurance;

  // --- Employment Income Deduction (給与所得控除) — on total salary gross ---
  let employmentIncomeDeduction = 0;
  if (totalSalaryGross <= 1625000) {
    employmentIncomeDeduction = Math.min(totalSalaryGross, 550000);
  } else if (totalSalaryGross <= 1800000) {
    employmentIncomeDeduction = totalSalaryGross * 0.4 - 100000;
  } else if (totalSalaryGross <= 3600000) {
    employmentIncomeDeduction = totalSalaryGross * 0.3 + 80000;
  } else if (totalSalaryGross <= 6600000) {
    employmentIncomeDeduction = totalSalaryGross * 0.2 + 440000;
  } else if (totalSalaryGross <= 8500000) {
    employmentIncomeDeduction = totalSalaryGross * 0.1 + 1100000;
  } else {
    employmentIncomeDeduction = 1950000;
  }

  const employmentIncome = Math.max(0, totalSalaryGross - employmentIncomeDeduction);
  const totalIncome = employmentIncome + businessIncome;

  // --- Basic Exemption ---
  let incomeTaxBasicExemption = 480000;
  if (totalIncome > 24000000 && totalIncome <= 24500000) incomeTaxBasicExemption = 320000;
  else if (totalIncome > 24500000 && totalIncome <= 25000000) incomeTaxBasicExemption = 160000;
  else if (totalIncome > 25000000) incomeTaxBasicExemption = 0;

  let residentTaxBasicExemption = 430000;
  if (totalIncome > 24000000 && totalIncome <= 24500000) residentTaxBasicExemption = 290000;
  else if (totalIncome > 24500000 && totalIncome <= 25000000) residentTaxBasicExemption = 150000;
  else if (totalIncome > 25000000) residentTaxBasicExemption = 0;

  // --- Taxable Income ---
  const extraDeductions = options.additionalDeductions ?? 0;
  const taxableIncomeTax = Math.max(0, Math.floor((totalIncome - totalSocialInsurance - incomeTaxBasicExemption - extraDeductions) / 1000) * 1000);

  // --- Resident Tax Pre-Calculation (based on previous year income if provided) ---
  const residentTaxBaseGross = (previousYearGross !== null && previousYearGross >= 0) ? previousYearGross : annualGross;
  
  let residentEmploymentIncomeDeduction = 0;
  if (residentTaxBaseGross <= 1625000) residentEmploymentIncomeDeduction = Math.min(residentTaxBaseGross, 550000);
  else if (residentTaxBaseGross <= 1800000) residentEmploymentIncomeDeduction = residentTaxBaseGross * 0.4 - 100000;
  else if (residentTaxBaseGross <= 3600000) residentEmploymentIncomeDeduction = residentTaxBaseGross * 0.3 + 80000;
  else if (residentTaxBaseGross <= 6600000) residentEmploymentIncomeDeduction = residentTaxBaseGross * 0.2 + 440000;
  else if (residentTaxBaseGross <= 8500000) residentEmploymentIncomeDeduction = residentTaxBaseGross * 0.1 + 1100000;
  else residentEmploymentIncomeDeduction = 1950000;

  const residentEmploymentIncome = Math.max(0, residentTaxBaseGross - residentEmploymentIncomeDeduction);
  
  let residentSocialInsurance = totalSocialInsurance;
  if (previousYearGross !== null && previousYearGross >= 0) {
    // Estimate previous year social insurance as ~14.14% of gross
    residentSocialInsurance = Math.floor(previousYearGross * 0.1414);
  }

  let actualResidentTaxBasicExemption = 430000;
  if (residentTaxBaseGross > 24000000 && residentTaxBaseGross <= 24500000) actualResidentTaxBasicExemption = 290000;
  else if (residentTaxBaseGross > 24500000 && residentTaxBaseGross <= 25000000) actualResidentTaxBasicExemption = 150000;
  else if (residentTaxBaseGross > 25000000) actualResidentTaxBasicExemption = 0;

  // Apply additional deductions (iDeCo etc.) to resident tax base only when using current-year income
  // (when previousYearGross is provided we have no data on that year's deductions, so skip)
  const residentExtraDeductions = (previousYearGross !== null && previousYearGross >= 0) ? 0 : extraDeductions;
  const taxableResidentTax = Math.max(0, Math.floor((residentEmploymentIncome - residentSocialInsurance - actualResidentTaxBasicExemption - residentExtraDeductions) / 1000) * 1000);

  // --- Income Tax ---
  let baseIncomeTax = 0;
  let marginalRate = 0;
  if (taxableIncomeTax <= 1949000)       { baseIncomeTax = taxableIncomeTax * 0.05;              marginalRate = 5;  }
  else if (taxableIncomeTax <= 3299000)  { baseIncomeTax = taxableIncomeTax * 0.10 - 97500;      marginalRate = 10; }
  else if (taxableIncomeTax <= 6949000)  { baseIncomeTax = taxableIncomeTax * 0.20 - 427500;     marginalRate = 20; }
  else if (taxableIncomeTax <= 8999000)  { baseIncomeTax = taxableIncomeTax * 0.23 - 636000;     marginalRate = 23; }
  else if (taxableIncomeTax <= 17999000) { baseIncomeTax = taxableIncomeTax * 0.33 - 1536000;    marginalRate = 33; }
  else if (taxableIncomeTax <= 39999000) { baseIncomeTax = taxableIncomeTax * 0.40 - 2796000;    marginalRate = 40; }
  else                                   { baseIncomeTax = taxableIncomeTax * 0.45 - 4796000;    marginalRate = 45; }

  const effectiveMarginalRate = parseFloat((marginalRate * 1.021).toFixed(3));

  // Home loan credit is applied BEFORE the reconstruction surtax (per NTA rules):
  //   所得税額 → 住宅ローン控除 → 基準所得税額 → ×1.021 → 復興特別所得税
  const rawHomeLoanCredit = options.homeLoanCredit ?? 0;
  const homeLoanIncomeTaxCredit = Math.min(rawHomeLoanCredit, Math.floor(baseIncomeTax));
  const afterHomeLoanBase = Math.max(0, Math.floor(baseIncomeTax) - homeLoanIncomeTaxCredit);

  // Reconstruction tax (2.1%) applied to base after home loan credit
  const incomeTax = Math.floor(afterHomeLoanBase * 1.021 / 100) * 100;

  // Home loan resident tax spillover: remainder up to min(97500, taxableIncome × 5%)
  const homeLoanRemainder = rawHomeLoanCredit - homeLoanIncomeTaxCredit;
  const homeLoanResidentTaxLimit = Math.min(97500, Math.floor(taxableIncomeTax * 0.05));
  let homeLoanResidentTaxCredit = Math.min(homeLoanRemainder, homeLoanResidentTaxLimit);

  // --- Resident Tax ---
  // Income-based levied amount
  let residentIncomeLeviedPrefectural = taxableResidentTax * (options.prefIncomeRate !== undefined ? options.prefIncomeRate : 0.04);
  let residentIncomeLeviedMunicipal = taxableResidentTax * (options.cityIncomeRate !== undefined ? options.cityIncomeRate : 0.06);

  // Adjusted deduction (simplified, total 2500 -> 1000 Prefectural, 1500 Municipal)
  residentIncomeLeviedPrefectural -= 1000;
  if (residentIncomeLeviedPrefectural < 0) residentIncomeLeviedPrefectural = 0;

  residentIncomeLeviedMunicipal -= 1500;
  if (residentIncomeLeviedMunicipal < 0) residentIncomeLeviedMunicipal = 0;
  
  // Per capita rate
  const residentPerCapitaPrefectural = options.prefPerCapita !== undefined ? options.prefPerCapita : 1500;
  const residentPerCapitaMunicipal = options.cityPerCapita !== undefined ? options.cityPerCapita : 3500;
  
  // If extremely low income, resident tax is 0. 
  // Simplified logic, Tokyo minimum income for single is 1,000,000 for per capita, 450k for income levied.
  let residentTaxPrefectural = 0;
  let residentTaxMunicipal = 0;
  
  if (residentEmploymentIncome > 450000) {
    residentTaxPrefectural = residentIncomeLeviedPrefectural + residentPerCapitaPrefectural;
    residentTaxMunicipal = residentIncomeLeviedMunicipal + residentPerCapitaMunicipal;
  }

  const roundedResidentTaxPrefectural = Math.floor(residentTaxPrefectural / 100) * 100;
  const roundedResidentTaxMunicipal = Math.floor(residentTaxMunicipal / 100) * 100;
  const roundedResidentTax = roundedResidentTaxPrefectural + roundedResidentTaxMunicipal;

  // --- Home Loan Resident Tax Credit ---
  // Cap the resident tax credit by the actual resident tax available
  homeLoanResidentTaxCredit = Math.min(homeLoanResidentTaxCredit, roundedResidentTax);
  const residentTaxAfterHomeLoan = roundedResidentTax - homeLoanResidentTaxCredit;

  // --- Furusato Nozei Tax Credits ---
  // The net donation (amount - 2000) is returned entirely via direct tax credits:
  //   income tax credit = netDonation × effectiveMarginalRate
  //   resident tax credit = remainder (via 住民税特例控除)
  const furusatoNet = options.furusatoNetDonation ?? 0;
  const furusatoIncomeTaxCredit = Math.min(incomeTax, Math.floor(furusatoNet * effectiveMarginalRate / 100));
  const furusatoResidentTaxCredit = Math.min(residentTaxAfterHomeLoan, furusatoNet - furusatoIncomeTaxCredit);

  const adjustedIncomeTax = incomeTax - furusatoIncomeTaxCredit;
  const adjustedResidentTax = residentTaxAfterHomeLoan - furusatoResidentTaxCredit;

  const totalDeductions = totalSocialInsurance + adjustedIncomeTax + adjustedResidentTax;
  const netPay = annualGross - totalDeductions;

  // Monthly/Bonus breakdown approximation
  const totalMonthsEarning = 12 + (annualBonus > 0 ? 1 : 0); // Simplified ratio
  let monthlyNet = 0;
  let bonusNet = 0;
  
  if (annualGross > 0) {
    monthlyNet = monthlySalary - monthlyHealth - monthlyKaigo - monthlyPension - monthlyEmploymentInsurance - Math.floor((adjustedIncomeTax + adjustedResidentTax) * (monthlySalary / annualGross));
    if (annualBonus > 0) {
      const bonusEmploymentInsurance = Math.floor(annualBonus * EMP_INS_RATE);
      bonusNet = annualBonus - bonusHealth - bonusKaigo - bonusPension - bonusEmploymentInsurance - Math.floor((adjustedIncomeTax + adjustedResidentTax) * (annualBonus / annualGross));
    }
  }

  return {
    annualGross,
    healthInsurance: annualHealth,
    kaigoInsurance: annualKaigo,
    pension: annualPension,
    employmentInsurance: annualEmploymentInsurance,
    nationalPension,
    nationalHealthInsurance,
    businessIncome,
    incomeTax: adjustedIncomeTax,
    marginalRate,
    effectiveMarginalRate,
    taxableIncome: taxableIncomeTax,
    employmentIncomeDeduction,
    employmentIncome,
    basicExemption: incomeTaxBasicExemption,
    residentTax: adjustedResidentTax,
    residentTaxPrefectural: roundedResidentTaxPrefectural,
    residentTaxMunicipal: roundedResidentTaxMunicipal,
    furusatoIncomeTaxCredit,
    furusatoResidentTaxCredit,
    homeLoanIncomeTaxCredit,
    homeLoanResidentTaxCredit,
    totalDeductions,
    netPay,
    monthlyNet,
    bonusNet,
    healthBracket,
    pensionBracket,
    healthStandardRemuneration: monthlyStandard,
    pensionStandardRemuneration: monthlyStandardPension
  };
}
