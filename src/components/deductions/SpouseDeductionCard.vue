<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MessageSchema } from '../../locales'
import { DEDUCTION_DEFS } from '../../data/deductions'

interface Props {
  amount: number
  spouseAnnualIncome: number
}

const props = defineProps<Props>()

const { t, locale: _locale } = useI18n<{ message: MessageSchema }>()
const locale = computed(() => _locale.value as 'en' | 'ja')

const name = computed(() =>
  locale.value === 'ja' ? DEDUCTION_DEFS['spouse'].nameJa : DEDUCTION_DEFS['spouse'].nameEn,
)

const incomeLabel = computed(() =>
  locale.value === 'ja'
    ? DEDUCTION_DEFS['spouse'].inputLabelJa
    : DEDUCTION_DEFS['spouse'].inputLabelEn,
)

const ntaUrl = DEDUCTION_DEFS['spouse'].ntaUrl

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)
</script>

<template>
  <UCard :ui="{ header: 'py-2 px-3 bg-gray-50', body: 'p-3' }">
    <template #header>
      <span class="text-sm font-semibold">{{ name }}</span>
    </template>
    <div class="deduction-computed">
      <span class="deduction-computed-label">{{ incomeLabel }}</span>
      <span class="deduction-computed-value">{{ formatCurrency(props.spouseAnnualIncome) }}</span>
    </div>
    <div class="deduction-computed">
      <span class="deduction-computed-label">{{ t('deductionAmountLabel') }}</span>
      <span class="deduction-computed-value">{{ formatCurrency(props.amount) }}</span>
    </div>
    <a
      v-if="ntaUrl"
      class="nta-reference-link"
      :href="ntaUrl"
      target="_blank"
      rel="noopener noreferrer"
      >{{ t('ntaReference') }} ↗</a
    >
  </UCard>
</template>

<style scoped>
.deduction-computed {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.55rem;
  padding-top: 0.45rem;
  border-top: 1px dashed #eee;
}

.deduction-computed-label {
  font-size: 0.78rem;
  color: #888;
}

.deduction-computed-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: #3b5bdb;
}

.nta-reference-link {
  display: block;
  margin-top: 0.45rem;
  font-size: 0.78rem;
  color: #3b5bdb;
  text-decoration: none;
  transition: color 0.2s;
}

.nta-reference-link:hover {
  color: #111;
  text-decoration: underline;
}
</style>
