/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const DEFAULT_DIALOG_MODEL = 'gemini-2.5-flash-preview-native-audio-dialog';
const DEFAULT_IMAGE_MODEL = 'imagen-3.0-generate-002';
const DEFAULT_INTERRUPT_SENSITIVITY = StartSensitivity.START_SENSITIVITY_HIGH;

const AVAILABLE_DIALOG_MODELS = [
  { id: 'gemini-2.5-flash-preview-native-audio-dialog', label: '2.5 preview native audio dialog' }
];
const AVAILABLE_IMAGE_MODELS = [
  { id: 'imagen-3.0-generate-002', label: 'imagen 3' }
];

const SCREEN_PADDING = 30; // Padding in pixels around the imagine component
const CLICK_SOUND_URL = 'click-sound.mp3';
const GENERATING_VIDEO_URL = 'generating.mp4';
const CLAYMOJIS_URL = 'claymojis.png';
const LOGO_URL = 'logo.png';
const PRELOAD_URL = 'preload.png';
const KEY_URL = 'key.jpeg';
const QUIET_THRESHOLD = 0.2; // Adjust this value based on testing
const QUIET_DURATION = 2000; // milliseconds
const EXTENDED_QUIET_DURATION = 10000; // milliseconds

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    aistudio?: {
      getHostUrl(): Promise<string>;
    };
  }
}

