<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MessageSchema } from '../../locales'
import { type DeductionEntry, DEDUCTION_DEFS } from '../../data/deductions'
import { useTaxStore } from '../../stores/tax'
import DeductionCardBase from './DeductionCardBase.vue'
import YenInputNumber from '../YenInputNumber.vue'

interface Props {
  entry: DeductionEntry
}

const props = defineProps<Props>()

const emit = defineEmits<{
  remove: []
}>()

const { t, locale: _locale } = useI18n<{ message: MessageSchema }>()
const locale = computed(() => _locale.value as 'en' | 'ja')

const store = useTaxStore()

const name = computed(() =>
  locale.value === 'ja'
    ? DEDUCTION_DEFS[props.entry.type].nameJa
    : DEDUCTION_DEFS[props.entry.type].nameEn,
)

const inputLabel = computed(() =>
  locale.value === 'ja'
    ? DEDUCTION_DEFS[props.entry.type].inputLabelJa
    : DEDUCTION_DEFS[props.entry.type].inputLabelEn,
)

const ntaUrl = computed(() => DEDUCTION_DEFS[props.entry.type].ntaUrl)
const isCount = computed(() => DEDUCTION_DEFS[props.entry.type].inputIsCount)
const isFurusato = computed(() => props.entry.type === 'furusato')

const deductionAmount = computed(() =>
  isFurusato.value
    ? Math.floor(store.furusatoEstimate.totalTaxSaving + 1e-7)
    : store.deductionAmountFor(props.entry),
)
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)
</script>

<template>
  <DeductionCardBase :name="name" @remove="emit('remove')">
    <label :for="`deduction-${entry.id}`" class="deduction-input-label">{{ inputLabel }}</label>
    <!-- eslint-disable vue/no-mutating-props -->
    <UInput
      v-if="isCount"
      :id="`deduction-${entry.id}`"
      type="number"
      v-model.number="entry.value"
      :min="0"
      :step="1"
    />
    <YenInputNumber
      v-else
      :id="`deduction-${entry.id}`"
      v-model="entry.value"
      :min="0"
      :step="1000"
    />
    <!-- eslint-enable vue/no-mutating-props -->
    <div class="deduction-computed">
      <span class="deduction-computed-label">{{
        t(isFurusato ? 'furusatoEstimatedSaving' : 'deductionAmount')
      }}</span>
      <span class="deduction-computed-value">{{ formatCurrency(deductionAmount) }}</span>
    </div>
    <p v-if="isFurusato" class="mt-2 text-sm">
      {{ t('furusatoOutOfPocket') }}:
      {{ formatCurrency(Math.max(0, Math.ceil(store.furusatoEstimate.outOfPocket - 1e-7))) }}
    </p>
    <p
      v-if="isFurusato && store.furusatoExceedsLimit"
      role="status"
      class="mt-2 text-sm text-amber-700 dark:text-amber-300"
    >
      {{ t('furusatoOverLimit') }}
    </p>
    <a
      v-if="ntaUrl"
      class="nta-reference-link"
      :href="ntaUrl"
      target="_blank"
      rel="noopener noreferrer"
      >{{ t(isFurusato ? 'furusatoMicReference' : 'ntaReference') }} ↗</a
    >
  </DeductionCardBase>
</template>

<style scoped>
.deduction-input-label {
  display: block;
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.35rem;
}

:global(.theme-dark) .deduction-input-label,
:global(html.dark) .deduction-input-label {
  color: #e2e8f0;
}

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

:global(.theme-dark) .deduction-computed-label,
:global(html.dark) .deduction-computed-label {
  color: #e2e8f0;
}

.deduction-computed-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: #3b5bdb;
}

:global(.theme-dark) .deduction-computed-value,
:global(html.dark) .deduction-computed-value {
  color: #e0e7ff;
}

.furusato-sim-link,
.nta-reference-link {
  display: block;
  margin-top: 0.45rem;
  font-size: 0.78rem;
  color: #3b5bdb;
  text-decoration: none;
  transition: color 0.2s;
}

:global(.theme-dark) .furusato-sim-link,
:global(.theme-dark) .nta-reference-link,
:global(html.dark) .furusato-sim-link,
:global(html.dark) .nta-reference-link {
  color: #e0e7ff;
}

.furusato-sim-link:hover,
.nta-reference-link:hover {
  color: #111;
  text-decoration: underline;
}

:global(.theme-dark) .furusato-sim-link:hover,
:global(.theme-dark) .nta-reference-link:hover,
:global(html.dark) .furusato-sim-link:hover,
:global(html.dark) .nta-reference-link:hover {
  color: #f8fafc;
}
</style>
