export type CountryCode = string

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
  currency: string
  currencyLabel: string
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
      { code: "SN-KF", name: "Kaffrine" },
      { code: "SN-KA", name: "Kaolack" },
      { code: "SN-KO", name: "Kolda" },
      { code: "SN-LG", name: "Louga" },
      { code: "SN-MT", name: "Matam" },
      { code: "SN-SL", name: "Saint-Louis" },
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
    code: "GW",
    iso2: "GW",
    iso3: "GNB",
    name: "Guinea-Bissau",
    nameFr: "Guinée-Bissau",
    flagUrl: "https://flagcdn.com/w20/gw.png",
    phoneCode: "+245",
    currency: "XOF",
    currencyLabel: "FCFA",
    regions: [
      { code: "GW-BA", name: "Bafatá" },
      { code: "GW-BM", name: "Biombo" },
      { code: "GW-BS", name: "Bissau" },
      { code: "GW-BL", name: "Bolama" },
      { code: "GW-CA", name: "Cacheu" },
      { code: "GW-GA", name: "Gabú" },
      { code: "GW-OI", name: "Oio" },
      { code: "GW-QU", name: "Quinara" },
      { code: "GW-TO", name: "Tombali" },
    ],
    mobilePayments: [{ name: "à confirmer", note: "Moyens de paiement mobiles à confirmer." }],
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
  {
    code: "ZA",
    iso2: "ZA",
    iso3: "ZAF",
    name: "South Africa",
    nameFr: "Afrique du Sud",
    flagUrl: "https://flagcdn.com/w20/za.png",
    phoneCode: "+27",
    currency: "ZAR",
    currencyLabel: "ZAR",
    regions: [
      { code: "ZA-01", name: "Pretoria" },
      { code: "ZA-02", name: "Johannesburg" },
      { code: "ZA-03", name: "Le Cap" },
      { code: "ZA-04", name: "Durban" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "DZ",
    iso2: "DZ",
    iso3: "DZA",
    name: "Algeria",
    nameFr: "Algérie",
    flagUrl: "https://flagcdn.com/w20/dz.png",
    phoneCode: "+213",
    currency: "DZD",
    currencyLabel: "DZD",
    regions: [
      { code: "DZ-01", name: "Alger" },
      { code: "DZ-02", name: "Oran" },
      { code: "DZ-03", name: "Constantine" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "AO",
    iso2: "AO",
    iso3: "AGO",
    name: "Angola",
    nameFr: "Angola",
    flagUrl: "https://flagcdn.com/w20/ao.png",
    phoneCode: "+244",
    currency: "AOA",
    currencyLabel: "AOA",
    regions: [
      { code: "AO-01", name: "Luanda" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "BW",
    iso2: "BW",
    iso3: "BWA",
    name: "Botswana",
    nameFr: "Botswana",
    flagUrl: "https://flagcdn.com/w20/bw.png",
    phoneCode: "+267",
    currency: "BWP",
    currencyLabel: "BWP",
    regions: [
      { code: "BW-01", name: "Gaborone" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "BI",
    iso2: "BI",
    iso3: "BDI",
    name: "Burundi",
    nameFr: "Burundi",
    flagUrl: "https://flagcdn.com/w20/bi.png",
    phoneCode: "+257",
    currency: "BIF",
    currencyLabel: "BIF",
    regions: [
      { code: "BI-01", name: "Gitega" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "CM",
    iso2: "CM",
    iso3: "CMR",
    name: "Cameroon",
    nameFr: "Cameroun",
    flagUrl: "https://flagcdn.com/w20/cm.png",
    phoneCode: "+237",
    currency: "XAF",
    currencyLabel: "FCFA",
    regions: [
      { code: "CM-01", name: "Yaoundé" },
      { code: "CM-02", name: "Douala" },
      { code: "CM-03", name: "Bamenda" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "CV",
    iso2: "CV",
    iso3: "CPV",
    name: "Cape Verde",
    nameFr: "Cap-Vert",
    flagUrl: "https://flagcdn.com/w20/cv.png",
    phoneCode: "+238",
    currency: "CVE",
    currencyLabel: "CVE",
    regions: [
      { code: "CV-01", name: "Praia" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "KM",
    iso2: "KM",
    iso3: "COM",
    name: "Comores",
    nameFr: "Comores",
    flagUrl: "https://flagcdn.com/w20/km.png",
    phoneCode: "+269",
    currency: "KMF",
    currencyLabel: "KMF",
    regions: [
      { code: "KM-01", name: "Moroni" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "DJ",
    iso2: "DJ",
    iso3: "DJI",
    name: "Djibouti",
    nameFr: "Djibouti",
    flagUrl: "https://flagcdn.com/w20/dj.png",
    phoneCode: "+253",
    currency: "DJF",
    currencyLabel: "DJF",
    regions: [
      { code: "DJ-01", name: "Djibouti" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "EG",
    iso2: "EG",
    iso3: "EGY",
    name: "Egypt",
    nameFr: "Égypte",
    flagUrl: "https://flagcdn.com/w20/eg.png",
    phoneCode: "+20",
    currency: "EGP",
    currencyLabel: "EGP",
    regions: [
      { code: "EG-01", name: "Le Caire" },
      { code: "EG-02", name: "Alexandrie" },
      { code: "EG-03", name: "Gizeh" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "ER",
    iso2: "ER",
    iso3: "ERI",
    name: "Eritrea",
    nameFr: "Érythrée",
    flagUrl: "https://flagcdn.com/w20/er.png",
    phoneCode: "+291",
    currency: "ERN",
    currencyLabel: "ERN",
    regions: [
      { code: "ER-01", name: "Asmara" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "SZ",
    iso2: "SZ",
    iso3: "SWZ",
    name: "Eswatini",
    nameFr: "Eswatini",
    flagUrl: "https://flagcdn.com/w20/sz.png",
    phoneCode: "+268",
    currency: "SZL",
    currencyLabel: "SZL",
    regions: [
      { code: "SZ-01", name: "Mbabane" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "ET",
    iso2: "ET",
    iso3: "ETH",
    name: "Ethiopia",
    nameFr: "Éthiopie",
    flagUrl: "https://flagcdn.com/w20/et.png",
    phoneCode: "+251",
    currency: "ETB",
    currencyLabel: "ETB",
    regions: [
      { code: "ET-01", name: "Addis-Abeba" },
      { code: "ET-02", name: "Dire Dawa" },
      { code: "ET-03", name: "Mekelle" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "GA",
    iso2: "GA",
    iso3: "GAB",
    name: "Gabon",
    nameFr: "Gabon",
    flagUrl: "https://flagcdn.com/w20/ga.png",
    phoneCode: "+241",
    currency: "XAF",
    currencyLabel: "FCFA",
    regions: [
      { code: "GA-01", name: "Libreville" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "GM",
    iso2: "GM",
    iso3: "GMB",
    name: "Gambia",
    nameFr: "Gambie",
    flagUrl: "https://flagcdn.com/w20/gm.png",
    phoneCode: "+220",
    currency: "GMD",
    currencyLabel: "GMD",
    regions: [
      { code: "GM-01", name: "Banjul" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "GH",
    iso2: "GH",
    iso3: "GHA",
    name: "Ghana",
    nameFr: "Ghana",
    flagUrl: "https://flagcdn.com/w20/gh.png",
    phoneCode: "+233",
    currency: "GHS",
    currencyLabel: "GHS",
    regions: [
      { code: "GH-01", name: "Accra" },
      { code: "GH-02", name: "Kumasi" },
      { code: "GH-03", name: "Tamale" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "GQ",
    iso2: "GQ",
    iso3: "GNQ",
    name: "Equatorial Guinea",
    nameFr: "Guinée équatoriale",
    flagUrl: "https://flagcdn.com/w20/gq.png",
    phoneCode: "+240",
    currency: "XAF",
    currencyLabel: "FCFA",
    regions: [
      { code: "GQ-01", name: "Malabo" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "KE",
    iso2: "KE",
    iso3: "KEN",
    name: "Kenya",
    nameFr: "Kenya",
    flagUrl: "https://flagcdn.com/w20/ke.png",
    phoneCode: "+254",
    currency: "KES",
    currencyLabel: "KES",
    regions: [
      { code: "KE-01", name: "Nairobi" },
      { code: "KE-02", name: "Mombasa" },
      { code: "KE-03", name: "Kisumu" },
      { code: "KE-04", name: "Nakuru" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "LS",
    iso2: "LS",
    iso3: "LSO",
    name: "Lesotho",
    nameFr: "Lesotho",
    flagUrl: "https://flagcdn.com/w20/ls.png",
    phoneCode: "+266",
    currency: "LSL",
    currencyLabel: "LSL",
    regions: [
      { code: "LS-01", name: "Maseru" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "LR",
    iso2: "LR",
    iso3: "LBR",
    name: "Liberia",
    nameFr: "Libéria",
    flagUrl: "https://flagcdn.com/w20/lr.png",
    phoneCode: "+231",
    currency: "LRD",
    currencyLabel: "LRD",
    regions: [
      { code: "LR-01", name: "Monrovia" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "LY",
    iso2: "LY",
    iso3: "LBY",
    name: "Libya",
    nameFr: "Libye",
    flagUrl: "https://flagcdn.com/w20/ly.png",
    phoneCode: "+218",
    currency: "LYD",
    currencyLabel: "LYD",
    regions: [
      { code: "LY-01", name: "Tripoli" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "MG",
    iso2: "MG",
    iso3: "MDG",
    name: "Madagascar",
    nameFr: "Madagascar",
    flagUrl: "https://flagcdn.com/w20/mg.png",
    phoneCode: "+261",
    currency: "MGA",
    currencyLabel: "MGA",
    regions: [
      { code: "MG-01", name: "Antananarivo" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "MW",
    iso2: "MW",
    iso3: "MWI",
    name: "Malawi",
    nameFr: "Malawi",
    flagUrl: "https://flagcdn.com/w20/mw.png",
    phoneCode: "+265",
    currency: "MWK",
    currencyLabel: "MWK",
    regions: [
      { code: "MW-01", name: "Lilongwe" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "MA",
    iso2: "MA",
    iso3: "MAR",
    name: "Morocco",
    nameFr: "Maroc",
    flagUrl: "https://flagcdn.com/w20/ma.png",
    phoneCode: "+212",
    currency: "MAD",
    currencyLabel: "MAD",
    regions: [
      { code: "MA-01", name: "Rabat" },
      { code: "MA-02", name: "Casablanca" },
      { code: "MA-03", name: "Marrakech" },
      { code: "MA-04", name: "Fès" },
      { code: "MA-05", name: "Tanger" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "MU",
    iso2: "MU",
    iso3: "MUS",
    name: "Mauritius",
    nameFr: "Maurice",
    flagUrl: "https://flagcdn.com/w20/mu.png",
    phoneCode: "+230",
    currency: "MUR",
    currencyLabel: "MUR",
    regions: [
      { code: "MU-01", name: "Port-Louis" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "MR",
    iso2: "MR",
    iso3: "MRT",
    name: "Mauritania",
    nameFr: "Mauritanie",
    flagUrl: "https://flagcdn.com/w20/mr.png",
    phoneCode: "+222",
    currency: "MRU",
    currencyLabel: "MRU",
    regions: [
      { code: "MR-01", name: "Nouakchott" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "MZ",
    iso2: "MZ",
    iso3: "MOZ",
    name: "Mozambique",
    nameFr: "Mozambique",
    flagUrl: "https://flagcdn.com/w20/mz.png",
    phoneCode: "+258",
    currency: "MZN",
    currencyLabel: "MZN",
    regions: [
      { code: "MZ-01", name: "Maputo" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "NA",
    iso2: "NA",
    iso3: "NAM",
    name: "Namibia",
    nameFr: "Namibie",
    flagUrl: "https://flagcdn.com/w20/na.png",
    phoneCode: "+264",
    currency: "NAD",
    currencyLabel: "NAD",
    regions: [
      { code: "NA-01", name: "Windhoek" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "NG",
    iso2: "NG",
    iso3: "NGA",
    name: "Nigeria",
    nameFr: "Nigéria",
    flagUrl: "https://flagcdn.com/w20/ng.png",
    phoneCode: "+234",
    currency: "NGN",
    currencyLabel: "NGN",
    regions: [
      { code: "NG-01", name: "Abuja" },
      { code: "NG-02", name: "Lagos" },
      { code: "NG-03", name: "Kano" },
      { code: "NG-04", name: "Ibadan" },
      { code: "NG-05", name: "Port Harcourt" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "UG",
    iso2: "UG",
    iso3: "UGA",
    name: "Uganda",
    nameFr: "Ouganda",
    flagUrl: "https://flagcdn.com/w20/ug.png",
    phoneCode: "+256",
    currency: "UGX",
    currencyLabel: "UGX",
    regions: [
      { code: "UG-01", name: "Kampala" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "CF",
    iso2: "CF",
    iso3: "CAF",
    name: "Central African Republic",
    nameFr: "République centrafricaine",
    flagUrl: "https://flagcdn.com/w20/cf.png",
    phoneCode: "+236",
    currency: "XAF",
    currencyLabel: "FCFA",
    regions: [
      { code: "CF-01", name: "Bangui" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "CD",
    iso2: "CD",
    iso3: "COD",
    name: "Democratic Republic of the Congo",
    nameFr: "République démocratique du Congo",
    flagUrl: "https://flagcdn.com/w20/cd.png",
    phoneCode: "+243",
    currency: "CDF",
    currencyLabel: "CDF",
    regions: [
      { code: "CD-01", name: "Kinshasa" },
      { code: "CD-02", name: "Lubumbashi" },
      { code: "CD-03", name: "Goma" },
      { code: "CD-04", name: "Kisangani" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "CG",
    iso2: "CG",
    iso3: "COG",
    name: "Congo",
    nameFr: "République du Congo",
    flagUrl: "https://flagcdn.com/w20/cg.png",
    phoneCode: "+242",
    currency: "XAF",
    currencyLabel: "FCFA",
    regions: [
      { code: "CG-01", name: "Brazzaville" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "RW",
    iso2: "RW",
    iso3: "RWA",
    name: "Rwanda",
    nameFr: "Rwanda",
    flagUrl: "https://flagcdn.com/w20/rw.png",
    phoneCode: "+250",
    currency: "RWF",
    currencyLabel: "RWF",
    regions: [
      { code: "RW-01", name: "Kigali" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "ST",
    iso2: "ST",
    iso3: "STP",
    name: "São Tomé and Príncipe",
    nameFr: "São Tomé-et-Príncipe",
    flagUrl: "https://flagcdn.com/w20/st.png",
    phoneCode: "+239",
    currency: "STN",
    currencyLabel: "STN",
    regions: [
      { code: "ST-01", name: "São Tomé" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "SC",
    iso2: "SC",
    iso3: "SYC",
    name: "Seychelles",
    nameFr: "Seychelles",
    flagUrl: "https://flagcdn.com/w20/sc.png",
    phoneCode: "+248",
    currency: "SCR",
    currencyLabel: "SCR",
    regions: [
      { code: "SC-01", name: "Victoria" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "SL",
    iso2: "SL",
    iso3: "SLE",
    name: "Sierra Leone",
    nameFr: "Sierra Leone",
    flagUrl: "https://flagcdn.com/w20/sl.png",
    phoneCode: "+232",
    currency: "SLE",
    currencyLabel: "SLE",
    regions: [
      { code: "SL-01", name: "Freetown" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "SO",
    iso2: "SO",
    iso3: "SOM",
    name: "Somalia",
    nameFr: "Somalie",
    flagUrl: "https://flagcdn.com/w20/so.png",
    phoneCode: "+252",
    currency: "SOS",
    currencyLabel: "SOS",
    regions: [
      { code: "SO-01", name: "Mogadiscio" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "SD",
    iso2: "SD",
    iso3: "SDN",
    name: "Sudan",
    nameFr: "Soudan",
    flagUrl: "https://flagcdn.com/w20/sd.png",
    phoneCode: "+249",
    currency: "SDG",
    currencyLabel: "SDG",
    regions: [
      { code: "SD-01", name: "Khartoum" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "SS",
    iso2: "SS",
    iso3: "SSD",
    name: "South Sudan",
    nameFr: "Soudan du Sud",
    flagUrl: "https://flagcdn.com/w20/ss.png",
    phoneCode: "+211",
    currency: "SSP",
    currencyLabel: "SSP",
    regions: [
      { code: "SS-01", name: "Juba" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "TZ",
    iso2: "TZ",
    iso3: "TZA",
    name: "Tanzania",
    nameFr: "Tanzanie",
    flagUrl: "https://flagcdn.com/w20/tz.png",
    phoneCode: "+255",
    currency: "TZS",
    currencyLabel: "TZS",
    regions: [
      { code: "TZ-01", name: "Dodoma" },
      { code: "TZ-02", name: "Dar es Salaam" },
      { code: "TZ-03", name: "Mwanza" },
      { code: "TZ-04", name: "Arusha" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "TD",
    iso2: "TD",
    iso3: "TCD",
    name: "Chad",
    nameFr: "Tchad",
    flagUrl: "https://flagcdn.com/w20/td.png",
    phoneCode: "+235",
    currency: "XAF",
    currencyLabel: "FCFA",
    regions: [
      { code: "TD-01", name: "N'Djamena" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "TN",
    iso2: "TN",
    iso3: "TUN",
    name: "Tunisia",
    nameFr: "Tunisie",
    flagUrl: "https://flagcdn.com/w20/tn.png",
    phoneCode: "+216",
    currency: "TND",
    currencyLabel: "TND",
    regions: [
      { code: "TN-01", name: "Tunis" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "ZM",
    iso2: "ZM",
    iso3: "ZMB",
    name: "Zambia",
    nameFr: "Zambie",
    flagUrl: "https://flagcdn.com/w20/zm.png",
    phoneCode: "+260",
    currency: "ZMW",
    currencyLabel: "ZMW",
    regions: [
      { code: "ZM-01", name: "Lusaka" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
  {
    code: "ZW",
    iso2: "ZW",
    iso3: "ZWE",
    name: "Zimbabwe",
    nameFr: "Zimbabwe",
    flagUrl: "https://flagcdn.com/w20/zw.png",
    phoneCode: "+263",
    currency: "ZWL",
    currencyLabel: "ZWL",
    regions: [
      { code: "ZW-01", name: "Harare" }
    ],
    mobilePayments: [{"name":"À confirmer","note":"Moyens de paiement mobiles à confirmer."}],
  },
]

// Bassin de diffusion : Afrique de l'Ouest francophone.
// NB : ne pas employer « UEMOA » : certains de ces pays n'y appartiennent
// pas (Guinée, Guinée-Bissau est bien membre mais lusophone, etc.).
export const SCOPE_COUNTRY_CODES = COUNTRIES.map((c) => c.code)

export function getCountryByCode(code: CountryCode | string | null | undefined): Country | undefined {
  if (!code) return undefined
  return COUNTRIES.find((c) => c.code === code || c.iso2 === code || c.iso3 === code)
}

export function getRegionsByCountry(code: CountryCode | string | null | undefined): Region[] {
  const country = getCountryByCode(code)
  return country?.regions ?? []
}

// flagcdn ne publie que des largeurs « × 20 » (20, 40, 80, 160, 320, …) :
// toute autre largeur renvoie un 404 (constaté sur w16/w24/w32/w48, y compris
// avec un User-Agent navigateur). On arrondit donc la taille demandée vers le
// HAUT sur une largeur publiée, pour ne jamais perdre en netteté — Next/Image
// met l'image à l'échelle CSS demandée.
const FLAGCDN_WIDTHS = [20, 40, 80, 160, 320, 640, 1280] as const

function snapFlagWidth(size: number): number {
  for (const w of FLAGCDN_WIDTHS) if (w >= size) return w
  return FLAGCDN_WIDTHS[FLAGCDN_WIDTHS.length - 1]
}

export function getFlagUrl(code: CountryCode | string | null | undefined, size: 16 | 20 | 24 | 32 | 48 = 20): string {
  const w = snapFlagWidth(size)
  const country = getCountryByCode(code)
  if (country) return country.flagUrl.replace(/\/w\d+\//, `/w${w}/`)
  if (code) return `https://flagcdn.com/w${w}/${String(code).toLowerCase()}.png`
  // « xx.png » n'existe pas chez flagcdn (404) : « un.png » est le
  // drapeau neutre réellement servi.
  return `https://flagcdn.com/w${w}/un.png`
}

// ---------------------------------------------------------------------------
// Régions du périmètre (9 pays, 93 régions).
//
// Le champ `client_city` / `city` stocke le NOM d'une région du référentiel.
// Le pays n'est pas une colonne dédiée : il est dérivé côté app par
// `lib/geography.ts` (countryCodeForPlace). Seul « Savanes » est ambigu
// (existe en CI et TG) — acceptable pour l'instant, sans migration DB.
// ---------------------------------------------------------------------------

/** Tous les noms de régions du périmètre, triés, doublons éliminés. */
export const ALL_REGION_NAMES: string[] = Array.from(
  new Set(COUNTRIES.flatMap((c) => c.regions.map((r) => r.name)))
).sort((a, b) => a.localeCompare(b, "fr"))

const REGION_NAME_SET = new Set(ALL_REGION_NAMES.map((n) => n.toLowerCase()))

/** Vrai si `name` est une région connue du périmètre (insensible à la casse). */
export function isKnownRegion(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase()
  return n.length > 0 && REGION_NAME_SET.has(n)
}

/** Map valeur→libellé pour la prop `items` des `Select` (base-ui). */
export const ALL_REGION_ITEMS: Record<string, string> = Object.fromEntries(
  ALL_REGION_NAMES.map((n) => [n, n])
)