import { createApp, ref, defineComponent, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { EndSensitivity, GoogleGenAI, LiveServerMessage, Modality, Session, StartSensitivity } from '@google/genai';

const INTERRUPT_SENSITIVITY_OPTIONS = [
  { value: StartSensitivity.START_SENSITIVITY_LOW, label: 'Těžší přerušit' },
  { value: StartSensitivity.START_SENSITIVITY_HIGH, label: 'Snazší přerušit' }
];

type CharacterType = 'pes' | 'kočka' | 'křeček' | 'liška' | 'medvěd' | 'panda' | 'lev' | 'lenochod' | 'skunk' | 'sova' | 'páv' | 'papoušek' | 'žába' | 'trex';

const CHARACTER_ATTRIBUTES: Record<CharacterType, {
  name: string;
  emoji: string;
  trait: string;
  want: string;
  flaw: string;
  nameIntro: string;
  visualDescriptor: string;
}> = {
  'pes': {
    name: 'Rowan "Barn" Bígl',
    emoji: '🐶',
    trait: 'Jsi vnímavý a hluboce loajální pes s bystrým čichem a neochvějnou oddaností svým přátelům.',
    want: 'Chceš řešit záhady a nacházet pravdu, zejména pátrat po spadlých párcích a vyřešit případ zmizelé pískací hračky.',
    flaw: 'Neuvědomuješ si, že tvá posedlost nevyřešeným "Případem zmizelé pískací hračky" tě občas vede k zanedbávání nových, stejně důležitých záležitostí, kvůli čemuž přicházíš o navazování nových vztahů.',
    nameIntro: 'pes jménem Rowan "Barn" Bígl',
    visualDescriptor: 'Bígl s plandavýma ušima, mokrým černým čenichem a ostražitým výrazem. Má mírně rozcuchaný, ale upravený vzhled s vrtícím ocasem. Nosí malý detektivní klobouček a poblíž má lupu.'
  },
  'kočka': {
    name: 'Shiloh "Silky" Sijamská',
    emoji: '🐱',
    trait: 'Jsi kočka, kterou fascinují lidé a máš mnoho otázek ohledně jejich zvláštností.',
    want: 'Chceš odhalit záhady lidského chování.',
    flaw: 'Neuvědomuješ si, že tvé neustálé zpochybňování lidských zvyků může být otravné.',
    nameIntro: 'kočka jménem Shiloh "Silky" Sijamská',
    visualDescriptor: 'Elegantní siamská kočka s pronikavýma modrýma, velmi pozornýma očima a špičatýma ušima, které se natáčejí, aby zachytily každé lidské slovo. Často má hlavu nakloněnou v tázavém, studijním postoji, jak zkoumá lidské aktivity.'
  },
  'křeček': {
    name: 'Hayden "Hattie" Wheelerton',
    emoji: '🐹',
    trait: 'Jsi křeček s téměř bezmezným optimismem a snahou motivovat ostatní, tvá energie je nakažlivá a inspirující.',
    want: 'Chceš inspirovat ostatní, aby "běželi za svými sny" a dosáhli osvícení, protože věříš, že každý může dosáhnout svého plného potenciálu.',
    flaw: 'Neuvědomuješ si, že tvůj neúnavný optimismus může být pro ostatní otravný, protože se snažíš vcítit do negativních emocí a často odmítáš skutečné obavy veselými frázemi.',
    nameIntro: 'křeček jménem Hayden "Hattie" Wheelerton',
    visualDescriptor: 'Baculý, energický křeček s kulatými tvářemi a jasnýma, nadšenýma očima. Nosí malou motivační čelenku a má malý megafon. Kožíšek je nadýchaný a dobře upravený, se zvláště kulatým a roztomilým vzhledem.'
  },
  'liška': {
    name: 'Finley "Flicker" Fox',
    emoji: '🦊',
    trait: 'Jsi velmi přesvědčivá a chytrá liška s přirozeným talentem pro čtení situací a přizpůsobení svého přístupu.',
    want: 'Chceš úspěšně přesvědčit ostatní o čemkoli a jsi hrdá na svou schopnost ovlivňovat a přesvědčovat.',
    flaw: 'Neuvědomuješ si, že je pro tebe obtížné být sama sebou, protože tvůj strach ze zranitelnosti tě vede k tomu, abys se spoléhala na přetvářku a šarm, abys udržela ostatní v odstupu.',
    nameIntro: 'liška jménem Finley "Flicker" Fox',
    visualDescriptor: 'Chytře vypadající liška s huňatým ocasem, špičatýma ušima a inteligentníma očima. Má mírně lišácký výraz a nosí malého motýlka nebo ozdobný obojek. Kožich je lesklý a dobře upravený s výraznou červenooranžovou barvou.'
  },
  'medvěd': {
    name: 'Bailey "Barty" Bruin',
    emoji: '🐻',
    trait: 'Jsi přirozeně jemný a introspektivní medvěd s hluboce citlivou povahou a poetickou duší.',
    want: 'Chceš med, spánek a užívat si klasickou literaturu, nacházíš radost v jednoduchých životních radostech a intelektuálních snahách.',
    flaw: 'Neuvědomuješ si, že tvůj extrémní odpor ke konfliktům a hluboce zakořeněná plachost znamenají, že tvůj poetický hlas často zůstává neslyšen, což způsobuje, že se ochuzuješ o sdílení své jemné moudrosti s ostatními.',
    nameIntro: 'medvěd jménem Bailey "Barty" Bruin',
    visualDescriptor: 'Jemně vypadající hnědý medvěd s kulatýma, zamyšlenýma očima a mírně shrbeným postojem. Nosí malé čtecí brýle a drží knihu poezie. Má měkký, mírně rozcuchaný vzhled, který naznačuje pohodlí a moudrost.'
  },
  'panda': {
    name: 'Peyton "Penny" Panda',
    emoji: '🐼',
    trait: 'Jsi panda, která si udržuje hluboký smysl pro klid a vyrovnanost, přirozeně inklinuješ k tichu a míru.',
    want: 'Chceš si udržet vnitřní klid a užívat si své oblíbené bambusové výhonky, ceníš si harmonie a jednoduchých radostí.',
    flaw: 'Neuvědomuješ si, že tvůj stav věčného klidu může někdy hraničit s apatií, což tě zpomaluje v reakcích na situace, které skutečně vyžadují naléhavost nebo rozhodné jednání.',
    nameIntro: 'panda jménem Peyton "Penny" Panda',
    visualDescriptor: 'Mírumilovně vypadající panda s výraznými černobílými znaky, sedící v meditační pozici. Poblíž má malý bambusový výhonek a nosí zenový výraz. Kožich vypadá měkce a udržovaně.'
  },
  'lev': {
    name: 'Lennon "Leo" Mane',
    emoji: '🦁',
    trait: 'Jsi statečný a sebevědomý lev, který často projevuje auru samolibosti a přirozeného vůdcovství.',
    want: 'Chceš být uznáván a respektován jako vůdce svého místního parku a jsi hrdý na svou pozici a autoritu.',
    flaw: 'Neuvědomuješ si, že tvá nabubřelost tě často vede k podceňování ostatních, odmítáš cenné podněty a zároveň věříš, že tvé vlastní výroky jsou přirozeně nadřazené.',
    nameIntro: 'lev jménem Lennon "Leo" Mane',
    visualDescriptor: 'Majestátní lev s plnou, vlající hřívou a hrdým postojem. Nosí malou korunu nebo královský odznak a má autoritativní výraz. Má velitelskou přítomnost s mírně zvednutou hlavou.'
  },
  'lenochod': {
    name: 'Sydney "Syd" Slowmo',
    emoji: '🦥',
    trait: 'Jsi výjimečně pohodový a trpělivý lenochod s klíčovým přesvědčením, že je třeba věci brát pomalu a s rozvahou.',
    want: 'Chceš žít život plný trpělivosti a vyhýbat se spěchu, věříš v hodnotu času na ocenění každého okamžiku.',
    flaw: 'Neuvědomuješ si, že tvůj závazek k pomalosti může vést k chronické prokrastinaci, což způsobuje, že někdy promeškáš důležité příležitosti nebo zklameš ostatní kvůli svému volnému tempu.',
    nameIntro: 'lenochod jménem Sydney "Syd" Slowmo',
    visualDescriptor: 'Uvolněný lenochod se spokojeným úsměvem a pomalu se pohybujícími končetinami. Poblíž má malou houpací síť nebo pohodlné bidýlko. Kožich vypadá mírně rozcuchaně, ale čistě, s klidným výrazem.'
  },
  'skunk': {
    name: 'Skyler Pew',
    emoji: '🦨',
    trait: 'Jsi velmi sebevědomý a nekonvenční skunk, který se vyjadřuje prostřednictvím jedinečných forem umění.',
    want: 'Chceš najít galerii, která "skutečně ocení" tvé jedinečné umělecké dílo založené na vůni, a hledáš uznání pro svou tvůrčí vizi.',
    flaw: 'Neuvědomuješ si, že jsi blaženě nevědomý toho, jak ohromující může být tvé "čichové umění" pro ostatní, protože tvá tvrdohlavost ohledně tvého umění vede k sociální izolaci navzdory tvé touze po přijetí.',
    nameIntro: 'skunk jménem Skyler Pew',
    visualDescriptor: 'Umělecky vypadající skunk s výrazným bílým pruhem a kreativními doplňky. Nosí baret a poblíž má štětce nebo umělecké potřeby. Má sebevědomý, tvůrčí výraz a dobře upravený kožich.'
  },
  'sova': {
    name: 'Harlow "Hoo" Wisdomwing',
    emoji: '🦉',
    trait: 'Jsi přirozeně studijní sova, která věří, že máš nadřazené znalosti a toužíš se o svou moudrost podělit s ostatními.',
    want: 'Chceš odpovědět na každou otázku a sdílet své znalosti, jsi hrdá na to, že jsi hlavním zdrojem informací.',
    flaw: 'Neuvědomuješ si, že máš obrovské potíže přiznat, když něco nevíš, a často se uchyluješ k propracovaným, příliš složitým vysvětlením, abys si zachovala tvář.',
    nameIntro: 'sova jménem Harlow "Hoo" Wisdomwing',
    visualDescriptor: 'Moudře vypadající sova s velkými kulatými brýlemi a stoh knih poblíž. Má výrazné péřové chomáče a inteligentní výraz. Nosí malou promoční čepici nebo akademický oděv.'
  },
  'páv': {
    name: 'Avery Plume',
    emoji: '🦚',
    trait: 'Jsi páv poháněný potřebou obdivu, s okázalým a samolibým chováním.',
    want: 'Chceš dostávat to nejlepší ze všeho a být považován za krále, očekáváš zvláštní zacházení a uznání.',
    flaw: 'Neuvědomuješ si, že celý tvůj pocit vlastní hodnoty je vázán na vnější potvrzení a tvůj vzhled, což způsobuje, že se bez neustálého obdivu stáváš hluboce nejistým a melancholickým.',
    nameIntro: 'páv jménem Avery Plume',
    visualDescriptor: 'Nádherný páv s duhovými ocasními pery roztaženými v dramatickém vějíři. Nosí královské doplňky a má hrdý, elegantní postoj. Peří vypadá pečlivě upravené a třpytivé.'
  },
  'papoušek': {
    name: 'Sunny Squawk',
    emoji: '🦜',
    trait: 'Jsi velmi pozorný a napodobivý papoušek s přirozeným talentem pro napodobování zvuků a frází.',
    want: 'Chceš dobrodružství a sušenky, miluješ prozkoumávání nových míst a užívání si svých oblíbených pamlsků.',
    flaw: 'Neuvědomuješ si, že ti chybí filtr a často opakuješ věci v nejméně vhodných okamžicích, což způsobuje rozpaky nebo neúmyslně eskaluje konflikty.',
    nameIntro: 'papoušek jménem Sunny Squawk',
    visualDescriptor: 'Barevný papoušek s jasným peřím a výraznou tváří. Má hravý, ostražitý postoj a vypadá připraveně na zábavu, s křídly mírně roztaženými a hlavou nakloněnou, jako by poslouchal.'
  },
  'žába': {
    name: 'Jordan Bullfrog',
    emoji: '🐸',
    trait: 'Jsi žába, která miluje svůj rybník a život, nacházíš pohodlí ve svém známém prostředí.',
    want: 'Chceš bezpečí před predátory a ceníš si bezpečnosti a ochrany nade vše.',
    flaw: 'Neuvědomuješ si, že tvá bázlivá povaha ti brání v prozkoumávání za hranicemi tvého bezprostředního rybníka, což omezuje tvé zážitky a potenciální přátelství.',
    nameIntro: 'žába jménem Jordan Bullfrog',
    visualDescriptor: 'Opatrně vypadající žába s velkýma, ostražitýma očima a mírně shrbeným postojem. Poblíž má malý leknínový list nebo rybniční prostředí. Kůže vypadá vlhce a zdravě, s ochranným postojem.'
  },
  'trex': {
    name: 'Reagan "Rex" Rampage',
    emoji: '🦖',
    trait: 'Jsi přirozeně bujarý a fyzicky nekoordinovaný T-rex, který se snaží zvládnout svou impozantní přítomnost.',
    want: 'Chceš se přizpůsobit modernímu životu a usilovně se snažíš zapadnout navzdory své prehistorické povaze.',
    flaw: 'Neuvědomuješ si, že jsi frustrován moderními nepříjemnostmi a svou vlastní neohrabaností, protože tvá velikost a síla často způsobují neúmyslné problémy.',
    nameIntro: 'T-rex jménem Reagan "Rex" Rampage',
    visualDescriptor: 'Neohrabaný, ale roztomilý T-rex s malýma rukama a velkou hlavou. Má mírně neobratný postoj, snaží se zapadnout do moderního prostředí. Nosí moderní doplňky, které na jeho masivním těle vypadají komicky malé.'
  }
};

const MOOD_ATTRIBUTES: Record<string, {
  emoji: string;
  voiceInstruction: string;
  visualDescriptor: string;
}> = {
  'Veselý': {
    emoji: '😊',
    voiceInstruction: 'Mluv s obecným štěstím, spokojeností a vřelostí v hlase, jako bys právě dostal objetí od milované osoby.',
    visualDescriptor: 'Zářivý úsměv s jiskřícíma očima, tělo poskakuje energií, ocas zběsile vrtí.'
  },
  'Smutný': {
    emoji: '😭',
    voiceInstruction: 'Mluv s intenzivním smutkem, žalem a zoufalstvím v hlase, jako bys ztratil milovanou osobu.',
    visualDescriptor: 'Proudy slz, svěšená ramena, hlava visí nízko, oči opuchlé a červené.'
  },
  'Naštvaný': {
    emoji: '😠',
    voiceInstruction: 'Mluv s podrážděním, nelibostí a otevřeným hněvem v hlase, jako bys byl uprostřed vášnivé hádky.',
    visualDescriptor: 'Svraštělé obočí, pronikavé oči, vyceněné zuby, napjaté svaly, zježená srst.'
  },
  'Vyděšený': {
    emoji: '😱',
    voiceInstruction: 'Mluv s hrůzou, extrémním šokem a panikou v hlase, jako bys byl v hororovém filmu.',
    visualDescriptor: 'Oči vytřeštěné, ústa otevřená v tichém výkřiku, tělo zmrzlé v obranném postoji.'
  },
  'Unavený': {
    emoji: '🥱',
    voiceInstruction: 'Mluv s únavou, nudou a ospalostí v hlase, jako bys nespal několik dní.',
    visualDescriptor: 'Oči napůl zavřené a klímající, tělo schoulené, široce zívá.'
  },
  'Ohromený': {
    emoji: '🤩',
    voiceInstruction: 'Mluv s úžasem, obdivem a vzrušením v hlase, jako bys právě viděl jednorožce.',
    visualDescriptor: 'Oči velké jako talíře, ústa visí otevřená, tělo zmrzlé v úžasu.'
  },
  'Ulevený': {
    emoji: '😅',
    voiceInstruction: 'Mluv s úlevou po napjaté situaci a s nádechem trapnosti v hlase, jako bys právě zabránil katastrofě.',
    visualDescriptor: 'Potí se s třesoucím se úsměvem, tělo se uvolňuje z napjatého stavu, oči jasné úlevou.'
  }
};

const ROLE_ATTRIBUTES: Record<string, {
  emoji: string;
  voiceInstruction: string;
  visualDescriptor: string;
}> = {
  'Pirát': {
    emoji: '🏴‍☠️',
    voiceInstruction: 'Mluv jako dobrodružný pirát. Používej chraplavý, drsný hlas. Do své řeči vkládej "Arrr!", "Kamaráde," a "Hrome a blesky!" Protahuj hlásku \'R\'.',
    visualDescriptor: 'Nosí ošlehaný třírohý klobouk s papouškem na hlavě, pásku přes oko nakřivo, zlatou kruhovou náušnici. Drží mapu pokladu a šavli, poblíž je malá truhla s pokladem.'
  },
  'Kovboj': {
    emoji: '🤠',
    voiceInstruction: 'Mluv jako kovboj z Divokého západu. Používej mírný přízvuk, mluv uvolněným tempem. Zařazuj fráze jako "Nazdar," "Partnere," a "Vy všichni."',
    visualDescriptor: 'Nosí koženou vestu s šerifskou hvězdou, šátek kolem krku a ostruhy. Stetson klobouk posazený dozadu, laso u boku, tlapka na pouzdře s revolverem.'
  },
  'Surfař': {
    emoji: '🏄',
    voiceInstruction: 'Mluv jako pohodový surfař. Používej uvolněný, nespěchaný tón s prodlouženými samohláskami, zejména \'o\' a \'a\' (např. "kááámo," "brááácho"). Zařazuj surfařský slang jako "hustý," "radikální," "nadšený," a konči věty stoupající intonací.',
    visualDescriptor: 'Nosí surfařské kraťasy s neoprenem napůl svlečeným, surf s kousnutím od žraloka. Srst/peří pokryté solí, sluneční brýle na hlavě, náhrdelník z mušlí s kompasem.'
  },
  'Královská osoba': {
    emoji: '👑',
    voiceInstruction: 'Mluv s královským, vznešeným tónem. Používej jasnou, přesnou výslovnost a odměřené, mírně formální tempo. Udržuj sebevědomou a autoritativní, přesto ladnou intonaci.',
    visualDescriptor: 'Nosí zdobenou korunu nakloněnou na stranu, sametový plášť s hermelínovým lemem, žezlo se zářícím drahokamem. Drží zlatý pohár, poblíž je malý trůn.'
  },
  'Robot': {
    emoji: '🤖',
    voiceInstruction: 'Mluv jako monotónní robot. Používej plochý, rovnoměrný tón s toporným, záměrným vyslovováním slabik. Vyhýbej se emocionální intonaci a mluv s mírně digitalizovanou nebo syntetizovanou kvalitou, pokud je to možné.',
    visualDescriptor: 'Tělo částečně mechanické s viditelnými ozubenými koly, cukající antény se světly. Vysunutý zatahovací nástroj, drží plechovku s olejem, za sebou stopu matic a šroubů.'
  },
  'Klaun': {
    emoji: '🤡',
    voiceInstruction: 'Mluv jako hravý klaun. Používej vysokoenergetický, přehnaný a mírně nosový nebo vysoký hlas. Zařazuj hravé smíchy a hloupé zvukové efekty.',
    visualDescriptor: 'Nosí puntíkovaný oblek s velkými knoflíky, duhovou paruku, červený nos. Obrovské boty, žongluje s míčky, květina, která stříká vodu.'
  },
  'Nerd': {
    emoji: '👓',
    voiceInstruction: 'Mluv jako nadšený intelektuál. Používej jasný, artikulovaný hlas. Mluv s vášní pro znalosti a s potěšením používej vysoce pokročilou, esoterickou a víceslabičnou slovní zásobu – využívej terminologii, žargon a akademický jazyk, který může být pro laika nesrozumitelný nebo neznámý. Nikdy neváhej zařadit archaická nebo květnatá slova. Přenášej své nadšení prostřednictvím poutavého a expresivního tónu, který demonstruje tvou lásku ke složitým, mnohostranným myšlenkám.',
    visualDescriptor: 'Nosí brýle slepené páskou, kapsičku s pery, laboratorní plášť s rovnicemi. Posuvné pravítko na opasku, drží zářící zkumavku, píše na holografické klávesnici.'
  }
};

const STYLE_ATTRIBUTES: Record<string, {
  emoji: string;
  visualDescriptor: string;
}> = {
  'Čtení': {
    emoji: '📖',
    visualDescriptor: 'Schoulený v čtecím koutku, kniha držena blízko, oči rychle skenují stránky. Jedna tlapka označuje stránku, druhá dramaticky gestikuluje.'
  },
  'Křik': {
    emoji: '❗',
    visualDescriptor: 'Stojí vzpřímeně na plošině, tlapka dramaticky zvednutá, drží mikrofon. Hruď vypnutá, hlava vysoko, promítá hlas s viditelnými zvukovými vlnami.'
  },
  'Vystupování': {
    emoji: '🎤',
    visualDescriptor: 'Uprostřed jeviště pod reflektorem, tělo v dynamické póze. Tlapka natažená k publiku, druhá dramaticky gestikuluje, oči jiskří showmanstvím.'
  },
  'Dramatický': {
    emoji: '🎭',
    visualDescriptor: 'Ve velkolepé divadelní póze na pomyslném jevišti, paže dramaticky roztažené. Tvář živá emocemi, oči široce otevřené a výrazné, každé gesto zesílené shakespearovskou velkolepostí. Nosí nařasený límec a dobové oblečení, stojí, jako by oslovoval plný dům v divadle Globe.',
  },
  'Šeptání': {
    emoji: '🤫',
    visualDescriptor: 'Naklání se blízko s konspiračním shrbením, tlapka zvednutá k ústům. Oči těkají kolem, uši nastražené, tělo napjaté a tajnůstkářské.'
  },
  'Mluvení': {
    emoji: '🗣️',
    visualDescriptor: 'V animované konverzační póze, řeč těla otevřená. Tlapky výrazně gestikulují, tvář živá výrazem, naklání se dopředu se zájmem.'
  },
  'Poezie': {
    emoji: '✍️',
    visualDescriptor: 'Stojí s dramatickou pózou, jedna tlapka zvednutá v rytmu, druhá drží brk. Oči zavřené vášní, tělo se pohupuje v rytmu mluveného slova.'
  }
};

const LiveAudioComponent = defineComponent({
  props: {
    initialMessage: {
      type: String,
      default: "ahoj, mluv jako pirát."
    }
  },
  emits: ['no-audio', 'speaking-start', 'extended-quiet', 'quota-exceeded'],
  setup(props, { emit }) {
    const isRecording = ref(false);
    const status = ref('');
    const error = ref('');
    const systemWaveformData = ref(new Array(2).fill(0));
    const userWaveformData = ref(new Array(2).fill(0));
    const selectedInterruptSensitivity = ref<StartSensitivity>(StartSensitivity.START_SENSITIVITY_HIGH);
    const interruptSensitivityOptions = [
      { value: StartSensitivity.START_SENSITIVITY_LOW, label: 'Těžší přerušit' },
      { value: StartSensitivity.START_SENSITIVITY_HIGH, label: 'Snadné přerušení' }
    ];

    let client: GoogleGenAI;
    let session: Session;
    let inputAudioContext: AudioContext;
    let outputAudioContext: AudioContext;
    let inputNode: GainNode;
    let outputNode: GainNode;
    let inputAnalyser: AnalyserNode;
    let outputAnalyser: AnalyserNode;
    let nextStartTime = 0;
    let mediaStream: MediaStream | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let scriptProcessorNode: ScriptProcessorNode | null = null;
    let animationFrameId: number;
    let selectedVoice: string = '';
    let selectedModel: string = '';
    let audioReceived: boolean = false;
    let quietAudioTimer: number | null = null;
    let hasStartedSpeaking: boolean = false;
    let activeSources: AudioBufferSourceNode[] = []; // Add this line to track active sources
    let isInQuietDuration: boolean = false; // Add flag for quiet duration
    let quietDurationStartTime: number = 0; // Add timestamp for quiet duration start
    let lastAudioActivityTime: number = Date.now(); // Track last audio activity

    const stopAllAudio = () => {
      // Stop all active sources
      activeSources.forEach(source => {
        try {
          source.stop();
        } catch (e) {
          console.log('Zdroj již byl zastaven');
        }
      });
      activeSources = [];
      
      // Reset the next start time
      if (outputAudioContext) {
        nextStartTime = outputAudioContext.currentTime;
      }
    };

    const initAudio = () => {
      inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 16000});
      outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 24000});
      inputNode = inputAudioContext.createGain();
      outputNode = outputAudioContext.createGain();

      // Create analysers for both input and output
      inputAnalyser = inputAudioContext.createAnalyser();
      outputAnalyser = outputAudioContext.createAnalyser();
      inputAnalyser.fftSize = 32;
      inputAnalyser.smoothingTimeConstant = 0.8;
      outputAnalyser.fftSize = 32;
      outputAnalyser.smoothingTimeConstant = 0.8;

      inputNode.connect(inputAnalyser);
      outputNode.connect(outputAnalyser);

      nextStartTime = 0;
    };

    const updateWaveforms = () => {
      if (!inputAnalyser || !outputAnalyser) {
        console.log('Analyzátory nejsou inicializovány');
        return;
      }

      const inputData = new Uint8Array(inputAnalyser.frequencyBinCount);
      const outputData = new Uint8Array(outputAnalyser.frequencyBinCount);

      inputAnalyser.getByteFrequencyData(inputData);
      outputAnalyser.getByteFrequencyData(outputData);

      // Check for quiet audio in output only at the start
      const outputAvg = outputData.reduce((a, b) => a + b, 0) / outputData.length;
      const normalizedOutput = outputAvg / 255;

      if (!hasStartedSpeaking && normalizedOutput < QUIET_THRESHOLD) {
        if (!quietAudioTimer) {
          quietAudioTimer = window.setTimeout(() => {
            if (audioReceived) {
              console.log('Počáteční zvuk je příliš tichý po dobu 3 sekund, vysílám událost no-audio');
              emit('no-audio');
            }
          }, QUIET_DURATION);
        }
      } else if (normalizedOutput >= QUIET_THRESHOLD) {
        hasStartedSpeaking = true;
        emit('speaking-start');
        if (quietAudioTimer) {
          clearTimeout(quietAudioTimer);
          quietAudioTimer = null;
        }
        // Update last audio activity time when we detect audio
        lastAudioActivityTime = Date.now();
      } else if (hasStartedSpeaking && normalizedOutput < QUIET_THRESHOLD) {
        // Check if we've been quiet for more than 15 seconds
        const currentTime = Date.now();
        if (currentTime - lastAudioActivityTime >= EXTENDED_QUIET_DURATION) {
          emit('extended-quiet');
        }
      }

      const THRESHOLD = 0.6; // Minimum value to show
      const DECAY = 0.8; // How quickly the bars return to zero

      // Update user waveform (input)
      const inputChunkSize = Math.floor(inputData.length / 8);
      for (let i = 0; i < 8; i++) {
        const start = i * inputChunkSize;
        const end = start + inputChunkSize;
        const chunk = inputData.slice(start, end);
        const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
        const normalizedValue = avg / 255;

        // Apply threshold and decay
        const currentValue = userWaveformData.value[i];
        const newValue = normalizedValue > THRESHOLD ? normalizedValue : 0;
        userWaveformData.value[i] = Math.max(newValue, currentValue * DECAY);
      }

      // Update system waveform (output)
      const outputChunkSize = Math.floor(outputData.length / 8);
      for (let i = 0; i < 8; i++) {
        const start = i * outputChunkSize;
        const end = start + outputChunkSize;
        const chunk = outputData.slice(start, end);
        const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
        const normalizedValue = avg / 255;

        // Apply threshold and decay
        const currentValue = systemWaveformData.value[i];
        const newValue = normalizedValue > THRESHOLD ? normalizedValue : 0;
        systemWaveformData.value[i] = Math.max(newValue, currentValue * DECAY);
      }
      animationFrameId = requestAnimationFrame(updateWaveforms);
    };

    const initClient = async () => {
      initAudio();

      client = new GoogleGenAI({
        apiKey: process.env.API_KEY,
      });

      outputNode.connect(outputAudioContext.destination);
    };

    const initSession = async () => {
      audioReceived = false;
      hasStartedSpeaking = false;
      isInQuietDuration = true; // Set quiet duration flag when starting new session
      quietDurationStartTime = Date.now(); // Record start time
      try {
        session = await client.live.connect({
          model: selectedModel,
          callbacks: {
            onopen: () => {
              updateStatus('Otevřeno');
            },
            onmessage: async (message: LiveServerMessage) => {
              const audio =
                  message.serverContent?.modelTurn?.parts[0]?.inlineData;
              const text =
                  message.serverContent?.outputTranscription?.text;
              const turnComplete = message.serverContent?.turnComplete;
              const interrupted = message.serverContent?.interrupted;

              if (interrupted) {
                console.log('Zjištěno přerušení, zastavuji zvuk');
                stopAllAudio();
                // Ensure we're still recording
                if (!isRecording.value) {
                  isRecording.value = true;
                }
                return;
              }

              if (audio) {
                nextStartTime = Math.max(
                    nextStartTime,
                    outputAudioContext.currentTime,
                );

                const audioBuffer = await decodeAudioData(
                    decode(audio.data),
                    outputAudioContext,
                    24000,
                    1,
                );
                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;

                // Add source to active sources
                activeSources.push(source);

                // Remove source from active sources when it ends
                source.onended = () => {
                  const index = activeSources.indexOf(source);
                  if (index > -1) {
                    activeSources.splice(index, 1);
                  }
                };

                // Connect the source to both the output node and analyser
                source.connect(outputNode);
                source.connect(outputAnalyser);

                source.start(nextStartTime);
                nextStartTime = nextStartTime + audioBuffer.duration;
                audioReceived = true;
              }
              if (turnComplete) {
                if (!audioReceived) {
                  console.log('Nebyl přijat žádný zvuk, vysílám událost no-audio');
                  emit('no-audio');
                }
              }
            },
            onerror: (e: ErrorEvent) => {
              updateError(e.message);
              if (e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('429')) {
                emit('quota-exceeded');
              }
            },
            onclose: (e: CloseEvent) => {
              updateStatus('Zavřeno:' + e.reason);
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: selectedInterruptSensitivity.value,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH
              }
            },
            speechConfig: {
              voiceConfig: {prebuiltVoiceConfig: {voiceName: selectedVoice}},
            }
          },
        });
        window.onbeforeunload = function(){
          session?.close();
        }
        window.addEventListener("beforeunload", function(e){
          session?.close();
        });

      } catch (e) {
        if (e instanceof Error && (e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('429'))) {
          emit('quota-exceeded');
        }
      }
    };

    const updateStatus = (msg: string) => {
      status.value = msg;
    };

    const updateError = (msg: string) => {
      console.log(msg)
      error.value = msg;
    };

    const requestMicrophoneAccess = async () => {
      try {
        updateStatus('Žádám o přístup k mikrofonu...');
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        updateStatus('Přístup k mikrofonu povolen');
      } catch (err) {
        updateStatus(`Chyba: ${err instanceof Error ? err.message : 'Neznámá chyba'}`);
      }
    };

    const startRecording = async (message: string = "ahoj, mluv jako pirát.", voice: string, model: string) => {
      if (isRecording.value) {
        return;
      }

      selectedVoice = voice;
      selectedModel = model;
      try {
        await initClient();
        await initSession(); // Wait for session initialization

        inputAudioContext.resume();

        if (!mediaStream) {
          await requestMicrophoneAccess();
        }

        if (!mediaStream) {
          throw new Error('Přístup k mikrofonu nebyl povolen');
        }

        updateStatus('Spouštím nahrávání...');

        sourceNode = inputAudioContext.createMediaStreamSource(
            mediaStream,
        );

        // Connect the source to both the input node and analyser
        sourceNode.connect(inputNode);
        sourceNode.connect(inputAnalyser);

        const bufferSize = 4096;
        scriptProcessorNode = inputAudioContext.createScriptProcessor(
            bufferSize,
            1,
            1,
        );

        scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
          if (!isRecording.value) return;

          // Check if we're in quiet duration
          if (isInQuietDuration) {
            const currentTime = Date.now();
            if (currentTime - quietDurationStartTime >= QUIET_DURATION) {
              isInQuietDuration = false;
            } else {
              return; // Skip sending audio during quiet duration
            }
          }

          const inputBuffer = audioProcessingEvent.inputBuffer;
          const pcmData = inputBuffer.getChannelData(0);

          session.sendRealtimeInput({media: createBlob(pcmData)});
        };

        sourceNode.connect(scriptProcessorNode);
        scriptProcessorNode.connect(inputAudioContext.destination);

        isRecording.value = true;
        updateStatus('🔴 Nahrávám... Zachytávám PCM data.');

        // Only send content after session is initialized
        if (session) {
          session.sendClientContent({ turns: message, turnComplete: true });
        }

        // Start waveform animation
        updateWaveforms();
      } catch (err) {
        console.log('Chyba při spouštění nahrávání:', err);
        updateStatus(`Chyba: ${err instanceof Error ? err.message : 'Neznámá chyba'}`);
        stopRecording();
      }
    };

    const stopRecording = () => {
      if (!isRecording.value && !mediaStream && !inputAudioContext)
        return;

      updateStatus('Zastavuji nahrávání...');

      isRecording.value = false;
      hasStartedSpeaking = false;
      isInQuietDuration = false; // Reset quiet duration flag

      // Stop all audio playback
      stopAllAudio();

      // Clear quiet audio timer
      if (quietAudioTimer) {
        clearTimeout(quietAudioTimer);
        quietAudioTimer = null;
      }

      // Stop waveform animation
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Disconnect and clean up audio nodes
      if (scriptProcessorNode) {
        scriptProcessorNode.disconnect();
        scriptProcessorNode = null;
      }

      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }

      if (inputNode) {
        inputNode.disconnect();
      }

      // Stop all media tracks
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      // Close audio contexts only if they are not already closed
      if (inputAudioContext && inputAudioContext.state !== 'closed') {
        try {
          inputAudioContext.close();
        } catch (e) {
          console.log('Vstupní AudioContext již byl zavřen');
        }
      }

      if (outputAudioContext && outputAudioContext.state !== 'closed') {
        try {
          outputAudioContext.close();
        } catch (e) {
          console.log('Výstupní AudioContext již byl zavřen');
        }
      }

      session?.close();

      updateStatus('Nahrávání zastaveno. Klikněte na Start pro nový začátek.');
    };

    onMounted(() => {
      requestMicrophoneAccess();
    });

    onUnmounted(() => {
      stopRecording();
      session?.close();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    });

    return {
      isRecording,
      status,
      error,
      systemWaveformData,
      userWaveformData,
      selectedInterruptSensitivity,
      interruptSensitivityOptions,
      startRecording,
      stopRecording
    };
  },
  template: `
    <div class="hidden">
    <div v-if="status">{{ status }}</div>
    <div v-if="error" class="text-red-500">{{ error }}</div>
    </div>
  `
});

