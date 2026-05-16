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
    sectionAccount: string;
    sectionAccountHint: string;
    accountEmail: string;
    accountName: string;
    profileBillingEmailLabel: string;
    profileBillingEmailHint: string;
    signOut: string;
    back: string;
    searchPlaceholder: string;
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
    appearanceSystem: string;
    appearanceLight: string;
    appearanceDark: string;
    sectionNotifications: string;
    sectionNotificationsHint: string;
    sectionSecurity: string;
    sectionSecurityHint: string;
    sectionBilling: string;
    sectionBillingHint: string;
    exportTitle: string;
    exportSubtitle: string;
    exportButton: string;
    exporting: string;
    exportError: string;
    exportSentMessage: string;
    deactivateTitle: string;
    deactivateSubtitle: string;
    deactivateButton: string;
    deleteTitle: string;
    deleteSubtitle: string;
    deleteButton: string;
    cancelTitleDeactivate: string;
    cancelTitleDelete: string;
    cancelWarnAccessLost: string;
    cancelWarnSubRunsToEnd: string;
    cancelWarnNoRefund: string;
    cancelWarnDataDeleted: string;
    cancelWarnAccountingKept: string;
    cancelWarnDataKept: string;
    cancelIntentDeactivate: string;
    cancelIntentDelete: string;
    cancelSendCode: string;
    cancelSending: string;
    cancelEmailSent: string;
    cancelEmailSentBody: string;
    cancelCodeLabel: string;
    cancelCodePlaceholder: string;
    cancelConfirm: string;
    cancelConfirming: string;
    cancelResend: string;
    cancelDoneDeactivate: string;
    cancelDoneDelete: string;
    cancelErrorGeneric: string;
    billingTitle: string;
    billingPlanLabel: string;
    billingStateLabel: string;
    billingCycleLabel: string;
    billingTrialEndsLabel: string;
    billingPaidUntilLabel: string;
    billingPlanFree: string;
    billingPlanPaid: string;
    billingStateTrial: string;
    billingStateActive: string;
    billingStatePastDue: string;
    billingStateSuspended: string;
    billingStateCanceled: string;
    billingCycleMonthly: string;
    billingCycleYearly: string;
    billingCancelNotice: string;
    billingManageOnWeb: string;
    billingManageOnWebHint: string;
    billingUpgradeCta: string;
    billingNotSet: string;
    billingProfileSection: string;
    billingProfileCompany: string;
    billingProfileManualToggle: string;
    billingProfileName: string;
    billingProfileIco: string;
    billingProfileDic: string;
    billingProfileAddress: string;
    billingProfileEmail: string;
    billingModeSection: string;
    billingModeCard: string;
    billingModeInvoice: string;
    billingCycleSection: string;
    billingCardSection: string;
    billingCardConnect: string;
    billingCardConnecting: string;
    billingCardDisconnect: string;
    billingCardExp: string;
    billingProformaSection: string;
    billingProformaGenerate: string;
    billingProformaGenerating: string;
    billingProformaRegenerate: string;
    billingProformaDelete: string;
    billingProformaActive: string;
    billingProformaConfirmDelete: string;
    billingProformaConfirmRegenerate: string;
    billingInvoicesSection: string;
    billingInvoicesEmpty: string;
    billingInvoicesOpenPdf: string;
    billingInvoicesOpening: string;
    billingInvoicesKindProforma: string;
    billingInvoicesKindTax: string;
    billingServicesSection: string;
    billingServicesEmpty: string;
    billingServiceCancel: string;
    billingServiceReactivate: string;
    billingServiceCanceled: string;
    billingServiceTrialEnds: string;
    billingServicePaidUntil: string;
    billingCheckoutOpening: string;
    billingCheckoutFailed: string;
    billingDeepLinkSuccess: string;
    billingDeepLinkCancel: string;
    billingSavingProfile: string;
    billingProfileSavedToast: string;
    billingSaveFailed: string;
    serviceLeads: string;
    servicePricing: string;
    serviceProcurement: string;
    serviceManagement: string;
    securityTitle: string;
    passwordTitleChange: string;
    passwordTitleSet: string;
    passwordSubtitleSet: string;
    currentPasswordLabel: string;
    newPasswordLabel: string;
    newPasswordAgainLabel: string;
    passwordMinLengthError: string;
    passwordMismatchError: string;
    passwordSubmit: string;
    passwordSubmitting: string;
    passwordSavedToast: string;
    revokeAllTitle: string;
    revokeAllSubtitle: string;
    revokeAllBtn: string;
    revokeAllConfirmTitle: string;
    revokeAllConfirmBody: string;
    revokeAllSuccess: string;
    notificationsTitle: string;
    pushTitle: string;
    pushLabel: string;
    pushDesc: string;
    pushPermissionDenied: string;
    pushNotSupported: string;
    pushNeedBuild: string;
    emailTitle: string;
    digestLabel: string;
    digestDesc: string;
    educationalLabel: string;
    educationalDesc: string;
    marketingLabel: string;
    marketingDesc: string;
    marketingPayingNote: string;
    loadFailed: string;
    saveFailed: string;
    saved: string;
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
    sectionAccount: "Účet",
    sectionAccountHint: "Odhlášení, export dat, smazání účtu",
    accountEmail: "Email",
    accountName: "Jméno",
    profileBillingEmailLabel: "Fakturační email",
    profileBillingEmailHint: "Pokud se liší od přihlašovacího emailu, doklady posíláme na oba.",
    signOut: "Odhlásit se",
    back: "Zpět",
    searchPlaceholder: "Hledat…",
    signOutConfirmTitle: "Odhlásit se",
    signOutConfirmBody: "Opravdu se chcete odhlásit?",
    cancel: "Zrušit",
    confirm: "Odhlásit",
    profileTitle: "Profil",
    accountTitle: "Účet",
    appearancePillSystem: "AUTO",
    appearancePillLight: "SVĚTLÝ",
    appearancePillDark: "TMAVÝ",
    appearanceTitle: "Vzhled",
    appearanceSystem: "Podle systému",
    appearanceLight: "Světlý",
    appearanceDark: "Tmavý",
    sectionNotifications: "Notifikace",
    sectionNotificationsHint: "Push, email digest, marketing",
    sectionSecurity: "Bezpečnost",
    sectionSecurityHint: "Změna hesla",
    sectionBilling: "Předplatné",
    sectionBillingHint: "Plán, fakturace, předplatné",
    exportTitle: "Poslat moje data emailem",
    exportSubtitle: "Pošleme JSON snapshot vašeho účtu (GDPR čl. 15/20) jako přílohu na váš email.",
    exportButton: "Odeslat email s daty",
    exporting: "Odesílám…",
    exportError: "Odeslání exportu se nezdařilo.",
    exportSentMessage: "Email s exportem byl odeslán na {email}.",
    deactivateTitle: "Deaktivovat účet",
    deactivateSubtitle: "Přihlášení bude zablokováno, ale data zůstávají. Reaktivovat můžete přes odkaz v emailu.",
    deactivateButton: "Deaktivovat účet",
    deleteTitle: "Smazat účet",
    deleteSubtitle: "Trvale odstraní osobní údaje. Účetní záznamy (faktury) jsou ze zákona ponechány.",
    deleteButton: "Smazat účet",
    cancelTitleDeactivate: "Potvrzení deaktivace",
    cancelTitleDelete: "Potvrzení smazání",
    cancelWarnAccessLost: "Ztratíte přístup k aplikaci i webu.",
    cancelWarnSubRunsToEnd: "Aktivní předplatné doběhne do konce zaplaceného období.",
    cancelWarnNoRefund: "Refund se nevrací.",
    cancelWarnDataDeleted: "Osobní údaje budou anonymizovány a smazány.",
    cancelWarnAccountingKept: "Účetní záznamy (faktury) jsou ze zákona ponechány.",
    cancelWarnDataKept: "Vaše data zůstanou uložená pro případnou reaktivaci.",
    cancelIntentDeactivate: "Rozumím a chci účet deaktivovat.",
    cancelIntentDelete: "Rozumím a chci účet trvale smazat.",
    cancelSendCode: "Poslat ověřovací kód",
    cancelSending: "Posílám…",
    cancelEmailSent: "Email odeslán",
    cancelEmailSentBody: "Poslali jsme 8-znakový kód na {email}. Platnost 30 minut.",
    cancelCodeLabel: "Ověřovací kód",
    cancelCodePlaceholder: "XXXX-XXXX",
    cancelConfirm: "Potvrdit",
    cancelConfirming: "Potvrzuji…",
    cancelResend: "Poslat znovu",
    cancelDoneDeactivate: "Účet deaktivován. Odhlašujeme vás…",
    cancelDoneDelete: "Účet smazán. Odhlašujeme vás…",
    cancelErrorGeneric: "Něco se pokazilo. Zkuste to znovu.",
    billingTitle: "Předplatné",
    billingPlanLabel: "Plán",
    billingStateLabel: "Stav",
    billingCycleLabel: "Cyklus",
    billingTrialEndsLabel: "Trial končí",
    billingPaidUntilLabel: "Předplaceno do",
    billingPlanFree: "Free",
    billingPlanPaid: "Placený plán",
    billingStateTrial: "Zkušební období",
    billingStateActive: "Aktivní",
    billingStatePastDue: "Po splatnosti",
    billingStateSuspended: "Pozastaveno",
    billingStateCanceled: "Zrušeno",
    billingCycleMonthly: "Měsíčně",
    billingCycleYearly: "Ročně",
    billingCancelNotice: "Předplatné bude ukončeno ke konci aktuálního období.",
    billingManageOnWeb: "Spravovat na webu",
    billingManageOnWebHint: "Upgrade plánu, změna platby a faktury jsou nyní jen v dashboardu na webu.",
    billingUpgradeCta: "Upgradovat plán",
    billingNotSet: "Nenastaveno",
    billingProfileSection: "Fakturační údaje",
    billingProfileCompany: "Firma",
    billingProfileManualToggle: "Vyplnit ručně",
    billingProfileName: "Název firmy",
    billingProfileIco: "IČO",
    billingProfileDic: "DIČ",
    billingProfileAddress: "Adresa",
    billingProfileEmail: "Email pro faktury",
    billingModeSection: "Způsob platby",
    billingModeCard: "Karta",
    billingModeInvoice: "Faktura",
    billingCycleSection: "Cyklus fakturace",
    billingCardSection: "Platební karta",
    billingCardConnect: "Připojit kartu",
    billingCardConnecting: "Otevírám platbu…",
    billingCardDisconnect: "Odpojit kartu",
    billingCardExp: "Platnost {month}/{year}",
    billingProformaSection: "Zálohová faktura",
    billingProformaGenerate: "Vystavit zálohovou fakturu",
    billingProformaGenerating: "Vystavuji…",
    billingProformaRegenerate: "Přegenerovat",
    billingProformaDelete: "Smazat",
    billingProformaActive: "Aktivní zálohová faktura: {number} ({amount})",
    billingProformaConfirmDelete: "Opravdu smazat aktuální zálohovou fakturu?",
    billingProformaConfirmRegenerate: "Stávající zálohovou fakturu smažeme a vystavíme novou. Pokračovat?",
    billingInvoicesSection: "Faktury a doklady",
    billingInvoicesEmpty: "Zatím žádné faktury.",
    billingInvoicesOpenPdf: "Otevřít PDF",
    billingInvoicesOpening: "Otevírám…",
    billingInvoicesKindProforma: "Záloha",
    billingInvoicesKindTax: "Daňový doklad",
    billingServicesSection: "Aktivní služby",
    billingServicesEmpty: "Žádné aktivní služby.",
    billingServiceCancel: "Ukončit automatickou obnovu",
    billingServiceReactivate: "Obnovit automatickou obnovu",
    billingServiceCanceled: "Auto-obnova vypnuta",
    billingServiceTrialEnds: "Trial do {date}",
    billingServicePaidUntil: "Předplaceno do {date}",
    billingCheckoutOpening: "Otevírám zabezpečenou platbu Stripe…",
    billingCheckoutFailed: "Otevření platby selhalo.",
    billingDeepLinkSuccess: "Platba dokončena. Aktualizuji stav…",
    billingDeepLinkCancel: "Platba zrušena.",
    billingSavingProfile: "Ukládám…",
    billingProfileSavedToast: "Fakturační údaje uloženy.",
    billingSaveFailed: "Uložení selhalo.",
    serviceLeads: "Veřejné zakázky",
    servicePricing: "Pricing API",
    serviceProcurement: "Procurement",
    serviceManagement: "Management API",
    securityTitle: "Bezpečnost",
    passwordTitleChange: "Změnit heslo",
    passwordTitleSet: "Nastavit heslo",
    passwordSubtitleSet: "Tento účet zatím nemá heslo (přihlašujete se přes OAuth). Po nastavení hesla se budete moci přihlásit i emailem.",
    currentPasswordLabel: "Současné heslo",
    newPasswordLabel: "Nové heslo (min. 8 znaků)",
    newPasswordAgainLabel: "Nové heslo znovu",
    passwordMinLengthError: "Heslo musí mít alespoň 8 znaků.",
    passwordMismatchError: "Hesla se neshodují.",
    passwordSubmit: "Uložit",
    passwordSubmitting: "Ukládám…",
    passwordSavedToast: "Heslo bylo uloženo.",
    revokeAllTitle: "Odhlásit ze všech zařízení",
    revokeAllSubtitle: "Ihned ukončí všechna aktivní přihlášení (web i mobilní aplikace, včetně tohoto zařízení). Budete se muset přihlásit znovu.",
    revokeAllBtn: "Odhlásit ze všech zařízení",
    revokeAllConfirmTitle: "Odhlásit ze všech zařízení?",
    revokeAllConfirmBody: "Toto zařízení i všechna ostatní přihlášení budou ukončena. Pokračovat?",
    revokeAllSuccess: "Všechny session ukončeny.",
    notificationsTitle: "Notifikace",
    pushTitle: "Push notifikace",
    pushLabel: "Push notifikace v aplikaci",
    pushDesc: "Upozornění na nové zakázky odpovídající vašim filtrům.",
    pushPermissionDenied: "Push notifikace jsou zakázané v nastavení iOS. Povolte je v Nastavení → Tendero.",
    pushNotSupported: "Push notifikace nejsou na simulátoru dostupné.",
    pushNeedBuild: "Push notifikace fungují až v plné verzi aplikace (App Store). V Expo Go nejsou dostupné.",
    emailTitle: "Email",
    digestLabel: "Denní souhrn zakázek",
    digestDesc: "Každý den vám pošleme všechny nové zakázky, které odpovídají vašim filtrům.",
    educationalLabel: "Tipy a návody",
    educationalDesc: "Tipy jak efektivně využívat Tendero a novinky v aplikaci.",
    marketingLabel: "Novinky a nabídky",
    marketingDesc: "Občasné novinky o produktech a speciální nabídky.",
    marketingPayingNote: "U platících účtů jsou marketingové emaily automaticky vypnuté.",
    loadFailed: "Nepodařilo se načíst nastavení.",
    saveFailed: "Uložení selhalo.",
    saved: "Uloženo",
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
    sectionAccount: "Account",
    sectionAccountHint: "Sign out, data export, delete account",
    accountEmail: "Email",
    accountName: "Name",
    profileBillingEmailLabel: "Billing email",
    profileBillingEmailHint: "If different from the sign-in email, invoices go to both.",
    signOut: "Sign out",
    back: "Back",
    searchPlaceholder: "Search…",
    signOutConfirmTitle: "Sign out",
    signOutConfirmBody: "Do you really want to sign out?",
    cancel: "Cancel",
    confirm: "Sign out",
    profileTitle: "Profile",
    accountTitle: "Account",
    appearancePillSystem: "AUTO",
    appearancePillLight: "LIGHT",
    appearancePillDark: "DARK",
    appearanceTitle: "Appearance",
    appearanceSystem: "System",
    appearanceLight: "Light",
    appearanceDark: "Dark",
    sectionNotifications: "Notifications",
    sectionNotificationsHint: "Push, email digest, marketing",
    sectionSecurity: "Security",
    sectionSecurityHint: "Change password",
    sectionBilling: "Subscription",
    sectionBillingHint: "Plan, billing, subscription",
    exportTitle: "Email my data",
    exportSubtitle: "We'll send a JSON snapshot of your account (GDPR art. 15/20) as an attachment to your email.",
    exportButton: "Send data email",
    exporting: "Sending…",
    exportError: "Failed to send export.",
    exportSentMessage: "Export email sent to {email}.",
    deactivateTitle: "Deactivate account",
    deactivateSubtitle: "Sign-in will be blocked, but your data is kept. You can reactivate via a link in email.",
    deactivateButton: "Deactivate account",
    deleteTitle: "Delete account",
    deleteSubtitle: "Permanently removes personal data. Accounting records (invoices) are kept by law.",
    deleteButton: "Delete account",
    cancelTitleDeactivate: "Confirm deactivation",
    cancelTitleDelete: "Confirm deletion",
    cancelWarnAccessLost: "You will lose access to the app and the web.",
    cancelWarnSubRunsToEnd: "Active subscription will run until the end of the paid period.",
    cancelWarnNoRefund: "No refund.",
    cancelWarnDataDeleted: "Personal data will be anonymized and deleted.",
    cancelWarnAccountingKept: "Accounting records (invoices) are kept by law.",
    cancelWarnDataKept: "Your data is kept in case you reactivate.",
    cancelIntentDeactivate: "I understand and want to deactivate my account.",
    cancelIntentDelete: "I understand and want to permanently delete my account.",
    cancelSendCode: "Send verification code",
    cancelSending: "Sending…",
    cancelEmailSent: "Email sent",
    cancelEmailSentBody: "We sent an 8-character code to {email}. Valid for 30 minutes.",
    cancelCodeLabel: "Verification code",
    cancelCodePlaceholder: "XXXX-XXXX",
    cancelConfirm: "Confirm",
    cancelConfirming: "Confirming…",
    cancelResend: "Resend",
    cancelDoneDeactivate: "Account deactivated. Signing you out…",
    cancelDoneDelete: "Account deleted. Signing you out…",
    cancelErrorGeneric: "Something went wrong. Please try again.",
    billingTitle: "Subscription",
    billingPlanLabel: "Plan",
    billingStateLabel: "Status",
    billingCycleLabel: "Cycle",
    billingTrialEndsLabel: "Trial ends",
    billingPaidUntilLabel: "Paid until",
    billingPlanFree: "Free",
    billingPlanPaid: "Paid plan",
    billingStateTrial: "Trial",
    billingStateActive: "Active",
    billingStatePastDue: "Past due",
    billingStateSuspended: "Suspended",
    billingStateCanceled: "Canceled",
    billingCycleMonthly: "Monthly",
    billingCycleYearly: "Yearly",
    billingCancelNotice: "Subscription will end at the end of the current period.",
    billingManageOnWeb: "Manage on the web",
    billingManageOnWebHint: "Plan upgrades, payment changes and invoices are currently only in the web dashboard.",
    billingUpgradeCta: "Upgrade plan",
    billingNotSet: "Not set",
    billingProfileSection: "Billing details",
    billingProfileCompany: "Company",
    billingProfileManualToggle: "Enter manually",
    billingProfileName: "Company name",
    billingProfileIco: "Tax ID",
    billingProfileDic: "VAT ID",
    billingProfileAddress: "Address",
    billingProfileEmail: "Email for invoices",
    billingModeSection: "Payment method",
    billingModeCard: "Card",
    billingModeInvoice: "Invoice",
    billingCycleSection: "Billing cycle",
    billingCardSection: "Payment card",
    billingCardConnect: "Connect card",
    billingCardConnecting: "Opening checkout…",
    billingCardDisconnect: "Disconnect card",
    billingCardExp: "Expires {month}/{year}",
    billingProformaSection: "Proforma invoice",
    billingProformaGenerate: "Issue proforma invoice",
    billingProformaGenerating: "Issuing…",
    billingProformaRegenerate: "Regenerate",
    billingProformaDelete: "Delete",
    billingProformaActive: "Active proforma: {number} ({amount})",
    billingProformaConfirmDelete: "Really delete the current proforma?",
    billingProformaConfirmRegenerate: "We'll delete the current proforma and issue a new one. Continue?",
    billingInvoicesSection: "Invoices",
    billingInvoicesEmpty: "No invoices yet.",
    billingInvoicesOpenPdf: "Open PDF",
    billingInvoicesOpening: "Opening…",
    billingInvoicesKindProforma: "Proforma",
    billingInvoicesKindTax: "Tax document",
    billingServicesSection: "Active services",
    billingServicesEmpty: "No active services.",
    billingServiceCancel: "Cancel auto-renewal",
    billingServiceReactivate: "Resume auto-renewal",
    billingServiceCanceled: "Auto-renewal off",
    billingServiceTrialEnds: "Trial until {date}",
    billingServicePaidUntil: "Paid until {date}",
    billingCheckoutOpening: "Opening Stripe secure checkout…",
    billingCheckoutFailed: "Failed to open checkout.",
    billingDeepLinkSuccess: "Payment completed. Refreshing…",
    billingDeepLinkCancel: "Payment canceled.",
    billingSavingProfile: "Saving…",
    billingProfileSavedToast: "Billing details saved.",
    billingSaveFailed: "Save failed.",
    serviceLeads: "Public tenders",
    servicePricing: "Pricing API",
    serviceProcurement: "Procurement",
    serviceManagement: "Management API",
    securityTitle: "Security",
    passwordTitleChange: "Change password",
    passwordTitleSet: "Set password",
    passwordSubtitleSet: "This account has no password yet (you sign in via OAuth). Setting a password lets you also sign in with email.",
    currentPasswordLabel: "Current password",
    newPasswordLabel: "New password (min. 8 chars)",
    newPasswordAgainLabel: "New password again",
    passwordMinLengthError: "Password must be at least 8 characters.",
    passwordMismatchError: "Passwords do not match.",
    passwordSubmit: "Save",
    passwordSubmitting: "Saving…",
    passwordSavedToast: "Password saved.",
    revokeAllTitle: "Sign out everywhere",
    revokeAllSubtitle: "Immediately end all active sessions (web and mobile app, including this device). You'll need to sign in again.",
    revokeAllBtn: "Sign out from all devices",
    revokeAllConfirmTitle: "Sign out everywhere?",
    revokeAllConfirmBody: "This device and all other sessions will be signed out. Continue?",
    revokeAllSuccess: "All sessions ended.",
    notificationsTitle: "Notifications",
    pushTitle: "Push notifications",
    pushLabel: "In-app push notifications",
    pushDesc: "Alerts for new tenders matching your filters.",
    pushPermissionDenied: "Push notifications are disabled in iOS settings. Enable them in Settings → Tendero.",
    pushNotSupported: "Push notifications are not available on the simulator.",
    pushNeedBuild: "Push notifications only work in the full app version (App Store). Not available in Expo Go.",
    emailTitle: "Email",
    digestLabel: "Daily tender digest",
    digestDesc: "Each day we'll email you all new tenders matching your filters.",
    educationalLabel: "Tips and tutorials",
    educationalDesc: "Tips on how to use Tendero effectively and product updates.",
    marketingLabel: "News and offers",
    marketingDesc: "Occasional product news and special offers.",
    marketingPayingNote: "Marketing emails are automatically off for paying accounts.",
    loadFailed: "Failed to load settings.",
    saveFailed: "Save failed.",
    saved: "Saved",
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
    sectionAccount: "Konto",
    sectionAccountHint: "Abmelden, Datenexport, Konto löschen",
    accountEmail: "E-Mail",
    accountName: "Name",
    profileBillingEmailLabel: "Rechnungs-E-Mail",
    profileBillingEmailHint: "Wenn sie sich von der Anmelde-E-Mail unterscheidet, senden wir Belege an beide.",
    signOut: "Abmelden",
    back: "Zurück",
    searchPlaceholder: "Suchen…",
    signOutConfirmTitle: "Abmelden",
    signOutConfirmBody: "Möchten Sie sich wirklich abmelden?",
    cancel: "Abbrechen",
    confirm: "Abmelden",
    profileTitle: "Profil",
    accountTitle: "Konto",
    appearancePillSystem: "AUTO",
    appearancePillLight: "HELL",
    appearancePillDark: "DUNKEL",
    appearanceTitle: "Aussehen",
    appearanceSystem: "System",
    appearanceLight: "Hell",
    appearanceDark: "Dunkel",
    sectionNotifications: "Benachrichtigungen",
    sectionNotificationsHint: "Push, E-Mail-Übersicht, Marketing",
    sectionSecurity: "Sicherheit",
    sectionSecurityHint: "Passwort ändern",
    sectionBilling: "Abonnement",
    sectionBillingHint: "Tarif, Abrechnung, Abonnement",
    exportTitle: "Meine Daten per E-Mail senden",
    exportSubtitle: "Wir senden einen JSON-Snapshot Ihres Kontos (DSGVO Art. 15/20) als Anhang an Ihre E-Mail.",
    exportButton: "Daten-E-Mail senden",
    exporting: "Sende…",
    exportError: "Senden des Exports fehlgeschlagen.",
    exportSentMessage: "Export-E-Mail wurde an {email} gesendet.",
    deactivateTitle: "Konto deaktivieren",
    deactivateSubtitle: "Anmeldung wird blockiert, Daten bleiben erhalten. Reaktivierung über Link in der E-Mail möglich.",
    deactivateButton: "Konto deaktivieren",
    deleteTitle: "Konto löschen",
    deleteSubtitle: "Persönliche Daten werden dauerhaft entfernt. Buchhaltungsdaten (Rechnungen) bleiben gesetzlich erhalten.",
    deleteButton: "Konto löschen",
    cancelTitleDeactivate: "Deaktivierung bestätigen",
    cancelTitleDelete: "Löschung bestätigen",
    cancelWarnAccessLost: "Sie verlieren den Zugang zur App und zum Web.",
    cancelWarnSubRunsToEnd: "Aktives Abonnement läuft bis zum Ende der bezahlten Periode.",
    cancelWarnNoRefund: "Keine Erstattung.",
    cancelWarnDataDeleted: "Persönliche Daten werden anonymisiert und gelöscht.",
    cancelWarnAccountingKept: "Buchhaltungsdaten (Rechnungen) bleiben gesetzlich erhalten.",
    cancelWarnDataKept: "Ihre Daten bleiben für eine eventuelle Reaktivierung gespeichert.",
    cancelIntentDeactivate: "Ich verstehe und möchte mein Konto deaktivieren.",
    cancelIntentDelete: "Ich verstehe und möchte mein Konto dauerhaft löschen.",
    cancelSendCode: "Bestätigungscode senden",
    cancelSending: "Senden…",
    cancelEmailSent: "E-Mail gesendet",
    cancelEmailSentBody: "Wir haben einen 8-stelligen Code an {email} gesendet. 30 Minuten gültig.",
    cancelCodeLabel: "Bestätigungscode",
    cancelCodePlaceholder: "XXXX-XXXX",
    cancelConfirm: "Bestätigen",
    cancelConfirming: "Bestätige…",
    cancelResend: "Erneut senden",
    cancelDoneDeactivate: "Konto deaktiviert. Sie werden abgemeldet…",
    cancelDoneDelete: "Konto gelöscht. Sie werden abgemeldet…",
    cancelErrorGeneric: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    billingTitle: "Abonnement",
    billingPlanLabel: "Tarif",
    billingStateLabel: "Status",
    billingCycleLabel: "Zyklus",
    billingTrialEndsLabel: "Testphase endet",
    billingPaidUntilLabel: "Bezahlt bis",
    billingPlanFree: "Free",
    billingPlanPaid: "Bezahlter Tarif",
    billingStateTrial: "Testphase",
    billingStateActive: "Aktiv",
    billingStatePastDue: "Überfällig",
    billingStateSuspended: "Ausgesetzt",
    billingStateCanceled: "Gekündigt",
    billingCycleMonthly: "Monatlich",
    billingCycleYearly: "Jährlich",
    billingCancelNotice: "Das Abonnement endet zum Ende der aktuellen Periode.",
    billingManageOnWeb: "Im Web verwalten",
    billingManageOnWebHint: "Tarif-Upgrades, Zahlungsänderungen und Rechnungen sind derzeit nur im Web-Dashboard verfügbar.",
    billingUpgradeCta: "Tarif upgraden",
    billingNotSet: "Nicht festgelegt",
    billingProfileSection: "Rechnungsdaten",
    billingProfileCompany: "Firma",
    billingProfileManualToggle: "Manuell eingeben",
    billingProfileName: "Firmenname",
    billingProfileIco: "Steuernummer",
    billingProfileDic: "USt-IdNr.",
    billingProfileAddress: "Adresse",
    billingProfileEmail: "E-Mail für Rechnungen",
    billingModeSection: "Zahlungsmethode",
    billingModeCard: "Karte",
    billingModeInvoice: "Rechnung",
    billingCycleSection: "Abrechnungszyklus",
    billingCardSection: "Zahlungskarte",
    billingCardConnect: "Karte verknüpfen",
    billingCardConnecting: "Checkout wird geöffnet…",
    billingCardDisconnect: "Karte trennen",
    billingCardExp: "Gültig bis {month}/{year}",
    billingProformaSection: "Vorausrechnung",
    billingProformaGenerate: "Vorausrechnung ausstellen",
    billingProformaGenerating: "Wird ausgestellt…",
    billingProformaRegenerate: "Neu generieren",
    billingProformaDelete: "Löschen",
    billingProformaActive: "Aktive Vorausrechnung: {number} ({amount})",
    billingProformaConfirmDelete: "Aktuelle Vorausrechnung wirklich löschen?",
    billingProformaConfirmRegenerate: "Wir löschen die aktuelle Vorausrechnung und stellen eine neue aus. Fortfahren?",
    billingInvoicesSection: "Rechnungen",
    billingInvoicesEmpty: "Noch keine Rechnungen.",
    billingInvoicesOpenPdf: "PDF öffnen",
    billingInvoicesOpening: "Wird geöffnet…",
    billingInvoicesKindProforma: "Vorausrechnung",
    billingInvoicesKindTax: "Steuerbeleg",
    billingServicesSection: "Aktive Dienste",
    billingServicesEmpty: "Keine aktiven Dienste.",
    billingServiceCancel: "Automatische Verlängerung beenden",
    billingServiceReactivate: "Automatische Verlängerung fortsetzen",
    billingServiceCanceled: "Auto-Verlängerung aus",
    billingServiceTrialEnds: "Testphase bis {date}",
    billingServicePaidUntil: "Bezahlt bis {date}",
    billingCheckoutOpening: "Sicherer Stripe-Checkout wird geöffnet…",
    billingCheckoutFailed: "Checkout konnte nicht geöffnet werden.",
    billingDeepLinkSuccess: "Zahlung abgeschlossen. Aktualisiere…",
    billingDeepLinkCancel: "Zahlung abgebrochen.",
    billingSavingProfile: "Speichere…",
    billingProfileSavedToast: "Rechnungsdaten gespeichert.",
    billingSaveFailed: "Speichern fehlgeschlagen.",
    serviceLeads: "Öffentliche Ausschreibungen",
    servicePricing: "Pricing API",
    serviceProcurement: "Procurement",
    serviceManagement: "Management API",
    securityTitle: "Sicherheit",
    passwordTitleChange: "Passwort ändern",
    passwordTitleSet: "Passwort festlegen",
    passwordSubtitleSet: "Dieses Konto hat noch kein Passwort (Sie melden sich über OAuth an). Mit einem Passwort können Sie sich auch per E-Mail anmelden.",
    currentPasswordLabel: "Aktuelles Passwort",
    newPasswordLabel: "Neues Passwort (min. 8 Zeichen)",
    newPasswordAgainLabel: "Neues Passwort erneut",
    passwordMinLengthError: "Passwort muss mindestens 8 Zeichen haben.",
    passwordMismatchError: "Passwörter stimmen nicht überein.",
    passwordSubmit: "Speichern",
    passwordSubmitting: "Speichere…",
    passwordSavedToast: "Passwort gespeichert.",
    revokeAllTitle: "Überall abmelden",
    revokeAllSubtitle: "Beendet sofort alle aktiven Sitzungen (Web und Mobile App, einschließlich dieses Geräts). Sie müssen sich neu anmelden.",
    revokeAllBtn: "Von allen Geräten abmelden",
    revokeAllConfirmTitle: "Überall abmelden?",
    revokeAllConfirmBody: "Dieses Gerät und alle anderen Sitzungen werden abgemeldet. Fortfahren?",
    revokeAllSuccess: "Alle Sitzungen beendet.",
    notificationsTitle: "Benachrichtigungen",
    pushTitle: "Push-Benachrichtigungen",
    pushLabel: "Push-Benachrichtigungen in der App",
    pushDesc: "Hinweise zu neuen Ausschreibungen, die Ihren Filtern entsprechen.",
    pushPermissionDenied: "Push-Benachrichtigungen sind in den iOS-Einstellungen deaktiviert. Aktivieren Sie sie in Einstellungen → Tendero.",
    pushNotSupported: "Push-Benachrichtigungen sind im Simulator nicht verfügbar.",
    pushNeedBuild: "Push-Benachrichtigungen funktionieren nur in der vollständigen App-Version (App Store). In Expo Go nicht verfügbar.",
    emailTitle: "E-Mail",
    digestLabel: "Tägliche Ausschreibungsübersicht",
    digestDesc: "Jeden Tag senden wir Ihnen alle neuen Ausschreibungen, die Ihren Filtern entsprechen.",
    educationalLabel: "Tipps und Anleitungen",
    educationalDesc: "Tipps zur effektiven Nutzung von Tendero und Produkt-Updates.",
    marketingLabel: "Neuigkeiten und Angebote",
    marketingDesc: "Gelegentliche Produktneuigkeiten und Sonderangebote.",
    marketingPayingNote: "Marketing-E-Mails sind bei zahlenden Konten automatisch deaktiviert.",
    loadFailed: "Einstellungen konnten nicht geladen werden.",
    saveFailed: "Speichern fehlgeschlagen.",
    saved: "Gespeichert",
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
