<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MessageSchema } from '../../locales'
import { type DeductionEntry, DEDUCTION_DEFS } from '../../data/deductions'
import DeductionCardBase from './DeductionCardBase.vue'

interface Props {
  entry: DeductionEntry
}

const props = defineProps<Props>()

const emit = defineEmits<{
  remove: []
  'edit-home-loan': []
}>()

const { t, locale: _locale } = useI18n<{ message: MessageSchema }>()
const locale = computed(() => _locale.value as 'en' | 'ja')

const name = computed(() =>
  locale.value === 'ja'
    ? DEDUCTION_DEFS['home_loan'].nameJa
    : DEDUCTION_DEFS['home_loan'].nameEn,
)

const ntaUrl = DEDUCTION_DEFS['home_loan'].ntaUrl

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)
</script>

<template>
  <DeductionCardBase
    :name="name"
    :show-edit-button="true"
    @remove="emit('remove')"
    @edit="emit('edit-home-loan')"
  >
    <template v-if="entry.homeLoanParams">
      <div class="hl-summary-row">
        <span>{{ t('homeLoanMoveInYear') }}</span>
        <span>{{ entry.homeLoanParams.moveInYear }}</span>
      </div>
      <div class="hl-summary-row">
        <span>{{ t('homeLoanYearEndBalance') }}</span>
        <span>{{ formatCurrency(entry.homeLoanParams.yearEndBalance) }}</span>
      </div>
      <div class="hl-summary-row">
        <span>{{ t('homeLoanDeductionYear') }}</span>
        <span>{{ entry.homeLoanParams.deductionYear }}{{ t('homeLoanDeductionYearSuffix') }}</span>
      </div>
      <div class="deduction-computed">
        <span class="deduction-computed-label">{{ t('homeLoanEstimatedCredit') }}</span>
        <span class="deduction-computed-value">{{ formatCurrency(entry.value) }}</span>
      </div>
      <a
        v-if="ntaUrl"
        class="nta-reference-link"
        :href="ntaUrl"
        target="_blank"
        rel="noopener noreferrer"
        >{{ t('ntaReference') }} ↗</a
      >
    </template>
  </DeductionCardBase>
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

.hl-summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  color: #666;
  padding: 0.2rem 0;
}

.hl-summary-row span:last-child {
  font-weight: 600;
  color: #333;
}
</style>