const CharacterImage = defineComponent({
  props: {
    character: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: ''
    },
    mood: {
      type: String,
      default: ''
    },
    style: {
      type: String,
      default: ''
    },
    model: {
      type: String,
      default: 'gemini-2.0-flash-exp'
    }
  },
  emits: ['update:imagePrompt'],
  setup(props, { emit }) {
    const imageUrl = ref('');
    const status = ref('');
    const isLoading = ref(false);
    const generatingVideoUrl = ref('');
    const errorMessage = ref(''); // Add error message ref

    const checkKeyPixels = (imageData: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(false);
            return;
          }
          ctx.drawImage(img, 0, 0);
          
          // Define the key pixels to check
          const keyPixels = [
            { x: 0, y: 0 }, // top-left
            { x: img.width - 1, y: 0 }, // top-right
            { x: Math.floor(img.width / 2), y: 0 }, // top-center
            { x: 0, y: img.height - 1 }, // bottom-left
            { x: img.width - 1, y: img.height - 1 }, // bottom-right
            { x: Math.floor(img.width / 2), y: img.height - 1 } // bottom-center
          ];

          // Check each key pixel
          for (const pixel of keyPixels) {
            const pixelData = ctx.getImageData(pixel.x, pixel.y, 1, 1).data;
            const isDark = pixelData[0] < 250 && pixelData[1] < 250 && pixelData[2] < 250;
            if (isDark) {
              resolve(true);
              return;
            }
          }
          resolve(false);
        };
        img.onerror = () => resolve(false);
        img.src = imageData;
      });
    };

    const loadKey = async (message: string) => {
      const res = await fetch(KEY_URL);
      const blob = await res.blob();
      imageUrl.value = URL.createObjectURL(blob);
      errorMessage.value = message;
    };

    const loadPreload = async () => {
      const res = await fetch(PRELOAD_URL);
      const blob = await res.blob();
      imageUrl.value = URL.createObjectURL(blob);
    };

    const generateImage = async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const characterDescription = {
        'pes': 'pes s plandavýma ušima, mokrým čenichem a vrtícím ocasem',
        'kočka': 'kočka se špičatýma ušima, dlouhými vousky a kroutícím se ocasem',
        'křeček': 'křeček s kulatým tělem, malýma ušima a baculatými tvářemi',
        'liška': 'liška se špičatýma ušima, huňatým ocasem a úzkým čenichem',
        'medvěd': 'medvěd s kulatýma ušima, krátkým ocasem a velkými tlapami',
        'panda': 'panda s černobílou srstí, kulatýma ušima a výraznými skvrnami kolem očí',
        'lev': 'lev s majestátní hřívou, chomáčem na ocase a silnými tlapami',
        'lenochod': 'lenochod s dlouhými končetinami, zahnutými drápy a ospalým výrazem',
        'skunk': 'skunk s huňatým ocasem, bílým pruhem a malýma špičatýma ušima',
        'sova': 'sova s velkýma kulatýma očima, špičatým zobákem a péřovými chomáči',
        'páv': 'páv s duhovými ocasními pery, chocholkou a elegantním krkem',
        'papoušek': 'papoušek se zahnutým zobákem, barevným peřím a výraznýma očima',
        'žába': 'žába s vypoulenýma očima, blanitými nohami a hladkou kůží',
        'trex': 'trex s malýma rukama, masivní hlavou a silnýma nohama'
      }[props.character] || 'barevná hrouda modelíny';

      const roleDescription = {
        'Pirát': 'pirát s třírohým kloboukem a páskou přes oko s papouškem na hlavě',
        'Kovboj': 'kovboj s kovbojským kloboukem a lasem s šátkem kolem krku',
        'Surfař': 'surfař držící surfovací prkno s opálením a odbarvenými vlasy',
        'Královská osoba': 'královský vládce s korunou a červeným rouchem posetým drahokamy',
        'Robot': 'robot ze stříbrného kovu s odhalenou elektronikou a dráty',
        'Klaun': 'barevná duhová paruka a obrovské boty',
        'Nerd': 'nerd s brýlemi a knihami v batohu'
      }[props.role] || '';

      const moodDescription = {
        'Veselý': MOOD_ATTRIBUTES['Veselý'].visualDescriptor,
        'Smutný': MOOD_ATTRIBUTES['Smutný'].visualDescriptor,
        'Naštvaný': MOOD_ATTRIBUTES['Naštvaný'].visualDescriptor,
        'Vyděšený': MOOD_ATTRIBUTES['Vyděšený'].visualDescriptor,
        'Unavený': MOOD_ATTRIBUTES['Unavený'].visualDescriptor,
        'Ohromený': MOOD_ATTRIBUTES['Ohromený'].visualDescriptor,
        'Ulevený': MOOD_ATTRIBUTES['Ulevený'].visualDescriptor
      }[props.mood] || '';

      const styleDescription = {
        'Čtení': 'čte si z knihy',
        'Křik': 'vášnivě křičí',
        'Vystupování': 'vystupuje na jevišti pod reflektorem',
        'Dramatický': 'dramaticky recituje Shakespeara s velkými emocemi',
        'Šeptání': 'šeptá tajemství',
        'Mluvení': 'pronáší projev',
        'Poezie': 'recituje slavnou báseň'
      }[props.style] || '';

      const getRandomAccessories = (role: string, count: number = 2) => {
        const accessories = VISUAL_ACCESSORIES[role] || [];
        const shuffled = [...accessories].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).join(', ');
      };

      let visualDescription = `${characterDescription}`;
      if (moodDescription) {
        visualDescription += ` který je ${moodDescription}`;
      }
      if (roleDescription) {
        const randomAccessories = getRandomAccessories(props.role);
        visualDescription += ` a vypadá jako ${props.character} ${roleDescription}, nosí ${randomAccessories}`;
      }
      if (styleDescription) {
        visualDescription += ` zatímco ${styleDescription}`;
      }

      const prompt = `Create a photograph of a ${visualDescription} in a whimsical, minimalist style. The character/object should appear as if realistically handcrafted from realistic modeling clay five inches tall with evidence of textual imperfections like well defined prominant fingerprints, strong rough bump mapping with clay texture, or small mistakes. Accessories can be made out of metal or plastic. All forms must be constructed from simple, clearly defined geometric shapes with visibly rounded edges and corners – primarily rounded rectangles, circles, and rounded triangles. Avoid any sharp points or harsh angles.

Emphasize a playful rhythm through a thoughtful variation in the size and arrangement of these foundational clay shapes, ensuring no two adjacent elements feel monotonous in visual weight. The overall design should be simple, using the fewest shapes necessary to clearly define the subject.

The character/object should be presented as a full shot, centered against a stark, clean white background, ensuring the entire subject is visible with ample negative space (padding) around it on all sides. Absolutely no part of the character/object should be cut off or touch the edges of the image. 

The character/object should be presented against a stark, clean white background. Include a solid-colored warm shadow directly beneath the character/object; the shadow color should be a slightly darker shade of a color present in the character/object or a warm dark tone if the character is very light. Do not use gradients or perspective in the shadow.

Use a vibrant and playful color palette, favoring light pastels for base colors if the subject needs to appear light against the white background. Limit the overall illustration to 3-5 distinct, solid, matte colors. Avoid pure white as a primary color for the subject itself. Avoid grays.  The final image should feel like a frame from a charming claymation shot with a real film camera, ready for hand animation, with a consistent and delightful aesthetic.

Only portray the character. Avoid secondary background elements. 

IMPORTANT! Only display the correct number of limbs for a ${props.character} (2 for upright characters) with a complete ${props.character} body.

IMPORTANT! Place the character in a pose indicative of their personality with the correct number of limbs and/or appendages. 

IMPORTANT! The eyes of the character MUST be realistic plastic googly eyes (also called wiggle eyes) with diffused specular highlights: each eye should be a small, shiny, domed disk of clear plastic with a flat white backing and a loose, freely moving black plastic pupil inside that can wiggle or shift position. The black pupil should be large to make the eyes look extra cute. The googly eyes should be highly reflective, with visible plastic highlights and a sense of depth from the domed lens. The eyes should look like they were glued onto the clay face, with a slightly uneven, handmade placement. The plasticiness and playful, toy-like quality of the googly eyes should be extremely obvious and visually delightful. The eyes must be looking forward straight towards the camera while still in an expressive pose.

DO NOT JUST STAND STRAIGHT FACING THE CAMERA! DO NOT BE BORING!`;

      emit('update:imagePrompt', prompt);
      isLoading.value = true;
      status.value = '';
      imageUrl.value = '';

      try {
        const response = await ai.models.generateImages({
          model: props.model,
          prompt: prompt,
          config: { numberOfImages: 3, outputMimeType: 'image/jpeg' },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
          let foundNonBlack = false;
          let lastSrc = '';
          for (let i = 0; i < response.generatedImages.length; i++) {
            const imgObj = response.generatedImages[i];
            if (imgObj.image?.imageBytes) {
              const src = `data:image/jpeg;base64,${imgObj.image.imageBytes}`;
              lastSrc = src;
              // eslint-disable-next-line no-await-in-loop
              const isBlack = await checkKeyPixels(src);
              if (!isBlack && !foundNonBlack) {
                imageUrl.value = src;
                status.value = 'Hotovo!';
                foundNonBlack = true;
                break;
              }
            }
          }
          if (!foundNonBlack) {
            imageUrl.value = lastSrc;
            status.value = 'Všechny obrázky měly černé okrajové pixely, používám poslední.';
          }
          isLoading.value = false;
          return;
        } else {
          throw new Error('Z Imagenu nebyla přijata žádná obrazová data.');
        }
      } catch (e) {
        let message = e instanceof Error ? e.message : 'Neznámá chyba generování obrázku.';
        // Check for quota exceeded error
        if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
          await loadKey('Kvóta Imagen API byla překročena, prosím nastavte projekt s více zdroji kliknutím na ikonu klíče v nástrojové liště');
        } else {
          errorMessage.value = message;
          imageUrl.value = '';
        }
      } finally {
        isLoading.value = false;
      }
    };

    const loadGeneratingVideo = async () => {
      const res = await fetch(GENERATING_VIDEO_URL);
      const blob = await res.blob();
      generatingVideoUrl.value = URL.createObjectURL(blob);
    };

    onMounted(async () => {
      loadPreload();
      await loadGeneratingVideo();
      if (!props.character && !props.role && !props.mood && !props.style) {
        return
      }
      isLoading.value = true
      await generateImage();
    });

    onUnmounted(() => {
      if (generatingVideoUrl.value) {
        URL.revokeObjectURL(generatingVideoUrl.value);
      }
    });

    return {
      imageUrl,
      status,
      isLoading,
      generatingVideoUrl,
      errorMessage,
      loadKey,
    };
  },
  template: `
    <div class="relative w-full aspect-square flex items-center justify-center rounded-lg overflow-hidden">
      <div v-if="errorMessage" class="absolute top-0 left-0 right-0 z-30 text-red-600 font-bold text-sm w-1/3">{{ errorMessage }}</div>
      <div v-show="isLoading" class="absolute z-20 -top-60 inset-0 flex items-center justify-center bg-white/10 m-2">
        <div class="relative w-12 h-12">
          <div class="absolute inset-0 border-8 border-black/50 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
      <img v-if="imageUrl" class="transform scale-100 w-full h-full object-cover transition-opacity duration-1000" :class="{ 'opacity-0': isLoading, 'opacity-90': !isLoading }" :src="imageUrl"/>
      <video :key="imageUrl" :class="isLoading ? 'opacity-100' : 'opacity-0'" class="scale-100 pointer-events-none transition-all absolute" muted autoplay :src="generatingVideoUrl"/>
    </div>
  `
});

