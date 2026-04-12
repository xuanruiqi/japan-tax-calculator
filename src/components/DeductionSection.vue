<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { MessageSchema } from '../locales'
import { type DeductionType, DEDUCTION_DEFS } from '../data/deductions'
import { useTaxStore } from '../stores/tax'
import SpouseDeductionCard from './deductions/SpouseDeductionCard.vue'
import DependentDeductionCard from './deductions/DependentDeductionCard.vue'
import DeductionCard from './deductions/DeductionCard.vue'

const emit = defineEmits<{
  'open-wizard': []
  'edit-wizard': [id: string]
}>()

const { t, locale: _locale } = useI18n<{ message: MessageSchema }>()
const locale = computed(() => _locale.value as 'en' | 'ja')

const store = useTaxStore()
const {
  deductionEntries,
  autoSpouseDeduction,
  autoDependentDeductions,
  availableDeductionTypes,
  totalAdditionalDeductions,
} = storeToRefs(store)
const { removeDeduction, pushDeductionEntry } = store

const manualEntries = computed(() =>
  deductionEntries.value.filter(
    (e) =>
      e.type !== 'spouse' &&
      e.type !== 'dependent_general' &&
      e.type !== 'dependent_specified' &&
      e.type !== 'dependent_aged',
  ),
)

const deductionPickerItems = computed(() => [
  availableDeductionTypes.value.map((type) => ({
    label: locale.value === 'ja' ? DEDUCTION_DEFS[type].nameJa : DEDUCTION_DEFS[type].nameEn,
    onSelect: () => addDeduction(type),
  })),
])

function addDeduction(type: DeductionType) {
  if (type === 'home_loan') {
    emit('open-wizard')
    return
  }
  pushDeductionEntry(type)
}
</script>

<template>
  <div class="input-section deductions-section">
    <div class="deductions-header">
      <h2>{{ t('deductionsSection') }}</h2>
      <UDropdownMenu :items="deductionPickerItems">
        <UButton variant="outline" size="sm" class="outline-btn" :label="t('addDeduction')" />
      </UDropdownMenu>
    </div>

    <p
      class="no-deductions-msg"
      v-if="
        deductionEntries.length === 0 &&
        autoSpouseDeduction === 0 &&
        autoDependentDeductions.total === 0
      "
    >
      {{ t('noDeductions') }}
    </p>

    <div class="card-list">
      <SpouseDeductionCard
        v-if="autoSpouseDeduction > 0"
        :amount="autoSpouseDeduction"
        :spouse-annual-income="store.spouseAnnualIncome ?? 0"
      />

      <DependentDeductionCard
        v-if="autoDependentDeductions.general > 0"
        type="dependent_general"
        :count="autoDependentDeductions.general"
        :amount="autoDependentDeductions.generalAmount"
      />

      <DependentDeductionCard
        v-if="autoDependentDeductions.specified > 0"
        type="dependent_specified"
        :count="autoDependentDeductions.specified"
        :amount="autoDependentDeductions.specifiedAmount"
      />

      <DependentDeductionCard
        v-if="autoDependentDeductions.aged > 0"
        type="dependent_aged"
        :count="autoDependentDeductions.aged"
        :amount="autoDependentDeductions.agedAmount"
      />

      <DeductionCard
        v-for="entry in manualEntries"
        :key="entry.id"
        :entry="entry"
        @remove="removeDeduction(entry.id)"
        @edit-home-loan="emit('edit-wizard', entry.id)"
      />
    </div>

    <div class="deduction-total" v-if="deductionEntries.length > 0">
      <span>{{ t('totalAdditionalDeductions') }}</span>
      <span>{{ new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(totalAdditionalDeductions) }}</span>
    </div>
  </div>
</template>

<style scoped>
h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #111;
  margin-bottom: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.deductions-section {
  border-top: 1px solid #eaeaea;
  padding-top: 2rem;
  margin-top: 1rem;
}

.deductions-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.no-deductions-msg {
  font-size: 0.85rem;
  color: #aaa;
  margin: 0.5rem 0 1rem;
}

.deduction-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding: 0.75rem 0;
  border-top: 1px solid #eaeaea;
  font-size: 0.92rem;
  font-weight: 600;
  color: #111;
}
</style>
