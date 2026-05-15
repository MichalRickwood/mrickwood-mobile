/**
 * Tendero translations — cs / en / de.
 *
 * Klíče match s logickými sekcemi (Login, Register, Profile, atd.).
 * Pro nové stringy přidej do všech 3 jazyků, jinak fallback na cs.
 */

export type Locale = "cs" | "en" | "de";

export const LOCALES: Locale[] = ["cs", "en", "de"];

export interface Dict {
  brand: {
    tagline: string;
  };
  login: {
    title: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    submit: string;
    submitting: string;
    or: string;
    noAccount: string;
    register: string;
    errorInvalid: string;
    errorAccount: string;
    errorGeneric: string;
    errorNetwork: string;
  };
  register: {
    title: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    consentVopPre: string;
    consentVopLink: string;
    consentVopTail: string;
    consentGdprPre: string;
    consentGdprLink: string;
    consentGdprTail: string;
    submit: string;
    submitting: string;
    haveAccount: string;
    loginLink: string;
    successTitle: string;
    successBody: string;
    successCta: string;
    successCheckBtn: string;
    successCheckBtnLoading: string;
    successNotVerified: string;
    errorDefault: string;
    errorNetwork: string;
  };
  profileComplete: {
    title: string;
    subtitle: string;
    phoneLabel: string;
    phonePlaceholder: string;
    countryLabel: string;
    countryPlaceholder: string;
    icoLabel: string;
    icoPlaceholder: string;
    lookupSearching: string;
    lookupNotFound: string;
    lookupError: string;
    submit: string;
    submitting: string;
    signOut: string;
    error: string;
  };
  matches: {
    title: string;
    counterAll: string;
    counterFilter: string;
    filterAll: string;
    deadline: string;
    emptyTitle: string;
    emptyBody: string;
    errorTitle: string;
    errorBody: string;
  };
  matchDetail: {
    headerLabel: string;
    deadlineLabel: string;
    valueLabel: string;
    publishedLabel: string;
    regionLabel: string;
    cpvLabel: string;
    typeLabel: string;
    filterLabel: string;
    cta: string;
    notFoundTitle: string;
    notFoundBody: string;
    back: string;
  };
  settings: {
    title: string;
    signedInAs: string;
    sectionProfile: string;
    sectionProfileHint: string;
    sectionAccount: string;
    sectionAccountHint: string;
    accountEmail: string;
    accountName: string;
    deleteNote: string;
    signOut: string;
    signOutConfirmTitle: string;
    signOutConfirmBody: string;
    cancel: string;
    confirm: string;
    profileTitle: string;
    accountTitle: string;
    appearancePillSystem: string;
    appearancePillLight: string;
    appearancePillDark: string;
    appearanceTitle: string;
    appearanceMessage: string;
    appearanceSystem: string;
    appearanceLight: string;
    appearanceDark: string;
    appearanceComingSoon: string;
    appearanceComingSoonBody: string;
    companyTitle: string;
    companySubtitle: string;
    companySaveBtn: string;
    companySaveBtnLoading: string;
    companySaving: string;
    companySaved: string;
  };
  oauth: {
    divider: string;
    apple: string;
    google: string;
    github: string;
  };
  locale: {
    cs: string;
    en: string;
    de: string;
  };
}

