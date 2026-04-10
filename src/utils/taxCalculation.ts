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
  totalDeductions: number;
  netPay: number;
  monthlyNet: number;
  bonusNet: number;
  healthBracket: number;
  pensionBracket: number;
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
  { min: 810000, max: 850000, value: 830000 },
  { min: 850000, max: 890000, value: 880000 },
  { min: 890000, max: 930000, value: 930000 },
  { min: 930000, max: 970000, value: 980000 },
  { min: 970000, max: 1010000, value: 1030000 },
  { min: 1010000, max: 1050000, value: 1090000 },
  { min: 1050000, max: 1090000, value: 1150000 },
  { min: 1090000, max: 1130000, value: 1210000 },
  { min: 1130000, max: 1170000, value: 1270000 },
  { min: 1170000, max: 1210000, value: 1330000 },
  { min: 1210000, max: Infinity, value: 1390000 }
];

function getStandardRemunerationGrade(salary: number, maxBracketValue: number): { value: number, grade: number } {
  if (salary <= 0) return { value: 0, grade: 0 };
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
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
  prefIncomeRate?: number;
  cityIncomeRate?: number;
  prefPerCapita?: number;
  cityPerCapita?: number;
  additionalDeductions?: number; // sum of all 所得控除 entered by user (excludes furusato)
  furusatoNetDonation?: number;  // (donation - 2,000) — applied as direct tax credit, not income deduction
}

