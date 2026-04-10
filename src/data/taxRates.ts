export interface TaxRateInfo {
  prefIncomeRate: number;      // e.g., 0.04 (4%)
  cityIncomeRate: number;      // e.g., 0.06 (6%)
  prefPerCapita: number;       // e.g., 1500
  cityPerCapita: number;       // e.g., 3500
}

export interface PrefectureOverrides {
  default: TaxRateInfo;
  cities: {
    [cityName: string]: TaxRateInfo;
  }
}

// Reiwa 6 (2024) Kyokai Kenpo Rates (Employee Share = Total / 2)
export const KYOKAI_KENPO_RATES: Record<string, number> = {
  "北海道 (Hokkaido)": 5.105,
  "青森県 (Aomori)": 4.885,
  "岩手県 (Iwate)": 4.84,
  "宮城県 (Miyagi)": 4.885,
  "秋田県 (Akita)": 4.935,
  "山形県 (Yamagata)": 4.88,
  "福島県 (Fukushima)": 4.88,
  "茨城県 (Ibaraki)": 4.895,
  "栃木県 (Tochigi)": 4.885,
  "群馬県 (Gunma)": 4.88,
  "埼玉県 (Saitama)": 4.89,
  "千葉県 (Chiba)": 4.895,
  "東京都 (Tokyo)": 4.99,
  "神奈川県 (Kanagawa)": 5.01,
  "新潟県 (Niigata)": 4.835,
  "富山県 (Toyama)": 4.79,
  "石川県 (Ishikawa)": 4.90,
  "福井県 (Fukui)": 4.915,
  "山梨県 (Yamanashi)": 4.915,
  "長野県 (Nagano)": 4.83,
  "岐阜県 (Gifu)": 4.915,
  "静岡県 (Shizuoka)": 4.865,
  "愛知県 (Aichi)": 4.94,
  "三重県 (Mie)": 4.865,
  "滋賀県 (Shiga)": 4.89,
  "京都府 (Kyoto)": 4.98,
  "大阪府 (Osaka)": 5.17,
  "兵庫県 (Hyogo)": 5.025,
  "奈良県 (Nara)": 4.94,
  "和歌山県 (Wakayama)": 4.935,
  "鳥取県 (Tottori)": 4.91,
  "島根県 (Shimane)": 4.935,
  "岡山県 (Okayama)": 4.985,
  "広島県 (Hiroshima)": 4.96,
  "山口県 (Yamaguchi)": 4.985,
  "徳島県 (Tokushima)": 5.06,
  "香川県 (Kagawa)": 5.02,
  "愛媛県 (Ehime)": 4.965,
  "高知県 (Kochi)": 5.025,
  "福岡県 (Fukuoka)": 5.17,
  "佐賀県 (Saga)": 5.255,
  "長崎県 (Nagasaki)": 5.155,
  "熊本県 (Kumamoto)": 5.075,
  "大分県 (Oita)": 5.03,
  "宮崎県 (Miyazaki)": 4.925,
  "鹿児島県 (Kagoshima)": 5.03,
  "沖縄県 (Okinawa)": 4.975
};

export const PREFECTURES_LIST = Object.keys(KYOKAI_KENPO_RATES);

// Common structures
const baseStandard: TaxRateInfo = { prefIncomeRate: 0.04, cityIncomeRate: 0.06, prefPerCapita: 1500, cityPerCapita: 3500 };
const designatedCity: TaxRateInfo = { prefIncomeRate: 0.02, cityIncomeRate: 0.08, prefPerCapita: 1500, cityPerCapita: 3500 };