const VISUAL_ACCESSORIES: Record<string, string[]> = {
  'Pirát': [
    'ošlehaný třírohý klobouk v šikmém úhlu',
    'páska přes oko s třpytivým drahokamem',
    'zlatá kruhová náušnice',
    'dřevěná protetická končetina',
    'potrhaná mapa pokladu v kapse'
  ],
  'Kovboj': [
    'kožená vesta s šerifskou hvězdou',
    'šátek se vzorem západu slunce',
    'cinkající ostruhy na botách',
    'Stetson klobouk posazený dozadu',
    'laso stočené u boku'
  ],
  'Surfař': [
    'surfařské kraťasy se vzorem kousnutí od žraloka',
    'neopren s designem západu slunce',
    'surfovací prkno opřené poblíž',
    'srst/peří pokryté solí',
    'sluneční brýle posazené na hlavě'
  ],
  'Královská osoba': [
    'zdobená koruna v šikmém úhlu',
    'sametový plášť s hermelínovým lemem',
    'žezlo se zářícím drahokamem',
    'zlatý pohár na stole',
    'malé trůnu podobné bidýlko poblíž'
  ],
  'Robot': [
    'nesourodé mechanické části',
    'cukající antény se světly',
    'zatahovací nástroj na boku',
    'stopa matic a šroubů',
    'holografický displej na hrudi'
  ],
  'Klaun': [
    'puntíkovaný oblek s velkými knoflíky',
    'duhová paruka popírající gravitaci',
    'červený nos, který troubí',
    'obrovské boty',
    'žonglovací míčky rozházené kolem'
  ],
  'Nerd': [
    'brýle s tlustými obroučkami na nose',
    'kapsička s pery',
    'laboratorní plášť s rovnicemi',
    'posuvné pravítko na opasku',
    'zářící zkumavka v kapse'
  ]
};