const cs: Dict = {
  brand: { tagline: "Vyhledávání veřejných zakázek" },
  login: {
    title: "Přihlášení",
    emailLabel: "Email",
    emailPlaceholder: "jan@firma.cz",
    passwordLabel: "Heslo",
    passwordPlaceholder: "Vaše heslo",
    submit: "Přihlásit",
    submitting: "Přihlašuji…",
    or: "nebo",
    noAccount: "Nemáte účet?",
    register: "Zaregistrovat se",
    errorInvalid: "Neplatný email nebo heslo.",
    errorAccount: "Účet není aktivní.",
    errorGeneric: "Přihlášení selhalo.",
    errorNetwork: "Chyba sítě. Zkuste to znovu.",
  },
  register: {
    title: "Vytvořit účet",
    nameLabel: "Jméno",
    namePlaceholder: "Jan Novák",
    emailLabel: "Email",
    emailPlaceholder: "jan@firma.cz",
    passwordLabel: "Heslo (min. 8 znaků)",
    passwordPlaceholder: "Vaše heslo",
    consentVopPre: "Souhlasím s",
    consentVopLink: "obchodními podmínkami",
    consentVopTail: "a potvrzuji, že jednám v rámci podnikatelské činnosti.",
    consentGdprPre: "Souhlasím se",
    consentGdprLink: "zpracováním osobních údajů",
    consentGdprTail: "dle GDPR.",
    submit: "Vytvořit účet",
    submitting: "Registruji…",
    haveAccount: "Máte účet?",
    loginLink: "Přihlásit se",
    successTitle: "Zkontrolujte email",
    successBody:
      "Odeslali jsme ověřovací odkaz na {email}. Klikněte na něj a vraťte se zpět do appky.",
    successCta: "Zpět na přihlášení",
    successCheckBtn: "Mám potvrzeno – přihlásit",
    successCheckBtnLoading: "Přihlašuji…",
    successNotVerified: "Email ještě není potvrzený. Zkontrolujte schránku.",
    errorDefault: "Registrace selhala.",
    errorNetwork: "Chyba sítě. Zkuste to znovu.",
  },
  profileComplete: {
    title: "Dokončete profil",
    subtitle: "Pro plnou funkčnost potřebujeme telefon a IČO firmy. Trvá to chvilku.",
    phoneLabel: "Telefon",
    phonePlaceholder: "777 123 456",
    countryLabel: "Země firmy",
    countryPlaceholder: "Vyberte zemi",
    icoLabel: "IČO / Tax ID firmy",
    icoPlaceholder: "12345678",
    lookupSearching: "Hledám firmu v rejstříku…",
    lookupNotFound: "Firma s tímto IČO/Tax ID nebyla nalezena.",
    lookupError: "Chyba načtení rejstříku: {message}",
    submit: "Pokračovat",
    submitting: "Ukládám…",
    signOut: "Odhlásit a vrátit se na přihlášení",
    error: "Uložení selhalo. Zkuste to znovu.",
  },
  matches: {
    title: "Zakázky",
    counterAll: "Všechny matche · {count}",
    counterFilter: "{filter} · {count}",
    filterAll: "Vše",
    deadline: "Lhůta {date}",
    emptyTitle: "Žádné nové zakázky",
    emptyBody:
      "Jakmile se objeví nová zakázka odpovídající vašim filtrům, uvidíte ji tady.",
    errorTitle: "Nepodařilo se načíst",
    errorBody: "Zkuste pull-to-refresh.",
  },
  matchDetail: {
    headerLabel: "Zakázka",
    deadlineLabel: "Lhůta podání",
    valueLabel: "Předpokládaná hodnota",
    publishedLabel: "Publikováno",
    regionLabel: "Region",
    cpvLabel: "CPV",
    typeLabel: "Druh řízení",
    filterLabel: "Filtr",
    cta: "Otevřít na portálu →",
    notFoundTitle: "Zakázka nenalezena",
    notFoundBody: "Otevřete seznam a zkuste to znovu — možná je třeba pull-to-refresh.",
    back: "Zpět",
  },
  settings: {
    title: "Nastavení",
    signedInAs: "Přihlášen jako",
    sectionProfile: "Firemní údaje",
    sectionProfileHint: "Telefon, IČO, fakturace",
    sectionAccount: "Účet",
    sectionAccountHint: "Odhlásit, smazat účet",
    accountEmail: "Email",
    accountName: "Jméno",
    deleteNote: "Smazání účtu zatím přes web — bude přidáno do appky v další verzi.",
    signOut: "Odhlásit se",
    signOutConfirmTitle: "Odhlásit se",
    signOutConfirmBody: "Opravdu se chcete odhlásit?",
    cancel: "Zrušit",
    confirm: "Odhlásit",
    profileTitle: "Firemní údaje",
    accountTitle: "Účet",
    appearancePillSystem: "AUTO",
    appearancePillLight: "DEN",
    appearancePillDark: "NOC",
    appearanceTitle: "Vzhled",
    appearanceMessage: "Tmavý režim přijde v další verzi appky.",
    appearanceSystem: "Podle systému",
    appearanceLight: "Světlý",
    appearanceDark: "Tmavý",
    appearanceComingSoon: "Vzhled",
    appearanceComingSoonBody: "Tmavý/světlý režim přidáme brzy — pro teď je vše světlé.",
    companyTitle: "Firemní údaje",
    companySubtitle: "Dobrovolné. IČO + telefon umožní plnou aktivaci služeb a fakturaci.",
    companySaveBtn: "Uložit",
    companySaveBtnLoading: "Ukládám…",
    companySaving: "Ukládám…",
    companySaved: "Uloženo",
  },
  oauth: {
    divider: "nebo",
    apple: "Pokračovat přes Apple",
    google: "Pokračovat přes Google",
    github: "Pokračovat přes GitHub",
  },
  locale: { cs: "Čeština", en: "English", de: "Deutsch" },
};

