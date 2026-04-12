import { createI18n } from 'vue-i18n'
import en from './en'
import ja from './ja'

export type MessageSchema = typeof en

const i18n = createI18n<[MessageSchema], 'en' | 'ja'>({
  legacy: false,
  locale: 'ja',
  fallbackLocale: 'en',
  messages: { en, ja },
})

export default i18n
