export interface TaxRateInfo {
  prefIncomeRate: number;      // e.g., 0.04 (4%)
  cityIncomeRate: number;      // e.g., 0.06 (6%)
  prefPerCapita: number;       // e.g., 1500
  cityPerCapita: number;       // e.g., 3500
}

export interface PrefectureOverrides {
  default: TaxRateInfo;
  cities: {
    [cityId: string]: TaxRateInfo;
  }
}

export type LocaleNames = Record<string, string>;

// Display names — extensible to any locale by adding keys (e.g. zh, ko, …)
export const PREFECTURE_NAMES: Record<string, LocaleNames> = {
  hokkaido:   { ja: '北海道',   en: 'Hokkaido' },
  aomori:     { ja: '青森県',   en: 'Aomori' },
  iwate:      { ja: '岩手県',   en: 'Iwate' },
  miyagi:     { ja: '宮城県',   en: 'Miyagi' },
  akita:      { ja: '秋田県',   en: 'Akita' },
  yamagata:   { ja: '山形県',   en: 'Yamagata' },
  fukushima:  { ja: '福島県',   en: 'Fukushima' },
  ibaraki:    { ja: '茨城県',   en: 'Ibaraki' },
  tochigi:    { ja: '栃木県',   en: 'Tochigi' },
  gunma:      { ja: '群馬県',   en: 'Gunma' },
  saitama:    { ja: '埼玉県',   en: 'Saitama' },
  chiba:      { ja: '千葉県',   en: 'Chiba' },
  tokyo:      { ja: '東京都',   en: 'Tokyo' },
  kanagawa:   { ja: '神奈川県', en: 'Kanagawa' },
  niigata:    { ja: '新潟県',   en: 'Niigata' },
  toyama:     { ja: '富山県',   en: 'Toyama' },
  ishikawa:   { ja: '石川県',   en: 'Ishikawa' },
  fukui:      { ja: '福井県',   en: 'Fukui' },
  yamanashi:  { ja: '山梨県',   en: 'Yamanashi' },
  nagano:     { ja: '長野県',   en: 'Nagano' },
  gifu:       { ja: '岐阜県',   en: 'Gifu' },
  shizuoka:   { ja: '静岡県',   en: 'Shizuoka' },
  aichi:      { ja: '愛知県',   en: 'Aichi' },
  mie:        { ja: '三重県',   en: 'Mie' },
  shiga:      { ja: '滋賀県',   en: 'Shiga' },
  kyoto:      { ja: '京都府',   en: 'Kyoto' },
  osaka:      { ja: '大阪府',   en: 'Osaka' },
  hyogo:      { ja: '兵庫県',   en: 'Hyogo' },
  nara:       { ja: '奈良県',   en: 'Nara' },
  wakayama:   { ja: '和歌山県', en: 'Wakayama' },
  tottori:    { ja: '鳥取県',   en: 'Tottori' },
  shimane:    { ja: '島根県',   en: 'Shimane' },
  okayama:    { ja: '岡山県',   en: 'Okayama' },
  hiroshima:  { ja: '広島県',   en: 'Hiroshima' },
  yamaguchi:  { ja: '山口県',   en: 'Yamaguchi' },
  tokushima:  { ja: '徳島県',   en: 'Tokushima' },
  kagawa:     { ja: '香川県',   en: 'Kagawa' },
  ehime:      { ja: '愛媛県',   en: 'Ehime' },
  kochi:      { ja: '高知県',   en: 'Kochi' },
  fukuoka:    { ja: '福岡県',   en: 'Fukuoka' },
  saga:       { ja: '佐賀県',   en: 'Saga' },
  nagasaki:   { ja: '長崎県',   en: 'Nagasaki' },
  kumamoto:   { ja: '熊本県',   en: 'Kumamoto' },
  oita:       { ja: '大分県',   en: 'Oita' },
  miyazaki:   { ja: '宮崎県',   en: 'Miyazaki' },
  kagoshima:  { ja: '鹿児島県', en: 'Kagoshima' },
  okinawa:    { ja: '沖縄県',   en: 'Okinawa' },
};

