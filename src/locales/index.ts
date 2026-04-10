export interface LocaleStrings {
  title: string;
  subtitle: string;
  locationSettings: string;
  incomeDetails: string;
  annualBreakdown: string;
  monthlyPay: string;
  bonusPay: string;
  empPrefecture: string;
  empPrefectureSub: string;
  resPrefecture: string;
  resPrefectureSub: string;
  municipality: string;
  municipalitySub: string;
  standardCity: string;
  ageGroup: string;
  ageGroupSub: string;
  monthlySalary: string;
  annualBonus: string;
  prevIncome: string;
  prevIncomeSub: string;
  prevIncomePlaceholder: string;
  ageUnder40: string;
  age40to64: string;
  age65over: string;
  showSettings: string;
  hideSettings: string;
  unionSelect: string;
  unionKyokai: string;
  unionIts: string;
  unionTjk: string;
  unionOther: string;
  customHealth: string;
  customHealthSub: string;
  customKaigo: string;
  customKaigoSub: string;
  customPension: string;
  customPensionSub: string;
  grossIncome: string;
  employmentIncomeDeduction: string;
  employmentIncome: string;
  basicExemption: string;
  healthIns: string;
  nursingCare: string;
  pension: string;
  incomeTax: string;
  taxableIncome: string;
  taxableIncomeSub: string;
  marginalRateLabel: string;
  marginalRateSurtax: string;
  residentTax: string;
  residentPref: string;
  residentMuni: string;
  totalDeductions: string;
  netPay: string;
  gradeString: string;
  cashCostContributions: string;
  disposableIncome: string;
  disposableIncomeSub: string;
  furusatoCredit: string;
  furusatoIncomeTaxCredit: string;
  furusatoResidentTaxCredit: string;
  deductionsSection: string;
  addDeduction: string;
  noDeductions: string;
  removeDeduction: string;
  deductionAmount: string;
  totalAdditionalDeductions: string;
  homeLoanCredit: string;
  homeLoanIncomeTaxCredit: string;
  homeLoanResidentTaxCredit: string;
  homeLoanWizardTitle: string;
  homeLoanStepMoveIn: string;
  homeLoanStepHouseType: string;
  homeLoanStepLoanDetails: string;
  homeLoanStepConfirm: string;
  homeLoanMoveInYear: string;
  homeLoanHouseType: string;
  homeLoanNewConstruction: string;
  homeLoanExistingHousing: string;
  homeLoanYearEndBalance: string;
  homeLoanDeductionYear: string;
  homeLoanDeductionYearSuffix: string;
  homeLoanMaxBalance: string;
  homeLoanMaxYears: string;
  homeLoanCreditRate: string;
  homeLoanEstimatedCredit: string;
  homeLoanNotEligible: string;
  homeLoanExceedsPeriod: string;
  wizardNext: string;
  wizardBack: string;
  wizardConfirm: string;
  wizardCancel: string;
  wizardEdit: string;
}

