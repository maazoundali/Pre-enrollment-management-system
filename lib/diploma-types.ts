// lib/diploma-types.ts
// Shared definition of diploma types, subtypes, and their dynamic fields.
// Used both in the student form UI and server-side validation.

export interface FieldDef {
  key:      string
  labelKey: string     // i18n key under student.dossierNew.step2.diplomaFields.*
  type:     "grade" | "text" | "mention"
  required: boolean
}

export interface SubType {
  key:      string
  labelKey: string     // i18n key
  fields:   FieldDef[]
}

export interface DiplomaType {
  key:      string
  labelKey: string     // i18n key
  subtypes: SubType[] | null   // null = no subtype selector
  fields:   FieldDef[]         // fields shown when no subtype (or for all subtypes)
}

const GRADE = (key: string, labelKey: string, required = false): FieldDef =>
  ({ key, labelKey, type: "grade", required })

const TEXT = (key: string, labelKey: string, required = false): FieldDef =>
  ({ key, labelKey, type: "text", required })

const MENTION = (): FieldDef =>
  ({ key: "mention", labelKey: "mention", type: "mention", required: false })

export const DIPLOMA_TYPES: DiplomaType[] = [
  {
    key: "BAC", labelKey: "bac",
    subtypes: [
      {
        // Sciences, Maths, Technique, Informatique all share the same key subjects
        key: "SCIENTIFIQUE", labelKey: "bacScientifique",
        fields: [
          GRADE("math",            "math",         true),
          GRADE("physique",        "physique",      true),
          GRADE("francais",        "francais"),
          GRADE("anglais",         "anglais"),
          GRADE("informatique",    "informatique"),
          GRADE("moyenneGenerale", "moyenne",       true),
        ],
      },
      {
        key: "MATHS_INFO", labelKey: "bacMathsInfo",
        fields: [
          GRADE("math",            "math",         true),
          GRADE("physique",        "physique",      true),
          GRADE("informatique",    "informatique",  true),
          GRADE("francais",        "francais"),
          GRADE("anglais",         "anglais"),
          GRADE("moyenneGenerale", "moyenne",       true),
        ],
      },
      {
        key: "TECHNIQUE", labelKey: "bacTechnique",
        fields: [
          GRADE("math",            "math",         true),
          GRADE("physique",        "physique",      true),
          GRADE("francais",        "francais"),
          GRADE("anglais",         "anglais"),
          GRADE("informatique",    "informatique"),
          GRADE("moyenneGenerale", "moyenne",       true),
        ],
      },
      {
        key: "LETTRES", labelKey: "bacLettres",
        fields: [
          GRADE("arabe",        "arabe",    true),
          GRADE("francais",     "francais",  true),
          GRADE("philosophie",  "philosophie"),
          GRADE("histoire_geo", "histoireGeo"),
          GRADE("anglais",      "anglais"),
          GRADE("moyenneGenerale", "moyenne", true),
        ],
      },
      {
        key: "ECONOMIE", labelKey: "bacEconomie",
        fields: [
          GRADE("math",            "math",         true),
          GRADE("gestion",         "gestion",       true),
          GRADE("informatique",    "informatique"),
          GRADE("francais",        "francais"),
          GRADE("anglais",         "anglais"),
          GRADE("moyenneGenerale", "moyenne",       true),
        ],
      },
      {
        key: "SPORT", labelKey: "bacSport",
        fields: [
          GRADE("sport",    "sport",    true),
          GRADE("sciences", "sciences"),
          GRADE("arabe",    "arabe"),
          GRADE("moyenneGenerale", "moyenne", true),
        ],
      },
    ],
    fields: [],
  },
  {
    key: "LICENCE", labelKey: "licence",
    subtypes: null,
    fields: [
      TEXT("specialite",      "specialite",      true),
      TEXT("etablissement",   "etablissement"),
      GRADE("moyenneGenerale","moyenneGenerale",  true),
      MENTION(),
    ],
  },
  {
    key: "MASTER", labelKey: "master",
    subtypes: null,
    fields: [
      TEXT("specialite",      "specialite",      true),
      TEXT("etablissement",   "etablissement"),
      GRADE("moyenneGenerale","moyenneGenerale",  true),
      MENTION(),
    ],
  },
  {
    key: "DOCTORAT", labelKey: "doctorat",
    subtypes: null,
    fields: [
      TEXT("specialite",    "specialite",    true),
      TEXT("etablissement", "etablissement"),
    ],
  },
  {
    key: "BTS", labelKey: "bts",
    subtypes: null,
    fields: [
      TEXT("specialite",    "specialite",    true),
      TEXT("etablissement", "etablissement"),
      MENTION(),
    ],
  },
  {
    key: "AUTRE", labelKey: "autre",
    subtypes: null,
    fields: [],
  },
]

export const DIPLOMA_TYPE_MAP = Object.fromEntries(DIPLOMA_TYPES.map((d) => [d.key, d]))

/** Derive a human-readable title from type + sousType for display and PDF */
export function buildDiplomaTitle(
  type: string | null,
  sousType: string | null,
  labels: Record<string, string>
): string {
  if (!type) return ""
  const dt = DIPLOMA_TYPE_MAP[type]
  if (!dt) return type
  const base = labels[dt.labelKey] ?? type
  if (sousType && dt.subtypes) {
    const st = dt.subtypes.find((s) => s.key === sousType)
    if (st) return `${base} — ${labels[st.labelKey] ?? sousType}`
  }
  return base
}
