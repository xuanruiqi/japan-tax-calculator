<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { MessageSchema } from '../locales'
import { useTaxStore } from '../stores/tax'
import YenInputNumber from './YenInputNumber.vue'

const { t, locale: _locale } = useI18n<{ message: MessageSchema }>()
const locale = computed(() => _locale.value as 'en' | 'ja')

const store = useTaxStore()
const { incomeEntries, previousYearIncomeInput, primarySalaryEntry } = storeToRefs(store)
const { addIncomeEntry, removeIncomeEntry } = store

const incomePickerItems = computed(() => [
  [
    { label: t('salaryIncomeName'), onSelect: () => addIncomeEntry('salary') },
    { label: t('businessIncomeName'), onSelect: () => addIncomeEntry('business') },
  ],
])
</script>

<template>
  <div class="input-section">
    <h2>{{ t('incomeDetails') }}</h2>

    <div class="card-list">
      <UCard
        v-for="entry in incomeEntries"
        :key="entry.id"
        :ui="{ header: 'py-2 px-3 bg-gray-50', body: 'p-3' }"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <span class="text-sm font-semibold">
              {{ entry.type === 'salary' ? t('salaryIncomeName') : t('businessIncomeName') }}
              <small
                v-if="entry.type === 'salary' && entry === primarySalaryEntry"
                class="bracket-info"
                style="margin-left: 0.4rem"
                >{{ t('primaryJob') }}</small
              >
              <UInput
                v-model="entry.name"
                size="xs"
                variant="ghost"
                class="name-input inline-block w-28 ml-1"
                :placeholder="t('incomeNamePlaceholder')"
              />
            </span>
            <UButton
              variant="ghost"
              size="xs"
              color="error"
              class="remove-btn"
              icon="i-lucide-x"
              @click="removeIncomeEntry(entry.id)"
              :title="t('removeIncome')"
            />
          </div>
        </template>

        <!-- Salary inputs -->
        <template v-if="entry.type === 'salary'">
          <label class="deduction-input-label">{{ t('monthlySalary') }}</label>
          <YenInputNumber v-model="entry.monthlySalary" :min="0" :step="1000" />
          <label class="deduction-input-label" style="margin-top: 0.5rem">{{
            t('annualBonus')
          }}</label>
          <YenInputNumber v-model="entry.annualBonus" :min="0" :step="1000" />
          <div class="si-toggle" style="margin-top: 0.6rem" v-if="entry === primarySalaryEntry">
            <USwitch v-model="entry.joinsEmploymentInsurance" />
            <span>
              {{ t('joinsEmploymentInsurance') }}
              <UTooltip
                :content="{ side: 'bottom' }"
                :ui="{
                  content:
                    'h-auto bg-white text-gray-900 border border-gray-200 shadow-lg rounded-lg p-0 max-w-xs',
                }"
              >
                <template #content>
                  <div class="text-xs leading-relaxed" style="padding: 1rem" v-if="locale === 'ja'">
                    次の<b>(1)および(2)の両方</b>に該当する場合、雇用保険に加入する必要があります。<br /><br />
                    <b>(1) 31日以上継続して雇用される見込みがあること</b><br />
                    ・期間の定めなく雇用される場合<br />
                    ・雇用期間が31日以上の場合<br />
                    ・契約に更新規定があり、31日未満での雇止め明示がない場合<br /><br />
                    <b>(2) 1週間の所定労働時間が20時間以上であること</b>
                  </div>
                  <div class="text-xs leading-relaxed" style="padding: 1rem" v-else>
                    Employment insurance is required when <b>both</b> of the following apply:<br /><br />
                    <b>(1) Expected to be employed continuously for 31+ days</b><br />
                    · No fixed term<br />
                    · Contract of 31+ days<br />
                    · Contract has renewal clause with no explicit non-renewal before 31 days<br /><br />
                    <b>(2) Scheduled weekly hours are 20 or more</b>
                  </div>
                </template>
                <span
                  class="inline-flex items-center justify-center w-4 h-4 text-[0.65rem] font-bold text-gray-500 bg-gray-100 rounded-full cursor-help ml-1"
                  >?</span
                >
              </UTooltip>
            </span>
          </div>
          <div class="si-toggle" style="margin-top: 0.6rem">
            <USwitch v-model="entry.joinsSocialInsurance" />
            <span>
              {{ t('joinsSocialInsurance') }}
              <UTooltip
                :content="{ side: 'bottom' }"
                :ui="{
                  content:
                    'h-auto bg-white text-gray-900 border border-gray-200 shadow-lg rounded-lg p-0 max-w-xs',
                }"
              >
                <template #content>
                  <div class="text-xs leading-relaxed" style="padding: 1rem" v-if="locale === 'ja'">
                    以下のいずれかに該当する場合、勤務先の社会保険に加入する必要があります。<br /><br />
                    <b>① フルタイムの3/4以上</b><br />
                    正社員の所定労働時間・日数の3/4以上勤務している場合<br /><br />
                    <b>② 以下の5条件をすべて満たす場合</b><br />
                    ・週の所定労働時間が20時間以上<br />
                    ・所定内賃金が月額8.8万円以上（残業代・交通費・ボーナス除く）<br />
                    ・雇用期間が2ヶ月超の見込み<br />
                    ・昼間学生でないこと<br />
                    ・従業員51人以上の企業であること
                  </div>
                  <div class="text-xs leading-relaxed" style="padding: 1rem" v-else>
                    You must enroll in employer social insurance if either of the following
                    applies:<br /><br />
                    <b>1. You work 3/4+ of full-time hours and days;</b><br /><br />
                    <b>2. All five conditions are met:</b><br />
                    - Weekly working hours: 20+ hours/week<br />
                    - Monthly wage: ¥88,000+ (base pay only, excl. overtime, commuting, bonus)<br />
                    - Employment period: expected to exceed 2 months<br />
                    - Not a full-time student<br />
                    - Employer has 51+ employees (pension-insured)
                  </div>
                </template>
                <span
                  class="inline-flex items-center justify-center w-4 h-4 text-[0.65rem] font-bold text-gray-500 bg-gray-100 rounded-full cursor-help ml-1"
                  >?</span
                >
              </UTooltip>
            </span>
          </div>
        </template>

        <!-- Business inputs -->
        <template v-else>
          <label class="deduction-input-label">{{ t('businessRevenue') }}</label>
          <YenInputNumber v-model="entry.revenue" :min="0" :step="1000" />
          <label class="deduction-input-label" style="margin-top: 0.5rem">{{
            t('businessExpenses')
          }}</label>
          <YenInputNumber v-model="entry.expenses" :min="0" :step="1000" />
        </template>
      </UCard>
    </div>

    <div style="margin-top: 0.75rem">
      <UDropdownMenu :items="incomePickerItems">
        <UButton variant="outline" size="sm" class="outline-btn" :label="t('addIncome')" />
      </UDropdownMenu>
    </div>

    <div class="input-group" style="margin-top: 1rem">
      <label>{{ t('prevIncome') }}</label>
      <YenInputNumber
        v-model="previousYearIncomeInput"
        :min="0"
        :step="1000"
        :placeholder="t('prevIncomePlaceholder')"
      />
    </div>
  </div>
</template>

<style scoped>
h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #111;
  margin-bottom: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.deduction-input-label {
  display: block;
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.35rem;
}

.si-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #555;
}

.bracket-info {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  color: #666;
  vertical-align: middle;
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-group label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 0.4rem;
}
</style>