export const CITY_NAMES: Record<string, LocaleNames> = {
  sapporo:        { ja: '札幌市',     en: 'Sapporo' },
  yubari:         { ja: '夕張市',     en: 'Yubari' },
  sendai:         { ja: '仙台市',     en: 'Sendai' },
  saitama_city:   { ja: 'さいたま市', en: 'Saitama City' },
  chiba_city:     { ja: '千葉市',     en: 'Chiba City' },
  tokyo_23ku:     { ja: '東京23区',   en: 'Tokyo 23 Wards' },
  musashino:      { ja: '武蔵野市',   en: 'Musashino' },
  yokohama:       { ja: '横浜市',     en: 'Yokohama' },
  kawasaki:       { ja: '川崎市',     en: 'Kawasaki' },
  sagamihara:     { ja: '相模原市',   en: 'Sagamihara' },
  niigata_city:   { ja: '新潟市',     en: 'Niigata City' },
  shizuoka_city:  { ja: '静岡市',     en: 'Shizuoka City' },
  hamamatsu:      { ja: '浜松市',     en: 'Hamamatsu' },
  nagoya:         { ja: '名古屋市',   en: 'Nagoya' },
  kyoto_city:     { ja: '京都市',     en: 'Kyoto City' },
  osaka_city:     { ja: '大阪市',     en: 'Osaka City' },
  sakai:          { ja: '堺市',       en: 'Sakai' },
  kobe:           { ja: '神戸市',     en: 'Kobe' },
  toyooka:        { ja: '豊岡市',     en: 'Toyooka' },
  okayama_city:   { ja: '岡山市',     en: 'Okayama City' },
  hiroshima_city: { ja: '広島市',     en: 'Hiroshima City' },
  fukuoka_city:   { ja: '福岡市',     en: 'Fukuoka City' },
  kitakyushu:     { ja: '北九州市',   en: 'Kitakyushu' },
  kumamoto_city:  { ja: '熊本市',     en: 'Kumamoto City' },
};

export const PREFECTURES_LIST = Object.keys(PREFECTURE_NAMES);

// Reiwa 6 (2024) Kyokai Kenpo Rates (Employee Share = Total / 2)
export const KYOKAI_KENPO_RATES: Record<string, number> = {
  hokkaido:   5.105,
  aomori:     4.885,
  iwate:      4.84,
  miyagi:     4.885,
  akita:      4.935,
  yamagata:   4.88,
  fukushima:  4.88,
  ibaraki:    4.895,
  tochigi:    4.885,
  gunma:      4.88,
  saitama:    4.89,
  chiba:      4.895,
  tokyo:      4.99,
  kanagawa:   5.01,
  niigata:    4.835,
  toyama:     4.79,
  ishikawa:   4.90,
  fukui:      4.915,
  yamanashi:  4.915,
  nagano:     4.83,
  gifu:       4.915,
  shizuoka:   4.865,
  aichi:      4.94,
  mie:        4.865,
  shiga:      4.89,
  kyoto:      4.98,
  osaka:      5.17,
  hyogo:      5.025,
  nara:       4.94,
  wakayama:   4.935,
  tottori:    4.91,
  shimane:    4.935,
  okayama:    4.985,
  hiroshima:  4.96,
  yamaguchi:  4.985,
  tokushima:  5.06,
  kagawa:     5.02,
  ehime:      4.965,
  kochi:      5.025,
  fukuoka:    5.17,
  saga:       5.255,
  nagasaki:   5.155,
  kumamoto:   5.075,
  oita:       5.03,
  miyazaki:   4.925,
  kagoshima:  5.03,
  okinawa:    4.975,
};

// Common structures
const baseStandard: TaxRateInfo = { prefIncomeRate: 0.04, cityIncomeRate: 0.06, prefPerCapita: 1500, cityPerCapita: 3500 };
const designatedCity: TaxRateInfo = { prefIncomeRate: 0.02, cityIncomeRate: 0.08, prefPerCapita: 1500, cityPerCapita: 3500 };

