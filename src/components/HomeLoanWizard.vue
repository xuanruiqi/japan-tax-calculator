<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { HomeLoanParams, HomeLoanHouseType } from '../data/homeLoan';
import {
  HOME_LOAN_HOUSE_TYPES,
  getHomeLoanLimits,
  getAvailableHouseTypes,
  calculateHomeLoanCredit,
} from '../data/homeLoan';
import type { LocaleStrings } from '../locales';

const props = defineProps<{
  t: LocaleStrings;
  locale: 'en' | 'ja';
  initial?: HomeLoanParams | null;
}>();

const emit = defineEmits<{
  confirm: [params: HomeLoanParams];
  cancel: [];
}>();

const step = ref(props.initial ? 4 : 1); // jump to confirm if editing
const moveInYear = ref(props.initial?.moveInYear ?? 2024);
const houseType = ref<HomeLoanHouseType>(props.initial?.houseType ?? 'certified');
const yearEndBalance = ref(props.initial?.yearEndBalance ?? 0);
const deductionYear = ref(props.initial?.deductionYear ?? 1);

const MOVE_IN_YEARS = [2022, 2023, 2024, 2025];

// When move-in year changes, reset house type if it's no longer available
watch(moveInYear, () => {
  const available = getAvailableHouseTypes(moveInYear.value);
  if (!available.includes(houseType.value)) {
    houseType.value = available[0] ?? 'certified';
  }
});

const availableTypes = computed(() => getAvailableHouseTypes(moveInYear.value));

const newTypes = computed(() =>
  HOME_LOAN_HOUSE_TYPES.filter(h => !h.isExisting && availableTypes.value.includes(h.type))
);
const existingTypes = computed(() =>
  HOME_LOAN_HOUSE_TYPES.filter(h => h.isExisting && availableTypes.value.includes(h.type))
);

const limits = computed(() => getHomeLoanLimits(moveInYear.value, houseType.value));
const maxDeductionYear = computed(() => limits.value.years);

const currentParams = computed<HomeLoanParams>(() => ({
  moveInYear: moveInYear.value,
  houseType: houseType.value,
  yearEndBalance: yearEndBalance.value,
  deductionYear: deductionYear.value,
}));

const estimatedCredit = computed(() => calculateHomeLoanCredit(currentParams.value));

const exceedsPeriod = computed(() =>
  deductionYear.value > maxDeductionYear.value && maxDeductionYear.value > 0
);