export function calculateTaxesAndInsurance(monthlySalary: number, annualBonus: number, options: TaxCalculationOptions = {}): TaxCalculationResult {
  // --- Social Insurance ---
  const HEALTH_INS_RATE = options.healthInsuranceRate !== undefined ? options.healthInsuranceRate : 0.0499; // Default 9.98% / 2
  const KAIGO_RATE = options.kaigoInsuranceRate !== undefined ? options.kaigoInsuranceRate : 0.0;
  const PENSION_RATE = options.pensionRate !== undefined ? options.pensionRate : 0.0915;    // Default 18.3% / 2
  const previousYearGross = options.previousYearGross ?? null;

  const healthObj = getStandardRemunerationGrade(monthlySalary, 1390000);
  const pensionObj = getStandardRemunerationGrade(monthlySalary, 650000);

  const monthlyStandard = healthObj.value;
  const healthBracket = healthObj.grade;
  
  const monthlyStandardPension = pensionObj.value;
  // Pension grade starts at Health grade 4 (88,000 JPY), so Pension Grade = Health Grade - 3
  const pensionBracket = pensionObj.grade > 0 ? Math.max(1, pensionObj.grade - 3) : 0;

  const monthlyHealth = Math.floor(monthlyStandard * HEALTH_INS_RATE);
  const monthlyKaigo = Math.floor(monthlyStandard * KAIGO_RATE);
  const monthlyPension = Math.floor(monthlyStandardPension * PENSION_RATE);

  const bonusStandardHealth = Math.min(Math.floor(annualBonus / 1000) * 1000, 5730000);
  const bonusStandardPension = Math.min(Math.floor(annualBonus / 1000) * 1000, 1500000);

  const bonusHealth = Math.floor(bonusStandardHealth * HEALTH_INS_RATE);
  const bonusKaigo = Math.floor(bonusStandardHealth * KAIGO_RATE);
  const bonusPension = Math.floor(bonusStandardPension * PENSION_RATE);

  const annualHealth = monthlyHealth * 12 + bonusHealth;
  const annualKaigo = monthlyKaigo * 12 + bonusKaigo;
  const annualPension = monthlyPension * 12 + bonusPension;
  const totalSocialInsurance = annualHealth + annualKaigo + annualPension;

  // --- Income ---
  const annualGross = monthlySalary * 12 + annualBonus;

  // --- Employment Income Deduction (給与所得控除) ---
  let employmentIncomeDeduction = 0;
  if (annualGross <= 1625000) {
    employmentIncomeDeduction = Math.min(annualGross, 550000); // Wait, actually standard deduction is min 550,000 but if gross < 550,000 it is gross.
  } else if (annualGross <= 1800000) {
    employmentIncomeDeduction = annualGross * 0.4 - 100000;
  } else if (annualGross <= 3600000) {
    employmentIncomeDeduction = annualGross * 0.3 + 80000;
  } else if (annualGross <= 6600000) {
    employmentIncomeDeduction = annualGross * 0.2 + 440000;
  } else if (annualGross <= 8500000) {
    employmentIncomeDeduction = annualGross * 0.1 + 1100000;
  } else {
    employmentIncomeDeduction = 1950000;
  }

  const employmentIncome = Math.max(0, annualGross - employmentIncomeDeduction);

  // --- Basic Exemption ---
  let incomeTaxBasicExemption = 480000;
  if (annualGross > 24000000 && annualGross <= 24500000) incomeTaxBasicExemption = 320000;
  else if (annualGross > 24500000 && annualGross <= 25000000) incomeTaxBasicExemption = 160000;
  else if (annualGross > 25000000) incomeTaxBasicExemption = 0;

  let residentTaxBasicExemption = 430000;
  if (annualGross > 24000000 && annualGross <= 24500000) residentTaxBasicExemption = 290000;
  else if (annualGross > 24500000 && annualGross <= 25000000) residentTaxBasicExemption = 150000;
  else if (annualGross > 25000000) residentTaxBasicExemption = 0;

  // --- Taxable Income ---
  const extraDeductions = options.additionalDeductions ?? 0;
  const taxableIncomeTax = Math.max(0, Math.floor((employmentIncome - totalSocialInsurance - incomeTaxBasicExemption - extraDeductions) / 1000) * 1000);

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

  const taxableResidentTax = Math.max(0, Math.floor((residentEmploymentIncome - residentSocialInsurance - actualResidentTaxBasicExemption) / 1000) * 1000);

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

  // With reconstruction tax (2.1%)
  const effectiveMarginalRate = parseFloat((marginalRate * 1.021).toFixed(3));
  const incomeTax = Math.floor(Math.floor(baseIncomeTax) * 1.021 / 100) * 100;

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

  // --- Furusato Nozei Tax Credits ---
  // The net donation (amount - 2000) is returned entirely via direct tax credits:
  //   income tax credit = netDonation × effectiveMarginalRate
  //   resident tax credit = remainder (via 住民税特例控除)
  const furusatoNet = options.furusatoNetDonation ?? 0;
  const furusatoIncomeTaxCredit = Math.min(incomeTax, Math.floor(furusatoNet * effectiveMarginalRate / 100));
  const furusatoResidentTaxCredit = Math.min(roundedResidentTax, furusatoNet - furusatoIncomeTaxCredit);

  const adjustedIncomeTax = incomeTax - furusatoIncomeTaxCredit;
  const adjustedResidentTax = roundedResidentTax - furusatoResidentTaxCredit;

  const totalDeductions = totalSocialInsurance + adjustedIncomeTax + adjustedResidentTax;
  const netPay = annualGross - totalDeductions;

  // Monthly/Bonus breakdown approximation
  const totalMonthsEarning = 12 + (annualBonus > 0 ? 1 : 0); // Simplified ratio
  let monthlyNet = 0;
  let bonusNet = 0;
  
  if (annualGross > 0) {
    monthlyNet = monthlySalary - monthlyHealth - monthlyKaigo - monthlyPension - Math.floor((adjustedIncomeTax + adjustedResidentTax) * (monthlySalary / annualGross));
    if (annualBonus > 0) {
      bonusNet = annualBonus - bonusHealth - bonusKaigo - bonusPension - Math.floor((adjustedIncomeTax + adjustedResidentTax) * (annualBonus / annualGross));
    }
  }

  return {
    annualGross,
    healthInsurance: annualHealth,
    kaigoInsurance: annualKaigo,
    pension: annualPension,
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
    totalDeductions,
    netPay,
    monthlyNet,
    bonusNet,
    healthBracket,
    pensionBracket
  };
}