const en: Dict = {
  brand: { tagline: "Public tender search" },
  login: {
    title: "Sign in",
    emailLabel: "Email",
    emailPlaceholder: "you@company.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Your password",
    submit: "Sign in",
    submitting: "Signing in…",
    or: "or",
    noAccount: "No account?",
    register: "Sign up",
    errorInvalid: "Invalid email or password.",
    errorAccount: "Account is not active.",
    errorGeneric: "Sign-in failed.",
    errorNetwork: "Network error. Please try again.",
  },
  register: {
    title: "Create account",
    nameLabel: "Name",
    namePlaceholder: "John Doe",
    emailLabel: "Email",
    emailPlaceholder: "you@company.com",
    passwordLabel: "Password (min. 8 chars)",
    passwordPlaceholder: "Your password",
    consentVopPre: "I agree to the",
    consentVopLink: "Terms of Service",
    consentVopTail: "and confirm I am acting as a business.",
    consentGdprPre: "I agree to the",
    consentGdprLink: "processing of personal data",
    consentGdprTail: "under GDPR.",
    submit: "Create account",
    submitting: "Signing up…",
    haveAccount: "Have an account?",
    loginLink: "Sign in",
    successTitle: "Check your email",
    successBody:
      "We sent a verification link to {email}. Click it, then come back to the app.",
    successCta: "Back to sign in",
    successCheckBtn: "I have confirmed – sign in",
    successCheckBtnLoading: "Signing in…",
    successNotVerified: "Email not verified yet. Check your inbox.",
    errorDefault: "Registration failed.",
    errorNetwork: "Network error. Please try again.",
  },
  profileComplete: {
    title: "Complete your profile",
    subtitle: "We need your phone and company tax ID for full functionality. It only takes a minute.",
    phoneLabel: "Phone",
    phonePlaceholder: "777 123 456",
    countryLabel: "Company country",
    countryPlaceholder: "Select country",
    icoLabel: "Tax ID / Company number",
    icoPlaceholder: "12345678",
    lookupSearching: "Looking up company in registry…",
    lookupNotFound: "No company found with this tax ID.",
    lookupError: "Registry lookup failed: {message}",
    submit: "Continue",
    submitting: "Saving…",
    signOut: "Sign out and return to login",
    error: "Save failed. Please try again.",
  },
  matches: {
    title: "Tenders",
    counterAll: "All matches · {count}",
    counterFilter: "{filter} · {count}",
    filterAll: "All",
    deadline: "Due {date}",
    emptyTitle: "No new tenders",
    emptyBody: "When a new tender matches your filters, you'll see it here.",
    errorTitle: "Could not load",
    errorBody: "Try pull-to-refresh.",
  },
  matchDetail: {
    headerLabel: "Tender",
    deadlineLabel: "Submission deadline",
    valueLabel: "Estimated value",
    publishedLabel: "Published",
    regionLabel: "Region",
    cpvLabel: "CPV",
    typeLabel: "Procedure type",
    filterLabel: "Filter",
    cta: "Open on portal →",
    notFoundTitle: "Tender not found",
    notFoundBody: "Open the list and try again — pull-to-refresh may help.",
    back: "Back",
  },
  settings: {
    title: "Settings",
    signedInAs: "Signed in as",
    sectionProfile: "Company details",
    sectionProfileHint: "Phone, tax ID, billing",
    sectionAccount: "Account",
    sectionAccountHint: "Sign out, delete account",
    accountEmail: "Email",
    accountName: "Name",
    deleteNote: "Account deletion is on the web for now — coming to the app in a later version.",
    signOut: "Sign out",
    signOutConfirmTitle: "Sign out",
    signOutConfirmBody: "Do you really want to sign out?",
    cancel: "Cancel",
    confirm: "Sign out",
    profileTitle: "Company details",
    accountTitle: "Account",
    appearancePillSystem: "AUTO",
    appearancePillLight: "DAY",
    appearancePillDark: "NIGHT",
    appearanceTitle: "Appearance",
    appearanceMessage: "Dark mode is coming in a later version.",
    appearanceSystem: "System",
    appearanceLight: "Light",
    appearanceDark: "Dark",
    appearanceComingSoon: "Appearance",
    appearanceComingSoonBody: "Dark/light mode coming soon — everything is light for now.",
    companyTitle: "Company details",
    companySubtitle: "Optional. Tax ID + phone enable full service activation and billing.",
    companySaveBtn: "Save",
    companySaveBtnLoading: "Saving…",
    companySaving: "Saving…",
    companySaved: "Saved",
  },
  oauth: {
    divider: "or",
    apple: "Continue with Apple",
    google: "Continue with Google",
    github: "Continue with GitHub",
  },
  locale: { cs: "Čeština", en: "English", de: "Deutsch" },
};