const formatJPY = (v: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(v);

const houseTypeName = (type: HomeLoanHouseType) => {
  const def = HOME_LOAN_HOUSE_TYPES.find(h => h.type === type);
  if (!def) return type;
  return props.locale === 'ja' ? def.nameJa : def.nameEn;
};


const nextStep = () => { if (step.value < 4) step.value++; };
const prevStep = () => { if (step.value > 1) step.value--; };
const goToStep = (s: number) => { step.value = s; };

const handleConfirm = () => {
  emit('confirm', { ...currentParams.value });
};
</script>

<template>
  <div class="wizard-overlay" @click.self="emit('cancel')">
    <div class="wizard-dialog">
      <div class="wizard-header">
        <h3>{{ t.homeLoanWizardTitle }}</h3>
        <button class="wizard-close" @click="emit('cancel')">&#10005;</button>
      </div>

      <!-- Step indicators -->
      <div class="wizard-steps">
        <div
          v-for="(label, i) in [t.homeLoanStepMoveIn, t.homeLoanStepHouseType, t.homeLoanStepLoanDetails, t.homeLoanStepConfirm]"
          :key="i"
          class="wizard-step-indicator"
          :class="{ active: step === i + 1, completed: step > i + 1 }"
          @click="step > i + 1 ? goToStep(i + 1) : undefined"
        >
          <span class="step-number">{{ step > i + 1 ? '&#10003;' : i + 1 }}</span>
          <span class="step-label">{{ label }}</span>
        </div>
      </div>

      <div class="wizard-body">
        <!-- Step 1: Move-in Year -->
        <div v-if="step === 1" class="wizard-step-content">
          <label class="wizard-field-label">{{ t.homeLoanMoveInYear }}</label>
          <div class="year-grid">
            <button
              v-for="year in MOVE_IN_YEARS"
              :key="year"
              class="year-btn"
              :class="{ selected: moveInYear === year }"
              @click="moveInYear = year"
            >
              {{ year }}
            </button>
          </div>
        </div>

        <!-- Step 2: House Type -->
        <div v-if="step === 2" class="wizard-step-content">
          <label class="wizard-field-label">{{ t.homeLoanHouseType }}</label>

          <div class="type-group" v-if="newTypes.length > 0">
            <div class="type-group-label">{{ t.homeLoanNewConstruction }}</div>
            <button
              v-for="ht in newTypes"
              :key="ht.type"
              class="type-btn"
              :class="{ selected: houseType === ht.type }"
              @click="houseType = ht.type"
            >
              <span class="type-name">{{ locale === 'ja' ? ht.nameJa : ht.nameEn }}</span>
              <small class="type-desc">{{ locale === 'ja' ? ht.descJa : ht.descEn }}</small>
            </button>
          </div>

          <div class="type-group" v-if="existingTypes.length > 0">
            <div class="type-group-label">{{ t.homeLoanExistingHousing }}</div>
            <button
              v-for="ht in existingTypes"
              :key="ht.type"
              class="type-btn"
              :class="{ selected: houseType === ht.type }"
              @click="houseType = ht.type"
            >
              <span class="type-name">{{ locale === 'ja' ? ht.nameJa : ht.nameEn }}</span>
              <small class="type-desc">{{ locale === 'ja' ? ht.descJa : ht.descEn }}</small>
            </button>
          </div>

          <!-- Show limits for selected type -->
          <div class="type-info" v-if="limits.maxBalance > 0">
            <div class="info-row">
              <span>{{ t.homeLoanMaxBalance }}</span>
              <span>{{ formatJPY(limits.maxBalance) }}</span>
            </div>
            <div class="info-row">
              <span>{{ t.homeLoanMaxYears }}</span>
              <span>{{ limits.years }}{{ locale === 'ja' ? '年間' : ' years' }}</span>
            </div>
            <div class="info-row">
              <span>{{ t.homeLoanCreditRate }}</span>
              <span>0.7%</span>
            </div>
          </div>
        </div>

        <!-- Step 3: Loan Details -->
        <div v-if="step === 3" class="wizard-step-content">
          <div class="wizard-input-group">
            <label class="wizard-field-label">{{ t.homeLoanYearEndBalance }}</label>
            <div class="wizard-input-wrapper">
              <span class="wizard-currency">&#165;</span>
              <input
                type="number"
                v-model.number="yearEndBalance"
                :min="0"
                :max="limits.maxBalance"
                step="100000"
                class="wizard-input"
              />
            </div>
            <small class="wizard-hint">{{ t.homeLoanMaxBalance }}: {{ formatJPY(limits.maxBalance) }}</small>
          </div>

          <div class="wizard-input-group">
            <label class="wizard-field-label">
              {{ t.homeLoanDeductionYear }}
            </label>
            <div class="wizard-input-wrapper deduction-year-wrapper">
              <input
                type="number"
                v-model.number="deductionYear"
                :min="1"
                :max="maxDeductionYear"
                step="1"
                class="wizard-input deduction-year-input"
              />
              <span class="wizard-suffix" v-if="locale === 'ja'">{{ t.homeLoanDeductionYearSuffix }}</span>
            </div>
            <small class="wizard-hint">{{ t.homeLoanMaxYears }}: {{ maxDeductionYear }}{{ locale === 'ja' ? '年間' : ' years' }}</small>
            <small class="wizard-warning" v-if="exceedsPeriod">{{ t.homeLoanExceedsPeriod }}</small>
          </div>

          <div class="credit-preview" v-if="yearEndBalance > 0 && !exceedsPeriod">
            <span>{{ t.homeLoanEstimatedCredit }}</span>
            <span class="credit-amount">{{ formatJPY(estimatedCredit) }}</span>
          </div>
        </div>

        <!-- Step 4: Confirmation -->
        <div v-if="step === 4" class="wizard-step-content">
          <div class="confirm-summary">
            <div class="confirm-row">
              <span>{{ t.homeLoanMoveInYear }}</span>
              <span>{{ moveInYear }}</span>
            </div>
            <div class="confirm-row">
              <span>{{ t.homeLoanHouseType }}</span>
              <span>{{ houseTypeName(houseType) }}</span>
            </div>
            <div class="confirm-row">
              <span>{{ t.homeLoanYearEndBalance }}</span>
              <span>{{ formatJPY(yearEndBalance) }}</span>
            </div>
            <div class="confirm-row">
              <span>{{ t.homeLoanDeductionYear }}</span>
              <span>{{ deductionYear }}{{ t.homeLoanDeductionYearSuffix }}</span>
            </div>
            <div class="confirm-row">
              <span>{{ t.homeLoanMaxBalance }}</span>
              <span>{{ formatJPY(limits.maxBalance) }}</span>
            </div>
            <div class="confirm-divider"></div>
            <div class="confirm-row highlight">
              <span>{{ t.homeLoanEstimatedCredit }}</span>
              <span class="credit-amount">{{ formatJPY(estimatedCredit) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer buttons -->
      <div class="wizard-footer">
        <button v-if="step > 1" class="wizard-btn secondary" @click="prevStep">
          {{ t.wizardBack }}
        </button>
        <button v-if="step === 1" class="wizard-btn secondary" @click="emit('cancel')">
          {{ t.wizardCancel }}
        </button>
        <div class="wizard-footer-spacer"></div>
        <button v-if="step < 4" class="wizard-btn primary" @click="nextStep">
          {{ t.wizardNext }}
        </button>
        <button v-if="step === 4" class="wizard-btn primary" @click="handleConfirm">
          {{ t.wizardConfirm }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wizard-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.wizard-dialog {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.18);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.wizard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #eaeaea;
}

.wizard-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #111;
}

.wizard-close {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #999;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s;
}

.wizard-close:hover {
  color: #333;
  background: #f5f5f5;
}

/* Step indicators */
.wizard-steps {
  display: flex;
  padding: 1rem 1.5rem;
  gap: 0.25rem;
  border-bottom: 1px solid #f0f0f0;
}

.wizard-step-indicator {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  font-size: 0.78rem;
  color: #aaa;
  transition: color 0.2s, background 0.2s;
}

.wizard-step-indicator.active {
  color: #111;
  background: #f5f5f5;
  font-weight: 600;
}

.wizard-step-indicator.completed {
  color: #1a6b50;
  cursor: pointer;
}

.wizard-step-indicator.completed:hover {
  background: #f0faf5;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 600;
  background: #eee;
  color: #999;
  flex-shrink: 0;
}

.wizard-step-indicator.active .step-number {
  background: #111;
  color: #fff;
}

.wizard-step-indicator.completed .step-number {
  background: #1a6b50;
  color: #fff;
}

.step-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Body */
.wizard-body {
  padding: 1.5rem;
  flex: 1;
  min-height: 200px;
}

.wizard-step-content {
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.wizard-field-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.75rem;
}

/* Year grid */
.year-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.year-btn {
  padding: 1rem 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  color: #444;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.year-btn:hover {
  border-color: #999;
}

.year-btn.selected {
  border-color: #111;
  background: #111;
  color: #fff;
}

/* House type selection */
.type-group {
  margin-bottom: 1rem;
}

.type-group-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.5rem;
}

.type-btn {
  display: flex;
  flex-direction: column;
  width: 100%;
  text-align: left;
  padding: 0.65rem 0.85rem;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  margin-bottom: 0.5rem;
  transition: border-color 0.15s, background 0.15s;
}

.type-btn:hover {
  border-color: #bbb;
}

.type-btn.selected {
  border-color: #111;
  background: #fafafa;
}

.type-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: #222;
}