export const translations: Record<'en' | 'ja', LocaleStrings> = {
  en: {
    title: 'Japan Tax Calculator',
    subtitle: 'Estimate your take-home pay',
    
    // Sections
    locationSettings: 'Location Settings',
    incomeDetails: 'Income Details',
    annualBreakdown: 'Annual Breakdown',
    monthlyPay: 'Monthly Take-home',
    bonusPay: 'Bonus Take-home',
    
    // Location Settings
    empPrefecture: 'Prefecture of Employment',
    empPrefectureSub: '(Affects Kyokai Kenpo Rate)',
    resPrefecture: 'Prefecture of Residence',
    resPrefectureSub: '(Affects Resident Tax)',
    municipality: 'Municipality',
    municipalitySub: '(Only shown if exceptions exist)',
    standardCity: 'Standard / Other',
    
    // Income Details
    ageGroup: 'Age Group',
    ageGroupSub: '(Affects Nursing Care Insurance)',
    monthlySalary: 'Monthly Salary (JPY)',
    annualBonus: 'Annual Bonus (JPY)',
    prevIncome: 'Previous Year Gross Income (JPY)',
    prevIncomeSub: '(Optional: For accurate Resident Tax)',
    prevIncomePlaceholder: 'Same as current if empty',
    
    // Options
    ageUnder40: 'Under 40 - No Kaigo',
    age40to64: '40 to 64 - Pay Kaigo',
    age65over: '65 or older - Billed separately',
    
    // Advanced Settings
    showSettings: 'Show Detailed Settings',
    hideSettings: 'Hide Detailed Settings',
    unionSelect: 'Health Insurance Union',
    unionKyokai: 'Kyokai Kenpo - 4.99%',
    unionIts: 'Kanto ITS - 4.75%',
    unionTjk: 'TJK - 4.45%',
    unionOther: 'Other Union (Custom Rate)',
    
    customHealth: 'Health Insurance Rate (%)',
    customHealthSub: '(Employee Share - Default: 4.99%)',
    customKaigo: 'Nursing Care Insurance Rate (%)',
    customKaigoSub: '(Employee Share)',
    customPension: 'Pension Rate (%)',
    customPensionSub: '(Employee Share - Default: 9.15%)',
    
    // Breakdown
    grossIncome: 'Gross Income',
    employmentIncomeDeduction: 'Employment Income Deduction',
    employmentIncome: 'Employment Income',
    basicExemption: 'Basic Exemption',
    healthIns: 'Health Insurance',
    nursingCare: 'Nursing Care',
    pension: 'Pension',
    incomeTax: 'Income Tax',
    taxableIncome: 'Taxable Income',
    taxableIncomeSub: 'After all deductions',
    marginalRateLabel: 'Marginal Rate',
    marginalRateSurtax: 'incl. 2.1% surtax',
    residentTax: 'Resident Tax',
    residentPref: 'Prefectural',
    residentMuni: 'Municipal',
    totalDeductions: 'Total Withholdings',
    netPay: 'Net Pay',
    gradeString: 'Grade',
    cashCostContributions: 'Savings Contributions',
    disposableIncome: 'Disposable Take-home',
    disposableIncomeSub: 'After iDeCo / savings contributions',
    furusatoCredit: 'Furusato Nozei Credit',
    furusatoIncomeTaxCredit: 'Income Tax Credit',
    furusatoResidentTaxCredit: 'Resident Tax Credit',

    // Deductions section
    deductionsSection: 'Income Deductions',
    addDeduction: '+ Add Deduction',
    noDeductions: 'No deductions added yet.',
    removeDeduction: 'Remove',
    deductionAmount: 'Deduction:',
    totalAdditionalDeductions: 'Total Additional Deductions',

    // Home loan deduction
    homeLoanCredit: 'Home Loan Deduction',
    homeLoanIncomeTaxCredit: 'Income Tax Credit',
    homeLoanResidentTaxCredit: 'Resident Tax Credit',
    homeLoanWizardTitle: 'Home Loan Deduction Setup',
    homeLoanStepMoveIn: 'Move-in Year',
    homeLoanStepHouseType: 'House Type',
    homeLoanStepLoanDetails: 'Loan Details',
    homeLoanStepConfirm: 'Confirm',
    homeLoanMoveInYear: 'Year you moved in',
    homeLoanHouseType: 'Type of housing',
    homeLoanNewConstruction: 'New Construction',
    homeLoanExistingHousing: 'Existing Housing',
    homeLoanYearEndBalance: 'Year-end Loan Balance (JPY)',
    homeLoanDeductionYear: 'Year of deduction period',
    homeLoanDeductionYearSuffix: '',
    homeLoanMaxBalance: 'Max eligible balance',
    homeLoanMaxYears: 'Deduction period',
    homeLoanCreditRate: 'Credit rate',
    homeLoanEstimatedCredit: 'Estimated annual credit',
    homeLoanNotEligible: 'This house type is not eligible for the selected move-in year.',
    homeLoanExceedsPeriod: 'Exceeds the deduction period.',
    wizardNext: 'Next',
    wizardBack: 'Back',
    wizardConfirm: 'Confirm',
    wizardCancel: 'Cancel',
    wizardEdit: 'Edit',
  },
  ja: {
    title: '手取り計算ツール (日本)',
    subtitle: 'あなたの手取り額を計算します',
    
    locationSettings: '地域設定',
    incomeDetails: '収入情報',
    annualBreakdown: '年間内訳',
    monthlyPay: '月々の手取り',
    bonusPay: 'ボーナスの手取り',
    
    empPrefecture: '勤務地',
    empPrefectureSub: '(協会けんぽの保険料率に影響)',
    resPrefecture: '居住する都道府県',
    resPrefectureSub: '(住民税に影響)',
    municipality: '市区町村',
    municipalitySub: '(例外的な税率が存在する場合のみ表示)',
    standardCity: 'その他市区町村 (標準)',
    
    ageGroup: '年齢',
    ageGroupSub: '(介護保険の有無に影響)',
    monthlySalary: '月額給与 (円)',
    annualBonus: '年間ボーナス (円)',
    prevIncome: '前年の総収入 (円)',
    prevIncomeSub: '(任意: 住民税の正確な計算に必要)',
    prevIncomePlaceholder: '空欄の場合は今年の収入と同額とみなす',
    
    ageUnder40: '40歳未満 - 介護保険なし',
    age40to64: '40歳〜64歳 - 介護保険あり',
    age65over: '65歳以上 - 別途請求',
    
    showSettings: '詳細設定を表示',
    hideSettings: '詳細設定を隠す',
    unionSelect: '健康保険組合',
    unionKyokai: '協会けんぽ - 4.99%',
    unionIts: '関東ITS - 4.75%',
    unionTjk: '東京情報サービス健保組合 (TJK) - 4.45%',
    unionOther: 'その他の組合 (カスタム料率)',
    
    customHealth: '健康保険料率 (%)',
    customHealthSub: '(従業員負担分 - デフォルト: 4.99%)',
    customKaigo: '介護保険料率 (%)',
    customKaigoSub: '(従業員負担分)',
    customPension: '厚生年金料率 (%)',
    customPensionSub: '(従業員負担分 - デフォルト: 9.15%)',
    
    grossIncome: '額面給与',
    employmentIncomeDeduction: '給与所得控除',
    employmentIncome: '給与所得',
    basicExemption: '基礎控除',
    healthIns: '健康保険',
    nursingCare: '介護保険',
    pension: '厚生年金',
    incomeTax: '所得税',
    taxableIncome: '課税所得額',
    taxableIncomeSub: '各種控除後',
    marginalRateLabel: '限界税率',
    marginalRateSurtax: '復興税込み',
    residentTax: '住民税',
    residentPref: '都道府県民税',
    residentMuni: '市区町村民税',
    totalDeductions: '給与天引き合計',
    netPay: '手取り額',
    gradeString: '等級',
    cashCostContributions: '掛金額 (iDeCo等)',
    disposableIncome: '可処分所得',
    disposableIncomeSub: 'iDeCo等の掛金後',
    furusatoCredit: 'ふるさと納税控除',
    furusatoIncomeTaxCredit: '所得税控除分',
    furusatoResidentTaxCredit: '住民税控除分',

    // Deductions section
    deductionsSection: '所得控除',
    addDeduction: '◦控除を追加',
    noDeductions: 'まだ控除が追加されていません。',
    removeDeduction: '削除',
    deductionAmount: '控除額:',
    totalAdditionalDeductions: '追加控除合計',

    // Home loan deduction
    homeLoanCredit: '住宅ローン控除',
    homeLoanIncomeTaxCredit: '所得税控除分',
    homeLoanResidentTaxCredit: '住民税控除分',
    homeLoanWizardTitle: '住宅ローン控除の設定',
    homeLoanStepMoveIn: '入居年',
    homeLoanStepHouseType: '住宅の種類',
    homeLoanStepLoanDetails: 'ローン情報',
    homeLoanStepConfirm: '確認',
    homeLoanMoveInYear: '入居した年',
    homeLoanHouseType: '住宅の種類',
    homeLoanNewConstruction: '新築住宅',
    homeLoanExistingHousing: '既存住宅（中古）',
    homeLoanYearEndBalance: '年末ローン残高 (円)',
    homeLoanDeductionYear: '控除適用年目',
    homeLoanDeductionYearSuffix: '年目',
    homeLoanMaxBalance: '借入限度額',
    homeLoanMaxYears: '控除期間',
    homeLoanCreditRate: '控除率',
    homeLoanEstimatedCredit: '控除見込額',
    homeLoanNotEligible: 'この住宅の種類は選択された入居年では対象外です。',
    homeLoanExceedsPeriod: '控除期間を超えています。',
    wizardNext: '次へ',
    wizardBack: '戻る',
    wizardConfirm: '確定',
    wizardCancel: 'キャンセル',
    wizardEdit: '編集',
  }
};