const de: Dict = {
  brand: { tagline: "Ausschreibungssuche" },
  login: {
    title: "Anmelden",
    emailLabel: "E-Mail",
    emailPlaceholder: "sie@firma.de",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Ihr Passwort",
    submit: "Anmelden",
    submitting: "Anmelden…",
    or: "oder",
    noAccount: "Kein Konto?",
    register: "Registrieren",
    errorInvalid: "Ungültige E-Mail oder Passwort.",
    errorAccount: "Konto ist nicht aktiv.",
    errorGeneric: "Anmeldung fehlgeschlagen.",
    errorNetwork: "Netzwerkfehler. Bitte erneut versuchen.",
  },
  register: {
    title: "Konto erstellen",
    nameLabel: "Name",
    namePlaceholder: "Max Mustermann",
    emailLabel: "E-Mail",
    emailPlaceholder: "sie@firma.de",
    passwordLabel: "Passwort (min. 8 Zeichen)",
    passwordPlaceholder: "Ihr Passwort",
    consentVopPre: "Ich stimme den",
    consentVopLink: "Geschäftsbedingungen",
    consentVopTail: "zu und bestätige, dass ich gewerblich tätig bin.",
    consentGdprPre: "Ich stimme der",
    consentGdprLink: "Verarbeitung personenbezogener Daten",
    consentGdprTail: "gemäß DSGVO zu.",
    submit: "Konto erstellen",
    submitting: "Registriere…",
    haveAccount: "Bereits ein Konto?",
    loginLink: "Anmelden",
    successTitle: "E-Mail prüfen",
    successBody:
      "Wir haben einen Bestätigungslink an {email} gesendet. Klicken Sie ihn an und kehren Sie zur App zurück.",
    successCta: "Zurück zur Anmeldung",
    successCheckBtn: "Bestätigt – Anmelden",
    successCheckBtnLoading: "Anmelden…",
    successNotVerified: "E-Mail noch nicht bestätigt. Prüfen Sie Ihr Postfach.",
    errorDefault: "Registrierung fehlgeschlagen.",
    errorNetwork: "Netzwerkfehler. Bitte erneut versuchen.",
  },
  profileComplete: {
    title: "Profil vervollständigen",
    subtitle: "Wir benötigen Telefon und Firmen-USt-IdNr. Dauert nur eine Minute.",
    phoneLabel: "Telefon",
    phonePlaceholder: "777 123 456",
    countryLabel: "Firmensitz",
    countryPlaceholder: "Land wählen",
    icoLabel: "USt-IdNr. / Firmennummer",
    icoPlaceholder: "12345678",
    lookupSearching: "Suche Firma im Register…",
    lookupNotFound: "Keine Firma mit dieser USt-IdNr. gefunden.",
    lookupError: "Registerabfrage fehlgeschlagen: {message}",
    submit: "Weiter",
    submitting: "Speichere…",
    signOut: "Abmelden und zurück zur Anmeldung",
    error: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
  },
  matches: {
    title: "Ausschreibungen",
    counterAll: "Alle Treffer · {count}",
    counterFilter: "{filter} · {count}",
    filterAll: "Alle",
    deadline: "Frist {date}",
    emptyTitle: "Keine neuen Ausschreibungen",
    emptyBody:
      "Sobald eine neue Ausschreibung Ihren Filtern entspricht, erscheint sie hier.",
    errorTitle: "Laden fehlgeschlagen",
    errorBody: "Versuchen Sie Pull-to-Refresh.",
  },
  matchDetail: {
    headerLabel: "Ausschreibung",
    deadlineLabel: "Abgabefrist",
    valueLabel: "Geschätzter Wert",
    publishedLabel: "Veröffentlicht",
    regionLabel: "Region",
    cpvLabel: "CPV",
    typeLabel: "Verfahrensart",
    filterLabel: "Filter",
    cta: "Im Portal öffnen →",
    notFoundTitle: "Ausschreibung nicht gefunden",
    notFoundBody:
      "Öffnen Sie die Liste und versuchen Sie es erneut — Pull-to-Refresh kann helfen.",
    back: "Zurück",
  },
  settings: {
    title: "Einstellungen",
    signedInAs: "Angemeldet als",
    sectionProfile: "Firmendaten",
    sectionProfileHint: "Telefon, USt-IdNr., Abrechnung",
    sectionAccount: "Konto",
    sectionAccountHint: "Abmelden, Konto löschen",
    accountEmail: "E-Mail",
    accountName: "Name",
    deleteNote: "Kontolöschung ist derzeit über die Website — kommt in einer späteren App-Version.",
    signOut: "Abmelden",
    signOutConfirmTitle: "Abmelden",
    signOutConfirmBody: "Möchten Sie sich wirklich abmelden?",
    cancel: "Abbrechen",
    confirm: "Abmelden",
    profileTitle: "Firmendaten",
    accountTitle: "Konto",
    appearancePillSystem: "AUTO",
    appearancePillLight: "HELL",
    appearancePillDark: "DUNKEL",
    appearanceTitle: "Aussehen",
    appearanceMessage: "Dunkelmodus kommt in einer späteren Version.",
    appearanceSystem: "System",
    appearanceLight: "Hell",
    appearanceDark: "Dunkel",
    appearanceComingSoon: "Aussehen",
    appearanceComingSoonBody: "Hell/Dunkel-Modus kommt bald — vorerst ist alles hell.",
    companyTitle: "Firmendaten",
    companySubtitle: "Optional. USt-IdNr. + Telefon ermöglichen volle Serviceaktivierung und Abrechnung.",
    companySaveBtn: "Speichern",
    companySaveBtnLoading: "Speichere…",
    companySaving: "Speichere…",
    companySaved: "Gespeichert",
  },
  oauth: {
    divider: "oder",
    apple: "Mit Apple fortfahren",
    google: "Mit Google fortfahren",
    github: "Mit GitHub fortfahren",
  },
  locale: { cs: "Čeština", en: "English", de: "Deutsch" },
};

export const dicts: Record<Locale, Dict> = { cs, en, de };
