<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MessageSchema } from '../../locales'
import { type DeductionEntry, DEDUCTION_DEFS } from '../../data/deductions'
import { useTaxStore } from '../../stores/tax'
import DeductionCardBase from './DeductionCardBase.vue'

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

const deductionAmount = computed(() => store.deductionAmountFor(props.entry))

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)
</script>

<template>
  <DeductionCardBase :name="name" @remove="emit('remove')">
    <label class="deduction-input-label">{{ inputLabel }}</label>
    <!-- eslint-disable-next-line vue/no-mutating-props -->
    <UInput type="number" v-model.number="entry.value" :min="0" :step="isCount ? 1 : 1000">
      <template #leading v-if="!isCount"
        ><span class="text-base text-muted font-medium">¥</span></template
      >
    </UInput>
    <div class="deduction-computed">
      <span class="deduction-computed-label">{{ t('deductionAmount') }}</span>
      <span class="deduction-computed-value">{{ formatCurrency(deductionAmount) }}</span>
    </div>
    <a
      v-if="isFurusato"
      class="furusato-sim-link"
      href="https://www.furusato-tax.jp/about/simulation"
      target="_blank"
      rel="noopener noreferrer"
      >{{ t('furusatoSimLink') }} ↗</a
    >
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

.furusato-sim-link,
.nta-reference-link {
  display: block;
  margin-top: 0.45rem;
  font-size: 0.78rem;
  color: #3b5bdb;
  text-decoration: none;
  transition: color 0.2s;
}

.furusato-sim-link:hover,
.nta-reference-link:hover {
  color: #111;
  text-decoration: underline;
}
</style>