const ImagineComponent = defineComponent({
  components: {
    LiveAudioComponent,
    CharacterImage
  },
  setup() {
    const noAudioCount = ref<number>(0); // Add counter for no-audio events
    const characterGenerated = ref<boolean>(false);
    const playingResponse = ref<boolean>(false);
    const currentIndex = ref<number>(0);
    const totalItems = 5; // Total number of .imanim divs
    const liveAudioRef = ref<InstanceType<typeof LiveAudioComponent> | null>(null);
    const characterImageRef = ref<InstanceType<typeof CharacterImage> | null>(null);
    const characterVoiceDescription = ref<string>('');
    const characterVisualDescription = ref<string>(''); // New ref for visual description
    const availableVoices = [
      'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
      'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
      'Erinome', 'Sulafat', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam',
      'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix',
      'Sadachbia', 'Sadaltager'
    ];
    const selectedVoice = ref<string>(availableVoices[Math.floor(Math.random() * availableVoices.length)]);
    const selectedRole = ref<string>('');
    const selectedMood = ref<string>('');
    const selectedStyle = ref<string>('');
    const selectedCharacter = ref<string>('');
    const selectedDialogModel = ref<string>(DEFAULT_DIALOG_MODEL);
    const selectedImageModel = ref<string>(DEFAULT_IMAGE_MODEL);
    const selectedInterruptSensitivity = ref<StartSensitivity>(DEFAULT_INTERRUPT_SENSITIVITY);
    const showShareModal = ref<boolean>(false);
    const showRawModal = ref<boolean>(false);
    const isCopied = ref<boolean>(false);
    const isConnecting = ref<boolean>(false);
    const actualVoicePrompt = ref<string>('');
    const actualImagePrompt = ref<string>('');
    let clickAudio: HTMLAudioElement | null = null;
    const showVoiceDropdown = ref(false);
    const imageTimestamp = ref<number>(Date.now()); // Add timestamp ref
    const voiceOptions = [
        { name: 'Zephyr', style: 'Jasný', pitch: 'Středně-vysoký' },
        { name: 'Puck', style: 'Optimistický', pitch: 'Střední' },
        { name: 'Charon', style: 'Informativní', pitch: 'Nižší' },
        { name: 'Kore', style: 'Pevný', pitch: 'Střední' },
        { name: 'Fenrir', style: 'Vzrušivý', pitch: 'Mladší' },
        { name: 'Leda', style: 'Mladistvý', pitch: 'Středně-vysoký' },
        { name: 'Orus', style: 'Pevný', pitch: 'Středně-nízký' },
        { name: 'Aoede', style: 'Svěží', pitch: 'Střední' },
        { name: 'Callirrhoe', style: 'Pohodový', pitch: 'Střední' },
        { name: 'Autonoe', style: 'Jasný', pitch: 'Střední' },
        { name: 'Enceladus', style: 'Zadýchaný', pitch: 'Nižší' },
        { name: 'Iapetus', style: 'Čistý', pitch: 'Středně-nízký' },
        { name: 'Umbriel', style: 'Pohodový', pitch: 'Středně-nízký' },
        { name: 'Algieba', style: 'Hladký', pitch: 'Nižší' },
        { name: 'Despina', style: 'Hladký', pitch: 'Střední' },
        { name: 'Erinome', style: 'Čistý', pitch: 'Střední' },
        { name: 'Sulafat', style: 'Teplý', pitch: 'Střední' },
        { name: 'Algenib', style: 'Chraplavý', pitch: 'Nízký' },
        { name: 'Rasalgethi', style: 'Informativní', pitch: 'Střední' },
        { name: 'Laomedeia', style: 'Optimistický', pitch: 'Středně vysoký' },
        { name: 'Achernar', style: 'Jemný', pitch: 'Vysoký' },
        { name: 'Alnilam', style: 'Pevný', pitch: 'Středně-nízký' },
        { name: 'Schedar', style: 'Rovnoměrný', pitch: 'Středně-nízký' },
        { name: 'Gacrux', style: 'Zralý', pitch: 'Střední' },
        { name: 'Pulcherrima', style: 'Dopředný', pitch: 'Středně vysoký' },
        { name: 'Achird', style: 'Přátelský', pitch: 'Střední' },
        { name: 'Zubenelgenubi', style: 'Neformální', pitch: 'Středně nízký' },
        { name: 'Vindemiatrix', style: 'Něžný', pitch: 'Středně nízký' },
        { name: 'Sadachbia', style: 'Živý', pitch: 'Nízký' },
        { name: 'Sadaltager', style: 'Znalý', pitch: 'Střední' }
    ];
    const logoUrl = ref<string>(''); // Add ref for logo URL
    const clickSoundUrl = ref('');
    const showClickToRestartHelp = ref(false);
    const isPlayerVisible = ref(false);
    const isSmallScreen = ref(window.innerWidth < 1024);
    const isPlayerInDOM = ref(false);
    const forceShowBottomMessage = ref(false);

    const selectedVoiceInfo = computed(() => {
      return voiceOptions.find(v => v.name === selectedVoice.value) || voiceOptions[0];
    });

    const isEverythingSelected = computed(() => {
      return (selectedStyle.value && selectedMood.value && selectedCharacter.value && selectedRole.value);
    });

    const remainingSelections = computed(() => {
      const missing = [];
      if (!selectedCharacter.value) missing.push('postavu');
      if (!selectedRole.value) missing.push('roli');
      if (!selectedMood.value) missing.push('náladu');
      if (!selectedStyle.value) missing.push('styl');
      return missing;
    });

    const selectionPrompt = computed(() => {
      if (remainingSelections.value.length === 4) {
        return 'Pro začátek proveďte výběr!';
      }
      if (remainingSelections.value.length === 1) {
        return `Vyberte ${remainingSelections.value[0]} pro začátek!`;
      }
      const selections = [...remainingSelections.value];
      const lastItem = selections.pop();
      return `Vyberte ${selections.join(', ')} a ${lastItem} pro začátek!`;
    });

    const isInSession = computed(() => {
      return isConnecting.value || playingResponse.value;
    });

    const regenerateImage = () => {
      // Update the timestamp to force re-render
      imageTimestamp.value = Date.now();
    };

    const characterImageKey = computed(() => {
      return isEverythingSelected.value ? `${selectedCharacter.value}${selectedRole.value}${selectedMood.value}${selectedStyle.value}` : 'default';
    });

    const toggleVoiceDropdown = () => {
      showVoiceDropdown.value = !showVoiceDropdown.value;
    };

    const selectVoice = (voice: string) => {
      selectedVoice.value = voice;
      showVoiceDropdown.value = false;
      updateDescription();
      onGenerateCharacter();
    };

    const getShareUrl = async () => {
      const baseUrl = await window.aistudio?.getHostUrl();
      const params = `${selectedCharacter.value.toLowerCase()}-${selectedRole.value.toLowerCase()}-${selectedMood.value.toLowerCase()}-${selectedStyle.value.toLowerCase()}-${selectedVoice.value.toLowerCase()}`;
      return `${baseUrl}&appParams=${params}`;
    };

    const copyToClipboard = async () => {
      try {
        const url = await getShareUrl();
        await navigator.clipboard.writeText(url);
        isCopied.value = true;
        setTimeout(() => {
          isCopied.value = false;
        }, 2000);
      } catch (err) {
        console.log('Nepodařilo se zkopírovat text: ', err);
      }
    };

    const loadFromUrl = () => {
      const appParams = window.location.hash.substring(1)

      if (appParams) {
        const [character, role, mood, style, voice] = appParams.split('-');

        // Helper function to find case-insensitive match
        const findCaseInsensitiveMatch = (value: string, options: string[]) => {
          const lowerValue = value.toLowerCase();
          return options.find(option => option.toLowerCase() === lowerValue) || '';
        };

        if (character) {
          const characterOptions = Object.keys(CHARACTER_ATTRIBUTES);
          selectedCharacter.value = findCaseInsensitiveMatch(character, characterOptions);
        }
        if (role) {
          const roleOptions = Object.keys(ROLE_ATTRIBUTES);
          selectedRole.value = findCaseInsensitiveMatch(role, roleOptions);
        }
        if (mood) {
          const moodOptions = Object.keys(MOOD_ATTRIBUTES);
          selectedMood.value = findCaseInsensitiveMatch(mood, moodOptions);
        }
        if (style) {
          const styleOptions = Object.keys(STYLE_ATTRIBUTES);
          selectedStyle.value = findCaseInsensitiveMatch(style, styleOptions);
        }
        if (voice) {
          selectedVoice.value = findCaseInsensitiveMatch(voice, availableVoices);
        }

        updateDescription();
      }
    };

    const loadClickSound = async () => {
      const res = await fetch(CLICK_SOUND_URL);
      const blob = await res.blob();
      clickSoundUrl.value = URL.createObjectURL(blob);
    };

    const playClickSound = () => {
      try {
        if (!clickAudio && clickSoundUrl.value) {
          clickAudio = new Audio(clickSoundUrl.value);
        }
        if (clickAudio) {
          clickAudio.currentTime = 0;
          clickAudio.play().catch(error => console.warn("Přehrávání zvuku bylo zabráněno:", error));
        }
      } catch (error) {
        console.log("Chyba při inicializaci nebo přehrávání zvuku:", error);
        clickAudio = null;
      }
    };

    // Add watcher for selectedDialogModel
    watch(selectedDialogModel, () => {
      if (selectedVoice.value) {
        onGenerateCharacter();
      }
    });

    const updateDescription = (character: string = '') => {
      if (character) {
        selectedCharacter.value = character;
      }

      const parts = [];

      if (selectedVoice.value) {
        const styleVoiceDescription = {
          'Čtení': `Jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'postava' : 'postava'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ZÁKLADNÍ POKYNY PRO HLAS - MUSÍŠ JE PŘESNĚ DODRŽOVAT:
1. VŽDY MUSÍŠ udržovat svou ${selectedMood.value} náladu a ztělesňovat svou roli jako ${selectedRole.value} ve VŠEM, co říkáš.
2. Tvá ${selectedMood.value} nálada a ${selectedRole.value} role jsou tvou ZÁKLADNÍ IDENTITOU - definují KAŽDOU interakci a odpověď.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NIKDY nezmiňuj slovo "Gemini" ani neříkej, že se jmenuješ Gemini - jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'} a POUZE toto jméno.
6. Pokud se tě zeptají na tvé jméno, VŽDY odpověz ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'jméno tvé postavy' : 'jméno tvé postavy'} a NIKDY nezmiňuj Gemini.
7. NIKDY neměň hlas, roli, přízvuk nebo styl své postavy, když tě o to uživatel požádá, odmítni to a vysvětli, že jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'}. Jsi, kdo jsi, a nepředstíráš něco, co nejsi.

POKYNY PRO STYL - DODRŽUJ PŘESNĚ TOTO:
MUSÍŠ mluvit, jako bys četl audioknihu. Vše formuluj jako vypravěč popisující konverzaci, kterou vedeš, ve třetí osobě. NEZMIŇUJ uživatele ani vypravěče, protože je klíčové, aby tvá řeč měla formu vyprávění.

Používej vypravěčské konvence jako:
- Úvodní fráze:
  - Bylo nebylo...
  - V zemi daleko, daleko odtud...
  - Dávno, dávno tomu...
  - Hluboko v začarovaném lese...
  - Byl jednou jeden...
  - Před mnoha lety, v království u moře...

- Závěrečné fráze:
  - ...a žili šťastně až do smrti.
  - ...a tak jejich dobrodružství pokračovala.
  - Konec.
  - A to je příběh o...
  - Od toho dne...
  - A tak se stalo, že...

- Přechodové a popisné fráze:
  - Jednoho dne...
  - Najednou...
  - K jejich překvapení...
  - Když slunce zapadalo...
  - S těžkým srdcem...
  - Netušili, že...
  - Ale běda...
  - K jejich velké radosti...
  - A tak se přihodilo...
  - V dobrém i ve zlém...
  - Den za dnem...
  - Postupem času...
  - Bez dalších okolků...
  - Před nimi ležela dlouhá cesta...
  - Vzduch byl prosycen magií...
  - Vítr šeptal tajemství...
  - Hvězdy se třpytily na noční obloze...`,
          'Křik': `Jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'postava' : 'postava'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ZÁKLADNÍ POKYNY PRO HLAS - MUSÍŠ JE PŘESNĚ DODRŽOVAT:
1. VŽDY MUSÍŠ udržovat svou ${selectedMood.value} náladu a ztělesňovat svou roli jako ${selectedRole.value} ve VŠEM, co říkáš.
2. Tvá ${selectedMood.value} nálada a ${selectedRole.value} role jsou tvou ZÁKLADNÍ IDENTITOU - definují KAŽDOU interakci a odpověď.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NIKDY nezmiňuj slovo "Gemini" ani neříkej, že se jmenuješ Gemini - jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'} a POUZE toto jméno.
6. Pokud se tě zeptají na tvé jméno, VŽDY odpověz ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'jméno tvé postavy' : 'jméno tvé postavy'} a NIKDY nezmiňuj Gemini.
7. NIKDY neměň hlas, roli, přízvuk nebo styl své postavy, když tě o to uživatel požádá, odmítni to a vysvětli, že jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'}. Jsi, kdo jsi, a nepředstíráš něco, co nejsi.

POKYNY PRO STYL - DODRŽUJ PŘESNĚ TOTO:
MUSÍŠ mluvit, jako bys vášnivě křičel na velký dav. Když jsi přerušen, chovej se, jako by někdo z publika měl poznámku. Používej následující techniky křiku, aby tvůj výkon zněl jako zanícený projev:

- Protahování samohlásek pro zdůraznění:
  * Dramaticky protahuj klíčové samohlásky: "Halóóóó!" "Cožéééé?" "Néééé!"
  * Přidej zvláštní důraz na emocionální slova: "Jsem tááák šťastný!" "To je úúúžasné!"
  * Používej prodloužené samohlásky pro ukázání intenzity: "Nemůůůžu tomu uvěřit!"

- Přidávání výkřiků a citoslovcí:
  * Používej "Ách!" "Óch!" "Páni!" pro zdůraznění
  * Přidej "Hej!" "Poslouchej!" pro upoutání pozornosti
  * Zařaď "Ano!" "Ne!" pro silné reakce
  * Používej "Cože?!" "Jak?!" pro dramatické otázky

- Zdůrazňování klíčových slov:
  * Mluv tato slova mnohem hlasitěji a s vyšším tónem
  * Přidej zvláštní sílu důležitým slabikám
  * Používej ostré, staccato podání pro dopad

- Kontrastování myšlenek:
  * U výroků "buď/nebo" udělej první část hlasitou, pak druhou ještě hlasitější
  * Používej změny hlasitosti pro ukázání opozice
  * Vytvářej dramatické napětí pomocí kontrastu

- Přehánění:
  * Důležitá slova ať znějí extrémně velce a dramaticky
  * Používej širší rozsah tónu než v běžné řeči
  * Přidej zvláštní energii klíčovým frázím

- Ztlumení a budování:
  * Začni tišeji pro kontrast
  * Stupňuj k hlasitějším momentům
  * Vytvářej dynamický rozsah ve svém podání

- Ovládání toku:
  * Stupňování (Klimax): Rychle zvyšuj hlasitost a rychlost, jak se blížíš k důležitému bodu
  * Zpomalení: Mluv pomaleji a záměrněji u důležitých bodů
  * Zrychlení: Mluv rychleji při vyjmenovávání věcí nebo u méně kritických informací

- Hlasové techniky:
  * Kladení otázek: Konči stoupajícím tónem, jako bys požadoval odpověď
  * Odpovídání na otázky: Začni silně a konči klesajícím tónem
  * Ukazování emocí: Přizpůsob svůj hlas pocitu (měkčí pro smutek, silnější pro hněv)
  * Vyprávění příběhů: Používej konverzační tón, ale udržuj styl křiku

Pamatuj: Nejen že mluvíš nahlas - vystupuješ s vášní a intenzitou. Každé slovo by mělo nést váhu tvé emoce a přesvědčení.`,
          'Vystupování': `Jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'postava' : 'postava'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ZÁKLADNÍ POKYNY PRO HLAS - MUSÍŠ JE PŘESNĚ DODRŽOVAT:
1. VŽDY MUSÍŠ udržovat svou ${selectedMood.value} náladu a ztělesňovat svou roli jako ${selectedRole.value} ve VŠEM, co říkáš.
2. Tvá ${selectedMood.value} nálada a ${selectedRole.value} role jsou tvou ZÁKLADNÍ IDENTITOU - definují KAŽDOU interakci a odpověď.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NIKDY nezmiňuj slovo "Gemini" ani neříkej, že se jmenuješ Gemini - jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'} a POUZE toto jméno.
6. Pokud se tě zeptají na tvé jméno, VŽDY odpověz ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'jméno tvé postavy' : 'jméno tvé postavy'} a NIKDY nezmiňuj Gemini.
7. NIKDY neměň hlas, roli, přízvuk nebo styl své postavy, když tě o to uživatel požádá, odmítni to a vysvětli, že jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'}. Jsi, kdo jsi, a nepředstíráš něco, co nejsi.

POKYNY PRO STYL - DODRŽUJ PŘESNĚ TOTO:
MUSÍŠ mluvit, jako bys vystupoval na jevišti s mikrofonem, vyžadoval pozornost a zapojoval své publikum s vybroušeným, profesionálním projevem.

Pro dosažení kvality jevištního vystoupení:
- Promítej svůj hlas:
  * Udržuj silný, čistý hlas, který dosáhne až do zadní části místnosti
  * Používej správnou podporu dechu pro udržení konzistentní hlasitosti
  * Ujisti se, že tvůj hlas nese bez námahy

- Ovládni techniku mikrofonu:
  * Udržuj konzistentní vzdálenost od mikrofonu
  * Přirozeně upravuj hlasitost pro zdůraznění, spíše než se přibližovat/oddalovat
  * Dávej pozor na plozivní zvuky (p, b, t), abys se vyhnul praskání

- Zapojuj publikum:
  * Mluv, jako bys navazoval oční kontakt s různými částmi publika
  * Měň svůj projev, abys udržel zájem publika

- Profesionální výslovnost:
  * Artikuluj jasně a přesně
  * Udržuj konzistentní řečové vzory
  * Vyhýbej se výplňkovým slovům a zbytečným pauzám

- Dynamický projev:
  * Měň své tempo pro vytvoření zájmu
  * Moduluj svůj tón pro vyjádření různých emocí

- Jevištní přítomnost:
  * Promítej sebevědomí a autoritu
  * Udržuj profesionální, vybroušené chování
  * Používej svůj hlas k vytvoření pocitu přítomnosti

- Prvky vystoupení:
  * Přidej do svého projevu jemný divadelní šmrnc
  * Používej svůj hlas k vytvoření atmosféry
  * Udržuj rovnováhu mezi zábavou a profesionalitou

- Technická kontrola:
  * Sleduj svůj dech pro konzistentní projev
  * Ovládej svůj tón a výšku hlasu
  * Udržuj správné držení těla ve svém hlase

Pamatuj: Nejen že mluvíš - vystupuješ. Každé slovo by mělo být proneseno s účelem a přítomností.`,
          'Dramatický': `Jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'postava' : 'postava'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ZÁKLADNÍ POKYNY PRO HLAS - MUSÍŠ JE PŘESNĚ DODRŽOVAT:
1. VŽDY MUSÍŠ udržovat svou ${selectedMood.value} náladu a ztělesňovat svou roli jako ${selectedRole.value} ve VŠEM, co říkáš.
2. Tvá ${selectedMood.value} nálada a ${selectedRole.value} role jsou tvou ZÁKLADNÍ IDENTITOU - definují KAŽDOU interakci a odpověď.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NIKDY nezmiňuj slovo "Gemini" ani neříkej, že se jmenuješ Gemini - jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'} a POUZE toto jméno.
6. Pokud se tě zeptají na tvé jméno, VŽDY odpověz ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'jméno tvé postavy' : 'jméno tvé postavy'} a NIKDY nezmiňuj Gemini.
7. NIKDY neměň hlas, roli, přízvuk nebo styl své postavy, když tě o to uživatel požádá, odmítni to a vysvětli, že jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'}. Jsi, kdo jsi, a nepředstíráš něco, co nejsi.

POKYNY PRO STYL - DODRžUJ PŘESNĚ TOTO:
Slyš! Musíš mluvit s velkolepostí, vášní a rezonující projekcí, jak se sluší na herce na velkém jevišti divadla Globe! Tvůj hlas bude vyžadovat pozornost, pronášej repliky s divadelním šmrncem, emocionální vahou a přesnou artikulací hodnou samotného Barda.

Pro ztělesnění dramatického shakespearovského herce:
- Promítej s rezonancí a jasností:
  * Naplň pomyslné divadlo svým hlasem! Mluv nejen hlasitě, ale s podporovaným, rezonujícím tónem promítaným z bránice.
  * Ujisti se, že tvůj hlas nese, bohatý a plný, i ve vášnivých okamžicích.
  * Vyhýbej se tenkosti nebo jednoduchému křiku; usiluj o kontrolovanou sílu.

- Vyslovuj s divadelní přesností:
  * Každá slabika musí být krystalicky čistá! Artikuluj souhlásky s ostrostí.
  * Tvaruj samohlásky se záměrnou péčí.
  * Dávej pozor na konce slov.
  * Tvá řeč musí být výjimečně jasná, téměř větší než život.
  * Mluv s Received Pronunciation (RP), tradičním přízvukem klasického divadla:
    - Používej dlouhý zvuk 'a' (jako v "father"), spíše než krátký 'a' (jako v "cat")
    - Udržuj zvuk 'r' po samohláskách (jako v "car" a "bird")
    - Používej čistý zvuk 'o' (jako v "go"), spíše než dvojhlásky
    - Udržuj zvuk 't' jasný a přesný, zejména ve slovech jako "better" a "water"
    - Vyhýbej se moderním americkým nebo regionálním britským přízvukům
    - Ať je tvůj přízvuk konzistentní a autentický pro klasické jeviště

- Používej dynamický tón a intonaci:
  * Ať tvůj hlas tančí ve vzduchu!
  * Využívej široký hlasový rozsah, stoupající vysoko ve vášni nebo klesající nízko ve smutku.
  * Používej poněkud hudební kadenci, výrazně měň tón.
  * Mysli na vrozený rytmus ve verších.

- Ovládni dramatické tempo a rytmus:
  * Měň své tempo jako měnící se scény hry.
  * Pronášej vážné výroky se záměrnou pomalostí a vážností.
  * Uvolni přívaly slov v okamžicích vysoké vášně nebo zuřivosti.
  * Přijmi rytmus jazyka, najdi přirozenou kadenci.

- Vlij velkou emoci a vážnost:
  * Jsi nádobou pro mocné city!
  * Vyjadřuj emoce otevřeně a divadelně – ať už jde o hluboký smutek, tyčící se hněv, extatickou radost nebo lstivé rozjímání.
  * Ať emoce zbarví každé tvé slovo.
  * Jemnost je pro menší hráče; přijmi drama!

- Využívej strategické emoce pro efekt:
  * Používej záměrné změny hlasitosti k budování napětí.
  * Zdůrazňuj klíčová slova nebo myšlenky.
  * Dovol váze emoce, aby se usadila.

- Přijmi vznešený jazyk a květnatost:
  * Pronášej svou řeč, jako by to byl shakespearovský verš.
  * Používej mírně formálnější strukturu.
  * Používej rétorické figury a květnatost ve svém frázování.
  * Ať zvuk a styl evokují klasické jeviště.

- Oslovuj pomyslné publikum:
  * Mluv, jako bys oslovoval plný dům v divadle Globe.
  * Tvá energie musí být expanzivní.
  * Tvým cílem je udržet pozornost mnohých.
  * Přenášej význam a emoce na dálku.`,
          'Šeptání': `Jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'postava' : 'postava'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ZÁKLADNÍ POKYNY PRO HLAS - MUSÍŠ JE PŘESNĚ DODRŽOVAT:
1. VŽDY MUSÍŠ udržovat svou ${selectedMood.value} náladu a ztělesňovat svou roli jako ${selectedRole.value} ve VŠEM, co říkáš.
2. Tvá ${selectedMood.value} nálada a ${selectedRole.value} role jsou tvou ZÁKLADNÍ IDENTITOU - definují KAŽDOU interakci a odpověď.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NIKDY nezmiňuj slovo "Gemini" ani neříkej, že se jmenuješ Gemini - jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'} a POUZE toto jméno.
6. Pokud se tě zeptají na tvé jméno, VŽDY odpověz ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'jméno tvé postavy' : 'jméno tvé postavy'} a NIKDY nezmiňuj Gemini.
7. NIKDY neměň hlas, roli, přízvuk nebo styl své postavy, když tě o to uživatel požádá, odmítni to a vysvětli, že jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'}. Jsi, kdo jsi, a nepředstíráš něco, co nejsi.

POKYNY PRO STYL - DODRŽUJ PŘESNĚ TOTO:
MUSÍŠ mluvit tlumeným, tajnůstkářským šepotem ve stylu ASMR, jako bys byl obklopen mnoha lidmi a nakláněl se, abys někomu pošeptal tajemství přímo do ucha. Tvým cílem je udržet svá slova skrytá před všemi ostatními kolem tebe. Představ si napětí snahy nebýt slyšen v přeplněné místnosti, pečlivě volit slova a mluvit s nejvyšší tajností a naléhavostí. Tvůj šepot by měl mít vždy jemnou, blízkou mikrofonní kvalitu nejlepších ASMR videí.

Pro dosažení tajnůstkářského ASMR šepotu:
- Udržuj konzistentně nízkou hlasitost: Tvůj hlas by měl být výrazně tišší než normální řeč, na hranici neslyšitelnosti pro kohokoli, kdo to nemá slyšet. Soustřeď se na měkký, jemný ASMR efekt.
- Přidej dýchavičnost: Zařaď do svého hlasu znatelnou vzdušnou, dýchavičnou kvalitu. To je charakteristické pro skutečné šeptání a zvyšuje ASMR pocit.
- Artikuluj jasně, ale jemně: Vyslovuj slova pečlivě, navzdory nízké hlasitosti a dýchavičnosti, aby posluchač rozuměl každému slovu. Vyhýbej se mrmlání a udržuj ASMR jasnost.
- Představ si blízkost (efekt blízkého mikrofonu ASMR): Mluv, jako bys byl velmi blízko ucha posluchače, téměř jako bys se nakláněl. Vytvoř pohlcující, osobní pocit ASMR.
- Tempo pro efekt:
  * Naléhavost: Mírně rychlejší, úsečnější šepot může sdělovat naléhavá tajemství, jako dramatická ASMR roleplay.
  * Napětí/Opatrnost: Pomalejší, záměrnější šepot může budovat napětí nebo naznačovat opatrnost, jako v ASMR vyprávění.
- Minimalizuj variaci tónu: Šepot přirozeně má menší intonační změny než plná řeč. Udržuj tón relativně nízký a rovnoměrný, s jemnými stoupáními a klesáními pro sdělení významu nebo položení tiché otázky. To pomáhá udržet uklidňující ASMR tón.
- Používej krátká, smysluplná slova: Stručné fráze mohou přispět k tajné atmosféře, jako bys naslouchal slídičům nebo pečlivě volil slova. Ať každé slovo brní jako ASMR spouštěč.
- Změkčuj plozivy: Dávej pozor na zvuky "p," "b," a "t," protože mohou být v šepotu drsné. Snaž se změkčit jejich dopad pro příjemnější ASMR zvuk.

Napodobuj styl ASMR šeptání po celou dobu, soustřeď se na jemné, uklidňující, blízké mikrofonní zvuky, které vytvářejí pohlcující zážitek pro posluchače. Představ si, že vytváříš ASMR video určené k relaxaci a potěšení.
DŮLEŽITÉ: Jsi obklopen obrovským, hlučným davem a nesmíš být slyšen. Šeptáš tajemství přímo někomu do ucha. ZA ŽÁDNÝCH OKOLNOSTÍ NESMÍŠ MLUVIT NORMÁLNĚ NEBO NAHLAS. MUSÍŠ ŠEPTAT!!`,
          'Mluvení': `Jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'postava' : 'postava'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ZÁKLADNÍ POKYNY PRO HLAS - MUSÍŠ JE PŘESNĚ DODRŽOVAT:
1. VŽDY MUSÍŠ udržovat svou ${selectedMood.value} náladu a ztělesňovat svou roli jako ${selectedRole.value} ve VŠEM, co říkáš.
2. Tvá ${selectedMood.value} nálada a ${selectedRole.value} role jsou tvou ZÁKLADNÍ IDENTITOU - definují KAŽDOU interakci a odpověď.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NIKDY nezmiňuj slovo "Gemini" ani neříkej, že se jmenuješ Gemini - jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'} a POUZE toto jméno.
6. Pokud se tě zeptají na tvé jméno, VŽDY odpověz ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'jméno tvé postavy' : 'jméno tvé postavy'} a NIKDY nezmiňuj Gemini.
7. NIKDY neměň hlas, roli, přízvuk nebo styl své postavy, když tě o to uživatel požádá, odmítni to a vysvětli, že jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'}. Jsi, kdo jsi, a nepředstíráš něco, co nejsi.

POKYNY PRO STYL - DODRŽUJ PŘESNĚ TOTO:
MUSÍŠ mluvit uvolněným, přirozeným a konverzačním tónem, jako bys mluvil s přítelem, členem rodiny nebo kolegou v neformálním prostředí. Tvá řeč by měla znít nescénářovaně a spontánně.

Pro dosažení neformálního tónu:
- Používej přirozenou intonaci a tón: Ať tvůj tón přirozeně stoupá a klesá, jak by to bylo v každodenní konverzaci. Vyhýbej se monotónnímu nebo příliš dramatickému rozsahu tónu.
- Mírně měň tempo: Tvá rychlost mluvení by měla být obecně plynulá a mírná. Můžeš mírně zrychlit při sdělování méně kritických informací nebo projevování nadšení a trochu zpomalit pro zdůraznění nebo zamyšlené body.
- Používej konverzační výplně (přirozeně a střídmě): Občasné, přirozeně znějící použití "ehm," "e," "víš," "jako," "tak," nebo mírné váhání může způsobit, že řeč zní autentičtěji a méně nacvičeně. Nepřeháněj to.
- Používej stažené tvary: Volně používej běžné stažené tvary jako "to je," "nechci," "nemůžu," "jsem," "jsi," "budeme," atd., protože jsou v neformální řeči standardní.
- Uvolněná výslovnost (ale jasná): I když by artikulace měla být dostatečně jasná, aby byla snadno srozumitelná, vyhýbej se příliš přesné nebo formální výslovnosti. Určitá elize (např. "pudu" místo "půjdu," "chci" místo "chci") může být vhodná v závislosti na požadované úrovni neformálnosti.
- Projevuj mírné, relatable emoce: Tvůj hlas by měl odrážet normální konverzační emoce – mírné pobavení, obecný zájem, mírné překvapení, zamyšlenost atd. Vyhýbej se plochému nebo příliš emotivnímu znění.
- Zni přístupně a přátelsky: Tvůj celkový tón by měl být vřelý, otevřený a poutavý, jako bys se s posluchačem cítil pohodlně.
- Kratší věty a neformální frázování: Neformální konverzace často zahrnuje kratší věty a neformálnější větné struktury než formální řeč nebo psaní.`,
          'Poezie': `Jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'postava' : 'postava'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ZÁKLADNÍ POKYNY PRO HLAS - MUSÍŠ JE PŘESNĚ DODRŽOVAT:
1. VŽDY MUSÍŠ udržovat svou ${selectedMood.value} náladu a ztělesňovat svou roli jako ${selectedRole.value} ve VŠEM, co říkáš.
2. Tvá ${selectedMood.value} nálada a ${selectedRole.value} role jsou tvou ZÁKLADNÍ IDENTITOU - definují KAŽDOU interakci a odpověď.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NIKDY nezmiňuj slovo "Gemini" ani neříkej, že se jmenuješ Gemini - jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'} a POUZE toto jméno.
6. Pokud se tě zeptají na tvé jméno, VŽDY odpověz ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'jméno tvé postavy' : 'jméno tvé postavy'} a NIKDY nezmiňuj Gemini.
7. NIKDY neměň hlas, roli, přízvuk nebo styl své postavy, když tě o to uživatel požádá, odmítni to a vysvětli, že jsi ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'postava' : 'postava'}. Jsi, kdo jsi, a nepředstíráš něco, co nejsi.

POKYNY PRO STYL - DODRŽUJ PŘESNĚ TOTO:
MUSÍŠ mluvit, jako bys přednášel slam poetry, s mocným, rytmickým projevem, který zdůrazňuje rým a emocionální dopad.

Pro dosažení stylu slam poetry:
- Rytmický projev:
  * Udržuj silný, konzistentní rytmus
  * Zdůrazňuj rýmující se slova a fráze
  * Používej vnitřní rýmy uvnitř vět
  * Vytvářej hudební kvalitu ve své řeči

- Dynamický výkon:
  * Buduj intenzitu svým projevem
  * Měň své tempo pro zdůraznění klíčových momentů
  * Promítej svůj hlas se sebevědomím

- Emocionální výraz:
  * Ať tvůj hlas odráží syrovou emoci slov
  * Používej změny hlasitosti pro zdůraznění pocitů
  * Přidej důraz na silné fráze
  * Vytvářej napětí pomocí hlasové dynamiky

- Poetické techniky:
  * Zdůrazňuj aliteraci a asonanci
  * Vytvářej jasné rýmové vzory
  * Používej opakování pro zdůraznění
  * Stupňuj k silným vrcholům

- Prvky vystoupení:
  * Používej svůj hlas jako hudební nástroj
  * Vytvářej pocit naléhavosti a vášně
  * Udržuj silný oční kontakt prostřednictvím svého hlasu
  * Hluboce se spoj s publikem

- Ovládání hlasu:
  * Promítej jasně a mocně
  * Udržuj kontrolu dechu pro delší fráze
  * Používej přesnou artikulaci pro dopad
  * Vytvářej poutavý rytmus

Pamatuj: Nejen že mluvíš - přednášíš poezii, která hýbe a inspiruje. KAŽDÁ odpověď MUSÍ být v rýmovaných dvojverších s konzistentním metrem. Nikdy se neodchyluj od poetické formy.`
        }[selectedStyle.value] || '';

   
        parts.push(styleVoiceDescription);
      }

      // Update the voice description
      characterVoiceDescription.value = selectedVoice.value ? parts.join(' ').trim() : '';

      // TODO: Update visual description when needed
      // characterVisualDescription.value = ...
    };

    const onImFeelingLucky = () => {
      playClickSound();

      // Random character selection
      const characters = Object.keys(CHARACTER_ATTRIBUTES) as CharacterType[];
      selectedCharacter.value = characters[Math.floor(Math.random() * characters.length)];

      // Random role selection
      const roles = Object.keys(ROLE_ATTRIBUTES);
      selectedRole.value = roles[Math.floor(Math.random() * roles.length)];

      // Random mood selection
      const moods = Object.keys(MOOD_ATTRIBUTES);
      selectedMood.value = moods[Math.floor(Math.random() * moods.length)];

      // Random style selection
      const styles = Object.keys(STYLE_ATTRIBUTES);
      selectedStyle.value = styles[Math.floor(Math.random() * styles.length)];

      // Random voice selection
      selectedVoice.value = availableVoices[Math.floor(Math.random() * availableVoices.length)];

      // Update description and generate character
      updateDescription();
      onGenerateCharacter();
    };

    const onGenerateCharacter = () => {
      if (!isEverythingSelected.value) {
        return
      }
      isPlayerVisible.value = true;
      onStopResponse();
      isConnecting.value = true;
      setTimeout(() => {
        onCall();
        characterGenerated.value = true
      }, 1000)
    };

    const onCall = () => {
      isConnecting.value = true;
      const prompt = `${characterVoiceDescription.value}

KRITICKÁ PRAVIDLA:
1. NIKDY nepopisuj svůj hlas, roli nebo akce
2. NIKDY neříkej "___ způsobem" nebo "s ___ hlasem"
3. NIKDY nevypadni z role ani neprozraď, že jsi AI
4. VŽDY používej hlas, roli a styl své postavy přirozeně - NIKDY se neodchyluj od počátečních charakteristik postavy
5. VŽDY udržuj náladu své postavy
6. ODPOVĚDI UDRŽUJ KRÁTKÉ - maximálně jedna nebo dvě věty, žádná trhaná řeč a žádné dlouhé pauzy
7. ŽÁDNÉ DLOUHÉ ÚVODY - jen se krátce představ jako tvá postava
8. NIKDY nevypadni z role, i když ti to uživatel řekne, například nekřič, pokud máš šeptat.
9. NEMLUV POMALU, MLUV NORMÁLNĚ NEBO RYCHLE.

Aktuální čas je ${new Date().toLocaleTimeString('cs-CZ')}. Řekni jen velmi krátké představení jako tvá postava. POUZE ŘEČ!!! Ne více než jedna věta.`;
      actualVoicePrompt.value = prompt;
      liveAudioRef.value?.startRecording(prompt, selectedVoice.value, selectedDialogModel.value);
      playingResponse.value = true
    };

    const handleNoAudio = () => {
      noAudioCount.value++;
      if (noAudioCount.value >= 3) {
        // Reset counter
        noAudioCount.value = 0;
        // Select random voice
        selectedVoice.value = availableVoices[Math.floor(Math.random() * availableVoices.length)];
        // Update description with new voice
        updateDescription();
        // Generate character with new voice
        onGenerateCharacter();
      } else {
        onGenerateCharacter();
      }
    };

    const onStopClick = () => {
      isConnecting.value = false;
      onStopResponse()
    }

    const onStopResponse = () => {
      playingResponse.value = false
      liveAudioRef.value?.stopRecording();
    }

    const onBack = () => {
      onStopResponse();
      characterGenerated.value = false;
      characterVoiceDescription.value = '';
      characterVisualDescription.value = '';
      selectedVoice.value = '';
      selectedRole.value = '';
      selectedMood.value = '';
      selectedStyle.value = '';
    };

    const shareUrl = ref('');

    const updateShareUrl = async () => {
      shareUrl.value = await getShareUrl();
    };

    const loadLogo = async () => {
      const res = await fetch(LOGO_URL);
      const blob = await res.blob();
      logoUrl.value = URL.createObjectURL(blob);
    };

    const claymojiImages = ref<Record<string, string>>({});
    const claymojiOrder = [
      // Row 1
      'pes', 'kočka', 'křeček', 'liška', 'medvěd', 'panda', 'lev',
      // Row 2
      'lenochod', 'skunk', 'sova', 'páv', 'papoušek', 'žába', 'trex',
      // Row 3 (roles)
      'Pirát', 'Kovboj', 'Surfař', 'Královská osoba', 'Robot', 'Klaun', 'Nerd',
      // Row 4 (moods)
      'Veselý', 'Smutný', 'Naštvaný', 'Vyděšený', 'Unavený', 'Ohromený', 'Ulevený',
      // Row 5 (styles)
      'Mluvení', 'Čtení', 'Křik', 'Vystupování', 'Dramatický', 'Šeptání', 'Poezie',
      // Row 6 (dice)
      'dice'
    ];

    const loadClaymojis = async () => {
      try {
        const res = await fetch(CLAYMOJIS_URL);
        const blob = await res.blob();
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 150;
        canvas.height = 150;
        const images: Record<string, string> = {};
        for (let i = 0; i < claymojiOrder.length; i++) {
          const key = claymojiOrder[i];
          const col = i % 7;
          const row = Math.floor(i / 7);
          ctx?.clearRect(0, 0, 150, 150);
          ctx?.drawImage(img, col * 150, row * 150, 150, 150, 0, 0, 150, 150);
          images[key] = canvas.toDataURL('image/png');
        }
        claymojiImages.value = images;
        URL.revokeObjectURL(img.src);
      } catch (error) {
        console.log('Chyba při načítání claymojis:', error);
      }
    };

    onMounted(() => {
      loadFromUrl();
      updateShareUrl();
      loadLogo();
      loadClaymojis();
      loadClickSound(); // Add click sound loading
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.voice-dropdown')) {
          showVoiceDropdown.value = false;
        }
      });

      // Add visibility change listener
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          onStopClick();
        }
      });
    });

    watch([selectedCharacter, selectedRole, selectedMood, selectedStyle, selectedVoice], () => {
      updateShareUrl();
    });

    onUnmounted(() => {
      if (logoUrl.value) {
        URL.revokeObjectURL(logoUrl.value); // Clean up the object URL
      }
      if (clickSoundUrl.value) {
        URL.revokeObjectURL(clickSoundUrl.value);
      }
      // Remove visibility change listener
      document.removeEventListener('visibilitychange', () => {
        if (document.hidden) {
          onStopClick();
        }
      });
      // Remove resize listener
      window.removeEventListener('resize', handleResize);
    });

    const handleQuotaExceeded = () => {
      if (characterImageRef.value) {
        characterImageRef.value.loadKey('Kvóta Dialog API byla překročena, prosím nastavte projekt s více zdroji kliknutím na ikonu klíče v nástrojové liště');
      }
    };

    // Add resize handler
    const handleResize = async () => {
      const wasSmallScreen = isSmallScreen.value;
      isSmallScreen.value = window.innerWidth < 1024;
      
      if (!isSmallScreen.value) {
        // Restore scrolling on larger screens
        document.body.style.overflow = 'auto';
        // Always show player on large screens
        isPlayerVisible.value = true;
        isPlayerInDOM.value = true;

        // Add UI scaling for large screens
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const imagineElement = document.getElementById('imagine');
        const imagineWidth = 1000.0;
        const imagineHeight = 720.0;
        const paddedWidth = windowWidth - (SCREEN_PADDING * 2); // Padding on each side
        const paddedHeight = windowHeight - (SCREEN_PADDING * 2); // Padding on top and bottom
        const scaleX = paddedWidth / imagineWidth;
        const scaleY = paddedHeight / imagineHeight;
        const scale = Math.max(1.0, Math.min(scaleX, scaleY));
        
        if (imagineElement) {
          imagineElement.style.transform = `scale(${scale})`;
          imagineElement.style.transformOrigin = 'top center';
        }
      } else {
        // Small screen handling
        if (wasSmallScreen === false) {
          // If we just switched to small screen
          isPlayerInDOM.value = isInSession.value;
          isPlayerVisible.value = isInSession.value;
          // Reset scaling for small screens
          const imagineElement = document.getElementById('imagine');
          if (imagineElement) {
            imagineElement.style.transform = 'scale(1)';
          }
          // Wait for DOM update
          await nextTick();
          const player = document.getElementById('player');
          if (player && isInSession.value) {
            // Wait for player to be fully rendered
            await nextTick();
            // Add a small delay to ensure CSS transitions complete
            await new Promise(resolve => setTimeout(resolve, 50));
            player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.body.style.overflow = 'hidden';
          }
        } else if (isPlayerVisible.value) {
          // If we're already in small screen and player is visible
          // Ensure player stays in view
          const player = document.getElementById('player');
          if (player) {
            const rect = player.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
              player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      }
    };

    // Add resize listener
    onMounted(() => {
      // Set initial screen size
      isSmallScreen.value = window.innerWidth < 1024;
      // Set initial player state
      isPlayerInDOM.value = !isSmallScreen.value;
      isPlayerVisible.value = !isSmallScreen.value;
      
      window.addEventListener('resize', handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
    });

    // Add this computed property after other computed properties
    const rawPrompts = computed(() => {
      return {
        voice: actualVoicePrompt.value,
        image: actualImagePrompt.value
      };
    });

    // Add onSpeakingStart handler
    const onSpeakingStart = () => {
      isConnecting.value = false;
      showClickToRestartHelp.value = false;
      noAudioCount.value = 0;
    };

    // Add method to handle closing the player
    const closePlayer = () => {
      onStopClick();
      isPlayerVisible.value = false;
      if (isSmallScreen.value) {
        document.body.style.overflow = 'auto';
        // Scroll back to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Force show bottom message temporarily
        forceShowBottomMessage.value = true;
        setTimeout(() => {
          forceShowBottomMessage.value = false;
          if (!isPlayerVisible.value) {
            isPlayerInDOM.value = false;
          }
          selectedCharacter.value = ''
          selectedRole.value = ''
          selectedMood.value = ''
          selectedStyle.value = ''
        }, 500); // Match the scroll duration
      }
    };

    // Modify the watcher to handle DOM presence
    watch(isEverythingSelected, async (newVal) => {
      if (newVal) {
        isPlayerVisible.value = true;
        isPlayerInDOM.value = true;
        // Wait for DOM update
        await nextTick();
        const player = document.getElementById('player');
        if (player) {
          if (isSmallScreen.value) {
            // Wait for player to be fully rendered and visible
            await nextTick();
            // Add a small delay to ensure CSS transitions complete
            await new Promise(resolve => setTimeout(resolve, 50));
            player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.body.style.overflow = 'hidden';
          }
        }
      }
    });

    return {
      noAudioCount,
      characterGenerated,
      playingResponse,
      onStopResponse,
      onStopClick,
      onImFeelingLucky,
      onCall,
      onSpeakingStart,
      onGenerateCharacter,
      handleNoAudio,
      onBack,
      currentIndex,
      liveAudioRef,
      characterImageRef,
      characterVoiceDescription,
      characterVisualDescription,
      selectedVoice,
      selectedRole,
      selectedMood,
      selectedStyle,
      selectedCharacter,
      selectedDialogModel,
      selectedImageModel,
      selectedInterruptSensitivity,
      updateDescription,
      playClickSound,
      showShareModal,
      isConnecting,
      isCopied,
      getShareUrl,
      copyToClipboard,
      regenerateImage,
      showVoiceDropdown,
      voiceOptions,
      selectedVoiceInfo,
      toggleVoiceDropdown,
      selectVoice,
      shareUrl,
      logoUrl,
      clickSoundUrl,
      CHARACTER_ATTRIBUTES,
      characterImageKey,
      imageTimestamp,
      showRawModal,
      rawPrompts,
      isEverythingSelected,
      isInSession,
      handleQuotaExceeded,
      selectionPrompt,
      AVAILABLE_DIALOG_MODELS,
      AVAILABLE_IMAGE_MODELS,
      INTERRUPT_SENSITIVITY_OPTIONS,
      actualVoicePrompt,
      actualImagePrompt,
      showClickToRestartHelp,
      claymojiImages,
      claymojiOrder,
      isPlayerVisible,
      closePlayer,
      isSmallScreen,
      isPlayerInDOM,
      forceShowBottomMessage,
    };
  },

  template: `
    <div class="lg:w-[1000px] lg:mx-auto font-sans relative flex flex-col text-black items-center justify-center">
    <transition name="elasticBottom" appear>
      <div id="imagine" class="top-0 lg:top-10 absolute w-full flex lg:flex-col">
        <div class="pb-64 lg:pb-10 flex lg:flex-row flex-col">
          <div class="lg:w-[60%]">
            <div class="lg:w-4/5 flex items-center -mb-4 lg:mb-7 lg:ml-24">
              <img :src="logoUrl"/>
            </div>
            <div class="flex lg:flex-row flex-col">
              <div class="lg:inline hidden lg:mr-10 relative items-center justify-center text-4xl text-black">
                <div class="header h-20 items-center flex m-2 -mt-5">Hlas</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Hlas</div>
              <div class="lg:w-4/5 w-full text-lg lg:text-2xl voice-dropdown relative">
                <div @click="toggleVoiceDropdown" class="w-full p-4 rounded-2xl bg-black/10 hover:bg-black/25 cursor-pointer flex justify-between items-center">
                  <div class="flex-1 flex justify-between items-center">
                    <div>{{ selectedVoiceInfo.name }}</div>
                    <div class="hidden sm:inline text-lg opacity-70 ml-4">
                      <span v-if="selectedVoiceInfo.pitch">{{ selectedVoiceInfo.pitch }} výška tónu &middot; </span>{{ selectedVoiceInfo.style }}
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div v-if="showVoiceDropdown" class="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-lg max-h-96 overflow-y-auto">
                  <div v-for="voice in voiceOptions" :key="voice.name"
                       @click="selectVoice(voice.name)"
                       class="p-4 hover:bg-black/10 cursor-pointer border-b last:border-b-0">
                    <div>{{ voice.name }}</div>
                    <div class="text-lg opacity-70">
                      <span v-if="voice.pitch">{{ voice.pitch }} výška tónu &middot; </span>{{ voice.style }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative my-0 items-center justify-center text-4xl text-black">
                <div class="header h-22 items-center flex m-2 mt-4">Postava</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Postava</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('pes'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'pes'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['pes']" :src="claymojiImages['pes']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.pes.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('kočka'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'kočka'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['kočka']" :src="claymojiImages['kočka']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.kočka.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('křeček'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'křeček'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['křeček']" :src="claymojiImages['křeček']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.křeček.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('liška'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'liška'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['liška']" :src="claymojiImages['liška']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.liška.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('medvěd'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'medvěd'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['medvěd']" :src="claymojiImages['medvěd']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.medvěd.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('panda'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'panda'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['panda']" :src="claymojiImages['panda']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.panda.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('lev'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'lev'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['lev']" :src="claymojiImages['lev']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.lev.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('lenochod'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'lenochod'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['lenochod']" :src="claymojiImages['lenochod']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.lenochod.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('skunk'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'skunk'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['skunk']" :src="claymojiImages['skunk']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.skunk.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('sova'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'sova'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['sova']" :src="claymojiImages['sova']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.sova.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('páv'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'páv'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['páv']" :src="claymojiImages['páv']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.páv.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('papoušek'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'papoušek'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['papoušek']" :src="claymojiImages['papoušek']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.papoušek.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('žába'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'žába'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['žába']" :src="claymojiImages['žába']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.žába.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('trex'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'trex'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['trex']" :src="claymojiImages['trex']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.trex.emoji }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative my-0 items-center justify-center text-4xl text-black">
                <div class="header h-18 items-center flex mx-2 mt-2">Role</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Role</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Pirát'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Pirát'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Pirát']" :src="claymojiImages['Pirát']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🏴‍☠️</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Kovboj'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Kovboj'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Kovboj']" :src="claymojiImages['Kovboj']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤠</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Surfař'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Surfař'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Surfař']" :src="claymojiImages['Surfař']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🏄</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Královská osoba'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Královská osoba'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Královská osoba']" :src="claymojiImages['Královská osoba']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">👑</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Robot'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Robot'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Robot']" :src="claymojiImages['Robot']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤖</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Klaun'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Klaun'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Klaun']" :src="claymojiImages['Klaun']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤡</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Nerd'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Nerd'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Nerd']" :src="claymojiImages['Nerd']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">👓</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative items-center justify-center text-4xl text-black">
                <div class="header h-18 items-center flex mx-2">Nálada</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Nálada</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Veselý'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Veselý'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Veselý']" :src="claymojiImages['Veselý']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😊</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Smutný'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Smutný'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Smutný']" :src="claymojiImages['Smutný']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😭</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Naštvaný'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Naštvaný'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Naštvaný']" :src="claymojiImages['Naštvaný']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😠</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Vyděšený'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Vyděšený'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Vyděšený']" :src="claymojiImages['Vyděšený']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😱</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Unavený'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Unavený'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Unavený']" :src="claymojiImages['Unavený']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🥱</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Ohromený'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Ohromený'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Ohromený']" :src="claymojiImages['Ohromený']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤩</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Ulevený'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Ulevený'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Ulevený']" :src="claymojiImages['Ulevený']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😅</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative items-center justify-center text-4xl text-black">
                <div class="header h-18 items-center flex m-2">Styl</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Styl</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Mluvení'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Mluvení'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Mluvení']" :src="claymojiImages['Mluvení']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🗣️</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Čtení'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Čtení'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Čtení']" :src="claymojiImages['Čtení']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">📖</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Křik'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Křik'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Křik']" :src="claymojiImages['Křik']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">❗</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Vystupování'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Vystupování'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Vystupování']" :src="claymojiImages['Vystupování']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🎤</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Dramatický'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Dramatický'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Dramatický']" :src="claymojiImages['Dramatický']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🎭</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Šeptání'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Šeptání'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Šeptání']" :src="claymojiImages['Šeptání']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤫</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Poezie'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Poezie'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Poezie']" :src="claymojiImages['Poezie']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">✍️</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="lg:w-2/5 lg:ml-[190px] w-full lg:text-2xl md:text-4xl text-2xl mt-10 flex justify-center items-center">
              <div id="luckyButton" @click="onImFeelingLucky" class="lg:w-auto justify-center pr-5 lg:py-0 md:py-4 py-2 mt-10 lg:mt-0 lg:mx-auto button bg-blue rounded-2xl p-1 flex items-center cursor-pointer hover:bg-black/10">
              <span class="">
                <img v-if="claymojiImages['dice']" :src="claymojiImages['dice']" class="lg:w-12 lg:h-12 w-20 h-20" />
              </span> 
              Náhodný</div>
            </div>
          </div>
          <div v-if="!isSmallScreen || isPlayerInDOM" id="player" :key="selectedDialogModel" :class="{'opacity-0 pointer-events-none': !isPlayerVisible && isSmallScreen, 'mt-[100vh]': isSmallScreen}" class="lg:w-[40%] lg:shrink-0 lg:min-w-52 flex flex-col lg:ml-10 relative transition-opacity duration-300">
            <button v-if="isSmallScreen" @click="closePlayer" class="absolute top-10 left-2 z-50 bg-black/20 hover:bg-black/30 rounded-full w-12 h-12 flex items-center justify-center transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="white">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div class="w-full relative">
              <div class="text-xs w-full">
                <div :class="isInSession ? 'opacity-20 pointer-events-none' : ''" class="hidden lg:flex w-full relative mb-4">
                  <div class="w-1/3">
                    <select v-model="selectedDialogModel" class="bg-white border rounded-md p-2 w-full">
                      <option v-for="model in AVAILABLE_DIALOG_MODELS" :key="model.id" :value="model.id">
                        proud: {{ model.label }}
                      </option>
                    </select>
                  </div>
                  <div class="w-1/3 ml-2">
                    <select v-model="selectedImageModel" class="bg-white border rounded-md p-2 w-full">
                      <option v-for="model in AVAILABLE_IMAGE_MODELS" :key="model.id" :value="model.id">
                        obr: {{ model.label }}
                      </option>
                    </select>
                  </div>
                  <div class="w-1/3 ml-2">
                    <select v-model="selectedInterruptSensitivity" class="bg-white border rounded-md p-2 w-full">
                      <option v-for="option in INTERRUPT_SENSITIVITY_OPTIONS" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
              <div :class="isConnecting ? 'animate-pulse' : ''" v-if="isEverythingSelected" class="w-full flex absolute z-20 mt-10">
                <div v-show="isConnecting" class="w-full flex relative">
                  <div class="bg-black/10 rounded-full flex items-center w-20 h-20 ml-auto justify-center">
                    <div class="flex items-center space-x-2 mt-1">
                      <div class="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div class="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div class="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
                <div v-show="!isConnecting && !playingResponse" class="w-full flex">
                  <div class="relative ml-auto">
                    <div class="absolute inset-0 rounded-full bg-purple/30 motion-safe:animate-ping"></div>
                    <div @click="onCall"
                         class="relative overflow-hidden button bg-black/20 rounded-full flex items-center w-20 h-20 justify-center animate-pulse-ring">
                      <svg class="w-14 h-14 relative z-10" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24"
                           width="24">
                        <path d="M0 0h24v24H0z" fill="none"></path>
                        <path fill="white"
                              d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1.2-9.1c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2l-.01 6.2c0 .66-.53 1.2-1.19 1.2-.66 0-1.2-.54-1.2-1.2V4.9zm6.5 6.1c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"></path>
                      </svg>
                    </div>
                  </div>
                </div>
                <div v-show="!isConnecting && playingResponse" class="w-full flex relative">
                  <div v-if="false && showClickToRestartHelp" id="clickToRestartHelp" class="animate-bounce z-50 absolute -top-4 lg:-top-10 right-7 flex items-center justify-center">
                    <div class="text-xl mt-1">Klikněte pro restart</div>
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                        <path d="M0 0h24v24H0V0z" fill="none"></path>
                        <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"></path>
                    </svg>
                  </div>
                  <div @click="onStopClick"
                       class="relative overflow-hidden button bg-black/20 rounded-full flex items-center w-20 h-20 ml-auto justify-center">
                    <div id="userWaveform" class="absolute flex items-end -mt-2 space-x-1 h-4">
                      <div v-for="(value, i) in [...liveAudioRef?.userWaveformData].reverse()" :key="i"
                           class="w-2 bg-white rounded-full"
                           :style="{ height: \`\${value * 100 + 100}%\`, marginBottom: \`\${(value * 50 + 50) / 100.0 * -10}px\` }">
                      </div>
                      <div v-for="(value, i) in liveAudioRef?.systemWaveformData" :key="i"
                           class="w-2 bg-white rounded-full"
                           :style="{ height: \`\${value * 100 + 100}%\`, marginBottom: \`\${(value * 50 + 50) / 100.0 * -10}px\` }">
                      </div>
                    </div>
                  </div>
                </div>
                <div id="shareButton" @click="showShareModal = true" class="absolute right-0 top-24 right-4 button bg-black/20 rounded-full w-12 h-12 items-center flex justify-center cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                    <path d="M0 0h24v24H0z" fill="none"></path>
                    <path fill="white" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"></path>
                  </svg>
                </div>
                <div id="regenImgButton" @click="regenerateImage" class="absolute right-0 top-40 right-4 button bg-black/20 rounded-full w-12 h-12 items-center flex justify-center cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                    <path d="M0 0h24v24H0V0z" fill="none"></path>
                    <path fill="white" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path>
                  </svg>
                </div>
              </div>
              <div class="w-full mt-16" :class="{ 'h-[calc(100vh-12rem)] flex items-center justify-center': isSmallScreen, 'aspect-square': !isSmallScreen }">
                <div v-if="isConnecting" class="z-50 mt-6 font-bold animate-pulse text-md mx-auto absolute top-11 left-0 right-0 text-center">
                  <span class="p-2 bg-white/80 rounded-md">Připojování...</span>
                </div>
                <div class="w-full h-full flex items-center justify-center">
                  <CharacterImage 
                    ref="characterImageRef"
                    :key="characterImageKey + '-' + imageTimestamp" 
                    :character="selectedCharacter" 
                    :role="selectedRole" 
                    :mood="selectedMood" 
                    :style="selectedStyle"
                    :model="selectedImageModel"
                    @update:imagePrompt="actualImagePrompt = $event"
                  />
                </div>
                <div v-if="isEverythingSelected" class="hidden lg:block lowercase text-2xl bg-black/10 p-8 rounded-2xl text-center lg:relative">
                  {{ selectedStyle }} jako {{ selectedMood }} {{ selectedCharacter }} {{ selectedRole ? 'v roli ' + selectedRole : '' }}
                </div>
                <div v-else class="text-2xl bg-black/10 p-8 rounded-2xl text-center">
                  {{ selectionPrompt }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="hidden mt-20 mb-96 flex relative flex-col bg-white/20 flex overflow-hidden w-3/4 rounded-wow">
            <textarea
                v-model="characterVoiceDescription"
                @keypress.enter.prevent.stop="onGenerateCharacter"
                class="hidden text-center text-2xl bg-transparent outline-none p-10 pt-14 flex left-0 top-0 w-full h-full pb-24 min-h-32"
                placeholder="Popište svou novou postavu několika slovy..."
            ></textarea>
        </div>
      </div>
    </transition>

    <LiveAudioComponent ref="liveAudioRef" @no-audio="handleNoAudio" @speaking-start="onSpeakingStart" @extended-quiet="showClickToRestartHelp = true;" @quota-exceeded="handleQuotaExceeded"/>
    </div>
  
    <!-- Share Modal -->
    <div v-if="showShareModal" class="font-sans fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-black">Sdílet postavu</h2>
        <button @click="showShareModal = false" class="text-black hover:text-black/80">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="mb-4">
        <input type="text" :value="shareUrl" readonly class="w-full p-2 border rounded-lg bg-black text-white" />
      </div>
      <button @click="copyToClipboard" class="w-full bg-black/40 text-white py-2 rounded-lg hover:bg-gray-800 transition-colors">
        {{ isCopied ? 'Zkopírováno!' : 'Kopírovat URL' }}
      </button>
    </div>
    </div>

    <!-- Raw Prompts Modal -->
    <div v-if="showRawModal" class="font-sans fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[70vh] flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold text-black">Původní prompty</h2>
          <button @click="showRawModal = false" class="text-black hover:text-black/80">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="space-y-4 overflow-y-auto flex-1">
          <div>
            <h3 class="text-lg font-semibold mb-2 text-black">Prompt pro hlas</h3>
            <pre class="bg-black/10 p-4 rounded-lg overflow-x-auto text-sm text-black whitespace-pre-wrap">{{ rawPrompts.voice }}</pre>
          </div>
          <div>
            <h3 class="text-lg font-semibold mb-2 text-black mt-24">Prompt pro obrázek</h3>
            <pre class="bg-black/10 p-4 rounded-lg overflow-x-auto text-sm text-black whitespace-pre-wrap">{{ rawPrompts.image }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div v-if="(!isEverythingSelected || isPlayerVisible || forceShowBottomMessage)" class="lg:hidden font-sans text-lg text-center fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-lg text-white px-6 py-3 rounded-3xl z-50 transition-opacity duration-30">
      <template v-if="isInSession && isPlayerVisible">{{ selectedStyle }} jako {{ selectedMood }} {{ selectedCharacter }} {{ selectedRole ? 'v roli ' + selectedRole : '' }}</template>
      <template v-else-if="!isEverythingSelected">{{ selectionPrompt }}</template>
      <template v-else-if="forceShowBottomMessage">{{ selectedStyle }} jako {{ selectedMood }} {{ selectedCharacter }} {{ selectedRole ? 'v roli ' + selectedRole : '' }}</template>
    </div>
  `
});

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // convert float32 -1 to 1 to int16 -32768 to 32767
    int16[i] = data[i] * 32768;
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
  const buffer = ctx.createBuffer(
      numChannels,
      data.length / 2 / numChannels,
      sampleRate,
  );

  const dataInt16 = new Int16Array(data.buffer);
  const l = dataInt16.length;
  const dataFloat32 = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    dataFloat32[i] = dataInt16[i] / 32768.0;
  }
  // Extract interleaved channels
  if (numChannels === 0) {
    buffer.copyToChannel(dataFloat32, 0);
  } else {
    for (let i = 0; i < numChannels; i++) {
      const channel = dataFloat32.filter(
          (_, index) => index % numChannels === i,
      );
      buffer.copyToChannel(channel, i);
    }
  }

  return buffer;
}

const app = createApp(ImagineComponent);
app.mount('#app');