<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

interface Props {
  modelValue?: number | null | ''
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null | undefined]
  blur: [event: FocusEvent]
  change: [event: Event]
}>()

const attrs = useAttrs()

const passthroughAttrs = computed(() => {
  const rest = { ...attrs }
  delete rest.ui
  delete rest.formatOptions
  delete rest.stepSnapping
  return rest
})

const mergedUi = computed(() => {
  const rawUi = attrs.ui

  if (rawUi != null && typeof rawUi === 'object' && !Array.isArray(rawUi)) {
    return rawUi as Record<string, unknown>
  }

  return undefined
})

const mergedFormatOptions = computed<Intl.NumberFormatOptions>(() => {
  const rawFormatOptions = attrs.formatOptions

  if (
    rawFormatOptions != null &&
    typeof rawFormatOptions === 'object' &&
    !Array.isArray(rawFormatOptions)
  ) {
    return {
      style: 'currency',
      currency: 'JPY',
      currencyDisplay: 'narrowSymbol',
      useGrouping: true,
      maximumFractionDigits: 0,
      ...(rawFormatOptions as Intl.NumberFormatOptions),
    }
  }

  return {
    style: 'currency',
    currency: 'JPY',
    currencyDisplay: 'narrowSymbol',
    useGrouping: true,
    maximumFractionDigits: 0,
  }
})

const stepSnapping = computed(() => {
  const rawStepSnapping = attrs.stepSnapping

  if (rawStepSnapping == null) return false
  if (typeof rawStepSnapping === 'string') return rawStepSnapping !== 'false'

  return Boolean(rawStepSnapping)
})
</script>

<template>
  <UInputNumber
    v-bind="passthroughAttrs"
    :model-value="props.modelValue === '' ? null : props.modelValue"
    :ui="mergedUi"
    :format-options="mergedFormatOptions"
    :step-snapping="stepSnapping"
    :increment="false"
    :decrement="false"
    @update:model-value="emit('update:modelValue', $event)"
    @blur="emit('blur', $event)"
    @change="emit('change', $event)"
  />
</template>

<style scoped></style>
