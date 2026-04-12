<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { HomeLoanParams, HomeLoanHouseType } from '../data/homeLoan';
import {
  HOME_LOAN_HOUSE_TYPES,
  getHomeLoanLimits,
  getAvailableHouseTypes,
  calculateHomeLoanCredit,
} from '../data/homeLoan';
import type { MessageSchema } from '../locales';

const { t, locale: _locale } = useI18n<{ message: MessageSchema }>();
const locale = computed(() => _locale.value as 'en' | 'ja');

const props = defineProps<{
  initial?: HomeLoanParams | null;
}>();

const emit = defineEmits<{
  confirm: [params: HomeLoanParams];
  cancel: [];
}>();

const step = ref(props.initial ? 4 : 1);
const moveInYear = ref(props.initial?.moveInYear ?? 2024);
const houseType = ref<HomeLoanHouseType>(props.initial?.houseType ?? 'certified');
const yearEndBalance = ref(props.initial?.yearEndBalance ?? 0);
const deductionYear = ref(props.initial?.deductionYear ?? 1);

const MOVE_IN_YEARS = [2022, 2023, 2024, 2025];

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
  return locale.value === 'ja' ? def.nameJa : def.nameEn;
};

const nextStep = () => { if (step.value < 4) step.value++; };
const prevStep = () => { if (step.value > 1) step.value--; };
const goToStep = (s: number) => { step.value = s; };

const handleConfirm = () => emit('confirm', { ...currentParams.value });

/* ui prop shared by all type-tile buttons so the label is left-aligned & two-line */
const typeTileUi = { label: 'w-full text-left flex flex-col gap-0.5 py-0.5' };
</script>