.type-desc {
  font-size: 0.75rem;
  color: #888;
  margin-top: 0.1rem;
}

.type-info {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #eee;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  color: #555;
  padding: 0.25rem 0;
}

.info-row span:last-child {
  font-weight: 600;
  color: #333;
}

/* Loan details inputs */
.wizard-input-group {
  margin-bottom: 1.25rem;
}

.wizard-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.wizard-currency {
  position: absolute;
  left: 0.85rem;
  font-size: 1rem;
  color: #888;
}

.wizard-input {
  width: 100%;
  padding: 0.7rem 1rem 0.7rem 2rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
  transition: border-color 0.2s;
}

.wizard-input:focus {
  outline: none;
  border-color: #111;
}

.deduction-year-wrapper {
  max-width: 160px;
}

.deduction-year-input {
  padding-left: 1rem !important;
  text-align: center;
}

.wizard-suffix {
  position: absolute;
  right: 0.85rem;
  font-size: 0.9rem;
  color: #888;
}

.wizard-hint {
  display: block;
  font-size: 0.78rem;
  color: #999;
  margin-top: 0.3rem;
}

.wizard-warning {
  display: block;
  font-size: 0.78rem;
  color: #e03131;
  margin-top: 0.3rem;
}

/* Number input spinners hiding */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type=number] {
  -moz-appearance: textfield;
}

.credit-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #edf2ff;
  border-radius: 8px;
  margin-top: 0.5rem;
  font-size: 0.88rem;
  color: #333;
}

.credit-amount {
  font-weight: 700;
  font-size: 1.05rem;
  color: #3b5bdb;
}

/* Confirmation */
.confirm-summary {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #eee;
}

.confirm-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 0.88rem;
  color: #555;
}

.confirm-row span:last-child {
  font-weight: 600;
  color: #222;
}

.confirm-row.highlight {
  font-size: 1rem;
  color: #111;
}

.confirm-row.highlight .credit-amount {
  font-size: 1.15rem;
}

.confirm-divider {
  height: 1px;
  background: #e0e0e0;
  margin: 0.5rem 0;
}

/* Footer */
.wizard-footer {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid #eaeaea;
  gap: 0.75rem;
}

.wizard-footer-spacer {
  flex: 1;
}

.wizard-btn {
  padding: 0.55rem 1.25rem;
  font-size: 0.88rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.wizard-btn.primary {
  background: #111;
  color: #fff;
  border: 1px solid #111;
}

.wizard-btn.primary:hover {
  background: #333;
}

.wizard-btn.secondary {
  background: #fff;
  color: #555;
  border: 1px solid #ddd;
}

.wizard-btn.secondary:hover {
  border-color: #999;
  color: #111;
}
</style>
