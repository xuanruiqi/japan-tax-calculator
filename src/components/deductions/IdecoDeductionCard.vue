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

const { t, tm, locale: _locale } = useI18n<{ message: MessageSchema }>()
const locale = computed(() => _locale.value as 'en' | 'ja')

const store = useTaxStore()

const name = computed(() =>
  locale.value === 'ja' ? DEDUCTION_DEFS['ideco'].nameJa : DEDUCTION_DEFS['ideco'].nameEn,
)

const inputLabel = computed(() =>
  locale.value === 'ja'
    ? DEDUCTION_DEFS['ideco'].inputLabelJa
    : DEDUCTION_DEFS['ideco'].inputLabelEn,
)

const ntaUrl = DEDUCTION_DEFS['ideco'].ntaUrl

const deductionAmount = computed(() => store.deductionAmountFor(props.entry))

const isOverLimit = computed(() => (props.entry.value ?? 0) > store.idecoMonthlyLimit)

const overLimitWarning = computed(() => {
  const limitFormatted = new Intl.NumberFormat('ja-JP').format(store.idecoMonthlyLimit)
  return t('idecoOverLimitWarning', { limit: limitFormatted })
})

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)
</script>

<template>
  <DeductionCardBase :name="name" @remove="emit('remove')">
    <template #header-extra>
      <UTooltip
        :content="{ side: 'bottom' }"
        :ui="{
          content: 'h-auto bg-white text-gray-900 border border-gray-200 shadow-lg rounded-lg p-0',
        }"
      >
        <template #content>
          <div style="padding: 1rem; min-width: 220px">
            <div style="font-weight: 600; margin-bottom: 0.6rem; font-size: 0.8rem">
              {{ t('idecoLimitTooltipTitle') }}
            </div>
            <div
              v-for="row in tm('idecoLimitTooltipRows') as Array<{ label: string; limit: string }>"
              :key="row.label"
              style="
                display: flex;
                justify-content: space-between;
                gap: 1.5rem;
                font-size: 0.78rem;
                padding: 0.2rem 0;
                color: #444;
              "
            >
              <span>{{ row.label }}</span>
              <span style="font-weight: 600; color: #111; white-space: nowrap">{{
                row.limit
              }}</span>
            </div>
          </div>
        </template>
        <span
          class="inline-flex items-center justify-center w-4 h-4 text-[0.65rem] font-bold text-gray-500 bg-gray-100 rounded-full cursor-help"
          >?</span
        >
      </UTooltip>
    </template>

    <label class="deduction-input-label">{{ inputLabel }}</label>
    <UFormField :error="isOverLimit ? overLimitWarning : undefined">
      <!-- eslint-disable-next-line vue/no-mutating-props -->
      <YenInputNumber v-model="entry.value" :min="0" :step="1000" class="w-full" />
    </UFormField>
    <div class="deduction-computed">
      <span class="deduction-computed-label">{{ t('deductionAmount') }}</span>
      <span class="deduction-computed-value">{{ formatCurrency(deductionAmount) }}</span>
    </div>
    <a
      v-if="ntaUrl"
      class="nta-reference-link"
      :href="ntaUrl"
      target="_blank"
      rel="noopener noreferrer"
      >{{ t('ntaReference') }} ↗</a
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

.nta-reference-link {
  display: block;
  margin-top: 0.45rem;
  font-size: 0.78rem;
  color: #3b5bdb;
  text-decoration: none;
  transition: color 0.2s;
}

:global(.theme-dark) .nta-reference-link,
:global(html.dark) .nta-reference-link {
  color: #e0e7ff;
}

.nta-reference-link:hover {
  color: #111;
  text-decoration: underline;
}

:global(.theme-dark) .nta-reference-link:hover,
:global(html.dark) .nta-reference-link:hover {
  color: #f8fafc;
}
</style>