export const RESIDENT_TAX_RATES: Record<string, PrefectureOverrides> = {
  "北海道 (Hokkaido)": {
    default: { ...baseStandard },
    cities: { "札幌市 (Sapporo)": { ...designatedCity }, "夕張市 (Yubari)": { ...baseStandard, cityIncomeRate: 0.065 } }
  },
  "青森県 (Aomori)": { default: { ...baseStandard }, cities: {} },
  "岩手県 (Iwate)": { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  "宮城県 (Miyagi)": {
    default: { ...baseStandard, prefPerCapita: 2700 },
    cities: { "仙台市 (Sendai)": { ...designatedCity, prefPerCapita: 2700 } }
  },
  "秋田県 (Akita)": { default: { ...baseStandard, prefPerCapita: 2300 }, cities: {} },
  "山形県 (Yamagata)": { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  "福島県 (Fukushima)": { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  "茨城県 (Ibaraki)": { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  "栃木県 (Tochigi)": { default: { ...baseStandard, prefPerCapita: 2200 }, cities: {} },
  "群馬県 (Gunma)": { default: { ...baseStandard, prefPerCapita: 2200 }, cities: {} },
  "埼玉県 (Saitama)": {
    default: { ...baseStandard },
    cities: { "さいたま市 (Saitama City)": { ...designatedCity } }
  },
  "千葉県 (Chiba)": {
    default: { ...baseStandard },
    cities: { "千葉市 (Chiba City)": { ...designatedCity } }
  },
  "東京都 (Tokyo)": { default: { ...baseStandard }, cities: {} },
  "神奈川県 (Kanagawa)": {
    default: { prefIncomeRate: 0.04025, cityIncomeRate: 0.06, prefPerCapita: 1800, cityPerCapita: 3500 },
    cities: {
      "横浜市 (Yokohama)": { prefIncomeRate: 0.02025, cityIncomeRate: 0.08, prefPerCapita: 1800, cityPerCapita: 4400 },
      "川崎市 (Kawasaki)": { prefIncomeRate: 0.02025, cityIncomeRate: 0.08, prefPerCapita: 1800, cityPerCapita: 3500 },
      "相模原市 (Sagamihara)": { prefIncomeRate: 0.02025, cityIncomeRate: 0.08, prefPerCapita: 1800, cityPerCapita: 3500 }
    }
  },
  "新潟県 (Niigata)": {
    default: { ...baseStandard },
    cities: { "新潟市 (Niigata City)": { ...designatedCity } }
  },
  "富山県 (Toyama)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "石川県 (Ishikawa)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "福井県 (Fukui)": { default: { ...baseStandard }, cities: {} },
  "山梨県 (Yamanashi)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "長野県 (Nagano)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "岐阜県 (Gifu)": { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  "静岡県 (Shizuoka)": {
    default: { ...baseStandard, prefPerCapita: 1900 },
    cities: {
      "静岡市 (Shizuoka City)": { ...designatedCity, prefPerCapita: 1900 },
      "浜松市 (Hamamatsu)": { ...designatedCity, prefPerCapita: 1900 }
    }
  },
  "愛知県 (Aichi)": {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: {
      "名古屋市 (Nagoya)": { prefIncomeRate: 0.02, cityIncomeRate: 0.077, prefPerCapita: 2000, cityPerCapita: 3300 }
    }
  },
  "三重県 (Mie)": { default: { ...baseStandard, prefPerCapita: 2500 }, cities: {} },
  "滋賀県 (Shiga)": { default: { ...baseStandard, prefPerCapita: 2300 }, cities: {} },
  "京都府 (Kyoto)": {
    default: { ...baseStandard, prefPerCapita: 2100 },
    cities: { "京都市 (Kyoto City)": { ...designatedCity, prefPerCapita: 2100 } }
  },
  "大阪府 (Osaka)": {
    default: { ...baseStandard, prefPerCapita: 1800 },
    cities: {
      "大阪市 (Osaka City)": { ...designatedCity, prefPerCapita: 1800 },
      "堺市 (Sakai)": { ...designatedCity, prefPerCapita: 1800 }
    }
  },
  "兵庫県 (Hyogo)": {
    default: { ...baseStandard, prefPerCapita: 2300 },
    cities: {
      "神戸市 (Kobe)": { ...designatedCity, prefPerCapita: 2300 },
      "豊岡市 (Toyooka)": { prefIncomeRate: 0.04, cityIncomeRate: 0.061, prefPerCapita: 2300, cityPerCapita: 3500 }
    }
  },
  "奈良県 (Nara)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "和歌山県 (Wakayama)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "鳥取県 (Tottori)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "島根県 (Shimane)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "岡山県 (Okayama)": {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: { "岡山市 (Okayama City)": { ...designatedCity, prefPerCapita: 2000 } }
  },
  "広島県 (Hiroshima)": {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: { "広島市 (Hiroshima City)": { ...designatedCity, prefPerCapita: 2000 } }
  },
  "山口県 (Yamaguchi)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "徳島県 (Tokushima)": { default: { ...baseStandard }, cities: {} },
  "香川県 (Kagawa)": { default: { ...baseStandard }, cities: {} },
  "愛媛県 (Ehime)": { default: { ...baseStandard, prefPerCapita: 2200 }, cities: {} },
  "高知県 (Kochi)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "福岡県 (Fukuoka)": {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: {
      "福岡市 (Fukuoka City)": { ...designatedCity, prefPerCapita: 2000 },
      "北九州市 (Kitakyushu)": { ...designatedCity, prefPerCapita: 2000 }
    }
  },
  "佐賀県 (Saga)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "長崎県 (Nagasaki)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "熊本県 (Kumamoto)": {
    default: { ...baseStandard, prefPerCapita: 2000 },
    cities: { "熊本市 (Kumamoto City)": { ...designatedCity, prefPerCapita: 2000 } }
  },
  "大分県 (Oita)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "宮崎県 (Miyazaki)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "鹿児島県 (Kagoshima)": { default: { ...baseStandard, prefPerCapita: 2000 }, cities: {} },
  "沖縄県 (Okinawa)": { default: { ...baseStandard }, cities: {} }
};
