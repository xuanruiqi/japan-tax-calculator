<script setup lang="ts">
import { type DeductionEntry } from '../../data/deductions'
import HomeLoanDeductionCard from './HomeLoanDeductionCard.vue'
import IdecoDeductionCard from './IdecoDeductionCard.vue'
import StandardDeductionCard from './StandardDeductionCard.vue'

interface Props {
  entry: DeductionEntry
}

defineProps<Props>()

const emit = defineEmits<{
  remove: []
  'edit-home-loan': []
}>()
</script>

<template>
  <HomeLoanDeductionCard
    v-if="entry.type === 'home_loan'"
    :entry="entry"
    @remove="emit('remove')"
    @edit-home-loan="emit('edit-home-loan')"
  />
  <IdecoDeductionCard
    v-else-if="entry.type === 'ideco'"
    :entry="entry"
    @remove="emit('remove')"
  />
  <StandardDeductionCard
    v-else
    :entry="entry"
    @remove="emit('remove')"
  />
</template>