export const RESIDENT_TAX_RATES: Record<string, PrefectureOverrides> = {
  hokkaido: {
    default: { ...baseStandard },
    cities: { sapporo: { ...designatedCity }, yubari: { ...baseStandard, cityIncomeRate: 0.065 } }
  },
  aomori:    { default: { ...baseStandard }, cities: {} },
  iwate:     { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  miyagi: {
    default: { ...baseStandard, prefPerCapita: 2700 },
    cities: { sendai: { ...designatedCity, prefPerCapita: 2700 } }
  },
  akita:     { default: { ...baseStandard, prefPerCapita: 2300 }, cities: {} },
  yamagata:  { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  fukushima: { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  ibaraki:   { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  tochigi:   { default: { ...baseStandard, prefPerCapita: 2200 }, cities: {} },
  gunma:     { default: { ...baseStandard, prefPerCapita: 2200 }, cities: {} },
  saitama: {
    default: { ...baseStandard },
    cities: { saitama_city: { ...designatedCity } }
  },
  chiba: {
    default: { ...baseStandard },
    cities: { chiba_city: { ...designatedCity } }
  },
  tokyo:     { default: { ...baseStandard }, cities: { tokyo_23ku: { ...baseStandard }, musashino: { ...baseStandard } } },
  kanagawa: {
    default: { prefIncomeRate: 0.04025, cityIncomeRate: 0.06, prefPerCapita: 1800, cityPerCapita: 3500 },
    cities: {
      yokohama:   { prefIncomeRate: 0.02025, cityIncomeRate: 0.08, prefPerCapita: 1800, cityPerCapita: 4400 },
      kawasaki:    { prefIncomeRate: 0.02025, cityIncomeRate: 0.08, prefPerCapita: 1800, cityPerCapita: 3500 },
      sagamihara:  { prefIncomeRate: 0.02025, cityIncomeRate: 0.08, prefPerCapita: 1800, cityPerCapita: 3500 },
    }
  },
  niigata: {
    default: { ...baseStandard },
    cities: { niigata_city: { ...designatedCity } }
  },
  toyama:    { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  ishikawa:  { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  fukui:     { default: { ...baseStandard }, cities: {} },
  yamanashi: { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  nagano:    { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  gifu:      { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  shizuoka: {
    default: { ...baseStandard, prefPerCapita: 1900 },
    cities: {
      shizuoka_city: { ...designatedCity, prefPerCapita: 1900 },
      hamamatsu:     { ...designatedCity, prefPerCapita: 1900 },
    }
  },
  aichi: {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: {
      nagoya: { prefIncomeRate: 0.02, cityIncomeRate: 0.077, prefPerCapita: 2000, cityPerCapita: 3300 },
    }
  },
  mie:       { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  shiga:     { default: { ...baseStandard, prefPerCapita: 2300 }, cities: {} },
  kyoto: {
    default: { ...baseStandard, prefPerCapita: 2100 },
    cities: { kyoto_city: { ...designatedCity, prefPerCapita: 2100 } }
  },
  osaka: {
    default: { ...baseStandard, prefPerCapita: 1800 },
    cities: {
      osaka_city: { ...designatedCity, prefPerCapita: 1800 },
      sakai:      { ...designatedCity, prefPerCapita: 1800 },
    }
  },
  hyogo: {
    default: { ...baseStandard, prefPerCapita: 2300 },
    cities: {
      kobe:    { ...designatedCity, prefPerCapita: 2300 },
      toyooka: { prefIncomeRate: 0.04, cityIncomeRate: 0.061, prefPerCapita: 2300, cityPerCapita: 3500 },
    }
  },
  nara:      { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  wakayama:  { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  tottori:   { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  shimane:   { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  okayama: {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: { okayama_city: { ...designatedCity, prefPerCapita: 2000 } }
  },
  hiroshima: {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: { hiroshima_city: { ...designatedCity, prefPerCapita: 2000 } }
  },
  yamaguchi: { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  tokushima: { default: { ...baseStandard }, cities: {} },
  kagawa:    { default: { ...baseStandard }, cities: {} },
  ehime:     { default: { ...baseStandard, prefPerCapita: 2200 }, cities: {} },
  kochi:     { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  fukuoka: {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: {
      fukuoka_city: { ...designatedCity, prefPerCapita: 2000 },
      kitakyushu:   { ...designatedCity, prefPerCapita: 2000 },
    }
  },
  saga:      { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  nagasaki:  { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  kumamoto: {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: { kumamoto_city: { ...designatedCity, prefPerCapita: 2000 } }
  },
  oita:      { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  miyazaki:  { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  kagoshima: { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  okinawa:   { default: { ...baseStandard }, cities: {} },
};
