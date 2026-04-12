<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MessageSchema } from '../../locales'

interface Props {
  name: string
  showEditButton?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  remove: []
  edit: []
}>()

const { t } = useI18n<{ message: MessageSchema }>()
</script>

<template>
  <UCard :ui="{ header: 'py-2 px-3 bg-gray-50', body: 'p-3' }">
    <template #header>
      <div class="flex justify-between items-center">
        <span class="text-sm font-semibold flex items-center gap-1">
          {{ props.name }}
          <slot name="header-extra" />
        </span>
        <div class="flex items-center gap-1">
          <UButton
            v-if="props.showEditButton"
            variant="outline"
            size="xs"
            class="outline-btn"
            :label="t('wizardEdit')"
            @click="emit('edit')"
          />
          <UButton
            variant="ghost"
            size="xs"
            color="error"
            class="remove-btn"
            icon="i-lucide-x"
            @click="emit('remove')"
            :title="t('removeDeduction')"
          />
        </div>
      </div>
    </template>
    <slot />
  </UCard>
</template>
