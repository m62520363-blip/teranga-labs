export type CountryCode = "SN" | "CI" | "ML" | "BF" | "NE" | "GN" | "BJ" | "TG"

export interface Region {
  code: string
  name: string
  note?: string
}

export interface MobilePayment {
  name: string
  note?: string
}

export interface Country {
  code: CountryCode
  iso2: string
  iso3: string
  name: string
  nameFr: string
  flagUrl: string
  phoneCode: string
  currency: "XOF" | "GNF"
  currencyLabel: "FCFA" | "GNF"
  regions: Region[]
  mobilePayments: MobilePayment[]
  notes?: string
}

export const COUNTRIES: Country[] = [
  {
    code: "SN",
    iso2: "SN",
    iso3: "SEN",
    name: "Senegal",
    nameFr: "Sénégal",
    flagUrl: "https://flagcdn.com/w20/sn.png",
    phoneCode: "+221",
    currency: "XOF",
    currencyLabel: "FCFA",
    regions: [
      { code: "SN-DK", name: "Dakar" },
      { code: "SN-TH", name: "Thiès" },
      { code: "SN-DI", name: "Diourbel" },
      { code: "SN-FK", name: "Fatick" },
      { code: "SN-KA", name: "Kaolack" },
      { code: "SN-KO", name: "Kolda" },
      { code: "SN-LG", name: "Louga" },
      { code: "SN-MT", name: "Matam" },
      { code: "SN-SL", name: "Saint-Louis" },
      { code: "SN-TC", name: "Tambacounda" },
      { code: "SN-ZG", name: "Ziguinchor" },
      { code: "SN-KE", name: "Kédougou" },
      { code: "SN-SE", name: "Sédhiou" },
    ],
    mobilePayments: [{ name: "Wave" }, { name: "Max It" }],
    notes: "Sénégal : moyens de paiement mobiles confirmés (Wave, Max It). Orange Money retiré du périmètre indiqué.",
  },
  {
    code: "CI",
    iso2: "CI",
    iso3: "CIV",
    name: "Côte d'Ivoire",
    nameFr: "Côte d'Ivoire",
    flagUrl: "https://flagcdn.com/w20/ci.png",
    phoneCode: "+225",
    currency: "XOF",
    currencyLabel: "FCFA",
    regions: [
      { code: "CI-AB", name: "Abidjan" },
      { code: "CI-BS", name: "Bas-Sassandra" },
      { code: "CI-CM", name: "Comoé" },
      { code: "CI-DN", name: "Denguélé" },
      { code: "CI-GD", name: "Gôh-Djiboua" },
      { code: "CI-LC", name: "Lacs" },
      { code: "CI-LG", name: "Lagunes" },
      { code: "CI-MG", name: "Montagnes" },
      { code: "CI-SM", name: "Sassandra-Marahoué" },
      { code: "CI-SV", name: "Savanes" },
      { code: "CI-VB", name: "Vallée du Bandama" },
      { code: "CI-WR", name: "Woroba" },
      { code: "CI-YM", name: "Yamoussoukro" },
      { code: "CI-ZZ", name: "Zanzan" },
    ],
    mobilePayments: [{ name: "À confirmer", note: "Moyens de paiement mobiles à valider par intégration." }],
  },
  {
    code: "ML",
    iso2: "ML",
    iso3: "MLI",
    name: "Mali",
    nameFr: "Mali",
    flagUrl: "https://flagcdn.com/w20/ml.png",
    phoneCode: "+223",
    currency: "XOF",
    currencyLabel: "FCFA",
    regions: [
      { code: "ML-BKO", name: "Bamako" },
      { code: "ML-GA", name: "Gao" },
      { code: "ML-KY", name: "Kayes" },
      { code: "ML-KD", name: "Kidal" },
      { code: "ML-KL", name: "Koulikoro" },
      { code: "ML-MP", name: "Mopti" },
      { code: "ML-SE", name: "Ségou" },
      { code: "ML-SK", name: "Sikasso" },
      { code: "ML-TB", name: "Tombouctou" },
      { code: "ML-TA", name: "Taoudénit", note: "À confirmer (évolution du découpage)" },
      { code: "ML-MEN", name: "Ménaka", note: "À confirmer (évolution du découpage)" },
    ],
    mobilePayments: [{ name: "À confirmer", note: "À valider (découpage/réformes récentes)." }],
    notes: "Mali : découpage des régions à confirmer (réformes récentes).",
  },
  {
    code: "BF",
    iso2: "BF",
    iso3: "BFA",
    name: "Burkina Faso",
    nameFr: "Burkina Faso",
    flagUrl: "https://flagcdn.com/w20/bf.png",
    phoneCode: "+226",
    currency: "XOF",
    currencyLabel: "FCFA",
    regions: [
      { code: "BF-01", name: "Boucle du Mouhoun", note: "À confirmer (réorganisation éventuelle)" },
      { code: "BF-02", name: "Cascades", note: "À confirmer" },
      { code: "BF-03", name: "Centre", note: "À confirmer" },
      { code: "BF-04", name: "Centre-Est", note: "À confirmer" },
      { code: "BF-05", name: "Centre-Nord", note: "À confirmer" },
      { code: "BF-06", name: "Centre-Ouest", note: "À confirmer" },
      { code: "BF-07", name: "Centre-Sud", note: "À confirmer" },
      { code: "BF-08", name: "Est", note: "À confirmer" },
      { code: "BF-09", name: "Hauts-Bassins", note: "À confirmer" },
      { code: "BF-10", name: "Nord", note: "À confirmer" },
      { code: "BF-11", name: "Plateau-Central", note: "À confirmer" },
      { code: "BF-12", name: "Sahel", note: "À confirmer" },
      { code: "BF-13", name: "Sud-Ouest", note: "À confirmer" },
    ],
    mobilePayments: [{ name: "À confirmer", note: "À valider (réformes récentes)." }],
    notes: "Burkina Faso : découpage des régions à confirmer (réformes récentes).",
  },
  {
    code: "NE",
    iso2: "NE",
    iso3: "NER",
    name: "Niger",
    nameFr: "Niger",
    flagUrl: "https://flagcdn.com/w20/ne.png",
    phoneCode: "+227",
    currency: "XOF",
    currencyLabel: "FCFA",
    regions: [
      { code: "NE-AG", name: "Agadez" },
      { code: "NE-DI", name: "Diffa" },
      { code: "NE-DO", name: "Dosso" },
      { code: "NE-MA", name: "Maradi" },
      { code: "NE-NI", name: "Niamey" },
      { code: "NE-TA", name: "Tahoua" },
      { code: "NE-TI", name: "Tillabéri" },
      { code: "NE-ZI", name: "Zinder" },
    ],
    mobilePayments: [{ name: "À confirmer", note: "Moyens de paiement mobiles à confirmer." }],
  },
  {
    code: "GN",
    iso2: "GN",
    iso3: "GIN",
    name: "Guinea",
    nameFr: "Guinée",
    flagUrl: "https://flagcdn.com/w20/gn.png",
    phoneCode: "+224",
    currency: "GNF",
    currencyLabel: "GNF",
    regions: [
      { code: "GN-B", name: "Boké" },
      { code: "GN-C", name: "Conakry" },
      { code: "GN-F", name: "Faranah" },
      { code: "GN-K", name: "Kankan" },
      { code: "GN-D", name: "Kindia" },
      { code: "GN-L", name: "Labé" },
      { code: "GN-M", name: "Mamou" },
      { code: "GN-N", name: "Nzérékoré" },
    ],
    mobilePayments: [{ name: "À confirmer", note: "Moyens de paiement mobiles à confirmer." }],
    notes: "Guinée : devise GNF (taux configurable, non figé).",
  },
  {
    code: "BJ",
    iso2: "BJ",
    iso3: "BEN",
    name: "Benin",
    nameFr: "Bénin",
    flagUrl: "https://flagcdn.com/w20/bj.png",
    phoneCode: "+229",
    currency: "XOF",
    currencyLabel: "FCFA",
    regions: [
      { code: "BJ-AL", name: "Alibori" },
      { code: "BJ-AK", name: "Atacora" },
      { code: "BJ-AQ", name: "Atlantique" },
      { code: "BJ-BO", name: "Borgou" },
      { code: "BJ-CO", name: "Collines" },
      { code: "BJ-KO", name: "Couffo" },
      { code: "BJ-DO", name: "Donga" },
      { code: "BJ-LI", name: "Littoral" },
      { code: "BJ-MO", name: "Mono" },
      { code: "BJ-OU", name: "Ouémé" },
      { code: "BJ-PL", name: "Plateau" },
      { code: "BJ-ZO", name: "Zou" },
    ],
    mobilePayments: [{ name: "À confirmer", note: "Moyens de paiement mobiles à confirmer." }],
  },
  {
    code: "TG",
    iso2: "TG",
    iso3: "TGO",
    name: "Togo",
    nameFr: "Togo",
    flagUrl: "https://flagcdn.com/w20/tg.png",
    phoneCode: "+228",
    currency: "XOF",
    currencyLabel: "FCFA",
    regions: [
      { code: "TG-C", name: "Centrale" },
      { code: "TG-K", name: "Kara" },
      { code: "TG-M", name: "Maritime" },
      { code: "TG-P", name: "Plateaux" },
      { code: "TG-S", name: "Savanes" },
    ],
    mobilePayments: [{ name: "À confirmer", note: "Moyens de paiement mobiles à confirmer." }],
  },
]

export const UEMOA_COUNTRY_CODES = COUNTRIES.map((c) => c.code)

export function getCountryByCode(code: CountryCode | string | null | undefined): Country | undefined {
  if (!code) return undefined
  return COUNTRIES.find((c) => c.code === code || c.iso2 === code || c.iso3 === code)
}

export function getRegionsByCountry(code: CountryCode | string | null | undefined): Region[] {
  const country = getCountryByCode(code)
  return country?.regions ?? []
}

export function getFlagUrl(code: CountryCode | string | null | undefined, size: 16 | 20 | 24 | 32 | 48 = 20): string {
  const country = getCountryByCode(code)
  if (country) return country.flagUrl.replace("/w20/", "/w" + size + "/")
  if (code) return "https://flagcdn.com/w" + size + "/" + String(code).toLowerCase() + ".png"
  return "https://flagcdn.com/w" + size + "/xx.png"
}