<template>
  <UModal :open="true" @update:open="(val: boolean) => !val && emit('cancel')">
    <template #content>
    <div class="wizard-dialog">

      <!-- Header -->
      <div class="wizard-header">
        <h3>{{ t('homeLoanWizardTitle') }}</h3>
        <UButton variant="ghost" size="xs" class="remove-btn" icon="i-lucide-x" @click="emit('cancel')" />
      </div>

      <!-- Step indicators -->
      <div class="wizard-steps">
        <div
          v-for="(label, i) in [t('homeLoanStepMoveIn'), t('homeLoanStepHouseType'), t('homeLoanStepLoanDetails'), t('homeLoanStepConfirm')]"
          :key="i"
          class="wizard-step-indicator"
          :class="{ active: step === i + 1, completed: step > i + 1 }"
          @click="step > i + 1 ? goToStep(i + 1) : undefined"
        >
          <span class="step-number">{{ step > i + 1 ? '✓' : i + 1 }}</span>
          <span class="step-label">{{ label }}</span>
        </div>
      </div>

      <!-- Body -->
      <div class="wizard-body">

        <!-- Step 1: Move-in Year -->
        <div v-if="step === 1" class="wizard-step-content">
          <label class="wizard-field-label">{{ t('homeLoanMoveInYear') }}</label>
          <div class="year-grid">
            <UButton
              v-for="year in MOVE_IN_YEARS"
              :key="year"
              :variant="moveInYear === year ? 'solid' : 'outline'"
              color="neutral"
              block
              :class="moveInYear === year ? 'solid-btn' : 'outline-btn'"
              @click="moveInYear = year"
            >{{ year }}</UButton>
          </div>
        </div>

        <!-- Step 2: House Type -->
        <div v-if="step === 2" class="wizard-step-content">
          <label class="wizard-field-label">{{ t('homeLoanHouseType') }}</label>

          <div class="type-group" v-if="newTypes.length > 0">
            <div class="type-group-label">{{ t('homeLoanNewConstruction') }}</div>
            <UButtonGroup orientation="vertical" class="w-full">
              <UButton
                v-for="ht in newTypes"
                :key="ht.type"
                :variant="houseType === ht.type ? 'solid' : 'outline'"
                color="neutral"
                block
                :class="houseType === ht.type ? 'solid-btn' : 'outline-btn'"
                :ui="typeTileUi"
                @click="houseType = ht.type"
              >
                <span class="type-name">{{ locale === 'ja' ? ht.nameJa : ht.nameEn }}</span>
                <small class="type-desc">{{ locale === 'ja' ? ht.descJa : ht.descEn }}</small>
              </UButton>
            </UButtonGroup>
          </div>

          <div class="type-group" v-if="existingTypes.length > 0">
            <div class="type-group-label">{{ t('homeLoanExistingHousing') }}</div>
            <UButtonGroup orientation="vertical" class="w-full">
              <UButton
                v-for="ht in existingTypes"
                :key="ht.type"
                :variant="houseType === ht.type ? 'solid' : 'outline'"
                color="neutral"
                block
                :class="houseType === ht.type ? 'solid-btn' : 'outline-btn'"
                :ui="typeTileUi"
                @click="houseType = ht.type"
              >
                <span class="type-name">{{ locale === 'ja' ? ht.nameJa : ht.nameEn }}</span>
                <small class="type-desc">{{ locale === 'ja' ? ht.descJa : ht.descEn }}</small>
              </UButton>
            </UButtonGroup>
          </div>

          <div class="type-info" v-if="limits.maxBalance > 0">
            <div class="info-row">
              <span>{{ t('homeLoanMaxBalance') }}</span>
              <span>{{ formatJPY(limits.maxBalance) }}</span>
            </div>
            <div class="info-row">
              <span>{{ t('homeLoanMaxYears') }}</span>
              <span>{{ limits.years }}{{ t('yearsUnit') }}</span>
            </div>
            <div class="info-row">
              <span>{{ t('homeLoanCreditRate') }}</span>
              <span>0.7%</span>
            </div>
          </div>
        </div>

        <!-- Step 3: Loan Details -->
        <div v-if="step === 3" class="wizard-step-content">
          <div class="wizard-input-group">
            <label class="wizard-field-label">{{ t('homeLoanYearEndBalance') }}</label>
            <UInput type="number" v-model.number="yearEndBalance" :min="0" :max="limits.maxBalance" :step="100000">
              <template #leading><span class="text-base font-medium text-muted">¥</span></template>
            </UInput>
            <small class="wizard-hint">{{ t('homeLoanMaxBalance') }}: {{ formatJPY(limits.maxBalance) }}</small>
          </div>

          <div class="wizard-input-group">
            <label class="wizard-field-label">{{ t('homeLoanDeductionYear') }}</label>
            <div class="deduction-year-wrap">
              <UInput type="number" v-model.number="deductionYear" :min="1" :max="maxDeductionYear" :step="1">
                <template #trailing v-if="locale === 'ja'">
                  <span class="text-sm text-muted">{{ t('homeLoanDeductionYearSuffix') }}</span>
                </template>
              </UInput>
            </div>
            <small class="wizard-hint">{{ t('homeLoanMaxYears') }}: {{ maxDeductionYear }}{{ t('yearsUnit') }}</small>
            <small class="wizard-warning" v-if="exceedsPeriod">{{ t('homeLoanExceedsPeriod') }}</small>
          </div>

          <div class="credit-preview" v-if="yearEndBalance > 0 && !exceedsPeriod">
            <span>{{ t('homeLoanEstimatedCredit') }}</span>
            <span class="credit-amount">{{ formatJPY(estimatedCredit) }}</span>
          </div>
        </div>

        <!-- Step 4: Confirmation -->
        <div v-if="step === 4" class="wizard-step-content">
          <div class="confirm-summary">
            <div class="confirm-row">
              <span>{{ t('homeLoanMoveInYear') }}</span>
              <span>{{ moveInYear }}</span>
            </div>
            <div class="confirm-row">
              <span>{{ t('homeLoanHouseType') }}</span>
              <span>{{ houseTypeName(houseType) }}</span>
            </div>
            <div class="confirm-row">
              <span>{{ t('homeLoanYearEndBalance') }}</span>
              <span>{{ formatJPY(yearEndBalance) }}</span>
            </div>
            <div class="confirm-row">
              <span>{{ t('homeLoanDeductionYear') }}</span>
              <span>{{ deductionYear }}{{ t('homeLoanDeductionYearSuffix') }}</span>
            </div>
            <div class="confirm-row">
              <span>{{ t('homeLoanMaxBalance') }}</span>
              <span>{{ formatJPY(limits.maxBalance) }}</span>
            </div>
            <div class="confirm-divider"></div>
            <div class="confirm-row highlight">
              <span>{{ t('homeLoanEstimatedCredit') }}</span>
              <span class="credit-amount">{{ formatJPY(estimatedCredit) }}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="wizard-footer">
        <UButton v-if="step > 1"  variant="outline" color="neutral" class="outline-btn" @click="prevStep">{{ t('wizardBack') }}</UButton>
        <UButton v-if="step === 1" variant="outline" color="neutral" class="outline-btn" @click="emit('cancel')">{{ t('wizardCancel') }}</UButton>
        <div class="wizard-footer-spacer"></div>
        <UButton v-if="step < 4" variant="solid" color="neutral" class="solid-btn" @click="nextStep">{{ t('wizardNext') }}</UButton>
        <UButton v-if="step === 4" variant="solid" color="neutral" class="solid-btn" @click="handleConfirm">{{ t('wizardConfirm') }}</UButton>
      </div>

    </div>
    </template>
  </UModal>
</template>

<style scoped>
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
  to   { opacity: 1; transform: translateY(0); }
}

.wizard-field-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.75rem;
}

/* ── Year grid ──────────────────────────────────── */
.year-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}


/* ── House type group ───────────────────────────── */
.type-group {
  margin-bottom: 1.1rem;
}

.type-group-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.5rem;
}


.type-name {
  font-size: 0.88rem;
  font-weight: 600;
}
.type-desc {
  font-size: 0.75rem;
  opacity: 0.75;
  font-weight: 400;
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

/* ── Loan inputs ─────────────────────────────────── */
.wizard-input-group {
  margin-bottom: 1.25rem;
}

.deduction-year-wrap {
  max-width: 160px;
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

/* Hide number spinners */
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

/* ── Confirmation ────────────────────────────────── */
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

/* ── Footer ──────────────────────────────────────── */
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

</style>
