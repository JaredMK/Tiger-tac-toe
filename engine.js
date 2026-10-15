// Tic Tac Chaos: the game engine. Every rule of the game lives here: the mini-games, the main board,
// win and draw detection, random and timed-out moves, the computer's play, and the online match
// records. It is pure and deterministic: no screen, no clock, no Math.random; every random choice
// comes from an rng passed in (makeRng(seed) for a seeded one). The page loads it as a plain script;
// the Cloud Functions require() it, so a move is checked the same way on a phone and on the server.
'use strict';
/* ===================== Game logic (pure, no DOM) =====================
 * Everything about a match lives in one plain object (see newMatch); the UI
 * only ever calls playMove / endFlash and re-renders from that object.
 */
const TYPES = ['ttt', 'c4', 'bs', 'wordle', 'hangman', 'hex', 'hilo', 'snakes', 'memory', 'candy', 'bump', 'coins', 'pig', 'hunt', 'mastermind', 'bj', 'bus', 'rl', 'bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone', 'dash', 'lane', 'golf', 'pool', 'bowling', 'craps', 'takeover', 'flood', 'seating', 'districts', 'shelves', 'roads'];
// Release control: every mini-game is Released or Admin only. A game in TEST_TYPES is admin only until the
// admin's dashboard releases it (releases/{type} true in the database; false puts one back to admin only);
// everything else is released unless the database says otherwise. Admin-only games exist only for the
// admin: in their local matches and in friend games they host (their guest plays them in that match
// only); never in Find Match, nor anywhere for anyone else.
const TEST_TYPES = ['bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone', 'dash', 'lane', 'golf', 'pool', 'bowling', 'craps', 'takeover', 'flood', 'seating', 'districts', 'shelves', 'roads'];
function isReleased(t, releases) { return releases && typeof releases[t] === 'boolean' ? releases[t] : !TEST_TYPES.includes(t); }
function releasedTypes(releases) { return TYPES.filter(t => isReleased(t, releases)); }
// The games a setup may deal (admin: every game; anyone else: the released ones), and the setup's
// games list cut down to them (in place), so a match never draws a game its players may not see.
function allowedTypes(releases, admin) { return admin ? TYPES.slice() : releasedTypes(releases); }
function restrictGames(games, allowed) {
  if (!games || typeof games !== 'object') return games;
  for (const t of Object.keys(games)) if (games[t] && !allowed.includes(t)) games[t] = false;
  return games;
}
// No longer dealt, still played to the end in older matches and shown in their history: the Dice race
// (Snakes and Ladders replaced it) and Hexapawn (taken out: with nobody obliged to move in a square,
// the best play was often not to move at all).
const OLD_TYPES = ['dice', 'hexapawn'];
const INFO = {
  ttt:         { name: 'Tic-Tac-Toe',  hint: 'Three in a row wins' },
  c4:          { name: 'Connect 4',    hint: 'Pieces drop. Four in a row wins' },
  bs:          { name: 'Battleship',   hint: 'Sink the hidden ship. A hit fires again' },
  wordle:      { name: 'Wordle',       hint: 'Guess the hidden 5-letter word' },
  hangman:     { name: 'Hangman',      hint: 'Right letter: go again. Last letter wins' },
  hex:         { name: 'Hex',          hint: 'X joins left to right, O joins top to bottom' },
  hilo:        { name: 'Higher/Lower', hint: 'Guess the number from 1 to 20' },
  snakes:      { name: 'Snakes and Ladders', hint: 'Roll and climb. Ladders lift you, snakes slide you down' },
  dice:        { name: 'Dice Race',    hint: 'Roll and race along 15 spaces. First to the finish wins' },
  memory:      { name: 'Memory',       hint: 'Flip two cards. Find the matching pair' },
  candy:       { name: 'Candy Race',   hint: 'Spin, then hop to the next space of that colour' },
  bump:        { name: 'Bump',         hint: 'Spin 1, 2 or 3. Land on your opponent to send them home' },
  coins:       { name: 'Coin Flip',    hint: "Flip up to 3 coins that aren't yours. All five the same wins" },
  pig:         { name: 'Risky Rolls',  hint: "Roll and bank. A repeated number loses this turn's points. First to 21 wins" },   // ('pig': its id in saved games, records and stats, from when it was called Pig)
  hunt:        { name: 'Treasure Hunt', hint: 'Dig a cell: hot, warm, cool or cold. Dig up the treasure to win' },
  hexapawn:    { name: 'Hexapawn',     hint: 'Step forward, capture diagonally. Reach the far row to win' },
  mastermind:  { name: 'Mastermind',   hint: 'Crack the hidden 4-colour code' },
  bj:          { name: 'Blackjack',    hint: 'Beat the dealer without going over 21. First to 3 wins' },
  bus:         { name: 'Ride the Bus', hint: 'Colour, higher or lower, inside or outside, then the suit' },
  rl:          { name: 'Roulette',     hint: 'Bet 8 numbers, a group or green 0. Two hits wins' },
  bullseye:    { name: 'Bullseye',     hint: 'Stop both lines on the board. Bullseye 3, board 1. First to 5' },
  echo:        { name: 'Echo',         hint: 'Watch the pattern, then tap it back. Beat all four' },
  plinko:      { name: 'Plinko',       hint: 'Drop the chip. Land in the WIN bin' },
  pong:        { name: 'Cup Pong',     hint: 'Swipe up to throw. Sink all three cups' },
  trivia:      { name: 'Trivia',       hint: 'Wrong answers get crossed out. Three right wins' },
  oddone:      { name: 'Odd One Out',  hint: 'Tap the tile of a different shade. Three finds wins' },
  dash:        { name: 'Dash',         hint: 'Jump the hazards, duck the flyers. First to 1,000 m' },
  lane:        { name: 'Lane Rush',    hint: 'Swipe between lanes, dodge the traffic. First to 1,000 m' },
  golf:        { name: 'Mini Golf',    hint: 'Drag back to aim and set power. First ball in the cup wins' },
  pool:        { name: 'Pool',         hint: 'Sink your two balls. The black ball loses' },
  bowling:     { name: 'Bowling',      hint: 'Roll at a fresh rack each turn. First to 25 pins' },
  craps:       { name: 'Craps',        hint: '7 or 11 wins, 2, 3 or 12 loses. Win 2 rounds' },
  takeover:    { name: 'Takeover',     hint: 'Take a square and the ones around it. Most squares wins' },
  flood:       { name: 'Flood',        hint: 'Pick a colour. What the blob grabs is yours. First to 18' },
  seating:     { name: 'Seating',      hint: 'Take seats. Both seats of a table make it yours' },
  districts:   { name: 'Districts',    hint: 'Place pieces. Lead the most regions when the map is full' },
  shelves:     { name: 'Shelves',      hint: 'Mark shelves. Be on the most when they are full' },
  roads:       { name: 'Roads',        hint: 'Claim lines. The longest unbroken road wins' },
};
const C4 = { cols: 7, rows: 6, k: 4 };
const HP = { cols: 3, rows: 4 };
const MM = { pegs: 4, colors: 6 };    // Mastermind: a code of 4 pegs from 6 colours, no colour twice      // Hexapawn: X starts on the bottom row and moves up, O starts on the top row and moves down
const HEX_N = 4;
const HILO = { lo: 1, hi: 20 };
const CANDY = { len: 12, colors: ['red', 'yellow', 'green', 'blue'], gap: 3 };   // same colour at least 3 spaces apart
const NAME_MAX = 12;
const COINS = { n: 5, max: 3, mystery: '?' };   // 2 X, 2 O and one mystery coin that belongs to nobody until it is flipped
const RISKY = { goal: 21, maxRolls: 6 };
// Battleship: one hidden ship on a 4x4 grid, 1 to 4 cells long, lying across or down. Both players fire at it.
const BS = { n: 4, names: { 4: 'Battleship', 3: 'Submarine', 2: 'Destroyer', 1: 'Patrol Boat' } };
// Treasure hunt: a 6x6 grid. A dug cell tells only how far the treasure is, as a band of steps up, down,
// left or right: Hot (1), Warm (2-3), Cool (4-5), Cold (6 or more). (Older 5x5 squares play on as they are.)
const HUNT = { n: 6, bands: [null, 'hot', 'warm', 'cool', 'cold'] };
const DICE_GOAL = 16;   // 15 numbered spaces, then the finish
// Snakes and Ladders: 20 spaces in 4 rows of 5, numbered from the bottom; the pieces start before space 1
// and space 20 is the top. Each board has 2 ladders and 2 snakes, each crossing rows and at least 3 long.
const SNL = { n: 20, perRow: 5, ladders: 2, snakes: 2, minSpan: 3 };
// Bump: 9 spaces between Home and the Finish (10); a spin moves 1, 2 or 3.
const BUMP = { n: 9, max: 3 };
const MEMORY = { shapes: ['circle', 'square', 'triangle', 'diamond'], colors: ['green', 'yellow', 'purple', 'orange'] };
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

const WORDS5 = `about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along
alter among angel anger angle angry apart apple apply arena argue arise armor array arrow aside asset avoid awake award aware badly baker basic
basis beach beard beast begin being below bench berry birth black blade blame blank blast blaze blend bless blind block blood bloom board boast
bonus boost booth bound brain brand brave bread break breed brick bride brief bring broad brown brush build bunch burst buyer cabin cable candy
carry catch cause chain chair chalk charm chart chase cheap check cheek cheer chess chest chief child chill china choir chose civil claim class
clean clear clerk click cliff climb clock close cloth cloud coach coast could count court cover crack craft crane crash crazy cream crime crisp
cross crowd crown curve cycle daily dance dealt death debut delay dense depth diary dirty dough draft drain drama drawn dream dress drift drill
drink drive drove dusty dying eager early earth eight elbow elder elect empty enemy enjoy enter entry equal error essay event every exact exist
extra faint faith false fancy fatal fault favor feast fence fever field fifth fifty fight final first flame flash fleet flesh float flock flood
floor flour fluid focus force forge forth forty forum found frame fresh front frost fruit fully funny ghost giant given glass globe glory glove
going grace grade grain grand grant grape graph grasp grass grave great green greet grief grind gross group grove grown guard guess guest guide
guilt habit happy harsh heart heavy hedge hello hence hobby honey honor horse hotel house human humor hurry ideal image imply index inner input
issue ivory jeans jelly jewel joint judge juice knife knock known label labor large laser later laugh layer learn lease least leave legal lemon
level light limit linen liver lobby local logic loose lover lower loyal lucky lunch magic major maker maple march match maybe mayor meant medal
media mercy merit metal might minor minus mixed model money month moral motor mount mouse mouth movie music naive nasty naval nerve never newly
night noble noise north novel nurse occur ocean offer often olive onion opera orbit order other ought outer owner paint panel panic paper party
pasta patch pause peace pearl penny phase phone photo piano piece pilot pitch pizza place plain plane plant plate plaza point polar pound power
press price pride prime print prior prize proof proud prove pulse punch pupil queen quick quiet quite quote radar radio raise rally ranch range
rapid ratio reach react ready realm rebel refer relax reply ridge rifle right rigid risky river robot rocky roman rough round route royal rugby
rural salad sauce scale scene scent scope score sense serve seven shade shake shall shape share sharp sheep sheet shelf shell shift shine shirt
shock shoot shore short shout shown sight silly since sixth skill skirt slate sleep slice slide slope small smart smell smile smoke snake solar
solid solve sorry sound south space spare spark speak speed spell spend spice spike spine spite split spoke sport spray squad stack staff stage
stain stair stake stamp stand stare start state steak steam steel steep stick stiff still stock stone stood store storm story stove strap straw
strip stuck study stuff style sugar suite sunny super sweet swing sword table taste teach teeth tempo tense thank theft their theme there thick
thing think third those three threw throw thumb tiger tight timer tired title toast today token tooth topic total touch tough tower trace track
trade trail train treat trend trial tribe trick tried truck truly trunk trust truth twice uncle under union unity until upper upset urban usual
valid value video virus visit vital vivid vocal voice waste watch water weigh weird wheat wheel where which while white whole whose woman women
world worry worse worst worth would wound write wrong wrote yield young youth`.split(/\s+/);

const WORDS_HANG = `apple banana cherry orange grape lemon melon peach mango berry bread butter cheese cookie pizza salad sugar honey pasta pepper
house garden window kitchen bridge castle tower market school office river ocean island forest desert valley meadow jungle canyon tiger zebra
monkey rabbit turtle eagle shark whale dolphin horse sheep camel panda koala otter badger beaver falcon parrot planet rocket comet galaxy meteor
summer winter spring autumn storm cloud thunder breeze frost guitar violin piano trumpet drums flute cello banjo doctor farmer pilot sailor artist
writer singer dancer baker driver hammer wrench ladder bucket candle pillow blanket mirror carpet basket purple yellow silver golden violet indigo
friend family mother father sister brother cousin circle square diamond spiral coffee dinner supper picnic feast jacket button pocket helmet gloves
scarf boots pencil eraser marker crayon paper folder soccer tennis hockey rugby boxing racing dragon wizard knight pirate robot zombie ghost flower
blossom petal cactus clover maple willow morning evening sunset sunrise tonight rainbow puzzle secret riddle magic camera laptop screen tablet
remote engine wheel rubber copper marble beetle spider hornet hungry sleepy clever bright gentle brave happy quiet bottle kettle teapot saucer
napkin spoon knife plate`.split(/\s+/);

// Every valid 5-letter guess (the standard Wordle guess list, 14855 words), packed five letters per word.
const VALID5 = new Set(`aahedaaliiaapasaarghaartiabacaabaciabackabacsabaftabahtabakaabampabandabaseabashabaskabateabayaabbasabbedabbesabbeyabbotabceeabeamabearabeatabeerabeleabengabersabetsabeysabhorabideabiesabiusabjadabjudabledablerablesabletablowabmhoabnetabodeabohmaboilabomaaboonabordaboreabornabortaboutaboveabramabrayabrimabrinabrisabseyabsitabunaabuneaburaaburnabuseabutsabuzzabyesabysmabyssacaisacaraacariaccasacchaaccoyaccraacedyaceneacerbacersacetaacharachedacherachesacheyachooacidsacidyaciesacingaciniackeeackeracmesacmicacnedacnesacockacoelacoldaconeacornacralacredacresacridacronacrosacrylactasactedactinacton
actoractusacuteacylsadageadaptadatsadawnadawsadaysadbotaddasaddaxaddedadderaddinaddioaddleaddraadeadadeemadeptadhanadhocadieuadiosaditsadlibadmanadmenadminadmitadmixadnexadobeadoboadoonadoptadorbadoreadornadownadozeadradadrawadredadretadripadsumadukiadultaduncadustadvewadvtsadytaadytsadzedadzesaeciaaedesaegeraegisaeonsaerieaerosaesiraevumafaldafancafaraafarsafearaffixafflyafionafireafizzaflajaflapaflowafoamafootaforeafoulafretafritafrosafteraftosagainagalsagamaagamiagamyagapeagarsagaspagastagateagatyagaveagazeagbasageneagentagersaggagaggeraggieaggriaggroaggryaghasagidiagilaagileagingagiosagism
agistagitaagleeagletagleyaglooaglowaglusagmasagogeagogoagoneagonsagonyagoodagoraagreeagriaagrinagrosagrumaguedaguesagueyagunaagushagutiaheadaheapahentahighahindahingahintaholdaholeahullahuruaidasaidedaideraidesaidoiaidosaieryaigasaightailedaimagaimakaimedaimeraineeaingaaioliairedairerairnsairthairtsaisleaitchaitusaiveraixesaiyahaiyeeaiyohaiyooaizleajiesajivaajugaajupaajwanakaraakeesakelaakeneakingakitaakkasakkerakoiaakojaakoyaaksedaksesalaapalackalalaalamoalandalanealangalansalantalapaalapsalarmalaryalataalatealaysalbasalbeealbidalbumalceaalcesalcidalcosaldeaalderaldolaleakaleckalecsaleemalefs
aleftalephalertalewsaleyealfasalgaealgalalgasalgidalginalgoralgosalgumaliasalibialickalienalifsalignalikealimsalinealiosalistalivealiyaalkiealkinalkosalkydalkylallanallayalleeallelallenalleralleyallinallisallodallotallowalloyallusallylalmahalmasalmehalmesalmudalmugalodsaloedaloesaloftalohaaloinalonealongaloofaloosalosealoudalowealphaaltaralteralthoaltosalulaalumsalumyalurealurkalvaralwayamahsamainamariamaroamassamateamautamazeambanamberambitambleambosambryamebaameeramendameneamensamentamiasamiceamiciamideamidoamidsamiesamigaamigoamineaminoaminsamirsamissamityamlasammanammasammonammosamniaamnic
amnioamoksamoleamongamoreamortamouramoveamowtampedampleamplyampulamritamuckamuseamylsananaanataanchoancleanconandicandroanearaneleanentangasangelangerangleangloangryangstanighanileanilsanimaanimeanimianionaniseankerankhsankleankusanlasannalannanannasannatannexannoyannulannumannusanoasanodeanoleanomyansaeansasantaeantarantasantedantesanticantisantraantreantsyanuraanvilanyonaortaapaceapageapaidapartapaydapaysapeakapeekapersapertaperyapgaraphidaphisapianapingapiolapishapismapneaapodeapodsapolsapoopaportappalappamappayappelappleapplyapproapptsappuiappuyapresapronapsesapsisapsosaptedapteraptlyaquae
aquasarabaaraksarameararsarbaharbasarborarcedarchiarcosarcusardebardorardriareadareaearealarearareasarecaareddaredearefyareicarenaarenearepaarerearetearetsarettargalarganargilargleargolargonargotargueargusarhatariasarielarikiarilsariotarisearisharitharkedarledarlesarmedarmerarmetarmilarmorarnasarnisarnutarobaarohaaroidaromaarosearpasarpenarraharrasarrayarretarrisarrowarrozarsedarsesarseyarsisarsonartalartelarterarticartisartlyartsyaruhearumsarvalarveearvosarylsasadaasanaasconascotascusasdicashedashenashesashetasideasityaskaraskedaskeraskewaskoiaskosaspenasperaspicaspieaspisasproassaiassamassay
assedassesassetassezassotasterastirastunasuraaswayaswimasylaatapsataxyatigiatiltatimyatlasatmanatmasatmosatocsatokeatoksatollatomsatomyatoneatonyatopyatriaatripattapattarattasatteratticatuasauchtaudadaudaxaudioauditaugenaugeraugesaughtauguraulasaulicauloiaulosaumilaunesauntsauntyauraeauralauraraurasaureiauresauricaurisaurumautosauxinavailavaleavantavastavelsavensaversavertavgasavianavineavionaviseavisoavizeavoidavowsavyzeawaitawakeawardawareawariawarnawashawatoawaveawaysawdlsaweelawetoawfulawingawkinawmryawnedawnerawokeawolsaworkaxelsaxialaxileaxilsaxingaxiomaxionaxiteaxledaxlesaxmanaxmenaxoid
axoneaxonsayahsayayaayelpaygreayinsaymagayontayresayrieazansazideazidoazineazlonazoicazoleazonsazoteazothazukiazureazurnazuryazygyazymeazymsbaaedbaalsbaapsbabasbabbybabelbabesbabkababoobabulbabusbaccabaccobaccybachabachsbacksbackybacnebaconbadambaddybadgebadlybaelsbaffsbaffybaftabaftsbagelbaggybaghsbagiebagsybaguabahtsbahusbahutbaiksbailebailsbairnbaisabaithbaitsbaizabaizebajanbajrabajribajusbakedbakenbakerbakesbakrabalasbaldsbaldybaledbalerbalesbalksbalkyballoballsballybalmsbalmybaloibalonbaloobalotbalsabaltibalunbalusbalutbamasbambibammabammybanakbanalbancobancsbandabandhbandsbandybanedbanes
bangsbaniabanjobanksbankybannsbantsbantubantybantzbanyabaonsbaozibappubapusbarbebarbsbarbybarcabardebardobardsbardybaredbarerbaresbarfibarfsbarfybargebaricbarksbarkybarmsbarmybarnsbarnybaronbarpsbarrabarrebarrobarrybaryebasalbasanbasasbasedbasenbaserbasesbashabashobasicbasijbasilbasinbasisbasksbasonbassebassibassobassybastabastebastibastobastsbatchbatedbatesbathebathsbatikbatonbatosbattabattsbattubattybaudsbauksbaulkbaursbavinbawdsbawdybawksbawlsbawnsbawrsbawtybayasbayedbayerbayesbaylebayoubaytsbazarbazasbazoobballbdaysbeachbeadsbeadybeaksbeakybealsbeamsbeamybeanobeansbeanybeardbearebearsbeast
beathbeatsbeatybeausbeautbeauxbebopbecapbeckebecksbedadbedelbedesbedewbedimbedyebeechbeedibeefsbeefybeepsbeersbeerybeetsbefitbefogbegadbeganbegarbegatbegembegetbeginbegobbegotbegumbegunbeigebeigybeingbeinsbeirabeisabekahbelahbelarbelaybelchbeleebelgabeliebelitbellebellibellobellsbellybelonbelowbeltsbelvebemadbemasbemixbemudbenchbendsbendybenesbenetbengabenisbenjibennebennibennybentobentsbentybepatberayberesberetbergsberkoberksbermebermsberobberryberthberylbesatbesawbeseebesesbesetbesitbesombesotbestibestsbetasbetedbetelbetesbethsbetidbetonbettabettybevanbevelbeverbevorbevuebevvybewdybewetbewig
bezelbezesbezilbezzybhaisbhajibhangbhatsbhavabhelsbhootbhunabhutsbiachbialibialybibbsbibesbibisbiblebiccybicepbicesbickybiddybidedbiderbidesbidetbidisbidonbidribieldbiersbiffobiffsbiffybifidbigaebiggsbiggybighabightbiglybigosbigotbihonbijoubikedbikerbikesbikiebikkybilalbilatbilbobilbybiledbilesbilgebilgybilksbillsbillybimahbimasbimbobinalbindibindsbinerbinesbingebingobingsbingybinitbinksbinkybintsbiogsbiomebionsbiontbiosebiotabipedbipodbippybirchbirdobirdsbirisbirksbirlebirlsbirosbirrsbirsebirsybirthbirzebirzzbisesbisksbisombisonbitchbiterbitesbiteybitosbitoubitsybittebittsbittybiviabivvybizes
bizzobizzyblabsblackbladebladsbladyblaerblaesblaffblagsblahsblainblameblamsblancblandblankblareblartblaseblashblastblateblatsblattblaudblawnblawsblaysblazebleahbleakblearbleatblebsblechbleedbleepbleesblendblentblertblessblestbletsbleysblimpblimyblindblingbliniblinkblinsblinyblipsblissblistbliteblitsblitzblivebloatblobsblockblocsblogsblokeblondblonxbloodblookbloombloopbloreblotsblownblowsblowyblubsbludebludsbludybluedbluerbluesbluetblueybluffbluidblumeblunkbluntblurbblursblurtblushblypeboabsboaksboardboarsboartboastboatsboatybobacbobakbobasbobbybobolbobosboccabocceboccibochebocksbodedbodesbodge
bodgybodhibodlebodohboepsboersboetiboetsboeufboffoboffsboganbogeyboggybogiebogleboguebogusboheabohosboilsboingboinkboitebokedbokehbokesbokosbolarbolasboldoboldsbolesboletbolixbolksbollsbolosboltsbolusbomasbombebombobombsbomohbomorboncebondsbonedbonerbonesboneybongobongsboniebonksbonnebonnybonumbonusbonzabonzebooaibooayboobsboobyboodybooedboofyboogyboohsbooksbookyboolsboomsboomyboongboonsboordboorsbooseboostboothbootsbootyboozeboozyboppyborakboralborasboraxbordebordsboredboreeborekborelborerboresborgoboricborksbormsbornaborneboronbortsbortybortzboseybosiebosksboskybosombosonbossabossybosunbotas
botchbotehbotelbotesbotewbothybotosbottebottsbottybougeboughbouksbouleboultboundbounsbourdbourgbournbousebousyboutsboutubovidbowatbowedbowelbowerbowesbowetbowiebowlsbownebowrsbowseboxedboxenboxerboxesboxlaboxtyboyarboyauboyedboyeyboyfsboygsboylaboylyboyosboysybozosbraaibracebrachbrackbractbradsbraesbragsbrahsbraidbrailbrainbrakebraksbrakybramebrandbranebrankbransbrantbrashbrassbrastbratsbravabravebravibravobrawlbrawnbrawsbraxybraysbrazabrazebreadbreakbreambredebredsbreedbreembreerbreesbreidbreisbremebrensbrentbrerebrersbrevebrewsbreysbriarbribebrickbridebriefbrierbriesbrigsbrikibriksbrillbrims
brinebringbrinkbrinsbrinybriosbrisebriskbrissbrithbritsbrittbrizebroadbrochbrockbrodsbroghbrogsbroilbrokebromebromobroncbrondbroodbrookbroolbroombroosbrosebrosybrothbrownbrowsbruckbrughbruhsbruinbruitbrujabrujobrulebrumebrungbruntbrushbruskbrustbrutebrutsbruvsbuatsbuazebubalbubasbubbabubbebubbybubusbuchubuckobucksbuckubudasbuddybudedbudesbudgebudisbudosbuenabuffabuffebuffibuffobuffsbuffybufosbuftybuganbuggybuglebuhlsbuhrsbuiksbuildbuiltbuistbukesbukosbulbsbulgebulgybulksbulkybullabullsbullybulsebumbobumfsbumphbumpsbumpybunasbuncebunchbuncobundebundhbundsbundtbundubundybungsbungybuniabunjebunjy
bunkobunksbunnsbunnybuntsbuntybunyabuoysbuppyburanburasburbsburdsburetburfiburghburgsburinburkaburkeburksburlsburlyburnsburntburooburpsburqaburraburroburrsburrybursaburseburstbusbybusedbusesbushybusksbuskybussubustibustsbustybutchbuteobutesbutlebutohbuttebuttsbuttybututbutylbuxombuyerbuyinbuzzybwanabwazibydedbydesbykedbykesbylawbyresbyrlsbyssibytesbywaycaaedcabalcabascabbycabercabincablecabobcaboccabrecacaocacascachecackscackycacticaddycadeecadescadetcadgecadgycadiecadiscadrecaecacaesecafescaffecaffscagedcagercagescageycagotcahowcaidscainscairdcairncajoncajuncakedcakescakeycalfscalidcalifcalix
calkscallacallecallscalmscalmycaloscalpacalpscalvecalyxcamancamascamelcameocamescamiscamoscampicampocampscampycamuscanalcandocandycanedcanehcanercanescangscanidcannacannscannycanoecanoncansocanstcanticantocantscantycapascapaxcapedcapercapescapexcaphscapizcaplecaponcaposcapotcapricapulcaputcarapcaratcarbocarbscarbycardicardscardycaredcarercarescaretcarexcargocarkscarlecarlscarnecarnscarnycarobcarolcaromcaroncarpecarpicarpscarrscarrycarsecartacartecartscarvecarvycasascascocasedcasercasescaskscaskycastecastscasuscatchcatercatescattycaudacaukscauldcaulkcaulscaumscaupscauricausacausecavascavedcavel
cavercavescaviecavilcavuscawedcawkscaxonceaseceazecebidcecalcecumcedarcededcedercedescedisceibaceiliceilscelebcellacellicellocellscellycelomceltscensecentocentscentuceorlcepescerciceredcerescergeceriacericcernecerocceroscertscertycessecestacesticetescetylcezvechaapchaatchacechackchacochadochadschafechaffchaftchainchairchaischalkchalschampchamschanachangchankchantchaoschapechapschaptcharachardcharecharkcharmcharrcharschartcharychasechasmchatschavachavechavschawkchawlchawschayachayscheapcheatchebacheckchedicheebcheekcheepcheercheetchefschekachelachelpchemochemscherechertchesschestchethchevychews
chewychiaochiaschibachibschicachichchickchicochicschidechiefchielchikochikschildchilechilichillchimbchimechimochimpchinachinechingchinkchinochinschipschirkchirlchirmchirochirpchirrchirtchiruchitichitschivachivechivschivychizzchockchocochocschodechogschoilchoirchokechokochokycholacholicholochompchonschoofchookchoomchoonchopschordchorechosechosschotachottchoutchouxchowkchowschubschuckchufachuffchugschumpchumschunkchurlchurnchurrchusechutechutschylechymechyndcibolcidedcidercidescielscigarciggyciliacillscimarcimexcinchcinctcinescinqscionscippicircacircscirescirlscirriciscocissycistscitalcitedcitee
citercitescivescivetcivicciviecivilcivvyclachclackcladecladsclaesclagsclaimclairclameclampclamsclangclankclansclapsclaptclaroclartclaryclashclaspclassclastclatsclautclaveclaviclawsclayscleanclearcleatcleckcleekcleepclefscleftclegscleikclemsclepecleptclerkcleveclewsclickcliedcliescliffcliftclimbclimeclineclingclinkclintclipeclipscliptclitscloakcloamclockclodscloffclogsclokeclombclompcloneclonkclonscloopclootclopsclosecloteclothclotscloudclourclouscloutcloveclownclowscloyecloysclozeclubscluckcluedcluesclueyclumpclungclunkclypecnidacoachcoactcoadycoalacoalscoalycoaptcoarbcoastcoatecoaticoatscobbs
cobbycobiacoblecobotcobracobzacocascoccicoccocockscockycocoacocoscocuscodascodeccodedcodencodercodescodexcodoncoedscoffscogiecogoncoguecohabcohencohoecohogcohoscoifscoigncoilscoinscoirscoitscokedcokescokeycolascolbycoldscoledcolescoleycoliccolincollecollscollycologcoloncolorcoltscolzacomaecomalcomascombecombicombocombscombycomercomescometcomfycomiccomixcommacommecommocommscommycompocompscomptcomtecomusconchcondoconedconesconexconeyconfscongacongecongoconiaconicconinconksconkyconneconnscontecontoconusconvocoochcooedcooeecooercooeycoofscookscookycoolscoolycoombcoomscoomycoonscoopscooptcoostcoots
cootycoozecopalcopaycopedcopencopercopescophacoppycopracopsecopsycoquicoralcoramcorbecorbycordacordscoredcorercorescoreycorgicoriacorkscorkycormscornicornocornscornucornycorpscorsecorsocoseccosedcosescosetcoseycosiecostacostecostscotancotchcotedcotescothscottacottscouchcoudecoughcouldcountcoupecoupscourbcourdcourecourscourtcoutacouthcovedcovencovercovescovetcoveycovincowalcowancowedcowercowkscowlscowpscowrycoxaecoxalcoxedcoxescoxibcoyaucoyedcoyercoylycoypucozedcozencozescozeycoziecraalcrabscrackcraftcragscraiccraigcrakecramecrampcramscranecrankcranscrapecrapscrapycrarecrashcrasscratecravecrawl
crawscrayscrazecrazycreakcreamcredocredscreedcreekcreelcreepcreescreincremacremecremscrenacrepecrepscreptcrepycresscrestcrewecrewscriascribocribscrickcriedcriercriescrimecrimpcrimscrinecrinkcrinscrioscripecripscrisecrispcrisscrithcritscroakcrocicrockcrocscroftcrogscrombcromecronecronkcronscronycrookcroolcrooncropscrorecrosscrostcroupcroutcrowdcrowlcrowncrowscrozecruckcrudecrudocrudscrudycruelcruescruetcruftcrumbcrumpcrunkcruorcruracrusecrushcrustcrusycruvecrwthcryercrynecryptctenecubbycubebcubedcubercubescubiccubitcuckscuddacuddycuecacuffocuffscuifscuingcuishcuitscukesculchculetculexcullscully
culmsculpaculticultscultycumeccumincundycuneicunitcunnycuntscupelcupidcuppacuppycuprocuratcurbscurchcurdscurdycuredcurercurescuretcurfscuriacuriecuriocurlicurlscurlycurnscurnycurrscurrycursecursicurstcurvecurvycuseccushycuskscuspscuspycussocusumcutchcutercutescuteycutiecutincutiscuttocuttycutupcuveecuzescwtchcyanocyanscybercycadcycascyclecyclocydercylixcymaecymarcymascymescymolcyniccystscytescytonczarsdaalsdabbadacesdachadacksdadahdadasdaddydadisdadladadosdaffsdaffydaggadaggydagosdahisdahlsdaikodailydainedaintdairydaisydakerdaleddalekdalesdalisdalledallydaltsdamandamardamesdammedamnadamnsdamps
dampydancedancydandadandydangsdaniodanksdannydansedantsdappydarafdarbsdarcydareddarerdaresdargadargsdaricdarisdarksdarkydarlsdarnsdarredartsdarzidashidashydataldateddaterdatesdatildatosdattodatumdaubedaubsdaubydaudsdaultdauntdaursdautsdavendavitdawahdawdsdaweddawendawgsdawksdawnsdawtsdayaldayandaychdayntdazeddazerdazesdbagsdeadsdeairdealsdealtdeansdearedearndearsdearydeashdeathdeavedeawsdeawydebagdebardebbydebeldebesdebitdebtsdebuddebugdeburdebusdebutdebyedecaddecafdecaldecandecaydecimdeckodecksdecordecosdecoydecrydecyldedaldeedsdeedydeelydeemsdeensdeepsdeeredeersdeetsdeevedeevsdefatdeferdeffo
defisdefogdegasdegumdegusdeicedeidsdeifydeigndeilsdeinkdeismdeistdeitydekeddekesdekkodelaydeleddelesdelfsdelftdelisdelladellsdellydelosdelphdeltadeltsdelvedemandemesdemicdemitdemobdemoidemondemosdemotdemptdemurdenardenaydenchdenesdenetdenimdenisdensedentedentsdeochdeoxydepotdepthderatderayderbyderedderesderigdermadermsdernsdernyderosderpyderroderryderthdervsdesexdeshidesisdesksdessedetagdeterdetoxdeucedevasdeveldevildevisdevondevosdevotdewandewardewaxdeweddexesdexiedexysdhabadhaksdhalsdhikrdhobidholedholldholsdhonidhotidhowsdhutidiactdialsdianadianediarydiazodibbsdiceddicerdicesdiceydichtdicks
dickydicotdictadictodictsdictudictydiddydidiedidisdidosdidstdiebsdielsdienedietsdiffsdightdigitdikasdikeddikerdikesdikeydildodillidillsdillydimbodimerdimesdimlydimpsdinardineddinerdinesdingedingodingsdingydinicdinksdinkydinlodinnadinosdintsdiochdiodediolsdiotadippydipsodiramdirerdirgedirkedirksdirlsdirtsdirtydisasdiscidiscodiscsdishydisksdismeditalditasditchditedditesditsydittodittsdittyditzydivandivasdiveddiverdivesdiveydivisdivnadivosdivotdivvydiwandixiedixitdiyasdizendizzydjinndjinsdoabsdoatsdobbydobesdobiedobladobledobradobrodochtdocksdocosdocusdoddydodgedodgydodosdoeksdoersdoestdoethdoffs
dogaldogandogesdogeydoggodoggydogiedoglydogmadohyodoiltdoilydoingdoitsdojosdolcedolcidoleddoleedolesdoleydoliadoliedollsdollydolmadolordolosdoltsdomaldomeddomesdomicdonahdonasdoneedonerdongadongsdonkodonnadonnedonnydonordonsydonutdoobsdoocedoodydoofsdooksdookydooledoolsdoolydoomsdoomydoonadoorndoorsdoozydopasdopeddoperdopesdopeydoppedoraddorbadorbsdoreedoresdoricdorisdorjedorksdorkydormsdormydorpsdorrsdorsadorsedortsdortydosaidosasdoseddosehdoserdosesdoshadotaldoteddoterdotesdottydouardoubtdoucedoucsdoughdouksdouladoumadoumsdoupsdouradousedoutsdoveddovendoverdovesdoviedowakdowardowdsdowdydowed
doweldowerdowfsdowiedowledowlsdowlydownadownsdownydowpsdowrydowsedowtsdoxeddoxesdoxiedoyendoylydozeddozendozerdozesdrabsdrackdracodraffdraftdragsdraildraindrakedramadramsdrankdrantdrapedrapsdrapydratsdravedrawldrawndrawsdraysdreaddreamdreardreckdreeddreerdreesdregsdreksdrentdreredressdrestdreysdribsdricedrieddrierdriesdriftdrilldrilydrinkdripsdriptdrivedrockdroiddroildroitdrokedroledrolldromedronedronydroobdroogdrookdrooldroopdropsdroptdrossdroukdrovedrowndrowsdrubsdrugsdruiddrumsdrunkdrupedrusedrusydruxydryaddryasdryerdrylydsobodsomoduadsdualsduansduarsdubbodubbyducalducatducesduchyducksducky
ductiductsduddydudeddudesduelsduetsduettduffsdufusduingduitsdukasdukeddukesdukkadukundulcedulesduliadullsdullydulsedumasdumbodumbsdumkadumkydummydumpsdumpydunamduncedunchdunesdungsdungydunksdunnodunnydunshduntsduomiduomodupedduperdupesdupleduplyduppyduraldurasduredduresdurgydurnsdurocdurosduroydurradurrsdurrydurstdurumdurzidusksduskydustsdustydutchduvetduxesdwaaldwaledwalmdwamsdwamydwangdwarfdwaumdweebdwelldweltdwiledwinedyadsdyersdyingdykeddykesdykeydykondyneldynesdynosdzhoseagereagleeaglyeagreealedealeseanedeardsearedearlsearlyearnsearntearsteartheasedeaseleasereaseseasleeastseateneatereathe
eatineavedeavereavesebankebbedebbetebenaebeneebikeebonsebonyebookecadsecardecashechedechesechosecigseclatecoleecrusedemaedgededgeredgesedictedifyedileeditseduceeducteejiteensyeerieeeveneevereevnseffedefferefitsegadsegersegesteggareggedeggeregmasegretehingeidereidoseighteigneeikedeikoneildseironeiselejectejidoekdamekingekkaselainelandelanselateelbowelchieldereldinelecteleetelegyelemielfedelfineliadelideelinteliteelmenelogeelogyeloinelopeelopselpeeelsineludeeluteelvanelvenelverelvesemacsemailembarembayembedemberembogembowemboxembusemceeemeeremendemergemeryemeusemicsemirsemitsemmasemmeremmetemmew
emmysemojiemongemoteemoveemptsemptyemuleemureemydeemydsenactenarmenateendedenderendewendowendueenemaenemyenewsenfixeniacenjoyenlitenmewennogennuienokienolsenormenowsenrolensewenskyensueenterentiaentreentryenureenurnenvoienvoyenzymeolideorlseosinepactepeesepenaepeneephahephasephodephorepicsepochepodeepoptepoxyeppieeprisequalequesequidequiperaseerbiaerecterevsergonergosergoterhusericaerickericseringernederneserodeeroseerrederrorerseseructerugoerupteruvservenervilescarescotesileeskareskeresnesesrogessayessesesterestocestopestroetageetapeetatsetensethaletherethicethneethosethyleticsetnasetrogettin
ettleetudeetuisetweeetymaeughseukedeupadeuroseusolevadeevegsevenseventeverteveryevetsevhoeevictevilseviteevoheevokeewersewestewhowewkedexactexaltexamsexcelexeatexecsexeemexemeexertexfilexierexiesexileexineexingexistexiteexitsexodeexomeexonsexpatexpelexposextolextraexudeexulsexultexurbeyasseyerseyingeyotseyraseyreseyrieeyrirezinefabbofabbyfablefacedfacerfacesfacetfaceyfaciafaciefactafactofactsfactyfaddyfadedfaderfadesfadgefadosfaenafaeryfaffsfaffyfaggyfaginfagotfaiksfailsfainefainsfaintfairefairsfairyfaithfakedfakerfakesfakeyfakiefakirfalajfalesfallsfalsefalsyfamedfamesfanalfancyfandsfanesfanga
fangofangsfanksfannyfanonfanosfanumfaqirfaradfarcefarcifarcyfardsfaredfarerfaresfarlefarlsfarmsfarosfarrofarsefartsfascifastifastsfatalfatedfatesfatlyfatsofattyfatwafauchfaughfauldfaultfaunafaunsfaurdfautefautsfauvefavasfavelfaverfavesfavorfavusfawnsfawnyfaxedfaxesfayedfayerfaynefayrefazedfazesfealsfeardfearefearsfeartfeasefeastfeatsfeazefecalfecesfechtfecitfecksfedaifedexfeebsfeedsfeelsfeelyfeensfeersfeesefeezefehmefeignfeintfeistfelchfelidfelixfellafellsfellyfelonfeltsfeltyfemalfemesfemicfemmefemmyfemurfencefendsfendyfenisfenksfennyfentsfeodsfeoffferalfererferesferiaferlyfermifermsfernsferny
feroxferryfessefestafestsfestyfetalfetasfetchfetedfetesfetidfetorfettafettsfetusfetwafeuarfeudsfeuedfeverfewerfeyedfeyerfeylyfezesfezzyfiarsfiatsfiberfibrefibroficesfichefichuficinficosfictaficusfidesfidgefidosfidusfiefsfieldfiendfientfierefierifiersfieryfiestfifedfiferfifesfifisfifthfiftyfiggyfightfigosfikedfikesfilarfilchfiledfilerfilesfiletfiliifilksfillefillofillsfillyfilmifilmsfilmyfilonfilosfilthfilumfinalfincafinchfindsfinedfinerfinesfinisfinksfinnyfinosfiordfiqhsfiquefiredfirerfiresfiriefirksfirmafirmsfirnifirnsfirryfirstfirthfiscsfishofishyfisksfistsfistyfitchfitlyfitnafittefittsfiver
fivesfixedfixerfixesfixiefixitfizzyfjeldfjordflabsflackflaffflagsflailflairflakeflaksflakyflameflammflamsflamyflaneflankflansflapsflareflaryflashflaskflatsflavaflawnflawsflawyflaxyflaysfleamfleasfleckfleekfleerfleesfleetflegsflemefleshfleurflewsflexiflexofleysflickflicsfliedflierfliesflimpflimsflingflintflipsflirsflirtfliskfliteflitsflittfloatflobsflockflocsfloesflogsflongfloodfloorflopsflorafloreflorsfloryfloshflossflotafloteflourfloutflownflowsflowyflubsfluedfluesflueyflufffluidflukeflukyflumeflumpflungflunkfluorflurrflushfluteflutyfluytflybyflyerflyinflypeflytefnarrfoalsfoamsfoamyfocalfocus
foehnfogeyfoggyfogiefoglefogosfogoufohnsfoidsfoilsfoinsfoistfoldsfoleyfoliafolicfoliefoliofolksfolkyfollyfomesfondafondsfondufonesfoniofonlyfontsfoodsfoodyfoolsfootsfootyforamforayforbsforbyforcefordofordsforelforesforexforgeforgoforksforkyformaformeformsforteforthfortsfortyforumforzaforzefossafossefouatfoudsfouerfouetfoulefoulsfoundfountfoursfouthfoveafowlsfowthfoxedfoxesfoxiefoyerfoylefoynefrabsfrackfractfragsfrailfraimfraisframefrancfrankfrapefrapsfrassfratefratifratsfraudfrausfraysfreakfreedfreerfreesfreetfreitfremdfrenafreonfrerefreshfretsfriarfribsfriedfrierfriesfrigsfrillfrisefriskfrist
fritafritefrithfritsfrittfritzfrizefrizzfrockfroesfrogsfrommfrondfronsfrontfroomfrorefrornfroryfroshfrostfrothfrownfrowsfrowyfroyofrozefrugsfruitfrumpfrushfrustfryerfubarfubbyfubsyfucksfucusfuddyfudgefudgyfuelsfuerofuffsfuffyfugalfuggyfugiefugiofugisfuglefuglyfuguefugusfujisfullafullsfullyfulthfulwafumedfumerfumesfumetfundafundifundofundsfundyfungifungofungsfunicfunisfunksfunkyfunnyfunsyfuntsfuralfuranfurcafurlsfurolfurorfurosfurrsfurryfurthfurzefurzyfusedfuseefuselfusesfusilfusksfussyfustsfustyfutonfuzedfuzeefuzesfuzilfuzzyfycesfykedfykesfylesfyrdsfyttegabbagabbygablegaddigadesgadgegadgygadid
gadisgadjegadjogadsogaffegaffsgagedgagergagesgaidsgailygainsgairsgaitagaitsgaittgajosgalahgalasgalaxgaleagaledgalesgaliagalisgallsgallygalopgalutgalvogamasgamaygambagambegambogambsgamedgamergamesgameygamicgamingammagammegammygampsgamutganchgandyganefganevgangsganjaganksganofgantsgaolsgapedgapergapesgaposgappygaramgarbagarbegarbogarbsgardagardegaresgarisgarmsgarnigarregarrigarthgarumgasesgashygaspsgaspygassygastsgatchgatedgatergatesgathsgatorgauchgaucygaudsgaudygaugegaujegaultgaumsgaumygauntgaupsgaursgaussgauzegauzygavelgavotgawcygawdsgawksgawkygawpsgawsygayalgayergaylygazalgazargazedgazergazes
gazongazoogealsgeansgearegearsgeasageatsgeburgeckogecksgeeksgeekygeepsgeesegeestgeistgeitsgeldsgeleegelidgellygeltsgemelgemmagemmygemotgenaegenalgenasgenesgenetgenicgeniegeniigeningeniogenipgennygenoagenomgenregenrogentsgentygenuagenusgeodegeoidgerahgerbegeresgerlegermsgermygernegessegessogestegestsgetasgetupgeumsgeyangeyerghastghatsghautghazigheesghestghostghoulghuslghyllgiantgibedgibelgibergibesgibligibusgiddygiftsgigasgighegigotgiguegilasgildsgiletgiliagillsgillygilpygiltsgimelgimmegimpsgimpyginchgingagingegingsginksginnyginzogipongippogippygipsygirdsgirlfgirlsgirlygirnsgirongirosgirrsgirsh
girthgirtsgismogismsgistsgitchgitesgiustgivedgivengivergivesgizmoglacegladegladsgladyglaikglairglampglamsglandglansglareglaryglassglattglaumglaurglazeglazygleamgleanglebaglebeglebygledegledsgleedgleekgleesgleetgleisglensglentgleysglialgliasglibsglidegliffgliftglikeglimeglimsglintgliskglitsglitzgloamgloatglobeglobiglobsglobyglodegloggglomsgloomgloopglopsgloryglossglostgloutgloveglowsglowyglozegluedgluergluesglueygluggglugsglumeglumsgluongluteglutsglyphgnapignarlgnarrgnarsgnashgnatsgnawngnawsgnomegnowsgoadsgoafsgoaftgoalsgoarygoatsgoatygoavegobangobargobbegobbigobbogobbygobisgobosgodetgodlygodso
goelsgoersgoestgoethgoetygofergoffsgoggagogosgoiergoinggojisgokesgoldsgoldygolemgolesgolfsgollygolpegolpsgombogomergompagonadgonchgonefgonergongsgoniagonifgonksgonnagonofgonysgonzogoobygoodogoodsgoodygooeygoofsgoofygoogsgooksgookygooldgoolsgoolygoomygoonsgoonygoopsgoopygoorsgoorygoosegoosygopakgopikgoralgorasgoraygorbsgordogoredgoresgorgegorisgormsgormygorpsgorsegorsygoshtgossegotchgothsgothygottagouchgougegouksgouragourdgoutsgoutygovedgovesgowangowdsgowfsgowksgowlsgownsgoxesgoyimgoylegraalgrabsgracegradegradsgraffgraftgrailgraingraipgramagramegrampgramsgranagrandgranogransgrantgrapegraphgrapy
graspgrassgratagrategratsgravegravsgravygraysgrazegreatgrebegrebogrecegreedgreekgreengreesgreetgregegregogreingrensgrepsgresegrevegrewsgreysgricegridegridsgriefgriffgriftgrigsgrikegrillgrimegrimygrindgrinsgriotgripegripsgriptgripygrisegristgrisygrithgritsgrizegroangroatgrodygrogsgroingroksgromagromsgronegroofgroomgropegrossgroszgrotsgroufgroupgroutgrovegrovygrowlgrowngrowsgrrlsgrrrlgrubsgruedgruelgruesgrufegruffgrumegrumpgrundgruntgrycegrydegrykegrypegryptguacoguanaguanoguansguardguarsguavagubbagucksguckygudesguessguestguffsgugasgugglguideguidoguidsguildguileguiltguimpguiroguisegulabgulaggular
gulasgulchgulesguletgulfsgulfygullsgullygulphgulpsgulpygumbogummagummigummygumpsgunasgundigundygungegungygunksgunkygunnyguppyguqingurdygurgegurksgurlsgurlygurnsgurrygurshgurusgushyguslaguslegusligussygustogustsgustygutsyguttaguttyguyedguyleguyotguysegwinegyalsgyansgybedgybesgyeldgympsgynaegyniegynnygynosgyozagypesgyposgyppogyppygypsygyralgyredgyresgyrongyrosgyrusgytesgyvedgyvergyveshaafshaarshaatshabithablehabushacekhackshackyhadalhadedhadeshadjihadsthaemshaerehaetshaffshafizhaftahaftshaggshahamhahashaickhaikahaikshaikuhailshailyhainshainthairshairyhaithhajeshajishajjihakamhakashakeahakeshakim
hakushalalhaldihaledhalerhaleshalfahalfshalidhallohallshalmahalmshalonhaloshalsehalshhaltshalvahalvehalwahamalhambahamedhamelhameshammyhamzahanaphancehanchhandihandshandyhangihangshankshankyhansahansehantshaolehaomahapashapaxhaplyhappihappyhapusharamhardshardyharedharemharesharimharksharlsharmsharnsharosharpsharpyharryharshhartshashyhaskshaspshastahastehastyhatchhatedhaterhateshathahathihattyhaudshaufshaughhaugohauldhaulmhaulshaulthaunshaunthausehautehavanhavelhavenhaverhaveshavochawedhawkshawmshawsehayedhayerhayeyhaylehazanhazedhazelhazerhazeshazleheadsheadyhealdhealsheameheapsheapyheardheare
hearsheartheastheathheatsheatyheaveheavyhebenhebeshechtheckshederhedgehedgyheedsheedyheelsheezehefteheftsheftyheiauheidsheighheilsheirsheisthejabhejraheledhelesheliohelixhellahellohellshellyhelmsheloshelothelpshelvehemalhemeshemicheminhempshempyhencehenchhendshengehennahennyhenryhentsheparherbsherbyherdsheresherlshermahermshernsheronherosherpsherryhersehertzheryehespshestsheteshethsheuchheughheveahevelhewedhewerhewghhexadhexedhexerhexeshexylheyedhianthibashickshidedhiderhideshiemshifishighshighthijabhijrahikedhikerhikeshikoihilarhilchhillohillshillyhilsahiltshilumhilushimbohinauhindshingehings
hinkyhinnyhintshioishipedhiperhipeshiplyhippohippyhiredhireehirerhireshissyhistshitchhithehivedhiverhiveshizenhoachhoaedhoagyhoardhoarshoaryhoasthobbyhoboshockshocushodadhodjahoershoganhogenhoggshoghshogohhogoshohedhoickhoiedhoikshoinghoisehoisthokashokedhokeshokeyhokishokkuhokumholdsholedholesholeyholkshollahollohollyholmeholmsholonholosholtshomashomedhomerhomeshomeyhomiehommehomoshonanhondahondshonedhonerhoneshoneyhongihongshonkshonkyhonorhoochhoodshoodyhooeyhoofshoogohoohahookahookshookyhoolyhoonshoopshoordhoorshooshhootshootyhoovehopakhopedhoperhopeshoppyhorahhoralhorashordehorishorkshorme
hornshornyhorsehorsthorsyhosedhoselhosenhoserhoseshoseyhostahostshotchhotelhotenhotishotlyhottehottyhouffhoufshoughhoundhourihourshousehoutshoveahovedhovelhovenhoverhoveshowayhowbehowdyhoweshowffhowfshowkshowlshowrehowsohowtohoxedhoxeshoyashoyedhoylehubbahubbyhuckshudnahududhuershuffshuffyhugerhuggyhuhushuiashuieshukouhulashuleshulkshulkyhullohullshullyhumanhumashumfshumichumidhumorhumphhumpshumpyhumushunchhundohunkshunkyhuntshurdshurlshurlyhurrahurryhursthurtshurtyhushyhuskshuskyhusoshussyhutchhutiahuzzahuzzyhwylshydelhydrahydrohyenahyenshyggehyinghykeshylashyleghyleshylichymenhymnshyndehyoid
hypedhyperhypeshyphahyphyhyposhyraxhysonhytheiambiiambsibrikicersichedichesichoriciericilyicingickerickleiconsictalicticictusidantiddahiddatiddutidealideasideesidentidiomidiotidledidleridlesidlisidolaidolsidyllidylsiftarigapoiggediglooiglusignisihramiiwisikansikatsikonsileacilealileumileusiliaciliadilialiliumillerillthimageimagoimagyimamsimariimaumimbarimbedimbosimbueimideimidoimidsimineiminoimlisimmewimmitimmiximpedimpelimpisimplyimpotimproimshiimshyinaneinaptinarminboxinbyeincasincelincleincogincurincusincutindewindexindiaindieindolindowindriindueineptinerminertinferinfixinfosinfrainganingle
ingotinioninkedinkerinkleinlayinletinnedinnerinnieinnitinorbinputinrosinruninseeinsetinspointelinterintilintisintraintroinulainureinurninustinvarinverinwitiodiciodidiodinioniciorasiotasipponiradeirateiridsiringirkedirokoironeironsironyisbasishesisledislesisletisnaeisseiissueistleitchyitemsitheriviediviesivoryixiasixnayixoraixtleizardizarsizzatjaapsjabotjacaljacetjacksjackyjadedjadesjafasjaffajagasjagerjaggsjaggyjagirjagrajailsjakerjakesjakeyjakiejalapjaleojalopjambejambojambsjambujamesjammyjamonjamunjanesjankyjannsjannyjantyjapanjapedjaperjapesjarksjarlsjarpsjartajaruljaseyjaspejaspsjathajatis
jatosjauksjaunejauntjaupsjavasjaveljawanjawedjawnsjaxiejazzyjeansjeatsjebeljedisjeelsjeelyjeepsjeerajeersjeezejefesjeffsjehadjehusjelabjellojellsjellyjembejemmyjennyjeonsjeridjerksjerkyjerryjessejessyjestsjesusjeteejetesjetonjettyjeunejewedjeweljewiejhalajheeljhilsjiaosjibbajibbsjibedjiberjibesjiffsjiffyjiggyjigotjihadjillsjiltsjimmyjimpyjingojingsjinksjinnejinnijinnsjirdsjirgajirrejismsjitisjittyjivedjiverjivesjiveyjnanajobedjobesjockojocksjockyjocosjodeljoeysjohnsjoinsjointjoistjokedjokerjokesjokeyjokoljoledjolesjoliejollojollsjollyjoltsjoltyjomonjomosjonesjongsjontyjooksjoramjortsjorumjotas
jottyjotunjoualjougsjouksjoulejoursjoustjowarjowedjowlsjowlyjoyedjubasjubesjucosjudasjudgejudgyjudosjugaljugumjuicejuicyjujusjukedjukesjukusjulepjuliajumarjumbojumbyjumpsjumpyjuncojunksjunkyjuntajuntojupesjuponjuraljuratjureljuresjurisjurorjustejustsjutesjuttyjuvesjuviekaamakababkabarkabobkachakackskadaikadeskadiskafirkagoskaguskahalkaiakkaidskaieskaifskaikakaikskailskaimskaingkainskajalkakaskakiskalamkalaskaleskalifkaliskalpakaluakamaskameskamikkamiskammekanaekanalkanaskanatkandykanehkaneskangakangskanjikantskanzukaonskapaikapaskaphakaphskapokkapowkappakapurkapuskaputkaraikaraskaratkareekarez
karkskarmakarnskarookaroskarrikarstkarsykartskarzykashakasmekatalkataskatiskattikaughkaurikaurukaurykavalkavaskawaskawaukawedkayakkaylekayoskaziskazookbarskcalskeakikebabkebarkebobkeckskedgekedgykeechkeefskeekskeelskeemakeenokeenskeepskeetskeevekefirkehuakeirskelepkelimkellskellykelpskelpykeltskeltykembokembskempskemptkempykenafkenchkendokenoskentekentskepiskerbskerelkerfskerkykermakernekernskeroskerrykervekesarkestsketasketchketesketolkevelkevilkexeskeyedkeyerkhadikhadskhafskhakikhanakhanskhaphkhatskhayakhazikhedakheerkhethkhetskhirskhojakhorskhoumkhudskhulakhyalkiaatkiackkiakikiangkiasukibbe
kibbikibeikibeskiblakickskickykiddokiddykidelkideokidgekiefskierskievekievskightkikaykikeskikoikileykiligkilimkillskilnskiloskilpskiltskiltykimbokimetkinaskindakindskindykineskingskingykininkinkskinkykinoskiorekioskkipahkipaskipeskippakippskipsykirbykirkskirnskirrikisankissykistskitabkitedkiterkiteskithekithskitkekittykitulkivaskiwisklangklapsklettklickkliegkliksklongkloofklugeklutzknackknagsknapsknarlknarsknaurknaveknawekneadkneedkneelkneesknellkneltknickknifeknishknitskniveknobsknockknollknoopknopsknospknotsknoudknoutknowdknoweknownknowsknubsknuleknurlknurrknursknutskoalakoanskoapskobankobos
koelskoffskoftakogalkohaskohenkohlskoinekoiwikojiskokamkokaskokerkokrakokumkolaskoloskombikombukonbukondokonkskookskookykoorikopekkophskopjekoppakoraikorankoraskoratkoreskoriskormakoroskorunkoruskoseskotchkotoskotowkourakraalkrabskraftkraiskraitkrangkranskranzkrautkrayskreefkreenkreepkrengkrewekrillkriolkronakronekroonkrubikrumpkrunkksarskubiekudoskuduskudzukufiskugelkuiaskukrikukuskulakkulankulaskulfikumiskumyskunaskundskuriskurrekurtakuruskussokustikutaikutaskutchkutiskutuskuyaskuzuskvasskvellkwaaikwelakwinkkwirlkyackkyakskyangkyarskyatskyboskydstkyleskyliekylinkylixkyloekyndekyndskypeskyrie
kyteskythekyudolaarflaarilabdalabellabialabislabnelaborlabralaccylacedlacerlaceslacetlaceylacislackalackslackyladduladdyladedladeeladenladerladesladleladoolaerslaevolaganlagarlagerlaggylahallaharlaichlaicslaidelaidslaighlaikalaikslairdlairslairylaithlaitylakedlakerlakeslakhslakinlaksalaldylallslamaslambslambylamedlamerlameslamialammylampslanailanaslancelanchlandelandslanedlaneslankslankylantslapaslapellapinlapislapjelappalappylapselarchlardslardylareelareslarfslargalargelargolarislarkslarkylarnslarntlarumlarvalasedlaserlaseslassilassolassulassylastslatahlatchlatedlatenlaterlatexlathelathilaths
lathylatkelattelatuslauanlauchlaudelaudslaufslaughlaundlauralavallavaslavedlaverlaveslavralavvylawedlawerlawinlawkslawnslawnylawsylaxedlaxerlaxeslaxlylaybylayedlayerlayinlayuplazarlazedlazeslazoslazzilazzoleachleadsleadyleafsleafyleaksleakyleamsleansleantleanyleapsleaptlearelearnlearslearyleaseleashleastleatsleaveleavyleazelebenleccylecheledesledgeledgyledumleearleechleeksleepsleersleeryleeseleetsleezelefteleftsleftylegallegerlegesleggeleggoleggylegitlegnolehrslehualeirsleishlemanlemedlemellemeslemmalemmelemonlemurlendsleneslengslenislenoslenselentilentoleonelepakleperlepidlepraleptaleredleres
lerpslesboleseslesoslestsletchlethelettyletupleuchleucoleudsleughlevasleveelevelleverleveslevinlevislewislexeslexislezeslezzalezzolezzylianalianeliangliardliarsliartlibelliberliborlibralibrelibrilicetlichilichtlicitlickslidarlidosliefsliegelienslierslieuslieveliferlifeslifeyliftsliganligerliggelightlignelikedlikenlikerlikeslikinlilaclillslilosliltsliltylimanlimaslimaxlimbalimbilimbolimbslimbylimedlimenlimeslimeylimitlimmalimnslimoslimpalimpslinaclinchlindslindylinedlinenlinerlineslineylingalingolingslingylininlinkslinkylinnslinnylinoslintslintylinumlinuxlionslipaslipeslipidlipinliposlippyliras
lirkslirotlisesliskslislelispslistslitailitaslitedlitemliterliteslithelitholithslitielitrelivedlivenliverliveslividlivorlivreliwaaliwasllamallanoloachloadsloafsloamsloamyloansloastloathloavelobarlobbylobedlobesloboslobuslocallochelochslochylocielocislockslockylocoslocumlocuslodenlodeslodgeloessloftsloftyloganlogesloggylogialogiclogieloginlogoilogonlogoslohanloidsloinsloipeloirslokeslokeylokumlolasloledlollolollslollylologloloslomaslomedlomeslonerlongalongelongsloobylooedlooeyloofaloofslooielookslookyloomsloonsloonyloopsloopyloordlooselootslopedloperlopesloppyloralloranlordslordylorelloresloric
lorislorrylosedlosellosenloserloseslossylotahlotaslotesloticlotoslotsalottalottelottolotuslouedloughlouielouisloumaloundlounsloupeloupslourelourslourylouselousyloutslovatlovedloveeloverlovesloveylovielowanlowedlowenlowerloweslowlylowndlownelownslowpslowrylowselowthlowtsloxedloxesloyallozenluachluauslubedlubeslubraluceslucidlucksluckylucreludesludicludosluffaluffslugedlugerlugeslullsluluslumaslumbilumenlummelummylumpslumpylunarlunaslunchluneslunetlungelungilungslunksluntslupinlupuslurchluredlurerlureslurexlurgilurgyluridlurkslurrylurveluserlushyluskslustslustylususlutealutedluterlutesluvvyluxed
luxerluxeslweislyamslyardlyartlyaselycealyceelycralyinglymeslymphlynchlyneslyreslyriclysedlyseslysinlysislysollyssalytedlyteslythelyticlyttamaaedmaaremaarsmabanmabesmacasmacawmaccamacedmacermacesmachemachimachomachsmackamacksmaclemaconmacromactemadalmadammadarmaddymadgemadidmadlymadosmadremaedimaerlmafiamaficmaftsmagasmagesmaggsmagicmagmamagnamagotmagusmahalmahemmahismahoemahrsmahuamahwamaidsmaikomaiksmailemaillmailomailsmaimsmainsmairemairsmaisemaistmaizemajasmajatmajoemajormajosmakafmakaimakanmakarmakeemakermakesmakiemakismakosmalaemalaimalammalarmalasmalaxmaleomalesmalicmalikmalismalkymalls
malmsmalmymaltsmaltymalusmalvamalwamamakmamasmambamambomambumameemameymamiemamilmammamammymanasmanatmandimandsmandymanebmanedmanehmanesmanetmangamangemangimangomangsmangymaniamanicmaniemanismanksmankymanlymannamannymanoamanormanosmansemansomantamantemantomantsmantymanulmanusmanzomapaumapesmaplemapoumappymaqammaquimaraemarahmaralmaranmarasmaraymarchmarcsmardsmardymaresmargamargemargomargsmariamaridmarilmarkamarksmarlemarlsmarlymarmamarmsmaronmarormarramarrimarrymarsemarshmartsmaruamarvymasasmasedmasermasesmashamashymasksmasonmassamassemassymastsmastymasurmasusmasutmataimatchmatedmatermatesmatey
mathemathsmatinmatlomatramatsumattemattsmattymatzamatzomaubymaudsmaukamaulamaulsmaumsmaumymaundmauntmaurimausymautsmauvemauvymauzymavenmaviemavinmavismawedmawksmawkymawlamawnsmawpsmawrsmaxedmaxesmaximmaxismayanmayasmaybemayedmayormayosmaystmazacmazakmazarmazasmazedmazelmazermazesmazetmazeymazutmbarimbarsmbilambirambretmbubembugameadsmeakemeaksmealsmealymeanemeansmeantmeanymearemeasemeathmeatsmeatymebbemebosmeccamechamechsmecksmecummedalmediamedicmediimedinmedlemeechmeedsmeejameepsmeersmeetsmeffsmeidsmeikomeilsmeinsmeintmeinymeismmeithmekkamelammelasmelbamelchmeldsmeleemelesmelicmelikmellsmeloe
melonmelosmeltsmeltymemesmemicmemosmenadmencemendsmenedmenesmengemengsmenilmensamensemenshmentamentomentsmenusmeousmeowsmerchmercsmercymerdemerdsmeredmerelmerermeresmergemerilmerismeritmerksmerlemerlsmerrymersemerskmesadmesalmesasmescameselmesemmesesmeshymesiamesicmesnemesonmessymestomesylmetalmetasmetedmetegmetelmetermetesmethimethomethsmethymeticmetifmetismetolmetremetromettameumsmeusemevedmevesmewedmewlsmeyntmezesmezzamezzemezzomgalsmhorrmiaismiaoumiaowmiasmmiaulmicasmichemichimichtmicksmickymicosmicramicromiddymidgemidgymidismidstmiensmieuxmievemiffsmiffymiftymiggsmightmigmamigodmihasmihis
mikanmikedmikesmikosmikramikvamilchmildsmilermilesmilfsmiliamilkomilksmilkymillemillsmillymilormilosmilpamiltsmiltymiltzmimedmimeomimermimesmimicmimismimsyminaeminarminasmincemincymindimindsminedminerminesmingemingimingsmingyminimminisminkeminksminnyminorminosminsemintsmintyminusminxymiraamirahmirchmiredmiresmirexmiridmirinmirknmirksmirkymirlsmirlymirosmirrlmirrsmirthmirvsmirzamisalmischmisdomisermisesmisgomiskymislsmisosmissamissymistomistsmistymitasmitchmitermitesmiteymitiemitismitremitrymittamittsmiveymivvymixedmixenmixermixesmixiemixismixtemixupmiyasmizenmizesmizzymmkaymnememoaismoakymoals
moanamoansmoanymoarsmoatsmobbymobedmobeemobesmobeymobiemoblemobosmocapmochamochimochsmochymocksmockymocosmocusmodalmodelmodemmodermodesmodgemodiimodinmodocmodommodusmoenimoersmofosmogarmogasmoggymogosmogramoguemogulmoharmohelmohosmohrsmohuamohurmoilemoilsmoiramoiremoistmoitsmoitymojosmokermokesmokeymokismokkymokosmokusmolalmolarmolasmoldsmoldymoledmolermolesmoleymoliemollamollemollomollsmollymoloimolosmoltomoltsmoluemolvimolysmomesmomiemommamommemommymomosmompemomusmonadmonalmonasmondemondomonermoneymongomongsmonicmoniemonksmonosmonpemontemonthmontymoobsmoochmoodsmoodymooedmooeymooksmoolamooli
moolsmoolymoongmoonimoonsmoonymoopsmoorsmoorymoosemoothmootsmoovemopedmopermopesmopeymoppymopsymopusmoraemorahmoralmoranmorasmoratmoraymoreemorelmoresmorgymoriamorinmormomornamornemornsmoronmorormorphmorramorromorsemortsmorukmosedmosesmoseymosksmossomossymostemostomostsmotedmotelmotenmotesmotetmoteymothsmothymotifmotismotonmotormottemottomottsmottymotusmotzamouchmouesmoufsmouldmoulemoulsmoultmoulymoundmountmoupsmournmousemoustmousymouthmovedmovermovesmoviemowasmowedmowermowiemowramoxasmoxiemoyasmoylemoylsmozedmozesmozosmpretmradsmsasamtepemuchomucicmucidmucinmuckomucksmuckymucormucromucusmudar
muddymudgemudifmudimmudirmudramuffsmuffymuftimuggamuggsmuggymughomugilmugosmuhlymuidsmuilsmuirsmuirymuistmujikmukimmuktimulaimulchmulctmuledmulesmuleymulgamuliemullamullsmulsemulshmumbomummsmummymumphmumpsmumsymumusmunchmundsmundumungamungemungimungomungsmungymuniamunismunjamunjsmuntsmuntumuonsmuralmurasmuredmuresmurexmurghmurgimuridmurksmurkymurlsmurlymurramurremurrimurrsmurrymurthmurtimurukmurvamusarmuscamusedmuseemusermusesmusetmushamushymusicmusitmusksmuskymusosmussemussymustamusthmustsmustymutasmutchmutedmutermutesmuthamuticmutismutonmuttimuttsmutummuvvamuxedmuxesmuzakmuzzymvulamvulemvuli
myallmyalsmylarmynahmynasmyoidmyomamyonsmyopemyopsmyopymyrrhmysidmysiemythimythsmythymyxosmzeesnaamsnaansnaatsnabamnabbynabesnabisnabksnablanabobnachenachonacrenadasnadirnaevenaevinaffsnagarnagasnagesnaggynagornahalnaiadnaibsnaicenaidsnaieonaifsnaiksnailsnailynainsnaiosnairanairunaivenajibnakasnakednakernakfanalasnalednallanamadnamaknamaznamednamernamesnammanamusnanasnancenancynandunannanannynanosnantenantinantonantsnantynanuanapasnapednapesnapohnapoonappanappenappynarasnarconarcsnardsnaresnaricnarisnarksnarkynarodnarranarrenasalnashinashonasisnasonnastynasusnataknatalnatchnatesnatisnattonatty
natyanauchnauntnavalnavarnavednavelnavesnavewnavvynawabnawalnazarnazesnazirnazisnazzyndujaneafenealsneantneapsnearsneathneatoneatsnebbynebeknebelnechenecksneddyneebsneedsneedyneefsneeldneeleneembneemsneepsneeseneezenefienegrinegronegusneifsneighneistneivenelianelisnellynemasnemicnemnsnemptnenesnentaneonsneosaneozanepernepitneralneramnerdsnerdynerfsnerkanerksnerolnertsnertznervenervyneskinestsnestynetasnetesnetopnettanettsnettyneuksneumeneumsnevelnevernevesnevisnevusnevvynewbsnewednewelnewernewienewlynewsynewtsnexalnexinnextsnexumnexusngaiongakanganangapingatingegengomangoningramngweenibbynicad
nicednicerniceynichenichtnicksnickynicolnidalnidednidesnidornidusnieceniefsniessnievenifesniffsniffynifleniftynigernigganighsnightnigreniguanihilnikabnikahnikaunilasnillsnimbinimbsnimbynimpsninerninesninjaninnyninonnintaninthnioponiozanipasnipetnippyniqabnirlsnirlyniseinisinnissenisusnitalniternitesnitidnitonnitrenitronitrynittanittonittynivalnivasnivelnixednixernixesnixienizamnjirlnkosinmolinmolsnoahsnobbynoblenoblynocksnodalnoddynodednodesnodumnodusnoelsnoemanoemenogalnoggsnoggynohownoiasnoilsnoilynointnoirenoirsnoisenoisynokesnolesnollenollsnolosnomadnomasnomennomesnomicnomoinomosnonannonas
noncenoncynondanondononesnonetnongsnonicnonisnonnanonnononnynonylnoobsnooisnooitnooksnookynoonenoonsnoopsnoosenoovenopalnorianorienorisnorksnormanormsnorthnosednosernosesnoseynoshinosirnotalnotamnotchnotednoternotesnotumnougsnoujanouldnoulenoulsnounsnounynoupsnoustnovaenovasnovelnovianovionovumnowaynowdsnowednowlsnowtsnowtynoxalnoxasnoxesnoyaunoyednoyesnrttanrtyansimanubbynubianuchanucinnuddynudernudesnudgenudgynudienudzhnuevonuffsnugaenujolnukednukesnullanullonullsnullynumbsnumennummynumpsnunksnunkynunnynunusnuquenurdsnurdynurlsnurrsnursenurtsnurtznusednusesnutsonutsynuttynyaffnyalanyamsnying
nylonnymphnyongnyssanyungnyusenyuzeoafosoakedoakenoakeroakumoaredoareroasaloasesoasisoastsoatenoateroathsoavesobangobbosobeahobeliobeseobeysobiasobiedobiitobitsobjetoboesoboleoboliobolsoccamoccuroceanocherochesochreochryockerocoteocreaoctadoctaloctanoctasoctetocticoctlioctyloculiodahsodalsodderoddlyodeonodeumodismodistodiumodoomodorsodourodumsodyleodylsofaysoffaloffedofferoffieoflagoftenofterofuroogamsogeedogeesogginoghamogiveogledogleroglesogmicogresoheloohiasohingohmicohoneoicksoidiaoiledoileroiletoinksointsoiranojimeokapiokaysokehsokiesokingokoleokrasokrugoktasolateoldenolderoldieoldlyolehs
oleicoleinolentoleosoleumoleyloligooliosolivaoliveollasollavollerollieologyolonaolpaeolpesomasaomberombreombusomdahomdasomddaomdehomeesomegaomensomersomiaiomitsomlahommelomminomnesomovsomrahomulsonceroncesoncetoncusondesondolonelyonersoneryongononiononiumonkusonlaponlayonmunonnedonsenonsetontalonticooaasoobitoohedooidsoojahoomphoontsoopakoopedoopsyoorieoosesootidooyahoozedoozesoozieoozleopahsopalsopensopepeoperaoperyopgafopihiopineopingopiumopposopsatopsinopsitoptedopteropticopzitorachoracyoralsorangoransorantorateorbatorbedorbicorbitorcasorcinorderordieordosoreadorfesorfulorganorgiaorgicorgue
oribiorielorigoorixaorlesorlonorlopormerorneeornisorpedorpinorrisortetorthoorvalorzososarsoscarosetroseysoshacosieroskinoslinosmicosmolosoneossiaostiaotakuotaryotherothylotiumottarotterottosoubitoucheouchtouedsouensoughtouijaoulksoumasounceoundyoupasoupedoupheouphsoureyourieouselousiaoustsoutbyoutdooutedoutenouteroutgooutieoutreoutroouttaouzelouzosovalsovaryovateovelsovensoversovertovineovismovistovoidovoliovoloovuleowareowariowcheowersowiesowingowledowlerowletownedownerownioowresowrieowsenoxbowoxeasoxersoxeyeoxideoxidsoxiesoximeoximsoxineoxlipoxmanoxmenoxteroyamaoyersozekiozenaozoneozziepaaho
paalspaanspacaipacaspacaypacedpacerpacespaceypachapackspackypacospactapactspadampadaspaddopaddypadispadlepadmapadoupadrepadripaeanpaedopaeonpaganpagedpagerpagespaglepagnepagodpagripahitpahospahuspaikspailspainspaintpaipepaipspairepairspaisapaisepakaypakkapakkipakuapakulpalakpalarpalaspalaypaleapaledpalerpalespaletpalispalkipallapallspallupallypalmspalmypalpipalpspalsapalsypaluspambypampapanaxpancepanchpandapandspandypanedpanelpanespangapangspanicpanimpanirpankopankspannapannepannipannypansypantopantspantypaolipaolopapadpapalpapaspapawpaperpapespapeypappipappypapriparaeparasparchparcspardipards
pardyparedparenpareoparerparespareuparevpargepargoparidparisparkaparkiparksparkyparleparlyparmaparmoparmsparolparpsparraparrsparryparsepartepartipartspartyparveparvopasagpasarpaschpaseopasespashapashmpaskapasmopaspypassepassupastapastepastspastypataspatchpatedpateepatelpatenpaterpatespathspatiapatinpatiopatkapatlypatsypattapattepattupattypatuspauaspaulspausepauxipavanpavaspavedpavenpaverpavespavidpaviepavinpavispavonpavvypawaspawawpawedpawerpawkspawkypawlspawnspaxespayedpayeepayerpayorpaysdpeacepeachpeagepeagspeakepeakspeakypealspeanspearepearlpearspeartpeasepeasypeatspeatypeavypeazepebaspecan
pechspeciapeckepeckspeckypectspedalpedespedispedonpedospedropeecepeekspeekypeelspeelypeenspeentpeeoypeepepeepspeepypeerspeerypeevepeevopeggypeghspegmapegospeinepeinspeisepeisypeizepekanpekaupekeapekespekidpekinpekoepelaspelaupelchpelespelfspellspelmapelogpelonpelshpeltapeltspeluspenalpencependspendupenedpenespengopeniepenispenkspennapennepennipennypensepensypentspeolapeonspeonypeplapeplepeponpepospeppypepsipequiperaeperaiperceperchpercsperduperdypereaperesperfsperilperisperksperkyperleperlspermspermypernepernsperogperpsperryperseperspperstpertspervepervopervspervypeschpeskypesospestapestopests
pestypetalpetarpeterpetitpetospetrepetripettipettopettypewedpeweepewitpeysepffttphagephangpharepharmphasephasmpheerphemephenepheonphesephialphiesphishphizzphloxphobephocaphonephonophonsphonyphoohphooophotaphotophotsphotyphphtphubsphutsphutuphwatphylaphylephymaphynxphysapiaispianipianopianspibalpicalpicaspiccypiceypichipickspickypiconpicotpicrapiculpiecepiedspiendpierspiertpietapietspietypiezopiggypightpiglypigmypiingpikaspikaupikedpikelpikerpikespikeypikispikulpilaepilafpilaopilarpilaupilawpilchpileapiledpileipilerpilespileypilinpilispillspilonpilotpilowpilumpiluspimaspimpspinaspinaxpincepinch
pindapindspinedpinerpinespineypingapingepingopingspinkopinkspinkypinnapinnypinolpinonpinotpintapintopintspinuppionspionypiouspioyepioyspipalpipaspipedpiperpipespipetpipidpipispipitpippypipulpiquepiquipiraipirkspirlspirnspirogpirrepirripirrspiscopisespiskypisospissypistepitaspitchpithspithypitonpitotpitsopitsupittapittupiumapiumspivospivotpixelpixespixiepiyutpizedpizerpizespizzaplaasplaceplackplagaplageplaidplaigplainplaitplancplaneplanhplankplansplantplapsplashplasmplastplateplatsplattplatyplaudplaurplavsplayaplaysplazapleadpleaspleatplebeplebspleckpleeppleinplenapleneplenopleonpleshpletsplews
plexiplicapliedplierpliespligsplimsplingplinkplipsplishploatploceplockplodsploitplombplongplonkplookplootplopsploreplotsplotzploukploutplowsplowtployeployspluckpludspluespluffplugsplukeplumbplumeplumpplumsplumyplungplunkpluotplupsplushpluteplutoplutyplyerpneuspoachpoakapoakepoalopobbypoboypocanpochepochopockspockypodalpoddypodexpodgepodgypodiapodospoduspoemspoenapoepspoesypoetepoetspogeypoggepoggypogospoguepohedpoilupoindpointpoirepoisepokalpokedpokerpokespokeypokiepokitpolarpoledpolerpolespoleypoliopolispoljepolkapolkspollopollspollypolospoltspolyppolyspomaspombepomespommepommypomospompapomps
ponceponcypondspondyponesponeypongapongopongspongyponksponorpontopontspontyponzupooaypoochpoodspooedpooeypoofspoofypoohspoohypoojapookapookspoolspoolypoonspoopapoopspoopypooripoortpootspootypoovepoovypopespopiapopospoppapoppypopsypopupporaeporalporchporedporerporesporeyporgeporgyporinporksporkypornopornspornyportaporteporthportsportyporusposcaposedposerposesposetposeyposhopositposolpossepostepostspotaepotaipotchpotedpotespotinpotoopotropotsypottopottspottypoucepouchpouffpoufspoufypouispoukepoukspoulepoulppoultpoundpoupepouptpourspousypoutspoutypovospowanpowerpowiepowinpowispowltpowndpownspowny
powrepowsypoxedpoxespoyaspoyntpoyoupoysepozzypraampradspragsprahupramspranaprangprankpraosprapsprasepratepratsprattpratyprausprawnprayspreakpredypreedpreempreenpreespreifprekepremspremyprentpreonpreopprepspresapresepressprestpretapreuxpreveprexypreysprialprianpriceprickpricypridepridypriedpriefprierpriesprigsprillprimaprimeprimiprimoprimpprimsprimypringprinkprintprionpriorpriseprismprisspriusprivyprizeproalproasprobeprobsprobyproddprodsproemprofsprogsproinprokeproleprollpromopromsproneprongpronkproofprookprootpropsproraproreproseprosoprossprostprosyprotoproudproulproveprowkprowlprowsproxyproyn
prudepruneprunopruntprunyprutapryanpryerprysepsalmpseudpshawpshutpsiaspsionpsoaepsoaipsoaspsorapsychpsyopptishptypepubbypubcopubespubicpubispubsypucanpucerpucespuckapuckspuddypudgepudgypudicpudorpudsypuduspuerspuffapuffspuffypuggypugilpuhaspujahpujaspukaspukedpukerpukespukeypukkapukuspulaopulaspuledpulerpulespulikpulispulkapulkspullipullspullypulmopulpspulpypulsepuluspulutpumaspumiepumpspumpypunaspuncepunchpungapungipungopungspungypunimpunjipunkapunkspunkypunnypuntopuntspuntypupaepupalpupaspupilpuppapuppypupuspuraopuraupurdapurdypuredpureepurerpurespurgapurgepurinpurispurlspurospurpspurpypurre
purrspurrypursepursypurtypusespushypuslepussyputasputerputidputinputonputosputtiputtoputtsputtuputtyputzapuukopuyaspuzelpuztapwnedpyatspyetspygalpygmypyinspylonpynedpynespyoidpyotspyralpyranpyrespyrexpyricpyrospyruspyuffpyxedpyxespyxiepyxispzazzqadisqaidsqajaqqanatqapikqiblaqilasqipaoqophsqormaquabsquackquadsquaffquagsquailquairquaisquakequakyqualequalmqualyquankquantquarequarkquarlquartquashquasiquassquatequatsquawkquawsquaydquaysqubitqueanqueckqueekqueemqueenqueerquellquemequenaquernqueryquesoquestquetequeuequeynqueysqueyuquibsquichquickquidsquiesquietquiffquilaquillquiltquimsquinaquinequink
quinoquinsquintquipoquipsquipuquirequirkquirlquirtquistquitequitsquoadquodsquoifquoinquoisquoitquollquonkquopsquorkquorlquotaquotequothquoukquoysquranqurshquyteraadsraakerabatrabbirabicrabidrabisracedracerracesracheracksraconradarraddiraddyradgeradgyradifradiiradioradixradonrafeeraffsraffyrafikrafiqraftsraftyragasragderagedrageeragerragesraggaraggsraggyragisragusrahedrahuiraiahraiasraidsraikeraiksrailerailsrainerainsrainyrairdraiseraitaraithraitsrajahrajasrajesrakedrakeerakerrakesrakhirakiarakisrakkiraksirakusralesrallirallyralphramalrameeramenramesrametramieraminramisrammyramonrampsramseramsh
ramusranasranceranchrandorandsrandyranedraneeranesrangarangerangirangsrangyranidranisrankeranksrannsrannyranserantsrantyrapedrapeeraperrapesrapherapidrapinrapperapsoraredrareerarerraresrarksrasamrasasrasedraserrasesraspsraspyrasserastaratalratanratasratchratedratelraterratesratharatherathsratioratooratosrattirattyratusrauliraunsrauporavedravelravenraverravesraveyravinrawdyrawerrawinrawksrawlyrawnsraxedraxesrayahrayasrayedrayleraylsraynerayonrazairazedrazeerazerrazesrazetrazoorazorreachreactreaddreadsreadyreaisreaksrealmrealorealsreamereamsreamyreansreapsreardrearmrearsreastreatareatereaverebab
rebarrebberebecrebelrebidrebitreboprebudrebusrebutrebuyrecalrecapreccereccoreccyreceprecitrecksreconrectarecterectirectorecuerecurrecutredanreddsreddyrededredesrediaredidredifredigredipredlyredonredosredoxredryredubredugreduxredyereeafreechreedereedsreedyreefsreefyreeksreekyreelsreelyreemsreensreerdreestreevereezerefanrefedrefelreferrefforefisrefitrefixreflyrefryregalregarregesregetregexreggoregiaregieregleregmaregnaregosregotregurrehabrehemreifsreifyreignreikireiksreinereingreinkreinsreirdreistreiverejasrejigrejonrekedrekesrekeyrelaxrelayreletrelicrelierelitrellorelosremanremapremenremetremex
remitremixremourenalrenayrendsrendurenewreneyrengarengsrenigreninrenksrennerenosrenterentsreoilreorgrepasrepatrepayrepegrepelrepenrepinreplareplyreposrepotreppsreprorepunreputreranrerigrerunresamresatresawresayreseeresesresetresewresidresinresitresodresolresowrestorestsrestyresueresusretagretamretaxretchretemretiaretieretinretipretoxretroretryreunereupsreuserevelrevetrevierevowrevuerewanrewaxrewedrewetrewinrewonrewthrexesrezesrhabdrheasrheidrhemerheumrhiesrhimerhinerhinorhodyrhombrhonerhumbrhymerhymyrhynerhytariadsrialsriantriatariatoribasribbyribesricedricerricesriceyricherichtricinricksrider
ridesridgeridgyridicrielsriemsrieveriferriffsriffyriflerifteriftsriftyriggsrightrigidrigmorigolrigorrikkarikwariledrilesrileyrillerillsrillyrimaerimedrimerrimesrimonrimusrincerindsrindyrinesringeringsringyrinksrinseriojarioneriotsriotyripedripenriperripesrippsriqqsrisenriserrisesrishirisksriskyrispsristsrisusritesritherittsritzyrivalrivasrivedrivelrivenriverrivesrivetriyalrizasroachroadsroadyroakeroakyroamsroansroanyroarsroaryroastroaterobborobedroberrobesrobinroblerobotrobugroburrocherocksrockyrodedrodeorodesrodnyroersroganrogerrogueroguyrohanrohesrohunrohusroidsroilsroilyroinsroistrojakrojis
rokedrokerrokesrokeyrokosrolagroleorolesrolfsrollsrollyromalromanromeoromerrompsrompurompyronderondoroneoronesroninronneronterontsronukroodsroofsroofyrooksrookyroomsroomyroonsroopsroopyroosarooseroostrootsrootyropedroperropesropeyroqueroralroresroricroridrorierortsrortyrosalroscorosedrosesrosetrosharoshirosinrositrospsrossarossorostirostsrotalrotanrotasrotchrotedrotesrotisrotlsrotonrotorrotosrottarotterottorottyrouenrouesrouetroufsrougeroughrougyrouksroukyrouleroulsroumsroundroupsroupyrouseroustrouterouthroutsrovedrovenroverrovesrowanrowdyrowedrowelrowenrowerrowetrowierowmerowndrownsrowthrowts
royalroyetroyneroystrozesrozetrozitruachruanarubairubanrubbyrubelrubesrubinrubiorublerubliruborrubusrucheruchyrucksrudasruddsruddyruderrudesrudierudisruedaruersrufferuffsruffyrufusrugaerugalrugasrugbyruggyruiceruingruinsrukhsruledrulerrulesrullyrumalrumbarumborumenrumesrumlyrummyrumorrumporumpsrumpyruncerunchrundsrunedrunerrunesrungsrunicrunnyrunosruntsruntyrunupruoterupeerupiaruralrurpsrurusrusasrusesrushyrusksruskyrusmarusserustsrustyruthsrutinruttyruvidryalsrybatryijiryijyrykedrykesrymerrymmeryndsryotiryotsryperrypinrytheryugisaagssabalsabedsabersabessabhasabinsabirsabjisablesabossabotsabra
sabresabzisackssacrasacresaddosaddysadessadhesadhusadicsadissadlysadossadzasaetasafedsafersafessagarsagassagersagessaggysagossagumsahabsahebsahibsaicesaicksaicssaidssaigasailssaimssainesainssaintsairssaistsaithsajousakaisakersakessakiasakissaktisaladsalalsalassalatsalepsalessaletsalicsalissalixsallesallysalmisalolsalonsalopsalpasalpssalsasalsesaltosaltssaltysaludsaluesalutsalvesalvosamansamassambasambosameksamelsamensamessameysamfisamfusammysampisampssanadsandssandysanedsanersanessangasanghsangosangssankosansasantosantssaolasapansapidsaporsappysaransardssaredsareesargesargosarinsarirsarissarks
sarkysarodsarossarussarvosasersasinsassesassysataisataysatedsatemsatersatessatinsatissatyrsaubasaucesauchsaucysaughsaulssaultsaunasaunfsauntsaurysautesautssauvesavedsaversavessaveysavinsavorsavoysavvysawahsawedsawersaxessayassayedsayeesayersayidsaynesayonsaystsazesscabsscadsscaffscagsscailscalascaldscalescallscalpscalyscampscamsscandscansscantscapascapescapiscarescarfscarpscarsscartscaryscathscatsscattscaudscaupscaurscawssceatscenascendscenescentschavschifschmoschulschwascifiscindscionsciresclimscobescodyscoffscogsscoldsconescoogscoopscootscopascopescopsscorescornscorpscotescotsscougscoupscour
scoutscowlscowpscowsscrabscraescragscramscranscrapscratscrawscrayscreescrewscrimscripscrobscrodscrogscrooscrowscrubscrumscubascudiscudoscudsscuffscuftscugssculkscullsculpsculsscumsscupsscurfscursscusescutascutescutsscuzzscyessdaynsdeinsealsseameseamsseamyseanssearesearsseaseseatsseazesebumseccosechssectssedansedersedessedgesedgysedumseedsseedyseeksseeldseelsseelyseemsseepsseepyseerssefersegarsegassegnisegnosegolsegosseguesehriseifsseilsseineseirsseiseseismseityseizaseizesekossektsselahselesselfsselfyselkysellasellesellsselvasemassemeesemensemessemiesemissenassendssenessenexsengisennasenorsensa
sensesensisensusentesentisentssenvysenzasepadsepalsepiasepicsepoysepposeptaseptsseracseraiseralseredsererseresserfssergeseriasericserifserinserirserksseronserowserraserreserrsserryserumserveservoseseysessasetaesetalsetersethssetonsettssetupsevaksevenseversevirsewansewarsewedsewelsewensewersewinsexedsexersexessexorsextosextsseyensezesshackshadeshadsshadyshaftshagsshahsshakashakeshakoshaktshakyshaleshallshalmshaltshalyshamashameshamsshandshankshansshapeshapsshardsharesharksharnsharpshartshashshaulshaveshawlshawmshawnshawsshayashaysshchisheafshealshearsheasshedssheelsheensheepsheersheetsheikshelf
shellshendshengshentsheolsherdsheresheroshetsshevashewnshewsshiaishiedshielshiershiesshiftshillshilyshimsshineshinsshinyshiokshipsshireshirkshirrshirsshirtshishshisoshistshiteshitsshiurshivashiveshivsshlepshlubshmekshmoeshoalshoatshockshoedshoershoesshogishogsshojishojosholashoneshonkshookshoolshoonshoosshootshopeshopsshoreshorlshornshortshoteshotsshottshoudshoutshoveshowdshownshowsshowyshoyushredshrewshrisshrowshrubshrugshtarshtikshtumshtupshubashuckshuleshulnshulsshunsshuntshurashushshuteshutsshwasshyershylysialssibbssibiasibylsicessichtsickosickssickysidassidedsidersidessideysidhasidhesidle
siegesieldsienssientsiethsieursievesiftssighssightsigilsiglasigmasignasignssigrisijossikassikersikessildssiledsilensilersilessilexsilkssilkysillssillysilossiltssiltysilvasimarsimassimbasimissimpssimulsincesindssinedsinessinewsingesingssinhssinkssinkysinsisinussipedsipessippysiredsireesirensiressirihsirissirocsirrasirupsisalsisessissysistasistssitarsitchsitedsitessithesitkasitupsitussiversixersixessixmosixtesixthsixtysizarsizedsizelsizersizesskagsskailskaldskankskarnskartskateskatsskattskawsskeanskearskedsskeedskeefskeenskeerskeesskeetskeevskeezskeggskegsskeinskelfskellskelmskelpskeneskensskeos
skepsskermskerssketsskewsskidsskiedskierskiesskieyskiffskillskimoskimpskimsskinkskinsskintskiosskipsskirlskirrskirtskiteskitsskiveskivysklimskoalskobeskodyskoffskofsskogsskolsskoolskortskoshskranskrikskrooskuasskugsskulkskullskunkskyedskyerskyeyskyfsskyreskyrsskyteslabsslacksladeslaesslagsslaidslainslakeslamsslaneslangslankslantslapsslartslashslateslatsslatyslaveslawsslaysslebssledssleeksleepsleersleetsleptslewssleyssliceslickslideslierslilyslimeslimsslimyslingslinkslipeslipssliptslishslitsslivesloanslobssloesslogssloidslojdslokaslomosloomsloopslootslopeslopsslopyslormsloshslothslotssloveslows
sloydslubbslubssluedsluessluffslugssluitslumpslumsslungslunkslurbslurpslurssluseslushslutsslyerslylyslypesmaaksmacksmaiksmallsmalmsmaltsmarmsmartsmashsmazesmearsmeeksmeessmeiksmekesmellsmeltsmerksmewssmicksmilesmilysmirksmirrsmirssmitesmithsmitssmizesmocksmogssmokesmokosmokysmoltsmoorsmootsmoresmorgsmotesmoutsmowtsmugssmurssmushsmutssnabssnacksnafusnagssnailsnakesnakysnapssnaresnarfsnarksnarlsnarssnarysnashsnathsnawssneadsneaksneapsnebssnecksnedssneedsneersneessnellsnibssnicksnidesniedsniessniffsniftsnigssnipesnipssnipysnirtsnitssnivesnobssnodssnoeksnoepsnogssnokesnoodsnooksnoolsnoopsnootsnore
snortsnotssnoutsnowksnowssnowysnubssnucksnuffsnugssnushsnyessoakssoapssoapysoaresoarssoavesobassobersocassocessociasockosockssoclesodassoddysodicsodomsofarsofassoftasoftssoftysogersoggysohursoilssoilysojassojussokahsokensokessokolsolahsolansolarsolassoldesoldisoldosoldssoledsoleisolersolessolidsolonsolossolumsolussolvesomansomassonarsoncesondesonessongosongssongysonicsonlysonnesonnysonsesonsysooeysookssookysoolesoolssoomssoopssootesoothsootssootysophssophysoporsoppysoprasoralsorassorbisorbosorbssordasordosordssoredsoreesorelsorersoressorexsorgosornssorrasorrysortasortssorussothssotolsottosouce
souctsoughsoukssoulssoulysoumssoundsoupssoupysourssousesouthsoutssowarsowcesowedsowersowffsowfssowlesowlssowmssowndsownesowpssowsesowthsoxessoyassoylesoyuzsozinspacespackspacyspadespadospadsspaedspaerspaesspagsspahispailspainspaitspakespaldspalespallspaltspamsspanespangspankspansspardsparesparksparsspartspasmspatespatsspaulspawlspawnspawsspaydspaysspazaspazzspeakspealspeanspearspeatspeckspecsspectspeedspeelspeerspeilspeirspeksspeldspelkspellspeltspendspentspeosspermspeshspetsspeugspewsspewyspialspicaspicespickspicsspicyspidespiedspielspierspiesspiffspifsspikespiksspikyspilespillspiltspimsspina
spinespinkspinsspinyspirespirtspiryspitespitsspitzspivssplatsplaysplitsplogspodespodsspoilspokespoofspookspoolspoomspoonspoorspootsporesporksportsposasposhsposospotsspoutspradspragspratsprayspredspreesprewsprigspritsprodsprogspruesprugspudsspuedspuerspuesspugsspulespumespumyspunkspurnspursspurtsputaspyalspyresquabsquadsquatsquawsqueesquegsquibsquidsquitsquizsrslystabsstackstadestaffstagestagsstagystaidstaigstainstairstakestalestalkstallstampstandstanestangstankstansstaphstapsstarestarkstarnstarrstarsstartstarystashstatestatsstatustaunstavestawsstayssteadsteakstealsteamsteanstearsteddstedesteds
steedsteeksteelsteemsteensteepsteersteezsteiksteilsteinstelastelestellstemestemsstendstenostensstentstepssteptsteresternstetsstewsstewysteysstichstickstiedstiesstiffstilbstilestillstiltstimestimsstimystingstinkstintstipastipestirestirkstirpstirsstivestivystoaestoaistoasstoatstobsstockstoepstogsstogystoicstoitstokestolestolnstomastompstondstonestongstonkstonnstonystoodstookstoolstoopstoorstopestopsstoptstorestorkstormstorystossstotsstottstounstoupstourstoutstovestownstowpstowsstradstraestragstrakstrapstrawstraystrepstrewstriastrigstrimstripstropstrowstroystrumstrutstubsstuckstucsstudestudsstudy
stuffstullstulmstummstumpstumsstungstunkstunsstuntstupastupesturesturtstushstyedstyesstylestylistylostymestymystyrestytesuavesubahsubaksubassubbysubersubhasuccisuckssuckysucresudansuddssudorsudsysuedesuentsuerssuetesuetssuetysugansugarsughssugossuhursuidssuingsuintsuitesuitssujeesukhssukissukuksulcisulfasulfosulkssulkysullssullysulphsulussumacsumissummasumossumphsumpssunissunkssunnasunnssunnysuntssunupsuonasupedsupersupessuprasurahsuralsurassuratsurdssuredsurersuressurfssurfysurgesurgysurlysurrasusedsusessushisusussutorsutrasuttaswabsswackswadsswageswagsswailswainswaleswalyswamiswampswamyswang
swankswansswapsswaptswardswareswarfswarmswartswashswathswatsswaylswaysswealswearsweatswedesweedsweelsweepsweersweessweetsweirswellsweltsweptswerfsweysswiesswiftswigsswileswillswimsswineswingswinkswipeswireswirlswishswissswithswitsswiveswizzswobsswoleswollswolnswoonswoopswopsswoptswordsworeswornswotsswounswungsybbesybilsyboesybowsyceesycessyconsyedssyenssykersykessylissylphsylvasymarsynchsyncssyndssynedsynessynodsynthsypedsypessyphssyrahsyrensyrupsysopsythesyvertaalstaatatabactabbytabertabestabidtabistablatabletablstabootabortabostabuntabustacantacestacettachetachitachotachstacittackstackytacos
tactstadahtaelstaffytafiataggytagmataguatahastahrstaigataigstaikotailstainstainttairataishtaitstajestakastakentakertakestakhitakhttakintakistakkytalaktalaqtalartalastalcstalcytaleatalertalestaliktalkstalkytallstallytalmatalontalpataluktalustamaltamastamedtamertamestamintamistammytampstanastangatangitangotangstangytanhstaniatankatankstankytannatansutansytantetantitantotantytapastapedtapentapertapestapettapirtapistappatapustarastardotardstardytaredtarestargatargetarkatarnstaroctaroktarostarottarpstarretarrytarsetarsitartetartstartytarzytasartascatasedtasertasestaskstassatassetassotastetastotasty
tatartatertatestathstatietatoutattstattytatustaubetauldtaunttauontaupetautstautytavahtavastavertawaftawaitawastawedtawertawietawnytawsetawtstaxedtaxertaxestaxistaxoltaxontaxortaxustayratazzatazzeteachteadeteadsteaedteakstealsteamstearstearyteaseteatsteazetechstechytectatecumteddyteelsteemsteendteeneteensteenyteersteethteetsteffsteggsteguategusteheetehrsteiidteilsteindteinstekketelaetelcotelestelexteliatelictellstellyteloitelostemedtemestempitempotempstempttemsetenchtendstendutenestenettengeteniatennetennotennytenontenortensetenthtentstentytenuetepaltepastepeetepidtepoyteraiterasterceterekteres
terfeterfstergatermsterneternsterraterreterrytersetertsterzateslatestatesteteststestytetestethstetratetriteuchteughtewedteweltewittexastexestextatextsthackthagithaimthalethalithanathanethangthankthansthanxtharmtharsthawsthawtthawythebethecatheedtheektheestheftthegntheictheintheirthelfthemathemethenstheortheowtherethermthesethespthetathetethewsthewythickthiefthighthigsthilkthillthinethingthinkthinsthiolthirdthirlthofttholetholithongthornthorothorpthosethotsthousthowlthraethrawthreethrewthridthripthrobthroethrowthrumthudsthugsthujathumbthumpthunkthurlthuyathymethymithymytianstiaratiaretiarstibia
ticalticcaticedticestichytickstickytidaltiddytidedtidestiefstierstiffstifostiftstigertigestighttigontikastikestikiatikistikkatilaktildetiledtilertilestillstillytilthtiltstimbotimedtimertimestimidtimontimpstinastincttindstineatinedtinestingetingstinkstinnytintotintstintytipistippytipsytipuptiredtirestirlstirostirrstirthtitantitartitastitchtitertithetithititintitirtitistitletitretittytituptiyintiynstizestizzytoadstoadytoasttoazetockstockytocostodaytoddetoddytodeatodostoeastoffstoffytoftstofustogaetogastogedtogestoguetohostoidytoiletoilstoingtoisetoitstoitytokaytokedtokentokertokestokostolantolar
tolastoledtolestollstollytoltstolustolyltomantombotombstomentomestomiatomintommetommytomostomoztonaltonditondotonedtonertonestoneytongatongstonictonkatonkstonnetonustoolstoomstoonstoothtootstopaztopedtopeetopektopertopestophetophitophstopictopistopoitopostoppytoquetorahtorantorastorchtorcstorestorictoriitorostorottorrstorsetorsitorsktorsotortatortetortstorustosastosedtosestoshytossytosyltotaltotedtotemtotertotestottytouchtoughtoukstounstourstousetousytoutstouzetouzytowaitowedtoweltowertowietownotownstownytowsetowsytowtstowzetowzytoxictoxintoyedtoyertoyontoyostozedtozestozietrabstracetracktract
tradetradstradytragatragitragstragutraiktrailtraintraittramptramstranktranqtranstranttrapetrapotrapstrapttrashtrasstratstratttravetrawltrayftraystreadtreattrecktreedtreentreestrefatreiftrekstrematremstrendtresstresttretstrewstreyftreystriactriadtrialtribetricetricktridetriedtriertriestrifatrifftrigotrigstriketrildtrilltrimstrinetrinstrioltriortriostripetripstripytristtritetroadtroaktroattrocktrodetrodstrogstroistroketrolltromptronatronctronetronktronstrooptrooztropetropotrothtrotstrouttrovetrowstroystrucetrucktruedtruertruestrugotrugstrulltrulytrumptrunktrusstrusttruthtryertryketrymatrypstryst
tsadetsaditsarstskedtsubatsubotuanstuarttuathtubaetubaltubartubastubbytubedtubertubestuckstufastuffetuffstuftstuftytugratuiletuinatuismtuktutulestuliptulletulpatulpstulsitumidtummytumortumpstumpytunastundstunedtunertunestungstunictunnytupektupiktupletuqueturboturdsturfsturfyturksturmeturmsturnsturntturonturpsturrstushytuskstuskytuteetutestutortuttituttytutustuxestuyertwaestwaintwalstwangtwanktwatstwaystweaktweedtweeltweentweeptweertweettwerktwerptwicetwiertwigstwilltwilttwinetwinktwinstwinytwiretwirktwirltwirptwisttwitetwitstwixttwocstwoertwonktwyertyeestyerstyingtyiyntykestylertympstyndetyned
tynestypaltypedtypestypeytypictypostyppstyptotyrantyredtyrestyrostythetzarsubacsubityudalsudderudonsudyogugaliuggeduhlanuhuruukaseulamaulansulcerulemaulminulmosulnadulnaeulnarulnasulpanultraulvasulyieulzieumamiumbelumberumbleumbosumbraumbreumiacumiakumiaqummahummasummedumpedumphsumpieumptyumrahumrasunagiunaisunaptunarmunaryunausunbagunbanunbarunbedunbidunboxuncapuncesunciauncleuncosuncoyuncusuncutundamundeeunderundidundosundueundugunethunfedunfitunfixungagungetungodungotungumunhatunhipunicaunifyunionuniosuniteunitsunityunjamunkedunketunkeyunkidunkutunlapunlawunlayunledunlegunletunlidunlitunmad
unmanunmetunmewunmixunodeunoldunownunpayunpegunpenunpinunplyunpotunputunredunridunrigunripunsawunsayunseeunsetunsewunsexunsodunsubuntaguntaxuntieuntiluntinunwedunwetunwitunwonunzipupbowupbyeupdosupdryupendupfulupjetuplayupleduplituppedupperupranuprunupseeupsetupseyuptakupteruptieuraeiuraliuraosurareurariuraseurateurbanurbexurbiaurdeeurealureasuredoureicureidurenaurenturgedurgerurgesurialurineuriteurmanurnalurnedurpedursaeursidursonurubuurupaurvasusageusensusersusetausherusingusneausnicusqueustadusterusualusureusurpusuryuteriuteroutileutteruvealuveasuvulavacasvacayvacuavacuivacuovadasvadedvades
vadgevagalvaguevagusvaidsvailsvairevairsvairyvajravakasvakilvalesvaletvalidvalisvallivalorvalsevaluevalvevampsvampyvandavanedvanesvangavangsvantsvapedvapervapesvapidvaporvaranvarasvardavardovardyvarecvaresvariavarixvarnavarusvarvevasalvasesvastsvastyvatasvathavaticvatjevatosvatusvauchvaultvauntvautevautsvawtevaxesvealevealsvealyveenaveepsveersveeryveganvegasvegesveggovegievegosvehmeveilsveilyveinsveinyvelarveldsveldtvelesvellsvelumvenaevenalvenasvendsvenduveneyvengeveninvenomventiventsvenuevenusverbaverbsverdevergeverraverreverryversaverseversoverstvertevertsvertuvervevespavestavestsvetchveuve
vevesvexedvexervexesvexilvezirvialsviandvibedvibesvibexvibeyvicarvicedvicesvichyvicusvideoviersvieuxviewsviewyvifdaviffsvigasvigiavigilvigorvildevilervillavillevillivillsvimenvinalvinasvincavinedvinervinesvinewvinhovinicvinnyvinosvintsvinylviolavioldviolsviperviralviredvireoviresvirgavirgevirgoviridvirlsvirtuvirusvisasvisedvisesvisievisitvisnavisnevisonvisorvistavistovitaevitalvitasvitexvitrovittavivasvivatvivdavivervivesvividvivosvivrevixenvizirvizorvlastvleisvliesvlogsvoarsvoblavocabvocalvocesvoddyvodkavodouvodunvoemavogievoguevoicevoicivoidsvoilavoilevoipsvolaevolarvoledvolesvoletvolkevolks
voltavoltevoltivoltsvolvavolvevomervomitvotedvotervotesvouchvougevouluvowedvowelvowervoxelvoxesvozhdvraicvrilsvroomvrousvrouwvrowsvuggsvuggyvughsvughyvulgovulnsvulvavuttyvygievyingwaacswackewackowackswackywadaswaddswaddywadedwaderwadeswadgewadiswadtswaferwaffswaftswagedwagerwageswaggawagonwagyuwahaywaheywahoowaidewaifswaiftwailswainswairswaistwaitewaitswaivewakaswakedwakenwakerwakeswakfswaldowaldswaledwalerwaleswaliewaliswalkswallawallswallywaltywaltzwamedwameswamuswandswanedwaneswaneywangswankswankywanlewanlywannawantawantswantywanzewaqfswarbswarbywardswaredwareswarezwarkswarmswarnswarpswarre
warstwartswartywaseswashiwashywasmswaspswaspywastewastswatapwatchwaterwattswauffwaughwaukswaulkwaulswaurswavedwaverwaveswaveywawaswaweswawlswaxedwaxenwaxerwaxeswayedwazirwazoowealdwealsweambweanswearswearyweavewebbyweberwechtwedelwedgewedgyweedsweedyweeisweekeweeksweelsweemsweensweenyweepsweepyweestweeteweetswefteweftsweidsweighweilsweirdweirsweiseweizewekaswelchweldswelkewelkswelktwellswellywelshweltswembswenchwendswengewennywentswerfsweroswershwestswetaswetlywexedwexeswhackwhalewhamowhamswhangwhapswharewharfwhatawhatswhaupwhaurwhealwhearwheatwheekwheelwheenwheepwheftwhelkwhelmwhelpwhenswhere
whetswhewswheyswhichwhidswhieswhiffwhiftwhigswhilewhilkwhimswhinewhinswhinywhioswhipswhiptwhirlwhirrwhirswhishwhiskwhisswhistwhitewhitswhitywhizzwholewhompwhoofwhoopwhootwhopswhorewhorlwhortwhosewhosowhowswhumpwhupswhydawiccawickswickywiddywidenwiderwideswidowwidthwieldwielswifedwifeswifeywifiewiftswiftywiganwiggawiggywightwikiswilcowildswiledwileswilgawiliswiljawillswillywiltswimpswimpywincewinchwindswindywinedwineswineywingewingswingywinkswinkywinnawinnswinoswinzewipedwiperwipeswiredwirerwireswirrawirriwisedwiserwiseswishawishtwispswispywistswitanwitchwitedwiteswithewithswithywittywivedwiver
wiveswizenwizeswizzowoadswoadywoaldwockswodgewodgywofulwojuswokenwokerwokkawoldswolfswollywolvewomanwomaswombswombywomenwomynwongawongiwonkswonkywontswoodswoodywooedwooerwoofswoofywooldwoolswoolywoonswoopswoopywoosewooshwootzwoozywordswordyworksworkyworldwormswormyworryworseworstworthwortswouldwoundwovenwowedwoweewowsewoxenwrackwrangwrapswraptwrastwratewrathwrawlwreakwreckwrenswrestwrickwriedwrierwrieswringwristwritewritswrokewrongwrootwrotewrothwrungwryerwrylywuddywuduswuffswullswungawurstwuseswushuwussywuxiawyledwyleswyndswynnswytedwyteswythexebecxeniaxenicxenonxericxeroxxerusxoanaxolosxrays
xviiixylanxylemxylicxylolxylylxystixystsyaarsyaassyabasyabbayabbyyaccayachtyackayacksyaddayaffsyageryagesyagisyagnayahooyairdyajnayakkayakowyalesyamenyampayampyyamunyandyyangsyanksyapokyaponyappsyappyyarakyarcoyardsyareryarfayarksyarnsyarrayarrsyartayartoyatesyatrayaudsyauldyaupsyawedyaweyyawlsyawnsyawnyyawpsyayasyboreycladycledycondydradydredyeadsyeahsyealmyeansyeardyearnyearsyeastyecchyechsyechyyedesyeedsyeeekyeeshyeggsyelksyellsyelmsyelpsyeltsyentayenteyerbayerdsyerksyesesyesksyestsyestyyetisyettsyeuchyeuksyeukyyevenyevesyewenyexedyexesyfereyieldyikedyikesyillsyinceyipesyippyyirdsyirksyirrs
yirthyitesyitieylemsylideylidsylikeylkesymoltympesyobboyobbyyocksyodelyodhsyodleyogasyogeeyoghsyogicyoginyogisyohahyohayyoickyojanyokanyokedyokegyokelyokeryokesyokulyolksyolkyyolpsyomimyompsyonicyonisyonksyonnyyoofsyoopsyoposyoppoyoresyorgayorksyorpsyouksyoungyournyoursyourtyouseyouthyowedyowesyowieyowlsyowsayowzayoyosyraptyrentyrivdyrnehysameytostyuansyucasyuccayucchyuckoyucksyuckyyuftsyugasyukedyukesyukkyyukosyulanyulesyummoyummyyumpsyuponyuppyyurtayurtsyuzuszabrazackszaidazaidezaidyzairezakatzamaczamakzamanzambozamiazamiszanjazantezanzazanzezappyzardazarfszariszatiszawnszaxeszaydezayinzazen
zealszebeczebrazebubzebuszedaszeerazeinszendozerdazerkszeroszestszestyzetaszexeszezeszhomozhushzhuzhzibetziffsziganzikrszilaszilchzillazillszimbizimbszincozincszincyzinebzineszingszingyzinkezinkyzinoszippozippyziramzitiszittyzizelzizitzlotezlotyzoaeazoboszobuszoccozoeaezoealzoeaszoismzoistzokorzollezombizonaezonalzondazonedzonerzoneszonkszooeazooeyzooidzookszoomszoomyzoonszootyzoppazoppozorilzoriszorrozorsezoukszoweezowiezuluszupanzupaszuppazurfszuzimzygalzygonzymeszymic`.replace(/\s+/g, '').toUpperCase().match(/.{5}/g));

function other(p) { return p === 'X' ? 'O' : 'X'; }
// ---------- randomness: every random choice comes from an rng passed in, never from Math.random ----------
// A small seeded generator (sfc32): the same seed gives the same sequence on every device and on the server.
function makeRng(seed) {
  let h = 1779033703 ^ String(seed).length, a, b, c, d;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  const next = () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  a = next(); b = next(); c = next(); d = next();
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function needRng(rng) {
  if (typeof rng !== 'function') throw new Error('the engine needs an rng: pass makeRng(seed)');
  return rng;
}
function randInt(rng, n) { return Math.floor(rng() * n); }
function randomType(rng) { return TYPES[randInt(rng, TYPES.length)]; }
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) { const j = randInt(rng, i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}
// 9 cards: one matching pair plus seven other, all-different shape/colour combinations.
function memoryDeck(rng) {
  const combos = [];
  for (const s of MEMORY.shapes) for (const c of MEMORY.colors) combos.push({ s, c });
  const pick = shuffle(combos, rng).slice(0, 8);
  const cards = [{ s: pick[0].s, c: pick[0].c }, { s: pick[0].s, c: pick[0].c }].concat(pick.slice(1));
  return shuffle(cards, rng);
}
// Standard Wordle feedback: g = right spot, y = in the word elsewhere, x = not in the word (duplicates handled).
function wordleMarks(guess, word) {
  const marks = new Array(5).fill('x');
  const left = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === word[i]) marks[i] = 'g';
    else left[word[i]] = (left[word[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (marks[i] === 'g') continue;
    if (left[guess[i]] > 0) { marks[i] = 'y'; left[guess[i]]--; }
  }
  return marks;
}
// Hex: rows are shifted half a cell to the right, so (r, c) touches (r-1, c+1) and (r+1, c-1) as well as the four orthogonal cells.
function hexNeighbors(i) {
  const r = Math.floor(i / HEX_N), c = i % HEX_N, out = [];
  for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, 1], [1, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < HEX_N && cc >= 0 && cc < HEX_N) out.push(rr * HEX_N + cc);
  }
  return out;
}
// Breadth-first search from X's left edge (or O's top edge); returns the connecting path or null.
function hexPath(cells, p) {
  const isStart = p === 'X' ? i => i % HEX_N === 0 : i => i < HEX_N;
  const isEnd = p === 'X' ? i => i % HEX_N === HEX_N - 1 : i => i >= HEX_N * (HEX_N - 1);
  const parent = new Map(), queue = [];
  for (let i = 0; i < HEX_N * HEX_N; i++) if (cells[i] === p && isStart(i)) { parent.set(i, -1); queue.push(i); }
  while (queue.length) {
    const i = queue.shift();
    if (isEnd(i)) { const path = []; for (let k = i; k !== -1; k = parent.get(k)) path.push(k); return path; }
    for (const n of hexNeighbors(i)) if (cells[n] === p && !parent.has(n)) { parent.set(n, i); queue.push(n); }
  }
  return null;
}
// Does p have a legal move in this mini-game? Only Hexapawn can leave a player stuck; every other game
// always offers a move. A stuck player simply plays in another square.
function canMove(mini, p) { return mini.type === 'hexapawn' ? hpMoves(mini.cells, p).length > 0 : mini.type === 'trivia' ? !!(mini.ask && mini.ask.q) : mini.type === 'golf' ? !mini.holed[p] : true; }   // (Trivia: only with its question dealt)
// Hexapawn: a pawn steps one square straight forward into an empty square, or captures an opposing pawn
// one square diagonally forward. Cells run row by row from the top; X moves up, O moves down.
function hpMoves(cells, p) {
  const o = other(p), d = p === 'X' ? -1 : 1, out = [];
  for (let k = 0; k < HP.cols * HP.rows; k++) {
    if (cells[k] !== p) continue;
    const r = Math.floor(k / HP.cols), c = k % HP.cols, nr = r + d;
    if (nr < 0 || nr >= HP.rows) continue;
    if (!cells[nr * HP.cols + c]) out.push([k, nr * HP.cols + c]);
    for (const nc of [c - 1, c + 1]) if (nc >= 0 && nc < HP.cols && cells[nr * HP.cols + nc] === o) out.push([k, nr * HP.cols + nc]);
  }
  return out;
}
// ---------- playing cards (Blackjack and Ride the Bus) ----------
// A card is two characters: the rank (2-9, T for 10, J, Q, K, A) and the suit (S spades, H hearts,
// D diamonds, C clubs). Hearts and diamonds are red.
const CARD = { ranks: '23456789TJQKA', suits: 'SHDC', names: { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' } };
function cardDeck() { const d = []; for (const s of CARD.suits) for (const r of CARD.ranks) d.push(r + s); return d; }
function isCard(c) { return typeof c === 'string' && c.length === 2 && CARD.ranks.includes(c[0]) && CARD.suits.includes(c[1]); }
function cardRank(c) { return CARD.ranks.indexOf(c[0]) + 2; }          // 2 lowest ... 14 the ace (Ride the Bus: ace high)
function cardRed(c) { return c[1] === 'H' || c[1] === 'D'; }
function cardName(c) { const r = c[0]; return `${{ T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' }[r] || r} of ${CARD.names[c[1]]}`; }

// Blackjack: each player plays their own hands against the dealer; a win adds 1 to their tally (2 for a
// won double, 1 for a natural blackjack), and the first to 3 takes the square. Every hand is dealt from
// a freshly shuffled 52-card deck; the dealer's hole card and the deck stay hidden (online, with the
// server) until the dealer plays. The dealer hits on 16 or less and stands on every 17, soft ones too.
const BJ = { goal: 3, dealerStand: 17 };
function bjValue(c) { return c[0] === 'A' ? 1 : 'TJQK'.includes(c[0]) ? 10 : Number(c[0]); }
// A hand's best total: aces count 11 where that does not go over 21 (soft), otherwise 1.
function bjTotal(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += bjValue(c); if (c[0] === 'A') aces++; }
  const soft = aces > 0 && t + 10 <= 21;
  return { total: soft ? t + 10 : t, soft };
}
const bjNatural = cards => cards.length === 2 && bjTotal(cards).total === 21;
// The dealer turns the hole card over and draws to 17 or more.
function bjDealerPlay(dealer, deck) {
  const out = dealer.slice();
  while (bjTotal(out).total < BJ.dealerStand && deck.length) out.push(deck.pop());
  return out;
}
// How a finished hand ends: 'bj' (a natural), 'win', 'push', 'lose' or 'bust', and what it adds to the tally.
function bjOutcome(player, dealer, doubled, natural) {
  const p = bjTotal(player).total, d = bjTotal(dealer).total, dn = bjNatural(dealer);
  if (natural) return dn ? { res: 'push', gain: 0 } : { res: 'bj', gain: 1 };
  if (p > 21) return { res: 'bust', gain: 0 };
  if (dn) return { res: 'lose', gain: 0, dealerBj: true };          // a dealer blackjack beats any other 21
  if (d > 21 || p > d) return { res: 'win', gain: doubled ? 2 : 1 };
  return p === d ? { res: 'push', gain: 0 } : { res: 'lose', gain: 0 };
}
// Basic strategy for a hand of `cards` against the dealer's up card, for a dealer who stands on soft 17,
// with no splitting and doubling on any first two cards: 'hit', 'stand' or 'double'. `eager` (the tally
// is 1, so a won double takes the square) doubles in the closer spots too.
function bjStrategy(cards, up, eager) {
  const { total, soft } = bjTotal(cards), u = bjValue(up) === 1 ? 11 : bjValue(up), two = cards.length === 2;
  const dbl = (ok, otherwise) => (ok && two ? 'double' : otherwise);
  if (soft) {
    if (total >= 20) return 'stand';
    if (total === 19) return eager && u >= 4 && u <= 6 ? dbl(true, 'stand') : 'stand';
    if (total === 18) return u >= 3 && u <= 6 ? dbl(true, 'stand') : u <= 8 ? 'stand' : 'hit';
    if (total === 17) return dbl(u >= 3 && u <= 6, 'hit');
    if (total >= 15) return dbl(u >= (eager ? 3 : 4) && u <= 6, 'hit');
    return dbl(u >= (eager ? 4 : 5) && u <= 6, 'hit');
  }
  if (total >= 17) return 'stand';
  if (total >= 13) return u <= 6 ? 'stand' : 'hit';
  if (total === 12) return u >= 4 && u <= 6 ? 'stand' : 'hit';
  if (total === 11) return dbl(true, 'hit');
  if (total === 10) return dbl(u <= (eager ? 10 : 9), 'hit');
  if (total === 9) return dbl(u >= (eager ? 2 : 3) && u <= (eager ? 7 : 6), 'hit');
  if (total === 8) return dbl(eager && u >= 4 && u <= 6, 'hit');
  return 'hit';
}

// Ride the Bus: four rounds, each player on their own, each with their own deck. Round 1 red or black,
// round 2 higher or lower than card 1, round 3 inside or outside cards 1 and 2, round 4 the suit. A right
// guess keeps the card and goes straight on to the next round in the same turn; a wrong one discards it
// and ends the turn, with the cards already kept still kept. Every card is drawn from a freshly shuffled
// deck without the player's kept cards. The ace is high; a tie is wrong (an equal value in round 2, a
// value equal to either card in round 3). Passing round 4 takes the square.
const BUS = { rounds: 4, guesses: [['red', 'black'], ['higher', 'lower'], ['inside', 'outside'], ['S', 'H', 'D', 'C']] };
function busRight(kept, guess, card) {
  const r = cardRank(card);
  switch (kept.length) {
    case 0: return (guess === 'red') === cardRed(card);
    case 1: { const a = cardRank(kept[0]); return guess === 'higher' ? r > a : r < a; }
    case 2: {
      const a = cardRank(kept[0]), b = cardRank(kept[1]), lo = Math.min(a, b), hi = Math.max(a, b);
      return guess === 'inside' ? r > lo && r < hi : r < lo || r > hi;
    }
    default: return card[1] === guess;
  }
}
// The cards still in a player's deck (everything but what they have kept).
function busDeck(kept) { return cardDeck().filter(c => !kept.includes(c)); }
// The chance each guess for the next round is right, from the cards left in the deck.
function busOdds(kept) {
  const deck = busDeck(kept), r = Math.min(kept.length, BUS.rounds - 1);
  return BUS.guesses[r].map(g => ({ guess: g, p: deck.filter(c => busRight(kept, g, c)).length / deck.length }));
}

// Roulette: a small wheel of 25 pockets, 1 to 24 (odd red, even black, alternating round the wheel) and a
// green 0. A spin carries one bet: 8 numbers, one of the groups 1-8, 9-16 or 17-24, or green 0 on its own.
// A number or group that comes up is a hit, and two hits take the square; green 0 coming up on a bet on 0
// takes it at once. (0 on any other bet is a miss.)
const RL = {
  n: 24, pick: 8, goal: 2,
  wheel: [0, 17, 4, 21, 10, 13, 6, 19, 2, 23, 8, 15, 12, 1, 20, 5, 14, 9, 22, 3, 16, 11, 24, 7, 18],   // the pockets in order round the wheel
  groups: { g1: [1, 8], g2: [9, 16], g3: [17, 24] },
};
const rlRed = n => n > 0 && n % 2 === 1;
// A bet as sent: 'zero', 'g1', 'g2', 'g3', or an array of 8 different numbers from 1 to 24. Returns the
// bet in a standard form (numbers sorted) or null.
function rlBet(m) {
  if (m === 'zero' || RL.groups[m]) return m;
  if (!Array.isArray(m) || m.length !== RL.pick || !m.every(k => Number.isInteger(k) && k >= 1 && k <= RL.n) || new Set(m).size !== RL.pick) return null;
  return m.slice().sort((a, b) => a - b);
}
function rlCovers(bet, n) {
  if (bet === 'zero') return n === 0;
  if (RL.groups[bet]) return n >= RL.groups[bet][0] && n <= RL.groups[bet][1];
  return bet.includes(n);
}
// Mastermind: one hidden code shared by both players, 4 pegs from 6 colours, no colour twice (in the
// code or in a guess). Feedback: a solid marker per peg right in colour and place, a hollow one per peg
// right in colour but in the wrong place. Everything guessed stays on show; the exact code wins.
function mmFeedback(guess, code) {
  let solid = 0, common = 0;
  for (let k = 0; k < MM.pegs; k++) { if (guess[k] === code[k]) solid++; if (code.includes(guess[k])) common++; }
  return { solid, hollow: common - solid };
}
function mmValid(g) { return Array.isArray(g) && g.length === MM.pegs && g.every(c => Number.isInteger(c) && c >= 0 && c < MM.colors) && new Set(g).size === MM.pegs; }
let MM_ALL = null;                       // every possible code (6 x 5 x 4 x 3 = 360), built once
function mmAll() {
  if (MM_ALL) return MM_ALL;
  MM_ALL = [];
  const walk = (cur) => {
    if (cur.length === MM.pegs) { MM_ALL.push(cur.slice()); return; }
    for (let c = 0; c < MM.colors; c++) if (!cur.includes(c)) { cur.push(c); walk(cur); cur.pop(); }
  };
  walk([]);
  return MM_ALL;
}
function mmCode(rng) { const cols = shuffle(Array.from({ length: MM.colors }, (_, c) => c), rng); return cols.slice(0, MM.pegs); }
// The codes still consistent with every feedback so far (public information only).
function mmCandidates(pm) {
  return mmAll().filter(code => pm.guesses.every(g => { const f = mmFeedback(g.code, code); return f.solid === g.solid && f.hollow === g.hollow; }));
}
// The guess that best splits what is left: the smallest worst-case group of remaining codes (minimax),
// a code that could itself be the answer first among equals.
function mmBestGuess(cand) {
  if (cand.length <= 2) return cand[0];
  const canSet = new Set(cand.map(c => c.join('')));
  let best = null, bestWorst = Infinity, bestIn = false;
  for (const g of mmAll()) {
    const groups = new Map();
    let worst = 0;
    for (const c of cand) {
      const f = mmFeedback(g, c), k = f.solid * 10 + f.hollow;
      const n = (groups.get(k) || 0) + 1;
      groups.set(k, n);
      if (n > worst) { worst = n; if (worst > bestWorst) break; }
    }
    const isIn = canSet.has(g.join(''));
    if (worst < bestWorst || (worst === bestWorst && isIn && !bestIn)) { best = g; bestWorst = worst; bestIn = isIn; }
  }
  return best.slice();
}

function hpGoalRow(p) { return p === 'X' ? 0 : HP.rows - 1; }     // the opponent's home row
// Saved games and rooms from before Connect 4 grew to 7 columns: the old 5-wide board gets an empty
// column on each side, so every piece keeps its place (and its support) in the middle five.
function upgradeMini(mini) {
  // Trivia from when each player had their own question: the square keeps one of them (X's, else O's).
  if (mini && mini.type === 'trivia' && mini.ask && typeof mini.ask === 'object' && !('q' in mini.ask) && ('X' in mini.ask || 'O' in mini.ask)) {
    const p = mini.ask.X ? 'X' : mini.ask.O ? 'O' : null, ans = mini.answers || {};
    mini.ask = p ? mini.ask[p] : null;
    mini.answer = p && Number.isInteger(ans[p]) ? ans[p] : null;
    mini.crossed = [];
    delete mini.answers;
  }
  if (mini && mini.type === 'trivia' && !Array.isArray(mini.crossed)) mini.crossed = [];
  // Bullseye from the bar and its three hits: the hits become points, on a board in the middle of the field.
  if (mini && mini.type === 'bullseye' && !mini.pts) {
    mini.pts = { X: (mini.hits && mini.hits.X) || 0, O: (mini.hits && mini.hits.O) || 0 };
    mini.cfg = Object.assign({}, BULL_DEFAULTS); mini.pos = [BULLS.w / 2, BULLS.h / 2];
    if (!mini.speed) mini.speed = { X: 1, O: 1 };
    delete mini.hits; mini.last = null;
  }
  if (mini && mini.type === 'c4' && Array.isArray(mini.cells) && mini.cells.length === 5 * C4.rows && C4.cols === 7) {
    const at = k => Math.floor(k / 5) * 7 + (k % 5) + 1;
    const cells = new Array(C4.cols * C4.rows).fill(null);
    mini.cells.forEach((c, k) => { cells[at(k)] = c; });
    mini.cells = cells;
    if (Number.isInteger(mini.last)) mini.last = at(mini.last);
    if (Array.isArray(mini.winCells)) mini.winCells = mini.winCells.map(at);
  }
  // ...and from before Battleship grew to 4x4 with ships of 1 to 4 cells: the old 3x3 sea sits in the
  // top-left corner and its one-cell ship becomes a Patrol Boat.
  if (mini && mini.type === 'bs' && Array.isArray(mini.revealed) && mini.revealed.length === 9) {
    const at = k => Math.floor(k / 3) * BS.n + (k % 3);
    const revealed = new Array(BS.n * BS.n).fill(null);
    mini.revealed.forEach((c, k) => { revealed[at(k)] = c; });
    mini.revealed = revealed; mini.len = 1;
    if (Number.isInteger(mini.hidden)) { mini.ship = [at(mini.hidden)]; delete mini.hidden; }
    mini.hits = mini.ship && revealed[mini.ship[0]] ? mini.ship.slice() : [];
    if (Number.isInteger(mini.last)) mini.last = at(mini.last);
    if (Array.isArray(mini.winCells)) mini.winCells = mini.winCells.map(at);
  }
  if (mini && mini.type === 'bs' && !Array.isArray(mini.hits)) mini.hits = [];   // an empty list does not survive the database
  return mini;
}
function anyMove(state, p) { return state.squares.some(s => !s.owner && canMove(s.mini, p)); }
// Treasure hunt: steps up/down/left/right between two cells of the 5x5 grid.
function huntSize(mini) { return mini && Array.isArray(mini.dug) ? Math.round(Math.sqrt(mini.dug.length)) : HUNT.n; }
// The band of a distance: 0 is the treasure itself, then 1 Hot, 2 Warm, 3 Cool, 4 Cold.
function huntBand(d) { return d <= 0 ? 0 : d === 1 ? 1 : d <= 3 ? 2 : d <= 5 ? 3 : 4; }
function huntClue(mini, i) { return huntBand(huntDist(mini.treasure, i, huntSize(mini))); }
function huntDist(a, b, n = HUNT.n) {
  return Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n);
}
// Candy race track: 12 random colours where any three consecutive spaces differ, so the same colour
// is never closer than 3 spaces to itself.
function candyTrack(rng) {
  const track = [];
  for (let i = 0; i < CANDY.len; i++) {
    const recent = track.slice(Math.max(0, i - (CANDY.gap - 1)), i);
    const options = CANDY.colors.filter(c => !recent.includes(c));
    track.push(options[randInt(rng, options.length)]);
  }
  return track;
}

// Snakes and Ladders: the row (0 at the bottom) of a space from 1 to 20.
function snlRow(k) { return Math.floor((k - 1) / SNL.perRow); }
// A fresh board: 2 ladders (up) and 2 snakes (down) as [start, end] pairs. Every one crosses rows and
// spans at least 3 spaces; no two share an end (so none starts where another ends, and none chains);
// none starts on space 1 or touches the top space, 20.
function snlBoard(rng) {
  for (let tries = 0; tries < 50; tries++) {
    const used = new Set(), out = { ladders: [], snakes: [] };
    for (let k = 0; k < SNL.ladders + SNL.snakes; k++) {
      const up = k < SNL.ladders, opts = [];
      for (let a = 2; a < SNL.n; a++) for (let b = 1; b < SNL.n; b++) {
        if ((up ? b - a : a - b) < SNL.minSpan || snlRow(a) === snlRow(b) || used.has(a) || used.has(b)) continue;
        opts.push([a, b]);
      }
      if (!opts.length) break;
      const pair = opts[randInt(rng, opts.length)];
      used.add(pair[0]); used.add(pair[1]);
      (up ? out.ladders : out.snakes).push(pair);
    }
    if (out.ladders.length === SNL.ladders && out.snakes.length === SNL.snakes) return out;
  }
  return { ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 12]] };   // never needed: there is always room
}
// Whether a board keeps every placement rule (the tests check every board the generator makes).
function snlValid(b) {
  if (!b || !Array.isArray(b.ladders) || !Array.isArray(b.snakes) || b.ladders.length !== SNL.ladders || b.snakes.length !== SNL.snakes) return false;
  const ends = [];
  for (const [list, up] of [[b.ladders, true], [b.snakes, false]]) for (const pr of list) {
    if (!Array.isArray(pr) || pr.length !== 2 || !pr.every(Number.isInteger)) return false;
    const [a, c] = pr;
    if (a <= 1 || a >= SNL.n || c < 1 || c >= SNL.n) return false;          // nothing starts on 1, nothing touches the top
    if ((up ? c - a : a - c) < SNL.minSpan || snlRow(a) === snlRow(c)) return false;
    ends.push(a, c);
  }
  return new Set(ends).size === ends.length;                             // no shared ends
}
// Coin flip: the coins a flip by p turns over: every coin that isn't p's when there are three or fewer,
// otherwise three of them picked at random.
function coinPick(mini, p, rng) {
  const theirs = mini.coins.map((c, k) => (c !== p ? k : -1)).filter(k => k >= 0);
  return (theirs.length > COINS.max ? shuffle(theirs, rng).slice(0, COINS.max) : theirs).sort((a, b) => a - b);
}
// As a player's turn starts, every open Coin flip square picks the coins their flip would turn, so they
// can be marked before Flip is tapped; the flip then turns exactly those.
function markCoins(state, p, rng) {
  for (const sq of state.squares) if (!sq.owner && sq.mini.type === 'coins') sq.mini.marks = { by: p, coins: coinPick(sq.mini, p, rng) };
}
function coinMarksFor(mini, p) {
  const mk = mini.marks, theirs = mini.coins.filter(c => c !== p).length;
  if (!mk || mk.by !== p || !Array.isArray(mk.coins) || mk.coins.length !== Math.min(COINS.max, theirs)) return null;
  return mk.coins.every(k => Number.isInteger(k) && mini.coins[k] !== undefined && mini.coins[k] !== p) && new Set(mk.coins).size === mk.coins.length ? mk.coins.slice().sort((a, b) => a - b) : null;
}

// Battleship: a ship of random length (1 to 4) placed across or down, anywhere it fits.
function bsShip(rng) {
  const len = 1 + randInt(rng, 4), across = randInt(rng, 2) === 0, N = BS.n;
  const r = randInt(rng, across ? N : N - len + 1), c = randInt(rng, across ? N - len + 1 : N);
  return Array.from({ length: len }, (_, k) => (across ? r * N + c + k : (r + k) * N + c));
}
// Every way a ship of `len` cells fits on the grid (a one-cell ship counted once).
function bsPlacements(len) {
  const out = [], N = BS.n;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (c + len <= N) out.push(Array.from({ length: len }, (_, k) => r * N + c + k));
    if (len > 1 && r + len <= N) out.push(Array.from({ length: len }, (_, k) => (r + k) * N + c));
  }
  return out;
}

// ---------- the arcade games: Bullseye, Echo, Plinko, Cup Pong, Trivia, Odd One Out ----------
// Bullseye: a small dartboard (with a bullseye in its middle) sits somewhere on a field 100 units across
// and 120 down, and moves to a new random spot after every throw. A throw is aimed in two steps: a
// vertical line sweeps left and right (a tap stops it), then a horizontal line sweeps up and down (a
// tap stops it); the dart lands where they cross. The bullseye scores 3, the rest of the board 1, off the
// board 0; first to 5 points. The lines cross the field in cfg.sweep ms at the start (the same speed in
// both directions), and a player's own lines get cfg.ramp times faster with every throw of theirs that
// scores. The board's size, the bullseye's and the two speeds come from config/bulls (the admin's
// dashboard), copied into each square as it is dealt. A move is { x, y }: where the lines stopped, as
// fractions of the field's width and height; the score is worked out where the move is made (the
// server online), as is the board's next spot.
const BULLS = { goal: 5, w: 100, h: 120, bullPts: 3, boardPts: 1, edge: 4, minMove: 24, ai: { bull: 0.15, board: 0.45, worse: 0.4 } };
const BULL_DEFAULTS = { board: 9, bull: 2.5, sweep: 1300, ramp: 1.12 };   // the board's radius and the bullseye's (field units), ms per sweep across, the speed-up per scoring throw
const BULL_LIMITS = { board: [4, 30], bull: [0.5, 12], sweep: [400, 5000], ramp: [1, 2] };
const BULL_CFG = { cfg: null };
function bullsNorm(raw) {
  const out = {};
  for (const k of Object.keys(BULL_DEFAULTS)) {
    const v = raw && raw[k] != null ? Number(raw[k]) : NaN, [lo, hi] = BULL_LIMITS[k];
    out[k] = Number.isFinite(v) && v >= lo && v <= hi ? r3(v) : BULL_DEFAULTS[k];
  }
  if (out.bull >= out.board) out.bull = r3(out.board * 0.3);       // the bullseye always smaller than the board
  return out;
}
function setBullsConfig(raw) { BULL_CFG.cfg = raw && typeof raw === 'object' ? bullsNorm(raw) : null; }
const bullsConfig = () => Object.assign({}, BULL_CFG.cfg || BULL_DEFAULTS);
const r3 = x => Math.round(x * 1000) / 1000 + 0;
// The board's next spot: anywhere it fits whole on the field, a fair way from where it was.
function bullsSpot(cfg, prev, rng) {
  const R = cfg.board + BULLS.edge, w = BULLS.w - 2 * R, h = BULLS.h - 2 * R;
  let best = null;
  for (let k = 0; k < 40; k++) {
    const pt = [r3(R + rng() * w), r3(R + rng() * h)];
    const d = prev ? Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) : Infinity;
    if (d >= Math.min(BULLS.minMove, Math.hypot(w, h) * 0.4)) return pt;
    if (!best || d > best.d) best = { pt, d };
  }
  return best.pt;
}
// What a throw scores: where it landed (field units), how far from the board's middle, and the points.
function bullsScore(cfg, pos, x, y) {
  const at = [r3(x * BULLS.w), r3(y * BULLS.h)], d = r3(Math.hypot(at[0] - pos[0], at[1] - pos[1]));
  return { at, d, pts: d <= cfg.bull ? BULLS.bullPts : d <= cfg.board ? BULLS.boardPts : 0 };
}
const bullsPeriod = (cfg, speed) => cfg.sweep / speed;            // ms for the vertical line to cross the field (the horizontal one: as fast, so h/w as long)
// The computer: a bullseye, the board or a miss at its rates, slipping as its lines speed up.
function bullsRates(speed) { const f = Math.pow(1 / Math.max(1, speed), BULLS.ai.worse); return { bull: BULLS.ai.bull * f, board: BULLS.ai.board * f }; }
// Echo: four pads; each player has their own four patterns, of 4, 8, 11 and 14 steps, drawn when the
// square is dealt and never redrawn (a pattern failed plays again next attempt). A move is one attempt:
// the pads tapped back, in order; 'auto' (a timeout) is a failed attempt.
const ECHO = { pads: 4, lengths: [4, 8, 11, 14], step: 450, aiPass: [0.95, 0.75, 0.5, 0.3] };
const echoSeqs = rng => ECHO.lengths.map(n => Array.from({ length: n }, () => randInt(rng, ECHO.pads)));
// Plinko: 7 drop slots, 6 rows of pegs, 7 bins; one bin, drawn when the square is dealt, is the WIN
// bin. The chip's position runs in half-slots (0 to 12, a slot at an even one); at every peg it goes
// left or right, 50/50, except against a wall, where it can only go inward.
const PLINKO = { slots: 7, rows: 6, step: 230, land: 420 };
function plinkoPath(slot, rng) {
  let x = slot * 2;
  const path = [];
  for (let r = 0; r < PLINKO.rows; r++) {
    const right = x <= 0 ? true : x >= (PLINKO.slots - 1) * 2 ? false : rng() < 0.5;
    x += right ? 1 : -1; path.push(right);
  }
  return { path, bin: x / 2 };
}
// The chance of each bin from a slot (every path counted, the walls included): for the tests and the computer.
function plinkoOdds(slot) {
  const out = new Array(PLINKO.slots).fill(0);
  for (let k = 0; k < 1 << PLINKO.rows; k++) {
    let x = slot * 2;
    for (let r = 0; r < PLINKO.rows; r++) { const right = x <= 0 ? true : x >= (PLINKO.slots - 1) * 2 ? false : !!(k & (1 << r)); x += right ? 1 : -1; }
    out[x / 2] += 1 / (1 << PLINKO.rows);
  }
  return out;
}
// Cup Pong: the table is one unit long (the thrower at y 0, the far end at y 1) and one wide (x from
// -0.5 to 0.5). Each player's rack is three cups in a triangle at the far end. A throw is an aim
// (-1 to 1, the angle) and a power (0 to 1, the distance); the ball lands where the throw sends it,
// plus a little scatter either way. Inside a cup it sinks; within the rim it bounces, and drops in a
// quarter of the time; otherwise it misses.
const PONG = { cups: [[0, 0.84], [-0.1, 0.93], [0.1, 0.93]], r: 0.055, rim: 0.03, rimIn: 0.25, spread: 0.068, angle: 0.35, near: 0.5, far: 1.1, goal: 3, fly: 900, hold: 500, aiErr: [0.012, 0.018] };
const pongDist = power => PONG.near + (PONG.far - PONG.near) * power;
function pongThrow(cups, aim, power, rng) {
  const g = () => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };   // (Box-Muller)
  const th = aim * PONG.angle, d = pongDist(power);
  const x = Math.sin(th) * d + g() * PONG.spread, y = Math.cos(th) * d + g() * PONG.spread;
  let cup = null, best = Infinity;
  cups.forEach((up, k) => { if (!up) return; const dd = Math.hypot(x - PONG.cups[k][0], y - PONG.cups[k][1]); if (dd < best) { best = dd; cup = k; } });
  if (cup == null || best > PONG.r + PONG.rim) return { x, y, cup: null, rim: false, sunk: false };
  if (best <= PONG.r) return { x, y, cup, rim: false, sunk: true };
  return { x, y, cup, rim: true, sunk: rng() < PONG.rimIn };
}
// The throw that lands on a cup's centre with no scatter: the computer's aim, before its own error.
function pongAimAt(k) { const [cx, cy] = PONG.cups[k]; return { aim: Math.atan2(cx, cy) / PONG.angle, power: (Math.hypot(cx, cy) - PONG.near) / (PONG.far - PONG.near) }; }
// Trivia: the questions come from the bank the host sets (trivia.json, from the Open Trivia Database;
// setTriviaBank). A square has one question at a time, shared by both players, dealt from the questions
// not yet asked of anyone in this match. A wrong pick is crossed out (for both) and the question stays,
// the right answer never shown; the next turn there, either player's, goes on with what is left. The
// right answer scores and a new question is dealt. The right answer's place is kept apart from the
// public state online (answer); crossed holds the places picked wrong so far.
const TRIVIA = { goal: 3, options: 4, aiRight: 0.65, aiKnow: 0.53, reveal: 900, bank: null };   // aiKnow: the computer knows it this often, else guesses among what is left (65% right with four left); bank: the questions, as the host sets them
function setTriviaBank(bank) { TRIVIA.bank = bank && Array.isArray(bank.questions) && bank.questions.length ? bank : null; }
function triviaReady() { return !!TRIVIA.bank; }
function triviaUsed(state) {
  const used = new Set();
  for (const sq of (state && state.squares) || []) {
    const m = sq && sq.mini;
    if (!m || m.type !== 'trivia') continue;
    for (const id of m.asked || []) used.add(id);
    if (m.ask && m.ask.id) used.add(m.ask.id);
  }
  return used;
}
// The square's question, when it has none (a new square, or the last one answered right): never one
// asked before in this match (every question of the bank asked: any again). The answers' order is
// shuffled; the right one's place goes in answer, and nothing is crossed out yet.
function triviaDeal(state, sq, rng) {
  const m = sq.mini;
  if (!m || m.type !== 'trivia' || !TRIVIA.bank || m.ask) return;
  const used = triviaUsed(state);
  let pool = TRIVIA.bank.questions.filter(q => !used.has(q.id));
  if (!pool.length) pool = TRIVIA.bank.questions;
  const q = pool[randInt(rng, pool.length)];
  const opts = shuffle([q.a].concat(q.wrong.slice(0, TRIVIA.options - 1)), rng);
  m.ask = { id: q.id, q: q.q, cat: q.cat || '', opts };
  m.answer = opts.indexOf(q.a);
  m.crossed = [];
}
// Odd One Out: a grid of tiles of one colour, one of them a different shade (a little lighter or
// darker, and a touch off in hue, so it is fair with colours hard to tell apart). A player's grid grows
// with their finds: 3x3 with a clear difference, then 4x4, then 5x5 with a subtle one. The odd tile's
// place is kept apart from the public state online; the tiles' colours are what the page draws.
const ODD = { goal: 3, sizes: [3, 4, 5], diff: [16, 10, 6], hue: [6, 4, 3], aiFind: [0.9, 0.7, 0.5], reveal: 700 };
function oddGrid(level, rng) {
  const k = Math.min(level, ODD.sizes.length - 1), n = ODD.sizes[k];
  const h = randInt(rng, 360), sat = 50 + randInt(rng, 25), l = 42 + randInt(rng, 20);
  const up = l < 52 ? 1 : -1;                                   // the odd tile leans toward the middle lightness: always visible
  const dl = ODD.diff[k] * up, dh = (rng() < 0.5 ? -1 : 1) * ODD.hue[k];
  const base = `hsl(${h} ${sat}% ${l}%)`, odd = `hsl(${(h + dh + 360) % 360} ${sat}% ${l + dl}%)`;
  const pos = randInt(rng, n * n);
  return { grid: { n, base, odd, tiles: Array.from({ length: n * n }, (_, i) => (i === pos ? odd : base)) }, pos };
}

// ---------- Dash and Lane Rush: runs along a seeded course to 1,000 m ----------
// A move is one run: from the player's saved distance until they crash (or finish), at the speed of
// that distance (the further along, the faster); the crash point is the new saved distance. Each
// player's course (where the obstacles are) is fixed per square from a seed, so what crashed you is
// still there on the retry; every run opens with a grace stretch (two seconds at that speed) where the
// course's obstacles are left out. The page runs the run in real time, with the step function here;
// the engine knows the course, the speeds and what a result may be: a crash at an obstacle past the
// grace stretch (or the finish), in no less time than the course allows. The difficulty is one config
// per game (RUN_CFG: the admin's values from the database, set with setRunConfig), copied into each
// square when it is dealt, so a change applies to new squares and a square under way keeps its own.
const RUN_TYPES = ['dash', 'lane'];
const RUN_DEFAULTS = {
  dash: { target: 1000, v0: 8, ramp: 1.5, gapMin: 26, gapMax: 48, mix: { rock: 30, crate: 20, spike: 20, flyer: 20, pair: 10 } },   // mix: the obstacles' weights
  lane: { target: 1000, v0: 18, ramp: 1.8, gapMin: 18.8, gapMax: 34.4, mix: { one: 55, two: 45 } },                                      // rows with one car or two (twice the first starting speed; rows closer: a quarter more cars a course)
};
const RUN_LIMITS = { target: [200, 5000], v0: [3, 30], ramp: [0, 10], gapMin: [8, 200], gapMax: [10, 400] };
// grace: seconds with no obstacles at the start of a run; countdown: the 3-2-1 before it; aiRuns: how many
// runs the computer takes to finish, about; aiSlow: how much shorter its runs get with speed; aiSpread:
// the spread of its run lengths (log-normal); tolerance and slackMs: how much faster than the course's
// own time a reported run may be (frame rounding); hit: how far from an obstacle's place a crash may be
// reported (before, after); crashBin: the metres per bin in the crash stats.
const RUN = { grace: 2, countdown: 3, aiRuns: 4.5, aiSlow: 0.3, aiSpread: 0.45, tolerance: 0.85, slackMs: 200, hit: { dash: [1.5, 2.2], lane: [3.6, 3.6] }, crashBin: 50, maxCrashes: 40 };
const RUNT = { bar: 900, hold: 700 };                          // the result: the bar fills, then holds
const RUN_CFG = { dash: null, lane: null };
const r2 = x => Math.round(x * 100) / 100 + 0;                   // (+ 0: never a -0, which is not plain JSON)
// A config checked value by value: anything off, or missing, is the default.
function runNorm(type, raw) {
  const d = RUN_DEFAULTS[type], out = {};
  for (const k of ['target', 'v0', 'ramp', 'gapMin', 'gapMax']) {
    const v = raw && raw[k] != null ? Number(raw[k]) : NaN, [lo, hi] = RUN_LIMITS[k];
    out[k] = Number.isFinite(v) && v >= lo && v <= hi ? r2(v) : d[k];
  }
  if (out.gapMax < out.gapMin + 2) out.gapMax = out.gapMin + 2;
  out.mix = {};
  let tot = 0;
  for (const k of Object.keys(d.mix)) {
    const v = raw && raw.mix && raw.mix[k] != null ? Number(raw.mix[k]) : NaN;
    out.mix[k] = Number.isFinite(v) && v >= 0 && v <= 1000 ? Math.round(v) : d.mix[k];
    tot += out.mix[k];
  }
  if (!tot) out.mix = Object.assign({}, d.mix);
  return out;
}
function setRunConfig(cfg) { for (const t of RUN_TYPES) RUN_CFG[t] = runNorm(t, cfg && cfg[t]); }
function runConfig(type) { if (!RUN_CFG[type]) RUN_CFG[type] = runNorm(type, null); return JSON.parse(JSON.stringify(RUN_CFG[type])); }
const runSpeed = (cfg, d) => cfg.v0 + cfg.ramp * Math.max(0, d) / 100;                     // m/s at a distance along the course
// Seconds to run from a to b at the course's speeds (the speed grows with the distance).
function runSecs(cfg, a, b) { if (b <= a) return 0; return cfg.ramp > 0 ? (100 / cfg.ramp) * Math.log(runSpeed(cfg, b) / runSpeed(cfg, a)) : (b - a) / cfg.v0; }
// Where a run from a is after t seconds.
function runAfter(cfg, a, t) { if (t <= 0) return a; return cfg.ramp > 0 ? (runSpeed(cfg, a) * Math.exp(cfg.ramp * t / 100) - cfg.v0) * 100 / cfg.ramp : a + cfg.v0 * t; }
const runGrace = (cfg, a) => runAfter(cfg, a, RUN.grace) - a;                               // the obstacle-free stretch at the start of a run from a
// Dash's obstacles in metres (the runner is about a metre tall): width and height; a flyer's bottom
// edge is y above the ground, higher than the running runner and, being tall, in the way of any jump. Hitboxes are
// a touch smaller than the art (DASH.box, the 0.1 m shaved off each obstacle's sides).
const DASH_OBS = { rock: { w: 1.0, h: 0.8 }, crate: { w: 1.2, h: 1.15 }, spike: { w: 0.9, h: 0.95 }, flyer: { w: 1.3, h: 2.0, y: 1.25 } };   // (a flyer: a column of birds from 1.25 m up, too tall for any jump)
// The jump: a press launches at vy; while held (up to holdMax seconds) gravity is gHold, after that g,
// so a tap peaks at about 1.5 m and a hold at about 2.3 m, in the air a little longer.
const DASH = { g: 26, gHold: 10, vy: 8, holdMax: 0.25, box: { w: 0.6, h: 0.9 }, art: { w: 0.8, h: 1.0 }, shave: 0.1, step: 1 / 240 };
// Lane Rush: three lanes; a lane change takes switchSecs; the cars (the player's and the traffic's) are
// art metres long with a box that much shorter; two cars collide when their lanes are within laneHit.
const LANE = { lanes: 3, switchSecs: 0.22, art: 2.2, box: 2.0, laneHit: 0.72, step: 1 / 240 };
function weightedPick(mix, rng) {
  const ks = Object.keys(mix), tot = ks.reduce((s, k) => s + mix[k], 0);
  let r = rng() * tot;
  for (const k of ks) { r -= mix[k]; if (r < 0) return k; }
  return ks[ks.length - 1];
}
// A row of traffic: one or two cars, always leaving a lane open that the row before could reach (an
// open lane next to, or the same as, one of its own).
function laneRow(k, prev, rng) {
  const n = k === 'two' ? 2 : 1, prevOpen = prev ? [0, 1, 2].filter(l => !prev[l]) : null;
  for (;;) {
    const cars = [false, false, false];
    shuffle([0, 1, 2], rng).slice(0, n).forEach(l => { cars[l] = true; });
    const open = [0, 1, 2].filter(l => !cars[l]);
    if (!prevOpen || open.some(o => prevOpen.some(q => Math.abs(o - q) <= 1))) return cars;
  }
}
// A player's course: the obstacles in order, from the seed. Dash: { at, k } (a pair: two ground
// hazards a jump's length apart); Lane Rush: { at, cars: [lane 0, 1, 2] }.
function runCourse(mini, p) {
  const cfg = mini.cfg, rng = makeRng(`run:${mini.type}:${mini.seed[p]}`), out = [];
  let d = Math.max(cfg.gapMin, runGrace(cfg, 0) + 6);
  while (d < cfg.target - 4) {
    const k = weightedPick(cfg.mix, rng);
    if (mini.type === 'dash') {
      if (k === 'pair') {                                            // two hazards: one long jump clears both, or two quick ones
        const gap = 1.0 + 0.15 * runSpeed(cfg, d), kinds = ['rock', 'spike'];
        out.push({ at: r2(d), k: kinds[randInt(rng, 2)], pair: 1 });
        out.push({ at: r2(d + DASH_OBS.rock.w + gap), k: kinds[randInt(rng, 2)], pair: 2 });
        d += DASH_OBS.rock.w + gap;
      } else out.push({ at: r2(d), k });
    } else out.push({ at: r2(d), cars: laneRow(k, out.length ? out[out.length - 1].cars : null, rng) });
    d += cfg.gapMin + rng() * (cfg.gapMax - cfg.gapMin);
  }
  return out;
}
// What a run's result must be: from the saved distance to a crash at an obstacle past the grace stretch
// (or to the finish), in no less time than the course allows. `out`: the turn's time ran out mid-run
// (the run ends wherever it was: no obstacle needed; the time must still allow the distance).
function runCheck(mini, p, m) {
  if (!m || typeof m !== 'object') return 'bad';
  const cfg = mini.cfg, from = mini.dist[p], dist = Number(m.dist), ms = Number(m.ms);
  if (!Number.isFinite(dist) || !Number.isFinite(ms) || ms < 0 || dist < from || dist > cfg.target + 0.01) return 'bad';
  if (ms < runSecs(cfg, from, dist) * 1000 * RUN.tolerance - RUN.slackMs) return 'fast';   // more distance than the time allows at the course's speeds
  if (dist >= cfg.target || m.out) return null;
  const g = from + runGrace(cfg, from), [before, after] = RUN.hit[mini.type];
  return runCourse(mini, p).some(o => o.at >= g - 0.5 && dist >= o.at - before && dist <= o.at + after) ? null : 'course';   // a crash where there is nothing to crash into
}
// A timed-out player who never started: a run that crashes after a short random distance (at the first
// obstacle past the grace stretch and a few metres more; past the last obstacle, it finishes).
function runAuto(mini, p, rng) {
  const cfg = mini.cfg, from = mini.dist[p], want = from + runGrace(cfg, from) + 4 + rng() * 70;
  const ob = runCourse(mini, p).find(o => o.at >= want);
  const dist = ob ? Math.min(cfg.target, r2(ob.at + 0.2)) : cfg.target;
  return { dist, ms: Math.round(runSecs(cfg, from, dist) * 1000) + 60 };
}
// The computer: no run in real time; its crash distance is drawn to finish in about RUN.aiRuns runs
// (log-normal around a mean that shrinks a little as the course speeds up), then put at the obstacle
// there, like any crash.
const gaussOf = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const normCdf = x => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
function runAiMean(cfg, from) { return (cfg.target / RUN.aiRuns) * Math.pow(cfg.v0 / runSpeed(cfg, from), RUN.aiSlow); }
function runAi(mini, p, rng) {
  const cfg = mini.cfg, from = mini.dist[p], g = runGrace(cfg, from), mean = runAiMean(cfg, from), s = RUN.aiSpread;
  const len = Math.max(6, mean * Math.exp(s * gaussOf(rng) - s * s / 2));
  const ob = runCourse(mini, p).find(o => o.at >= from + g + len);
  const dist = ob ? Math.min(cfg.target, r2(ob.at + 0.2)) : cfg.target;
  const need = cfg.target - from - g;                            // the chance this run finishes
  const q = need <= 0 ? 1 : 1 - normCdf((Math.log(need / mean) + s * s / 2) / s);
  return { move: { dist, ms: Math.round(runSecs(cfg, from, dist) * 1000) + 80 }, q };
}
const runNeeds = (cfg, from) => Math.max(1, (cfg.target - from) / (runAiMean(cfg, from) + runGrace(cfg, from)));
// The run data a square carries to the stats (the admin's tuning): runs, distances and the crashes.
const runLog = mini => ({ run: { runs: { X: mini.runs.X, O: mini.runs.O }, dist: { X: Math.round(mini.dist.X), O: Math.round(mini.dist.O) }, crashes: { X: (mini.crashes.X || []).slice(), O: (mini.crashes.O || []).slice() } } });

// ----- the run itself: the page drives it in real time (one frame at a time), the tests step by step -----
// A fresh run from the player's saved distance: the course past the grace stretch, the runner on the
// ground (Dash) or in the middle lane (Lane Rush).
function runStart(mini, p) {
  const cfg = mini.cfg, from = mini.dist[p], g = runGrace(cfg, from);
  return { type: mini.type, cfg, from, d: from, t: 0, grace: g, course: runCourse(mini, p).filter(o => o.at >= from + g), i: 0,
    y: 0, vy: 0, air: false, held: false, holdT: 0, lane: 1, laneFrom: 1, laneT: 1, crash: null, done: false };
}
function runJump(sim) { if (sim.type !== 'dash' || sim.air || sim.crash || sim.done) return false; sim.air = true; sim.vy = DASH.vy; sim.held = true; sim.holdT = 0; return true; }
function runRelease(sim) { sim.held = false; }
function runLane(sim, dir) {
  if (sim.type !== 'lane' || sim.crash || sim.done) return false;
  const to = Math.max(0, Math.min(LANE.lanes - 1, Math.round(sim.lane) + dir));
  if (to === Math.round(sim.lane) && sim.laneT >= 1) return false;
  sim.laneFrom = runLaneX(sim); sim.lane = to; sim.laneT = 0;                 // (a change mid-change starts from where the car is)
  return true;
}
const runLaneX = sim => (sim.laneT >= 1 ? sim.lane : sim.laneFrom + (sim.lane - sim.laneFrom) * sim.laneT);   // the car's lane, as a number, mid-change
const overlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
function runHit(sim) {                                            // the obstacle the runner is touching, if any
  const d = sim.d;
  if (sim.type === 'dash') {
    const x0 = d - DASH.box.w / 2, x1 = d + DASH.box.w / 2, y0 = sim.y, y1 = sim.y + DASH.box.h, s = DASH.shave;
    for (let k = sim.i; k < sim.course.length; k++) {
      const o = sim.course[k], ob = DASH_OBS[o.k];
      if (o.at > d + 4) break;
      if (o.at + ob.w < d - 4) { if (k === sim.i) sim.i++; continue; }
      const oy = ob.y || 0;
      if (overlap(x0, x1, o.at + s, o.at + ob.w - s) && overlap(y0, y1, oy + s, oy + ob.h - s)) return o;
    }
  } else {
    const x = runLaneX(sim);
    for (let k = sim.i; k < sim.course.length; k++) {
      const o = sim.course[k];
      if (o.at > d + 6) break;
      if (o.at < d - 6) { if (k === sim.i) sim.i++; continue; }
      if (Math.abs(o.at - d) < LANE.box && o.cars.some((c, l) => c && Math.abs(l - x) < LANE.laneHit)) return o;
    }
  }
  return null;
}
// One frame of dt seconds, in fixed sub-steps: the distance grows at the course's speed, the jump or the
// lane change plays out, a touch is a crash (the run ends there), the target is the finish.
function runStep(sim, dt) {
  if (sim.crash || sim.done) return sim;
  const step = sim.type === 'dash' ? DASH.step : LANE.step;
  let left = Math.max(0, Math.min(0.1, dt));
  while (left > 1e-9 && !sim.crash && !sim.done) {
    const h = Math.min(step, left); left -= h;
    sim.d += runSpeed(sim.cfg, sim.d) * h; sim.t += h;
    if (sim.type === 'dash' && sim.air) {
      const g = sim.held && sim.holdT < DASH.holdMax ? DASH.gHold : DASH.g;
      sim.holdT += h; sim.vy -= g * h; sim.y += sim.vy * h;
      if (sim.y <= 0) { sim.y = 0; sim.vy = 0; sim.air = false; sim.held = false; }
    }
    if (sim.type === 'lane' && sim.laneT < 1) sim.laneT = Math.min(1, sim.laneT + h / LANE.switchSecs);
    if (sim.d >= sim.cfg.target) { sim.d = sim.cfg.target; sim.done = true; break; }
    const hit = runHit(sim);
    if (hit) { sim.crash = { at: r2(sim.d), ob: hit }; break; }
  }
  return sim;
}
// The move a run makes: its end (the crash, the finish, or where the time ran out) and its time.
const runResult = (sim, out) => ({ dist: r2(Math.min(sim.cfg.target, sim.d)), ms: Math.round(sim.t * 1000), out: !!out && !sim.done });

// ---------- Craps, Takeover and Flood ----------
// Craps: each player has their own count of rounds won; first to 2 takes the square. A move is a whole
// pass-line round, rolled out at once where the move is made (the server online: the dice are never
// known before): the come-out roll wins on 7 or 11, loses on 2, 3 or 12, and anything else is the
// point; then the point again wins and a 7 loses. A loss takes nothing away. The page plays the rolls
// back one by one (CRAPS.roll ms each, quicker after the fourth), with the puck going on at the point.
const CRAPS = { goal: 2, roll: 900, quick: 560, quickAfter: 4, puck: 420, hold: 900, winOdds: 244 / 495 };
function crapsRound(rng) {
  const rolls = [];
  let point = null, result = null;
  while (!result) {
    const d = [1 + randInt(rng, 6), 1 + randInt(rng, 6)], s = d[0] + d[1];
    rolls.push(d);
    if (point == null) {
      if (s === 7 || s === 11) result = 'win';
      else if (s === 2 || s === 3 || s === 12) result = 'lose';
      else point = s;
    } else if (s === point) result = 'win';
    else if (s === 7) result = 'lose';
  }
  return { rolls, point, result };
}
// When each roll of a round lands (ms into the move), and when the round's result shows.
function crapsTimes(rolls, point) {
  const at = [];
  let t = 0;
  for (let k = 0; k < rolls.length; k++) { at.push(t); t += k < CRAPS.quickAfter ? CRAPS.roll : CRAPS.quick; if (k === 0 && point != null) t += CRAPS.puck; }
  return { at, end: t };
}
// Takeover: a 5x5 board, empty to begin with. A move takes an empty cell and the cells above, below,
// left and right of it, the other player's included. Once no cell is empty, most cells wins (25: no tie).
const TAKE = { n: 5 };
const takeNear = i => { const n = TAKE.n, r = Math.floor(i / n), c = i % n, out = [i]; if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1); return out; };
const takeCount = (cells, p) => cells.filter(c => c === p).length;
function takeApply(cells, i, p) { const out = cells.slice(); for (const k of takeNear(i)) out[k] = p; return out; }
// The computer, two moves deep: the cell that leaves it furthest ahead after the other player's best reply.
function takeSearch(cells, me, rng) {
  const o = other(me), net = c => takeCount(c, me) - takeCount(c, o);
  let best = null;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) continue;
    const a = takeApply(cells, i, me);
    let worst = Infinity;
    if (!a.includes(null)) worst = net(a) > 0 ? 100 + net(a) : -100 + net(a);   // the board full: won or lost
    else for (let j = 0; j < a.length; j++) { if (a[j]) continue; const b = takeApply(a, j, o); const v = b.includes(null) ? net(b) : net(b) > 0 ? 100 + net(b) : -100 + net(b); if (v < worst) worst = v; }
    const v = worst + (rng ? rng() * 0.01 : 0);                  // (a hair of chance between equals)
    if (!best || v > best.v) best = { i, v, after: a };
  }
  return best;
}
// Flood: a 6x6 grid of five colours. The top-left cell starts the blob, shared by both players and not
// scored. A move picks a colour other than the blob's: the whole blob takes it, and every cell of that
// colour joined to the blob is absorbed and scored to the mover (shown in their colour). First to 18 of
// the 35 cells wins (with 35 there is no tie).
const FLOOD = { n: 6, colors: 5, goal: 18 };
const floodNear = i => { const n = FLOOD.n, r = Math.floor(i / n), c = i % n, out = []; if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1); return out; };
// The cells a colour would absorb, in waves out from the blob (each wave one step further): [[...], [...]].
function floodWaves(colors, owner, c) {
  const inBlob = owner.map(x => x != null), seen = inBlob.slice(), waves = [];
  let front = [];
  owner.forEach((x, i) => { if (x != null) for (const k of floodNear(i)) if (!seen[k] && colors[k] === c) { seen[k] = true; front.push(k); } });
  while (front.length) {
    waves.push(front);
    const next = [];
    for (const i of front) for (const k of floodNear(i)) if (!seen[k] && colors[k] === c) { seen[k] = true; next.push(k); }
    front = next;
  }
  return waves;
}
const floodGain = (pm, c) => floodWaves(pm.colors, pm.owner, c).reduce((s, w) => s + w.length, 0);
function floodApply(pm, c, p) {
  const colors = pm.colors.slice(), owner = pm.owner.slice(), score = { X: pm.score.X, O: pm.score.O };
  const waves = floodWaves(colors, owner, c);
  owner.forEach((x, i) => { if (x != null) colors[i] = c; });
  for (const w of waves) for (const i of w) { owner[i] = p; colors[i] = c; score[p] += 1; }
  return { colors, owner, score, waves };
}
// The computer, two moves deep: the colour with the most cells for it less the other player's best answer.
function floodSearch(pm, me, rng) {
  const o = other(me), blob = pm.colors[0];
  let best = null;
  for (let c = 0; c < FLOOD.colors; c++) {
    if (c === blob) continue;
    const a = floodApply(pm, c, me), gain = a.score[me] - pm.score[me];
    let reply = 0;
    if (a.score[me] < FLOOD.goal) for (let d = 0; d < FLOOD.colors; d++) { if (d === c) continue; const g = floodGain({ colors: a.colors, owner: a.owner }, d); if (g > reply) reply = g; }
    const v = (a.score[me] >= FLOOD.goal ? 1000 : 0) + (gain > 0 ? 100 : 0) + gain - 0.6 * reply + (rng ? rng() * 0.01 : 0);   // a colour that grabs nothing only when none grabs anything (else both sides could stall)
    if (!best || v > best.v) best = { c, v, gain, after: { type: 'flood', colors: a.colors, owner: a.owner, score: a.score }, win: a.score[me] >= FLOOD.goal };
  }
  return best;
}
// A score race's moves still needed, for the computer's choice of square: from the lead and the moves left,
// set so that the chance either side takes the square (winChance) is about the logistic of the lead.
function raceNeeds(lead, remain, scale) {
  const w = 1 / (1 + Math.exp(-lead / scale));
  return Math.max(0.3, 2 * Math.max(0.5, remain) * (1 - w));
}

// ---------- Seating, Districts, Shelves and Roads ----------
// Seating: a restaurant of 10 tables for two; every seat has a colour (one of four). A move seats you in
// any empty seat; then a customer Z walks in and sits in a random empty seat of their colour (any empty
// seat if none of theirs is left). The next customer's colour is always shown; where they sit, and the
// colour of the one after, are drawn only as the move is made (by the server online). A table is yours
// with both its seats. Five tables wins at once; else, once every seat is taken, most tables wins and a
// tie resets the square.
const SEAT = { tables: 10, colors: 4, goal: 5 };
const seatTable = i => Math.floor(i / 2), seatMate = i => (i % 2 ? i - 1 : i + 1);
const seatTables = (who, p) => { let n = 0; for (let t = 0; t < SEAT.tables; t++) if (who[2 * t] === p && who[2 * t + 1] === p) n++; return n; };
function seatZ(mini, rng) {                                       // the customer sits; returns the seat (or null when the room is full)
  const empty = mini.who.map((w, i) => (w ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) return null;
  const theirs = empty.filter(i => mini.color[i] === mini.next);
  const pool = theirs.length ? theirs : empty, z = pool[randInt(rng, pool.length)];
  mini.who[z] = 'Z';
  return z;
}
// The computer: its own half-table first, then the other player's, then a fresh table whose other seat is
// not the next customer's colour; else any seat.
function seatPick(pm, me, rng) {
  const o = other(me), who = pm.who, empty = who.map((w, i) => (w ? -1 : i)).filter(i => i >= 0);
  const half = p => empty.filter(i => who[seatMate(i)] === p);
  const mine = half(me); if (mine.length) return { move: mine[randInt(rng, mine.length)], why: 'complete' };
  const theirs = half(o); if (theirs.length) return { move: theirs[randInt(rng, theirs.length)], why: 'block' };
  const fresh = empty.filter(i => !who[seatMate(i)]), safe = fresh.filter(i => pm.color[seatMate(i)] !== pm.next);
  if (safe.length) return { move: safe[randInt(rng, safe.length)], why: 'start' };
  if (fresh.length) return { move: fresh[randInt(rng, fresh.length)], why: 'start' };
  return { move: empty[randInt(rng, empty.length)], why: 'any' };
}
// Districts: a map of 5 regions with 11 to 15 spots, each inside a region or on a border (counting for
// every region it touches). Every region is touched by an odd number of spots, at least 3, so once the map
// is full every region has a leader; most regions wins (5: no tie). Drawn as a Voronoi map from 5 seeds on
// a field 100 by 120; spots in the regions, on the borders between two and where three meet.
const DIST = { w: 100, h: 120, regions: 5, minSpots: 11, maxSpots: 15, gap: 11 };
const r1d = x => Math.round(x * 10) / 10 + 0;
function distClip(poly, a, b) {                                   // keep the part of poly closer to a than to b
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = b[0] - a[0], ny = b[1] - a[1];
  const side = p => (p[0] - mx) * nx + (p[1] - my) * ny, out = [];
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
function distMap(src) {
  const rng = makeRng('map ' + src());   // one draw seeds the map's own generator: a map is always found, however plain the source
  for (let tries = 0; tries < 400; tries++) {
    const seeds = [];
    for (let k = 0; k < 400 && seeds.length < DIST.regions; k++) {
      const p = [12 + rng() * (DIST.w - 24), 12 + rng() * (DIST.h - 24)];
      if (seeds.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) > 34)) seeds.push(p);
    }
    if (seeds.length < DIST.regions) continue;
    const polys = seeds.map((s, i) => seeds.reduce((poly, t, j) => (i === j ? poly : distClip(poly, s, t)), [[0, 0], [DIST.w, 0], [DIST.w, DIST.h], [0, DIST.h]]));
    const near = (p, i) => Math.hypot(p[0] - seeds[i][0], p[1] - seeds[i][1]);
    const touching = p => { const d = seeds.map((_, i) => near(p, i)), m = Math.min(...d); return d.map((x, i) => (x - m < 0.01 ? i : -1)).filter(i => i >= 0); };
    const cand = [];
    // inside each region: its centroid and points part way to its corners
    polys.forEach((poly, i) => {
      const c = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
      cand.push({ p: c, r: [i], kind: 'in' });
      for (const v of poly) { const q = [c[0] + (v[0] - c[0]) * 0.55, c[1] + (v[1] - c[1]) * 0.55]; if (touching(q).length === 1) cand.push({ p: q, r: [i], kind: 'in' }); }
    });
    // on a border between two: the middle of each long enough shared edge; where three meet: the corner
    for (let i = 0; i < polys.length; i++) for (let k = 0; k < polys[i].length; k++) {
      const p = polys[i][k], q = polys[i][(k + 1) % polys[i].length], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const t = touching(mid);
      if (t.length === 2 && t[0] === i && Math.hypot(q[0] - p[0], q[1] - p[1]) >= 14) cand.push({ p: mid, r: t, kind: 'border' });
      const tv = touching(p);
      if (tv.length === 3 && tv[0] === i && p[0] > 3 && p[0] < DIST.w - 3 && p[1] > 3 && p[1] < DIST.h - 3) cand.push({ p, r: tv, kind: 'corner' });
    }
    // a random choice of them, kept apart, with every region touched an odd number of times (3 or more)
    for (let pick = 0; pick < 60; pick++) {
      const order = shuffle(cand.map((_, k) => k), rng).sort((a, b) => cand[b].r.length - cand[a].r.length), chosen = [];   // border and corner spots first: they count for more regions, so fewer spots do
      const far = c => chosen.every(k => Math.hypot(cand[k].p[0] - c.p[0], cand[k].p[1] - c.p[1]) >= DIST.gap);
      const want = DIST.minSpots + randInt(rng, 3);   // (the mending below may add one or two)
      for (const k of order) { if (chosen.length >= want) break; if (far(cand[k])) chosen.push(k); }
      const count = () => { const n = new Array(DIST.regions).fill(0); for (const k of chosen) for (const r of cand[k].r) n[r]++; return n; };
      // mend the counts: an inside spot changes one region's count by one
      for (let fix = 0; fix < 20; fix++) {
        const n = count(), bad = n.findIndex(x => x < 3 || x % 2 === 0);
        if (bad < 0) break;
        const add = order.find(k => !chosen.includes(k) && cand[k].kind === 'in' && cand[k].r[0] === bad && far(cand[k]));
        const drop = chosen.find(k => cand[k].kind === 'in' && cand[k].r[0] === bad);
        if (n[bad] < 3 || add != null && (n[bad] % 2 === 0) && (chosen.length < DIST.maxSpots || drop == null)) { if (add == null) break; chosen.push(add); }
        else if (drop != null && n[bad] > 3) chosen.splice(chosen.indexOf(drop), 1);
        else if (add != null) chosen.push(add);
        else break;
      }
      const n = count();
      if (chosen.length >= DIST.minSpots && chosen.length <= DIST.maxSpots && chosen.length % 2 === 0 && n.every(x => x >= 3 && x % 2 === 1)) {   // (an even number of spots: both players place as many pieces)
        const spots = chosen.map(k => ({ x: r1d(cand[k].p[0]), y: r1d(cand[k].p[1]), r: cand[k].r.slice().sort((a, b) => a - b) })).sort((a, b) => a.y - b.y || a.x - b.x);
        return { regions: polys.map(poly => poly.map(p => [r1d(p[0]), r1d(p[1])])), spots };
      }
    }
  }
  throw new Error('no map');
}
// The regions' counts and leaders: { X: [...], O: [...], empty: [...], lead: ['X'|'O'|null] }.
function distTally(map, who) {
  const R = map.regions.length, out = { X: new Array(R).fill(0), O: new Array(R).fill(0), empty: new Array(R).fill(0), lead: new Array(R).fill(null) };
  map.spots.forEach((s, k) => { for (const r of s.r) { if (who[k] === 'X') out.X[r]++; else if (who[k] === 'O') out.O[r]++; else out.empty[r]++; } });
  for (let r = 0; r < R; r++) out.lead[r] = out.X[r] > out.O[r] ? 'X' : out.O[r] > out.X[r] ? 'O' : null;
  return out;
}
// The computer's view of a position: a region locked counts whole, an open one by its lead against the spots left.
function distEval(map, who, me) {
  const t = distTally(map, who), o = other(me);
  let v = 0;
  for (let r = 0; r < map.regions.length; r++) {
    const m = t[me][r], th = t[o][r], e = t.empty[r];
    v += m > th + e ? 1 : th > m + e ? -1 : 0.6 * (m - th) / (e + 1);
  }
  return v;
}
function distSearch(pm, me, rng) {                               // two moves deep, on the swing regions
  const o = other(me), who = pm.who, empty = who.map((w, k) => (w ? -1 : k)).filter(k => k >= 0);
  let best = null;
  for (const k of empty) {
    const a = who.slice(); a[k] = me;
    let worst = Infinity;
    const rest = a.map((w, j) => (w ? -1 : j)).filter(j => j >= 0);
    if (!rest.length) worst = distEval(pm.map, a, me) * 10;
    for (const j of rest) { const b = a.slice(); b[j] = o; const v = b.includes(null) ? distEval(pm.map, b, me) : distEval(pm.map, b, me) * 10; if (v < worst) worst = v; }
    const v = worst + (rng ? rng() * 0.001 : 0);
    if (!best || v > best.v) best = { k, v, after: a };
  }
  return best;
}
// Shelves: 6 shelves of 3 spots. A move puts your mark on an open spot; then a grey mark lands on a random
// open spot (drawn as the move is made). Once every spot is filled, each player scores the shelves they
// are on (up to 6); higher wins, and a tie resets the square.
const SHELF = { n: 6, per: 3 };
const shelfOn = (cells, p) => { let n = 0; for (let s = 0; s < SHELF.n; s++) if (cells.slice(s * SHELF.per, s * SHELF.per + SHELF.per).includes(p)) n++; return n; };
// The computer: a shelf it is not on yet, more so one the other player is missing too, and one nearly full.
function shelfPick(pm, me, rng) {
  const o = other(me), c = pm.cells;
  let best = null;
  for (let i = 0; i < c.length; i++) {
    if (c[i]) continue;
    const s = Math.floor(i / SHELF.per), row = c.slice(s * SHELF.per, s * SHELF.per + SHELF.per);
    const mineOn = row.includes(me), theirsOn = row.includes(o), filled = row.filter(Boolean).length;
    let v = mineOn ? 0 : 10 + (theirsOn ? 0 : 5) + 3 * filled;
    if (mineOn && !theirsOn && filled === SHELF.per - 1) v += 6;   // the last spot on a shelf they are missing: theirs no more
    v += rng ? rng() * 0.5 : 0;
    if (!best || v > best.v) best = { i, v };
  }
  return best;
}
// Roads: a grid of 4x4 dots, 24 lines between them (12 across, then 12 down). A move claims an open line;
// then a random open line is blocked (drawn as the move is made). Once none is open, each player's score is
// their longest road: a trail through their own lines using each line at most once (a corner may be passed
// more than once). Longer road wins; a tie resets the square.
const ROAD = { n: 4 };
const ROAD_SEGS = (() => { const out = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) out.push([r * 4 + c, r * 4 + c + 1]); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) out.push([r * 4 + c, (r + 1) * 4 + c]); return out; })();
// The longest trail through p's lines: { len, segs } (the lines in order along it).
function roadLongest(segs, p) {
  const mine = ROAD_SEGS.map((e, k) => (segs[k] === p ? k : -1)).filter(k => k >= 0);
  if (!mine.length) return { len: 0, segs: [] };
  const at = {};
  for (const k of mine) for (const v of ROAD_SEGS[k]) (at[v] = at[v] || []).push(k);
  const used = {};
  let best = [];
  const walk = (v, path) => {
    if (path.length > best.length) best = path.slice();
    for (const k of at[v] || []) {
      if (used[k]) continue;
      used[k] = true; path.push(k);
      const [a, b] = ROAD_SEGS[k];
      walk(a === v ? b : a, path);
      path.pop(); used[k] = false;
      if (best.length === mine.length) return;
    }
  };
  for (const v of Object.keys(at)) { walk(Number(v), []); if (best.length === mine.length) break; }
  return { len: best.length, segs: best };
}
// The computer: lengthen its own longest road, and take the line that would lengthen the other player's most.
function roadPick(pm, me, rng) {
  const o = other(me), segs = pm.segs, mine0 = roadLongest(segs, me).len, theirs0 = roadLongest(segs, o).len;
  let best = null;
  for (let k = 0; k < segs.length; k++) {
    if (segs[k]) continue;
    const a = segs.slice(); a[k] = me;
    const b = segs.slice(); b[k] = o;
    const gain = roadLongest(a, me).len - mine0, deny = roadLongest(b, o).len - theirs0;
    const touch = ROAD_SEGS[k].some(v => ROAD_SEGS.some((e, j) => segs[j] === me && e.includes(v))) ? 0.3 : 0;
    const v = 2 * gain + 1.2 * deny + touch + (rng ? rng() * 0.05 : 0);
    if (!best || v > best.v) best = { k, v, after: a };
  }
  return best;
}
// Seating, Shelves and Roads: after the move, a random empty place for the customer, the grey mark or the block.
const randomEmpty = (arr, rng) => { const e = arr.map((x, i) => (x ? -1 : i)).filter(i => i >= 0); return e.length ? e[randInt(rng, e.length)] : null; };

// ---------- Mini Golf, Pool and Bowling: the physics games (Matter.js, through physics.js) ----------
// The tables, the shots and the recordings live in physics.js (setPhysics registers it: the page once
// Matter.js has loaded from cdnjs, the server and the tests from the module). Without it these three
// are not dealt (dealable), as Trivia is not without its questions. A move is a shot { aim, power }:
// the aim in radians (0 straight up the table), the power 0..1. The shot is played out where the move
// is made (the shooter's phone in a local or friend match, the server in Find Match) and the recording
// goes into the square (last.rec): the other phone replays it, so both see the same thing.
const PHYS_TYPES = ['golf', 'pool', 'bowling'];
const PHYSICS = { lib: null };
function setPhysics(lib) { PHYSICS.lib = lib && typeof lib.run === 'function' ? lib : null; }
const physicsReady = () => !!PHYSICS.lib;
const GOLF = { goal: 1, aiErr: [0.035, 0.04], hold: 700 };
const POOLG = { goal: 2, aiErr: [0.02, 0.05], hold: 700, order: ['cue', 'x1', 'x2', 'o1', 'o2', 'black'] };
const BOWLG = { goal: 25, rack: 10, aiErr: [0.025, 0.04], hold: 800 };
const poolMine = p => (p === 'X' ? ['x1', 'x2'] : ['o1', 'o2']);
// A shot as a move: both numbers, the power within 0..1, the aim within a half turn either way (to
// three decimals, so a shot checked twice is the same shot twice).
function physShot(m) {
  if (!m || typeof m !== 'object') return null;
  const aim = Number(m.aim), power = Number(m.power);
  if (!Number.isFinite(aim) || !Number.isFinite(power) || Math.abs(aim) > 3.143 || power < 0 || power > 1) return null;
  return { aim: Math.round(aim * 1000) / 1000 + 0, power: Math.round(power * 1000) / 1000 + 0 };
}
// An angle brought round into the half turn either way (what a shot's aim must be).
function wrapAim(a) { a = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return Math.max(-3.141, Math.min(3.141, a)); }
// The aim from a point to a target: 0 is straight up the table (y decreasing), positive is to the right.
const aimTo = (from, to) => Math.atan2(to[0] - from[0], from[1] - to[1]);
// The pool cue ball's spot, or the nearest free spot below it when a ball sits there.
function poolSpot(mini) {
  const L = PHYSICS.lib, start = L.POOL.start.cue, R = L.POOL.ballR;
  for (let k = 0; k < 20; k++) {
    const y = start[1] + k * R * 2.2;
    if (!POOLG.order.some(id => id !== 'cue' && !mini.down[id] && Math.hypot(mini.balls[id][0] - start[0], mini.balls[id][1] - y) < R * 2.1)) return [start[0], Math.min(y, L.POOL.h - R - 1)];
  }
  return start.slice();
}
function physRun(mini, p, shot) { return PHYSICS.lib ? PHYSICS.lib.run(mini.type, mini, p, shot) : null; }
// A hole's path (the way round its walls, ending at the cup): the next point to make for from a place,
// and how far there is still to go along it.
function golfClear(hole, a, b) {                              // a straight roll from a to b: clear of the hole's walls and bumpers?
  const R = PHYSICS.lib.GOLF.ballR + 0.6, n = 24;
  for (let i = 1; i < n; i++) {
    const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n;
    for (const [cx, cy, w, h, ang] of hole.walls) {
      const c = Math.cos(ang || 0), s = Math.sin(ang || 0), dx = x - cx, dy = y - cy;
      if (Math.abs(dx * c + dy * s) < w / 2 + R && Math.abs(dy * c - dx * s) < h / 2 + R) return false;
    }
    for (const [cx, cy, r] of hole.bumpers) if (Math.hypot(x - cx, y - cy) < r + R) return false;
  }
  return true;
}
function golfNext(hole, pos) {                                 // the path point in sight with the least way still to go (any point, if none is)
  let best = -1, bd = Infinity;
  const pick = (pt, i) => { const d = Math.hypot(pt[0] - pos[0], pt[1] - pos[1]) + golfAhead(hole, i); if (d < bd) { bd = d; best = i; } };
  hole.path.forEach((pt, i) => { if (golfClear(hole, pos, pt)) pick(pt, i); });
  if (best < 0) hole.path.forEach(pick);
  return best;
}
function golfAhead(hole, i) { let s = 0; for (let k = i; k < hole.path.length - 1; k++) s += Math.hypot(hole.path[k + 1][0] - hole.path[k][0], hole.path[k + 1][1] - hole.path[k][1]); return s; }
function golfLeft(hole, pos) { const i = golfNext(hole, pos); return Math.hypot(hole.path[i][0] - pos[0], hole.path[i][1] - pos[1]) + golfAhead(hole, i); }
const physLast = (p, shot, r, extra) => Object.assign({ by: p, aim: shot.aim, power: shot.power, ms: r.ms, events: r.events, rec: r.rec }, extra);
// What a shot would do, for the computer: the same simulation, scored.
function physScore(mini, p, r) {
  const L = PHYSICS.lib, o = other(p);
  if (mini.type === 'golf') {
    if (r.result.first === p) return 1000;
    if (r.result.first === o) return -1000;
    return -golfLeft(L.HOLES[mini.hole], r.final[p] || mini.balls[p]);
  }
  if (mini.type === 'pool') {
    const pk = r.result.pocketed, own = pk.filter(id => poolMine(p).includes(id)).length, theirs = pk.filter(id => poolMine(o).includes(id)).length;
    if (pk.includes('black')) return -1000;
    let s = own * 100 - theirs * 80 - (pk.includes('cue') ? 150 : 0);
    if (own && mini.pocketed[p] + own >= POOLG.goal) s += 500;
    if (theirs && mini.pocketed[o] + theirs >= POOLG.goal) s -= 500;
    for (const id of poolMine(p)) if (r.final[id]) s -= Math.min(...L.POOL.pockets.map(([x, y]) => Math.hypot(r.final[id][0] - x, r.final[id][1] - y))) / 10;   // own balls left near pockets
    return s;
  }
  return r.result.knocked * 10 - (r.result.gutter ? 1 : 0);
}
function physCandidates(mini, p, rng) {
  const L = PHYSICS.lib, out = [];
  if (mini.type === 'golf') {                                 // at the next points of the hole's path, and at the cup, with powers to suit the distance
    const hole = L.HOLES[mini.hole], from = mini.balls[p], k = golfNext(hole, from);
    const targets = [hole.path[k], hole.path[Math.min(k + 1, hole.path.length - 1)], hole.cup];
    for (const t of targets) {
      const a = aimTo(from, t), d = Math.hypot(t[0] - from[0], t[1] - from[1]), base = Math.max(0.15, Math.min(0.95, 0.08 + d / 120));
      for (const dp of [0, 0.12, -0.08, 0.25]) out.push({ aim: a, power: base + dp });
      out.push({ aim: a + 0.12, power: base }, { aim: a - 0.12, power: base });
    }
    for (let k2 = 0; k2 < 3; k2++) out.push({ aim: (rng() - 0.5) * Math.PI * 1.6, power: 0.4 + rng() * 0.55 });   // the odd bank shot
  } else if (mini.type === 'pool') {
    const cue = mini.balls.cue, R = L.POOL.ballR;
    for (const id of poolMine(p)) {
      if (mini.down[id]) continue;
      const b = mini.balls[id];
      const pockets = L.POOL.pockets.slice().sort((u, v) => Math.hypot(b[0] - u[0], b[1] - u[1]) - Math.hypot(b[0] - v[0], b[1] - v[1])).slice(0, 2);
      for (const pk of pockets) {
        const dx = b[0] - pk[0], dy = b[1] - pk[1], n = Math.hypot(dx, dy) || 1;
        const ghost = [b[0] + (dx / n) * R * 2, b[1] + (dy / n) * R * 2];    // where the cue ball must be to send it pocketwards
        const a = aimTo(cue, ghost);
        for (const pw of [0.3, 0.45, 0.65]) out.push({ aim: a, power: pw });
        out.push({ aim: a + 0.03, power: 0.5 }, { aim: a - 0.03, power: 0.5 });
      }
    }
    for (let k = 0; k < 3; k++) out.push({ aim: (rng() - 0.5) * 2.4, power: 0.25 + rng() * 0.3 });   // a soft safety
  } else {
    const from = L.BOWL.start, head = L.BOWL.pins[0], a = aimTo(from, head);
    for (const da of [-0.07, -0.045, -0.025, 0, 0.025, 0.045, 0.07]) out.push({ aim: a + da, power: 0.9 });
    out.push({ aim: a + 0.01, power: 0.75 }, { aim: a - 0.01, power: 0.75 });
  }
  return out.map(s => ({ aim: wrapAim(s.aim), power: Math.max(0.05, Math.min(1, s.power)) }));
}
// The computer's shot: the best of its candidates, then a little error so it is not perfect.
function physAi(mini, p, rng) {
  const err = mini.type === 'golf' ? GOLF.aiErr : mini.type === 'pool' ? POOLG.aiErr : BOWLG.aiErr;
  let best = null;
  for (const c of physCandidates(mini, p, rng)) {
    const r = physRun(mini, p, c);
    if (!r) continue;
    const s = physScore(mini, p, r);
    if (!best || s > best.s) best = { c, s, r };
  }
  if (!best) return { move: randomLegalMove(mini, p, rng), q: 0 };
  const g = () => gaussOf(rng);
  const move = { aim: wrapAim(best.c.aim + g() * err[0]), power: Math.max(0.05, Math.min(1, best.c.power + g() * err[1])) };
  const q = mini.type === 'golf' ? (best.s >= 1000 ? 0.75 : 0.03) : mini.type === 'pool' ? (best.s >= 500 ? 0.55 : best.s >= 100 ? 0.35 : 0.02) : Math.min(0.9, best.s / 100);
  return { move: physShot(move), q };
}
// A random gentle shot: for a player who ran out of time.
function physRandom(mini, p, rng) {
  const L = PHYSICS.lib;
  if (mini.type === 'golf') {                                 // roughly towards the next point of the hole's path, at a power to suit the distance
    const hole = L.HOLES[mini.hole], from = mini.balls[p], to = hole.path[golfNext(hole, from)], d = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return physShot({ aim: wrapAim(aimTo(from, to) + (rng() - 0.5) * 0.7), power: Math.max(0.2, Math.min(0.6, (0.08 + d / 120) * (0.7 + rng() * 0.5))) });
  }
  if (mini.type === 'pool') { const ids = poolMine(p).filter(id => !mini.down[id]); const to = ids.length ? mini.balls[ids[randInt(rng, ids.length)]] : L.POOL.start.black; return physShot({ aim: wrapAim(aimTo(mini.balls.cue, to) + (rng() - 0.5) * 0.6), power: 0.25 + rng() * 0.25 }); }
  return physShot({ aim: (rng() - 0.5) * 0.2, power: 0.5 + rng() * 0.25 });
}
// How many moves the computer reckons it needs in a physics square (for its choice of square).
function physNeeds(mini, p) {
  if (mini.type === 'golf') { if (mini.holed[p]) return 0; return Math.max(1, 1 + golfLeft(PHYSICS.lib.HOLES[mini.hole], mini.balls[p]) / 60); }
  if (mini.type === 'pool') return Math.max(1, (POOLG.goal - mini.pocketed[p]) * 2);
  return Math.max(1, (BOWLG.goal - mini.pins[p]) / 6.5);
}

function newMini(type, rng) {
  switch (type) {
    case 'ttt':         return { type, cells: new Array(9).fill(null), last: null };
    case 'c4':          return { type, cells: new Array(C4.cols * C4.rows).fill(null), last: null };
    case 'bs':          { const ship = bsShip(rng); return { type, len: ship.length, ship, revealed: new Array(BS.n * BS.n).fill(null), hits: [], last: null }; }   // revealed: who fired at each cell; hits: the cells that hit
    case 'wordle':      return { type, word: WORDS5[randInt(rng, WORDS5.length)].toUpperCase(), guesses: [] };
    case 'hangman':     return { type, word: WORDS_HANG[randInt(rng, WORDS_HANG.length)].toUpperCase(), letters: [] };
    case 'hex':         return { type, cells: new Array(HEX_N * HEX_N).fill(null), last: null };
    case 'hilo':        return { type, target: HILO.lo + randInt(rng, HILO.hi - HILO.lo + 1), lo: HILO.lo, hi: HILO.hi, guesses: [] };
    case 'dice':        return { type, totals: { X: 0, O: 0 }, last: null };
    case 'snakes':      { const b = snlBoard(rng); return { type, ladders: b.ladders, snakes: b.snakes, pos: { X: 0, O: 0 }, last: null }; }   // pos 0: not on the board yet
    case 'bump':        return { type, pos: { X: 0, O: 0 }, last: null };   // 0 is Home, 10 the Finish
    case 'memory':      return { type, cards: memoryDeck(rng), flips: 0, seen: [], last: null };   // seen: cards shown so far
    case 'candy':       return { type, track: candyTrack(rng), pos: { X: -1, O: -1 }, last: null };
    case 'coins':       return { type, coins: shuffle(['X', 'X', 'O', 'O', COINS.mystery], rng), last: null };
    case 'pig':         return { type, bank: { X: 0, O: 0 }, turn: null, last: null };   // turn = the push-your-luck turn in progress
    case 'hunt':        return { type, treasure: randInt(rng, HUNT.n * HUNT.n), dug: new Array(HUNT.n * HUNT.n).fill(null), last: null };
    case 'hexapawn':    return { type, cells: ['O', 'O', 'O', null, null, null, null, null, null, 'X', 'X', 'X'], last: null };
    case 'mastermind':  return { type, code: mmCode(rng), guesses: [] };
    case 'bj':          return { type, wins: { X: 0, O: 0 }, hand: null, hole: null, deck: null, last: null };   // hand: the hand being played; hole and deck: hidden
    case 'bus':         return { type, prog: { X: [], O: [] }, last: null };   // prog: each player's kept cards, one per round passed
    case 'rl':          return { type, hits: { X: 0, O: 0 }, spins: [], last: null };
    case 'bullseye':    { const cfg = bullsConfig(); return { type, cfg, pts: { X: 0, O: 0 }, speed: { X: 1, O: 1 }, pos: bullsSpot(cfg, null, needRng(rng)), last: null }; }   // cfg: as dealt; pos: the board's middle
    case 'echo':        return { type, level: { X: 0, O: 0 }, seqs: { X: echoSeqs(needRng(rng)), O: echoSeqs(needRng(rng)) }, last: null };
    case 'plinko':      return { type, win: randInt(needRng(rng), PLINKO.slots), last: null };
    case 'pong':        return { type, cups: { X: [true, true, true], O: [true, true, true] }, last: null };
    case 'trivia':      return { type, right: { X: 0, O: 0 }, ask: null, answer: null, crossed: [], asked: [], last: null };   // ask: the square's question; answer: the right option's place (hidden online); crossed: the places picked wrong; asked: the ids answered here
    case 'golf': {                                            // a hole from the six; both balls side by side on the tee
      const L = PHYSICS.lib, hole = randInt(needRng(rng), L ? L.HOLES.length : 6), tee = L ? L.HOLES[hole].tee : [50, 140];
      return { type, hole, balls: { X: [tee[0] - 3, tee[1]], O: [tee[0] + 3, tee[1]] }, holed: { X: false, O: false }, shots: { X: 0, O: 0 }, last: null };
    }
    case 'pool': {                                            // the fixed layout: the cue ball, two of each colour, the black
      const L = PHYSICS.lib, st = L ? L.POOL.start : { cue: [50, 140], black: [50, 52], x1: [40, 66], x2: [60, 80], o1: [60, 66], o2: [40, 80] };
      return { type, balls: Object.fromEntries(POOLG.order.map(id => [id, st[id].slice()])), down: {}, pocketed: { X: 0, O: 0 }, last: null };
    }
    case 'bowling':     return { type, pins: { X: 0, O: 0 }, rolls: { X: 0, O: 0 }, last: null };
    case 'craps':       return { type, wins: { X: 0, O: 0 }, rounds: { X: 0, O: 0 }, last: null };
    case 'takeover':    return { type, cells: new Array(TAKE.n * TAKE.n).fill(null), last: null };
    case 'seating': { const r = needRng(rng); return { type, color: Array.from({ length: SEAT.tables * 2 }, () => randInt(r, SEAT.colors)), who: new Array(SEAT.tables * 2).fill(null), next: randInt(r, SEAT.colors), last: null }; }   // next: the next customer's colour, shown
    case 'districts': { const map = distMap(needRng(rng)); return { type, map, who: new Array(map.spots.length).fill(null), last: null }; }
    case 'shelves':     return { type, cells: new Array(SHELF.n * SHELF.per).fill(null), last: null };
    case 'roads':       return { type, segs: new Array(ROAD_SEGS.length).fill(null), last: null };
    case 'flood': {                                           // five colours at random; the start cell's neighbours never its colour (the blob starts as one cell)
      const r = needRng(rng), N = FLOOD.n * FLOOD.n, colors = Array.from({ length: N }, () => randInt(r, FLOOD.colors));
      for (const k of floodNear(0)) while (colors[k] === colors[0]) colors[k] = randInt(r, FLOOD.colors);
      const owner = new Array(N).fill(null); owner[0] = '-';      // '-': the blob's start, nobody's
      return { type, colors, owner, score: { X: 0, O: 0 }, last: null };
    }   // a fresh rack every roll; the totals are what count
    case 'dash': case 'lane': return { type, cfg: runConfig(type), seed: { X: randInt(needRng(rng), 1e9), O: randInt(rng, 1e9) }, dist: { X: 0, O: 0 }, runs: { X: 0, O: 0 }, crashes: { X: [], O: [] }, last: null };   // cfg: the difficulty this square was dealt with; seed: each player's course
    case 'oddone': {
      const gx = oddGrid(0, needRng(rng)), go = oddGrid(0, rng);
      return { type, finds: { X: 0, O: 0 }, grid: { X: gx.grid, O: go.grid }, pos: { X: gx.pos, O: go.pos }, last: null };   // pos: the odd tile's place (hidden online)
    }
  }
  throw new Error('unknown mini-game: ' + type);
}
function pickType(games, rng) { return games[randInt(rng, games.length)]; }
function newSquare(games, rng) { return { owner: null, mini: newMini(pickType(games, rng), rng) }; }
const CPU_NAME = 'Computer';
function defaultSetup() {
  const games = {};
  for (const t of TYPES) games[t] = true;
  return { names: { X: 'X', O: 'O' }, games, mode: 'two', human: 'X', timer: 0, players: { X: 'human', O: 'human' } };   // players: who plays each side locally   // mode: 'two' players, 'cpu' or 'online'; human: the side a person plays; timer: seconds per online turn, 0 = no limit
}
// The side(s) the computer plays in a local match: 'X', 'O', 'XO' (it plays both and a person watches) or null.
function cpuSide(setup) {
  if (!setup || setup.mode === 'online') return null;
  if (setup.players) return ['X', 'O'].filter(p => setup.players[p] === 'cpu').join('') || null;
  return setup.mode === 'cpu' ? other(setup.human === 'O' ? 'O' : 'X') : null;   // a setup from before the Human/Computer slots
}
// Older setups said "vs Computer, you play X"; now each side is a Human or Computer slot.
function normSetup(setup) {
  if (!setup.players || typeof setup.players !== 'object') {
    const cpu = setup.mode === 'cpu' ? other(setup.human === 'O' ? 'O' : 'X') : null;
    setup.players = { X: cpu === 'X' ? 'cpu' : 'human', O: cpu === 'O' ? 'cpu' : 'human' };
  }
  for (const p of ['X', 'O']) if (setup.players[p] !== 'cpu') setup.players[p] = 'human';
  if (setup.mode === 'cpu') setup.mode = 'two';
  return setup;
}
// Keep the computer's default name in step with the mode and side: the computer's side is called
// "Computer" unless someone typed a name for it, and a side that stops being the computer drops it.
function syncNames(setup) {
  const cpu = cpuSide(setup) || '';
  for (const p of ['X', 'O']) {
    const n = String(setup.names[p] || '').trim();
    if (cpu.includes(p)) { if (!n || n === p) setup.names[p] = CPU_NAME; }
    else if (n === CPU_NAME) setup.names[p] = p;
  }
}
// Play Local: player 1 is always a person, who picks X, O or Random; player 2 is a person or the
// computer and takes the other side. Kept as setup.local { pick, p2, n1, n2 }; an older setup (a
// Human or Computer on each side) is read into it, with the computer, if any, as player 2.
function normLocal(setup) {
  let L = setup.local;
  if (!L || typeof L !== 'object') {
    const pl = setup.players || {}, nm = setup.names || {};
    const s1 = pl.X === 'cpu' && pl.O !== 'cpu' ? 'O' : 'X', s2 = other(s1);
    const keep = (n, p) => { n = String(n || '').trim(); return n === p || n === CPU_NAME ? '' : n.slice(0, NAME_MAX); };
    L = { pick: s1, p2: pl[s2] === 'cpu' ? 'cpu' : 'human', n1: keep(nm[s1], s1), n2: keep(nm[s2], s2) };
  }
  setup.local = {
    pick: ['X', 'O', 'random'].includes(L.pick) ? L.pick : 'X', p2: L.p2 === 'cpu' ? 'cpu' : 'human',
    n1: String(L.n1 || '').slice(0, NAME_MAX), n2: String(L.n2 || '').slice(0, NAME_MAX),
  };
  return setup.local;
}
// Seat the two players for the next local match (Random is drawn again every time): the sides, who
// plays them and their names (a blank name is the side's letter; the computer's is Computer).
function seatLocal(setup, rng) {
  const L = normLocal(setup);
  const s1 = L.pick === 'random' ? (randInt(needRng(rng), 2) ? 'O' : 'X') : L.pick, s2 = other(s1);
  setup.mode = 'two'; setup.human = s1;
  setup.players = { X: 'human', O: 'human' }; setup.players[s2] = L.p2;
  setup.names = { X: 'X', O: 'O' };
  setup.names[s1] = L.n1.trim() || s1;
  setup.names[s2] = L.n2.trim() || (L.p2 === 'cpu' ? CPU_NAME : s2);
  return s1;
}
function enabledGames(setup) { return TYPES.filter(t => setup && setup.games && setup.games[t]); }
const TIMER_OPTIONS = [0, 60];   // seconds per turn in a friend game: no limit or 1 minute (Find Match is always 1 minute)
// A time per turn from an older room or setup (30 seconds or 3 minutes) becomes 1 minute; anything else, no limit.
function normTimer(v) { return TIMER_OPTIONS.includes(v) ? v : [30, 180].includes(v) ? 60 : 0; }
function newTimer(limit) { return { limit: limit || 0, deadline: null, for: null, pausedAt: null, timeouts: { X: 0, O: 0 }, streak: { X: 0, O: 0 }, bankNext: false }; }
function playerName(state, p) { return (state.setup && state.setup.names && state.setup.names[p]) || p; }
// The whole app state. It opens on the setup screen; startMatch turns it into a match.
function newState(rng) {
  rng = needRng(rng);
  return {
    v: 4,
    screen: 'menu',           // 'menu' | 'setup' | 'board' | 'mini' | 'win'
    setup: defaultSetup(),    // player names and the mini-games allowed; kept from match to match
    games: TYPES.slice(),     // the mini-games the current match draws from (squares and resets)
    turn: 'X',
    cpu: null,                // the side(s) the computer plays in this match: 'X', 'O', 'XO', or null for two people
    endPick: null,            // the match-end message picked for this match (so it does not change on screen)
    online: null,             // { role: 'host' | 'guest', code, me, name, joined } while playing over the network
    timer: newTimer(0),       // the online turn clock: limit in seconds (0 = none), deadline, timeouts per player
    spot: null,               // { square, by, label }: the square the other player is about to play in, shown before the zoom
    squares: Array.from({ length: 9 }, () => newSquare(TYPES, rng)),
    zoom: null,               // index of the mini-game being viewed
    flash: null,              // the move just made: its result, while the animation and toast play
    done: null,               // the move just made, kept on show until the player heads back to the board (that is when the turn passes)
    stamp: null,              // square whose owner's mark stamps in on the board (just claimed)
    lock: null,               // square the current player must keep playing (Hangman bonus guess, Risky Rolls turn)
    draft: '',                // letters typed so far (Wordle)
    pick: null,               // first card chosen (Memory)
    pickSq: null,             // ...and the square it belongs to
    sel: [],                  // coins chosen so far (Coin flip)
    confirm: null,            // 'new' while the "abandon this match?" card is up
    notice: null,             // short message over the Wordle keyboard ("Not a word")
    winner: null, winLine: null, winReason: null, counts: null,
    lastSquare: null, lastBy: null, moves: 0,
    sqlog: [],                // every mini-game that ended this match: { t: type, end: 'won' | 'draw', w: winner, X, O: turns each side spent in it }
  };
}
// Start a match from the setup screen: tidy the names, draw nine squares from the ticked games.
// Returns false (and changes nothing) when no mini-game is ticked.
// A game that can be dealt right now: Trivia only once its questions are in (trivia.json: the page
// fetches it, the server has it as a file); without them a Trivia square could never be played.
const dealable = t => (t === 'trivia' ? triviaReady() : PHYS_TYPES.includes(t) ? physicsReady() : true);
function startMatch(state, rng) {
  rng = needRng(rng);
  const games = enabledGames(state.setup).filter(dealable);
  if (!games.length) return false;
  syncNames(state.setup);
  for (const p of ['X', 'O']) {
    const n = String(state.setup.names[p] || '').trim().slice(0, NAME_MAX);
    state.setup.names[p] = n || p;
  }
  state.games = games;
  normSetup(state.setup);
  state.cpu = cpuSide(state.setup);
  state.endPick = null;                                       // the match-end message is picked afresh
  state.timer = newTimer(state.setup.mode === 'online' ? normTimer(state.setup.timer) : 0);
  state.spot = null;
  state.squares = Array.from({ length: 9 }, () => newSquare(games, rng));
  for (const sq of state.squares) if (sq.mini.type === 'trivia') triviaDeal(state, sq, rng);   // a question each, no two squares alike
  state.screen = 'board'; state.turn = 'X';
  state.zoom = null; state.flash = null; state.done = null; state.stamp = null; state.lock = null;
  state.draft = ''; state.pick = null; state.pickSq = null; state.sel = []; state.confirm = null; state.notice = null;
  state.winner = null; state.winLine = null; state.winReason = null; state.counts = null;
  state.lastSquare = null; state.lastBy = null; state.moves = 0; state.sqlog = [];
  markCoins(state, 'X', rng);
  return true;
}
// A started match in one call. setup may carry names and games (a map, or an array of the ticked types).
function newMatch(rng, setup) {
  const st = newState(rng);
  if (setup && setup.names) Object.assign(st.setup.names, setup.names);
  if (setup && setup.mode) st.setup.mode = setup.mode;
  if (setup && setup.human) st.setup.human = setup.human;
  if (setup && setup.players) st.setup.players = Object.assign({}, setup.players);
  else if (setup && setup.mode === 'cpu') st.setup.players = null;   // the older "vs Computer" form: normSetup reads it
  normSetup(st.setup);
  if (setup && setup.timer != null) st.setup.timer = setup.timer;
  if (setup && Array.isArray(setup.games)) for (const t of TYPES) st.setup.games[t] = setup.games.includes(t);
  else if (setup && setup.games) Object.assign(st.setup.games, setup.games);
  startMatch(st, rng);
  return st;
}

// K in a row for player p on a W x H grid: returns the winning cell indexes, or null.
function findRun(cells, W, H, K, p) {
  const dirs = [[1, 0], [0, 1], [1, 1], [-1, 1]]; // [dc, dr]: right, down, down-right, down-left
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (cells[r * W + c] !== p) continue;
      for (const [dc, dr] of dirs) {
        const run = [r * W + c];
        for (let k = 1; k < K; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= H || cc < 0 || cc >= W || cells[rr * W + cc] !== p) break;
          run.push(rr * W + cc);
        }
        if (run.length === K) return run;
      }
    }
  }
  return null;
}

// One move by player p in a mini-game. Mutates mini.
// Returns { ok:false, reason } or { ok:true, outcome:'win'|'draw'|'continue', cells?, note?, again? }.
// again = the same player moves again at once (Hangman after a correct letter).
function applyMove(mini, p, m, rng) {
  const idx = (max) => Number.isInteger(m) && m >= 0 && m < max;
  switch (mini.type) {
    case 'ttt': {
      if (!idx(9)) return { ok: false, reason: 'bad' };
      if (mini.cells[m]) return { ok: false, reason: 'taken' };
      mini.cells[m] = p; mini.last = m;
      const run = findRun(mini.cells, 3, 3, 3, p);
      if (run) return { ok: true, outcome: 'win', cells: run };
      if (mini.cells.every(Boolean)) return { ok: true, outcome: 'draw' };
      if (!tttOpen(mini.cells, 'X') && !tttOpen(mini.cells, 'O')) return { ok: true, outcome: 'draw', note: 'blocked' };   // nobody can make three in a row now: a draw, as if the board were full
      return { ok: true, outcome: 'continue' };
    }
    case 'c4': {
      if (!idx(C4.cols)) return { ok: false, reason: 'bad' };
      let at = -1;
      for (let r = C4.rows - 1; r >= 0; r--) {
        if (!mini.cells[r * C4.cols + m]) { at = r * C4.cols + m; break; }
      }
      if (at < 0) return { ok: false, reason: 'full' };
      mini.cells[at] = p; mini.last = at;
      const run = findRun(mini.cells, C4.cols, C4.rows, C4.k, p);
      if (run) return { ok: true, outcome: 'win', cells: run };
      if (mini.cells.every(Boolean)) return { ok: true, outcome: 'draw' };
      return { ok: true, outcome: 'continue' };
    }
    case 'bs': {
      // One shot at one cell. A hit or a miss is shown; the ship's direction never is. A hit that does not
      // sink it fires again at once (the turn goes on until a miss or the sinking shot); the shot that
      // hits its last cell sinks it and claims the square.
      if (!idx(BS.n * BS.n)) return { ok: false, reason: 'bad' };
      if (mini.revealed[m]) return { ok: false, reason: 'taken' };
      mini.revealed[m] = p; mini.last = m;
      if (!mini.ship.includes(m)) return { ok: true, outcome: 'continue', note: 'miss' };
      mini.hits.push(m);
      if (mini.ship.every(k => mini.hits.includes(k))) return { ok: true, outcome: 'win', cells: mini.ship.slice(), note: 'sunk' };
      return { ok: true, outcome: 'continue', note: 'hit', again: true };
    }
    case 'wordle': {
      const g = typeof m === 'string' ? m.toUpperCase() : '';
      if (!/^[A-Z]{5}$/.test(g)) return { ok: false, reason: 'bad' };
      if (!VALID5.has(g)) return { ok: false, reason: 'notword' };     // a non-word costs nothing
      mini.guesses.push({ by: p, word: g, marks: wordleMarks(g, mini.word) });
      if (g === mini.word) return { ok: true, outcome: 'win' };
      return { ok: true, outcome: 'continue', note: 'guess' };
    }
    case 'hangman': {
      const l = typeof m === 'string' ? m.toUpperCase() : '';
      if (!/^[A-Z]$/.test(l)) return { ok: false, reason: 'bad' };
      if (mini.letters.some(x => x.l === l)) return { ok: false, reason: 'taken' };
      const hit = mini.word.includes(l);
      mini.letters.push({ l, by: p, hit });
      if (!hit) return { ok: true, outcome: 'continue', note: 'miss' };
      const done = mini.word.split('').every(ch => mini.letters.some(x => x.l === ch));
      if (done) return { ok: true, outcome: 'win' };
      return { ok: true, outcome: 'continue', note: 'hit', again: true };
    }
    case 'hex': {
      if (!idx(HEX_N * HEX_N)) return { ok: false, reason: 'bad' };
      if (mini.cells[m]) return { ok: false, reason: 'taken' };
      mini.cells[m] = p; mini.last = m;
      const path = hexPath(mini.cells, p);
      if (path) return { ok: true, outcome: 'win', cells: path };
      if (mini.cells.every(Boolean)) return { ok: true, outcome: 'draw' };   // cannot happen in Hex; kept for safety
      return { ok: true, outcome: 'continue' };
    }
    case 'hilo': {
      if (!Number.isInteger(m) || m < mini.lo || m > mini.hi) return { ok: false, reason: 'bad' };
      if (m === mini.target) { mini.guesses.push({ by: p, n: m, res: 'hit' }); return { ok: true, outcome: 'win' }; }
      const res = m < mini.target ? 'higher' : 'lower';
      mini.guesses.push({ by: p, n: m, res });
      if (res === 'higher') mini.lo = m + 1; else mini.hi = m - 1;
      return { ok: true, outcome: 'continue', note: res };
    }
    case 'dice': {
      const roll = 1 + randInt(needRng(rng), 6);
      mini.totals[p] += roll; mini.last = { by: p, roll };
      if (mini.totals[p] >= DICE_GOAL) return { ok: true, outcome: 'win' };
      return { ok: true, outcome: 'continue', note: 'roll' };
    }
    case 'snakes': {
      // One roll: the piece hops that many spaces up, then climbs the ladder or slides down the snake
      // whose start it landed on. Reaching or passing space 20 wins.
      if (m !== 'roll') return { ok: false, reason: 'bad' };
      const roll = 1 + randInt(needRng(rng), 6), from = mini.pos[p], land = Math.min(from + roll, SNL.n);
      const ladder = mini.ladders.find(x => x[0] === land), snake = mini.snakes.find(x => x[0] === land);
      const via = land < SNL.n && ladder ? 'ladder' : land < SNL.n && snake ? 'snake' : null;
      const to = via === 'ladder' ? ladder[1] : via === 'snake' ? snake[1] : land;
      mini.pos[p] = to; mini.last = { by: p, roll, from, land, to, via };
      if (to >= SNL.n) return { ok: true, outcome: 'win' };
      return { ok: true, outcome: 'continue', note: via || 'roll' };
    }
    case 'bump': {
      // One spin of 1, 2 or 3: the piece hops that far. Landing exactly on the other piece sends it
      // back Home. Reaching or passing the Finish wins.
      if (m !== 'spin') return { ok: false, reason: 'bad' };
      const spin = 1 + randInt(needRng(rng), BUMP.max), from = mini.pos[p], fin = BUMP.n + 1, to = Math.min(from + spin, fin), o = other(p);
      const bumped = to < fin && mini.pos[o] === to;
      if (bumped) mini.pos[o] = 0;
      mini.pos[p] = to; mini.last = { by: p, spin, from, to, bumped };
      if (to >= fin) return { ok: true, outcome: 'win' };
      return { ok: true, outcome: 'continue', note: bumped ? 'bump' : 'spin' };
    }
    case 'memory': {
      if (!Array.isArray(m) || m.length !== 2) return { ok: false, reason: 'bad' };
      const [a, b] = m;
      if (![a, b].every(k => Number.isInteger(k) && k >= 0 && k < 9) || a === b) return { ok: false, reason: 'bad' };
      mini.flips += 1; mini.last = { by: p, a, b };
      if (!mini.seen) mini.seen = [];
      for (const k of [a, b]) if (!mini.seen.includes(k)) mini.seen.push(k);
      const ca = mini.cards[a], cb = mini.cards[b];
      if (ca.s === cb.s && ca.c === cb.c) return { ok: true, outcome: 'win', cells: [a, b] };
      return { ok: true, outcome: 'continue', note: 'nomatch' };
    }
    case 'candy': {
      const color = CANDY.colors[randInt(needRng(rng), CANDY.colors.length)];
      const from = mini.pos[p];
      let to = CANDY.len;                                    // the finish, unless a space of that colour is ahead
      for (let i = from + 1; i < CANDY.len; i++) if (mini.track[i] === color) { to = i; break; }
      mini.pos[p] = to; mini.last = { by: p, color, from, to };
      if (to === CANDY.len) return { ok: true, outcome: 'win' };
      return { ok: true, outcome: 'continue', note: 'spin' };
    }
    case 'coins': {
      // One move flips up to three coins that aren't the player's: the other side's and the mystery
      // coin (it belongs to nobody until it lands). All of them when there are three or fewer,
      // otherwise three picked at random. The player's own coins are never flipped. Five the same wins;
      // with no coin of their own a player's flip can even hand the square to the other side.
      // The coins were picked (and marked) as the turn started; a game from before the marks picks now.
      if (m !== 'flip') return { ok: false, reason: 'bad' };
      const r = needRng(rng);
      if (!mini.coins.some(c => c !== p)) return { ok: false, reason: 'none' };
      const picked = coinMarksFor(mini, p) || coinPick(mini, p, r);
      mini.marks = null;
      const was = picked.map(k => mini.coins[k]);
      const results = picked.map(() => (randInt(r, 2) ? 'O' : 'X'));
      picked.forEach((k, j) => { mini.coins[k] = results[j]; });
      mini.last = { by: p, flipped: picked, results, was };
      const sym = mini.coins[0];
      if (sym !== COINS.mystery && mini.coins.every(c => c === sym)) return { ok: true, outcome: 'win', winner: sym, cells: mini.coins.map((c, k) => k) };
      return { ok: true, outcome: 'continue', note: 'flip' };
    }
    case 'pig': {
      // One move is a whole push-your-luck turn: every successful roll hands the same player the
      // next choice (again), and only a bank or a bust ends the move.
      if (m !== 'roll' && m !== 'bank') return { ok: false, reason: 'bad' };
      const t = mini.turn;
      if (t && t.by !== p) return { ok: false, reason: 'busy' };
      if (m === 'bank') {
        if (!t || !t.pot) return { ok: false, reason: 'nopot' };
        mini.bank[p] += t.pot;
        mini.last = { by: p, kind: 'bank', pot: t.pot, rolls: t.rolls, roll: t.rolls[t.rolls.length - 1] };
        mini.turn = null;
        if (mini.bank[p] >= RISKY.goal) return { ok: true, outcome: 'win', note: 'bank' };   // a winning bank is still a bank: the phones show it as one
        return { ok: true, outcome: 'continue', note: 'bank' };
      }
      if (t && t.rolls.length >= RISKY.maxRolls) return { ok: false, reason: 'maxrolls' };   // a seventh roll can only bust
      if (t && mini.bank[p] + t.pot >= RISKY.goal) return { ok: false, reason: 'enough' };   // enough to win: only Bank is left
      const n = 1 + randInt(needRng(rng), 6);
      if (t && t.rolls.includes(n)) {
        mini.last = { by: p, kind: 'bust', roll: n, rolls: t.rolls.concat(n), pot: t.pot };   // the pot is lost, the bank is not
        mini.turn = null;
        return { ok: true, outcome: 'continue', note: 'bust' };
      }
      const rolls = (t ? t.rolls : []).concat(n), pot = (t ? t.pot : 0) + n;
      mini.turn = { by: p, rolls, pot };
      mini.last = { by: p, kind: 'roll', roll: n, rolls, pot };
      return { ok: true, outcome: 'continue', note: 'roll', again: true };
    }
    case 'hunt': {
      if (!idx(mini.dug.length)) return { ok: false, reason: 'bad' };
      if (mini.dug[m]) return { ok: false, reason: 'taken' };
      mini.dug[m] = p; mini.last = m;
      if (m === mini.treasure) return { ok: true, outcome: 'win', cells: [m] };
      return { ok: true, outcome: 'continue', note: 'dig' };
    }
    case 'mastermind': {
      if (!mmValid(m)) return { ok: false, reason: 'bad' };
      const f = mmFeedback(m, mini.code);
      mini.guesses.push({ by: p, code: m.slice(), solid: f.solid, hollow: f.hollow });
      if (f.solid === MM.pegs) return { ok: true, outcome: 'win', cells: [0, 1, 2, 3] };
      return { ok: true, outcome: 'continue', note: 'guess' };
    }
    case 'bj': {
      // A turn is played hand by hand: Deal (or Stand, which deals first), then Hit (again), Stand or Double.
      // A win or a loss ends the turn. A push does not: a new hand is dealt at once, from a reshuffled
      // deck, and the same player plays on. 'auto' (a timed-out turn) stands, dealing first if need be, and
      // stands again on every new hand a push brings, until a hand is won or lost. Only the hand's own
      // player can act in it until the turn is over.
      if (!['deal', 'hit', 'stand', 'double', 'auto'].includes(m)) return { ok: false, reason: 'bad' };
      let h = mini.hand;
      if (h && h.by !== p) return { ok: false, reason: 'busy' };
      if (m === 'deal' && h) return { ok: false, reason: 'dealt' };
      if ((m === 'hit' || m === 'double') && !h) return { ok: false, reason: 'nohand' };
      if (m === 'double' && h.cards.length !== 2) return { ok: false, reason: 'double' };
      mini.pushed = null;                                // the hands this move ended in a push (shown before the new deal)
      const deal = () => {                               // player, dealer up, player, dealer face down; true for a natural
        const deck = shuffle(cardDeck(), needRng(rng));
        const c1 = deck.pop(), up = deck.pop(), c2 = deck.pop(), hole = deck.pop();
        h = mini.hand = { by: p, cards: [c1, c2], up, doubled: false };
        mini.hole = hole; mini.deck = deck;
        return bjNatural(h.cards);
      };
      const settle = (natural) => {                      // the hand is over: the hole card turns, the dealer plays
        const hole = mini.hole, deck = mini.deck || [], hand = mini.hand;
        const bust = bjTotal(hand.cards).total > 21;
        const dealer = natural || bust ? [hand.up, hole] : bjDealerPlay([hand.up, hole], deck);
        const o = bjOutcome(hand.cards, dealer, hand.doubled, natural);
        mini.last = { by: p, cards: hand.cards.slice(), dealer, doubled: !!hand.doubled, res: o.res, gain: o.gain, dealerBj: !!o.dealerBj, natural: !!natural };
        mini.hand = null; mini.hole = null; mini.deck = null;
        if (o.res === 'push') mini.pushed = (mini.pushed || []).concat([mini.last]);
        else mini.wins[p] += o.gain;
        return o.res;
      };
      let res = null;
      if (!h) {
        if (deal()) res = settle(true);                  // a natural: settled at once
        else if (m === 'deal') return { ok: true, outcome: 'continue', note: 'deal', again: true };
      } else if (m === 'hit' || m === 'double') {
        h.cards.push(mini.deck.pop());
        if (m === 'double') h.doubled = true;
        if (m === 'hit' && bjTotal(h.cards).total < 21) return { ok: true, outcome: 'continue', note: 'hit', again: true };
      }
      if (!res) res = settle(false);                     // stand, a double's one card, 21, or a bust
      for (let guard = 0; res === 'push' && guard < 60; guard++) {   // a push: deal again, the turn goes on
        if (deal()) { res = settle(true); continue; }
        if (m !== 'auto') return { ok: true, outcome: 'continue', note: 'push', again: true };
        res = settle(false);
      }
      if (mini.wins[p] >= BJ.goal) return { ok: true, outcome: 'win', note: res };
      return { ok: true, outcome: 'continue', note: res };
    }
    case 'bus': {
      const kept = mini.prog[p], r = kept.length;
      if (r >= BUS.rounds || !BUS.guesses[r].includes(m)) return { ok: false, reason: 'bad' };
      const deck = busDeck(kept), card = deck[randInt(needRng(rng), deck.length)];
      const right = busRight(kept, m, card);
      mini.last = { by: p, round: r, guess: m, card, right };
      if (!right) return { ok: true, outcome: 'continue', note: 'wrong' };   // the card is discarded; the turn ends
      kept.push(card);
      if (kept.length >= BUS.rounds) return { ok: true, outcome: 'win', note: 'right' };
      return { ok: true, outcome: 'continue', note: 'right', again: true };
    }
    case 'rl': {
      const bet = rlBet(m);
      if (!bet) return { ok: false, reason: 'bad' };
      const n = RL.wheel[randInt(needRng(rng), RL.wheel.length)];
      const hit = rlCovers(bet, n);
      if (hit && bet !== 'zero') mini.hits[p] += 1;
      mini.last = { by: p, bet, n, hit };
      mini.spins = (mini.spins || []).concat({ n, by: p, hit }).slice(-6);   // the recent spins, hits and misses alike (the miniature shows them)
      if (hit && bet === 'zero') return { ok: true, outcome: 'win', note: 'zero' };
      if (hit && mini.hits[p] >= RL.goal) return { ok: true, outcome: 'win', note: 'hit' };
      return { ok: true, outcome: 'continue', note: hit ? 'hit' : 'miss' };
    }
    case 'golf': {                                            // a shot: the balls play out; the first in the cup takes the square (even knocked in by the other)
      const shot = physShot(m);
      if (!shot) return { ok: false, reason: 'bad' };
      if (mini.holed[p]) return { ok: false, reason: 'done' };
      const r = physRun(mini, p, shot);
      if (!r) return { ok: false, reason: 'nophys' };
      mini.shots[p] += 1;
      for (const q of ['X', 'O']) if (r.final[q] !== undefined) { if (r.final[q] === null) mini.holed[q] = true; else mini.balls[q] = r.final[q]; }
      mini.last = physLast(p, shot, r, { holed: r.result.holed, first: r.result.first, lip: r.events.some(e => e.k === 'lip') });
      if (r.result.first) return { ok: true, outcome: 'win', note: r.result.first === p ? 'holed' : 'knockedIn', winner: r.result.first };
      return { ok: true, outcome: 'continue', note: mini.last.lip ? 'lip' : 'shot' };
    }
    case 'pool': {                                            // a shot from the cue ball: own ball down, shoot again; theirs counts for them; the black loses; a scratch returns the cue
      const shot = physShot(m);
      if (!shot) return { ok: false, reason: 'bad' };
      const r = physRun(mini, p, shot);
      if (!r) return { ok: false, reason: 'nophys' };
      const o = other(p), pk = r.result.pocketed;
      for (const id of Object.keys(r.final)) { if (r.final[id] === null) mini.down[id] = true; else mini.balls[id] = r.final[id]; }
      const black = pk.includes('black'), scratch = pk.includes('cue'), own = pk.filter(id => poolMine(p).includes(id)).length, theirs = pk.filter(id => poolMine(o).includes(id)).length;
      mini.pocketed[p] += own; mini.pocketed[o] += theirs;
      if (scratch) { delete mini.down.cue; mini.balls.cue = poolSpot(mini); }
      mini.last = physLast(p, shot, r, { pocketed: pk.slice(), black, scratch, own, theirs, cue: mini.balls.cue.slice() });
      if (black) return { ok: true, outcome: 'win', note: 'black', winner: o };
      if (mini.pocketed[p] >= POOLG.goal) return { ok: true, outcome: 'win', note: 'cleared' };
      if (mini.pocketed[o] >= POOLG.goal) return { ok: true, outcome: 'win', note: 'gift', winner: o };
      const again = own > 0 && !theirs && !scratch;
      return Object.assign({ ok: true, outcome: 'continue', note: again ? 'again' : scratch ? 'scratch' : theirs ? 'theirs' : own ? 'own' : 'shot' }, again ? { again: true } : {});
    }
    case 'craps': {                                           // a whole pass-line round: rolled until it is won or lost
      if (m !== 'roll' && m !== 'auto') return { ok: false, reason: 'bad' };
      const r = crapsRound(needRng(rng));
      mini.rounds[p] += 1;
      if (r.result === 'win') mini.wins[p] += 1;
      mini.last = { by: p, rolls: r.rolls, point: r.point, result: r.result };
      if (mini.wins[p] >= CRAPS.goal) return { ok: true, outcome: 'win', note: 'won' };
      return { ok: true, outcome: 'continue', note: r.result === 'win' ? 'won' : 'lost' };
    }
    case 'seating': {                                         // a seat; then the customer sits; five tables, or most once the room is full
      if (!Number.isInteger(m) || m < 0 || m >= mini.who.length || mini.who[m]) return { ok: false, reason: 'bad' };
      const r = needRng(rng), o = other(p), zColor = mini.next;
      mini.who[m] = p;
      const z = seatZ(mini, r);
      if (mini.who.includes(null)) mini.next = randInt(r, SEAT.colors);
      const done = mini.who[seatMate(m)] === p ? seatTable(m) : null;
      mini.last = { by: p, seat: m, z, zColor, table: done, next: mini.next };
      const mt = seatTables(mini.who, p), ot = seatTables(mini.who, o);
      if (mt >= SEAT.goal) return { ok: true, outcome: 'win', note: 'tables', counts: { [p]: mt, [o]: ot } };
      if (mini.who.includes(null)) return { ok: true, outcome: 'continue', note: done != null ? 'table' : 'seat' };
      if (mt === ot) return { ok: true, outcome: 'draw', note: 'tie' };
      return { ok: true, outcome: 'win', note: 'full', winner: mt > ot ? p : o, counts: { [p]: mt, [o]: ot } };
    }
    case 'districts': {                                       // a spot; once the map is full, most regions led
      if (!Number.isInteger(m) || m < 0 || m >= mini.who.length || mini.who[m]) return { ok: false, reason: 'bad' };
      mini.who[m] = p;
      mini.last = { by: p, spot: m };
      if (mini.who.includes(null)) return { ok: true, outcome: 'continue', note: 'place' };
      const t = distTally(mini.map, mini.who), x = t.lead.filter(w => w === 'X').length, y = t.lead.filter(w => w === 'O').length;
      return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
    }
    case 'shelves': {                                         // a spot; then a grey mark on a random open one; once full, most shelves
      if (!Number.isInteger(m) || m < 0 || m >= mini.cells.length || mini.cells[m]) return { ok: false, reason: 'bad' };
      mini.cells[m] = p;
      const g = randomEmpty(mini.cells, needRng(rng));
      if (g != null) mini.cells[g] = 'G';
      mini.last = { by: p, at: m, grey: g };
      if (mini.cells.includes(null)) return { ok: true, outcome: 'continue', note: 'mark' };
      const x = shelfOn(mini.cells, 'X'), y = shelfOn(mini.cells, 'O');
      if (x === y) return { ok: true, outcome: 'draw', note: 'tie' };
      return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
    }
    case 'roads': {                                           // a line; then a random open line is blocked; once none is open, the longest road
      if (!Number.isInteger(m) || m < 0 || m >= mini.segs.length || mini.segs[m]) return { ok: false, reason: 'bad' };
      mini.segs[m] = p;
      const b = randomEmpty(mini.segs, needRng(rng));
      if (b != null) mini.segs[b] = 'B';
      mini.last = { by: p, seg: m, block: b };
      if (mini.segs.includes(null)) return { ok: true, outcome: 'continue', note: 'road' };
      const x = roadLongest(mini.segs, 'X').len, y = roadLongest(mini.segs, 'O').len;
      if (x === y) return { ok: true, outcome: 'draw', note: 'tie' };
      return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
    }
    case 'takeover': {                                        // an empty cell, and the cells around it, the other player's too
      if (!Number.isInteger(m) || m < 0 || m >= mini.cells.length || mini.cells[m]) return { ok: false, reason: 'bad' };
      const o = other(p), took = [], flipped = [];
      for (const k of takeNear(m)) { if (mini.cells[k] === o) flipped.push(k); else if (!mini.cells[k]) took.push(k); mini.cells[k] = p; }
      mini.last = { by: p, at: m, took, flipped };
      if (mini.cells.includes(null)) return { ok: true, outcome: 'continue', note: flipped.length ? 'flip' : 'take' };
      const x = takeCount(mini.cells, 'X'), y = takeCount(mini.cells, 'O');
      return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
    }
    case 'flood': {                                           // a colour other than the blob's: the blob takes it and grows
      if (!Number.isInteger(m) || m < 0 || m >= FLOOD.colors || m === mini.colors[0]) return { ok: false, reason: 'bad' };
      const before = mini.colors[0], a = floodApply(mini, m, p);
      mini.colors = a.colors; mini.owner = a.owner; mini.score = a.score;
      mini.last = { by: p, color: m, from: before, waves: a.waves, gain: a.waves.reduce((t, w) => t + w.length, 0) };
      if (mini.score[p] >= FLOOD.goal) return { ok: true, outcome: 'win', note: 'flood' };
      return { ok: true, outcome: 'continue', note: mini.last.gain ? 'grow' : 'none' };
    }
    case 'bowling': {                                         // a roll at a fresh rack: the pins down go on the total; 25 takes the square
      const shot = physShot(m);
      if (!shot) return { ok: false, reason: 'bad' };
      const r = physRun(mini, p, shot);
      if (!r) return { ok: false, reason: 'nophys' };
      const n = r.result.knocked;
      mini.pins[p] += n; mini.rolls[p] += 1;
      mini.last = physLast(p, shot, r, { knocked: n, down: r.result.down.slice(), gutter: r.result.gutter, strike: n === BOWLG.rack });
      if (mini.pins[p] >= BOWLG.goal) return { ok: true, outcome: 'win', note: 'pins' };
      return { ok: true, outcome: 'continue', note: n === BOWLG.rack ? 'strike' : r.result.gutter ? 'gutter' : 'roll' };
    }
    case 'dash': case 'lane': {                               // a run: its end and its time, checked against the course
      const mv = m === 'auto' ? runAuto(mini, p, needRng(rng)) : m;
      const why = runCheck(mini, p, mv);
      if (why) return { ok: false, reason: why };
      const from = mini.dist[p], to = Math.min(mini.cfg.target, r2(Number(mv.dist))), done = to >= mini.cfg.target;
      mini.dist[p] = to; mini.runs[p] += 1;
      if (!done) mini.crashes[p] = (mini.crashes[p] || []).concat(Math.round(to)).slice(-RUN.maxCrashes);
      mini.last = { by: p, from, to, ms: Math.round(Number(mv.ms)), out: !!mv.out && !done, done };
      if (done) return { ok: true, outcome: 'win', note: 'finish' };
      return { ok: true, outcome: 'continue', note: mv.out ? 'out' : 'crash' };
    }
    case 'bullseye': {                                        // where the two lines stopped: scored against the board where it is; then the board moves on
      const x = m && typeof m === 'object' ? Number(m.x) : NaN, y = m && typeof m === 'object' ? Number(m.y) : NaN;
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return { ok: false, reason: 'bad' };
      const cfg = mini.cfg, pos = mini.pos, sc = bullsScore(cfg, pos, x, y);
      mini.pts[p] += sc.pts;
      if (sc.pts) mini.speed[p] = r3(mini.speed[p] * cfg.ramp);
      mini.last = { by: p, x: r3(x), y: r3(y), at: sc.at, d: sc.d, pts: sc.pts, pos: pos.slice() };
      mini.pos = bullsSpot(cfg, pos, needRng(rng));
      if (mini.pts[p] >= BULLS.goal) return { ok: true, outcome: 'win', note: sc.pts === BULLS.bullPts ? 'bull' : 'board' };
      return { ok: true, outcome: 'continue', note: sc.pts === BULLS.bullPts ? 'bull' : sc.pts ? 'board' : 'miss' };
    }
    case 'echo': {
      const lvl = mini.level[p];
      if (lvl >= ECHO.lengths.length) return { ok: false, reason: 'done' };
      const seq = mini.seqs[p][lvl];
      let taps;
      if (m === 'auto') taps = [];
      else if (Array.isArray(m) && m.length <= seq.length && m.every(k => Number.isInteger(k) && k >= 0 && k < ECHO.pads)) taps = m.slice();
      else return { ok: false, reason: 'bad' };
      let failAt = -1;
      for (let k = 0; k < seq.length; k++) if (taps[k] !== seq[k]) { failAt = k; break; }
      const pass = failAt < 0;
      if (pass) mini.level[p] += 1;
      mini.last = { by: p, level: lvl, taps, pass, failAt, len: seq.length };
      if (mini.level[p] >= ECHO.lengths.length) return { ok: true, outcome: 'win', note: 'pass' };
      return { ok: true, outcome: 'continue', note: pass ? 'pass' : 'fail' };
    }
    case 'plinko': {
      if (!idx(PLINKO.slots)) return { ok: false, reason: 'bad' };
      const { path, bin } = plinkoPath(m, needRng(rng));
      const won = bin === mini.win;
      mini.last = { by: p, slot: m, path, bin, win: won };
      if (won) return { ok: true, outcome: 'win', note: 'win' };
      return { ok: true, outcome: 'continue', note: 'miss' };
    }
    case 'pong': {
      let aim, power;
      if (m === 'auto') { aim = rng() * 2 - 1; power = rng(); }
      else if (m && typeof m === 'object' && Number.isFinite(m.aim) && Number.isFinite(m.power)) { aim = Math.max(-1, Math.min(1, m.aim)); power = Math.max(0, Math.min(1, m.power)); }
      else return { ok: false, reason: 'bad' };
      const t = pongThrow(mini.cups[p], aim, power, needRng(rng));
      if (t.sunk) mini.cups[p][t.cup] = false;
      mini.last = { by: p, aim, power, x: Math.round(t.x * 1000) / 1000 + 0, y: Math.round(t.y * 1000) / 1000 + 0, cup: t.cup, rim: t.rim, sunk: t.sunk };   // (+ 0: never a -0, which is not plain JSON)
      if (mini.cups[p].every(c => !c)) return { ok: true, outcome: 'win', note: 'sunk' };
      return { ok: true, outcome: 'continue', note: t.sunk ? 'sunk' : t.rim ? 'rim' : 'miss' };
    }
    case 'trivia': {                                          // the square's question: a wrong pick is crossed out and it stays; the right one scores and a new one comes
      const ask = mini.ask;
      if (!ask || !ask.q) return { ok: false, reason: 'noquestion' };
      const right = mini.answer;
      if (!Number.isInteger(right)) return { ok: false, reason: 'secret' };   // (a phone without the answer: the server judges)
      const crossed = Array.isArray(mini.crossed) ? mini.crossed.slice() : [];
      let picked, auto = false;
      if (m === 'auto') {                                     // the turn's time ran out: one wrong pick, an option still standing crossed out at random
        const wrong = ask.opts.map((_, k) => k).filter(k => k !== right && !crossed.includes(k));
        picked = wrong.length ? wrong[randInt(needRng(rng), wrong.length)] : -1; auto = true;
      } else if (Number.isInteger(m) && m >= 0 && m < ask.opts.length && !crossed.includes(m)) picked = m;
      else return { ok: false, reason: Number.isInteger(m) && crossed.includes(m) ? 'crossed' : 'bad' };
      const correct = picked === right;
      mini.last = Object.assign({ by: p, id: ask.id, q: ask.q, cat: ask.cat, opts: ask.opts.slice(), crossed, picked, correct }, correct ? { right } : {}, auto ? { auto: true } : {});   // (a wrong pick never carries the right answer)
      if (!correct) {
        if (picked >= 0) mini.crossed = crossed.concat(picked);
        return { ok: true, outcome: 'continue', note: 'wrong' };
      }
      mini.right[p] += 1;
      mini.asked = (mini.asked || []).concat(ask.id);
      mini.ask = null; mini.answer = null; mini.crossed = [];  // the next question is dealt by playMove, from the whole match's unasked ones
      if (mini.right[p] >= TRIVIA.goal) return { ok: true, outcome: 'win', note: 'right' };
      return { ok: true, outcome: 'continue', note: 'right' };
    }
    case 'oddone': {
      const grid = mini.grid[p], pos = mini.pos ? mini.pos[p] : null;
      if (!Number.isInteger(pos)) return { ok: false, reason: 'secret' };
      let picked;
      if (m === 'auto') picked = -1;
      else if (Number.isInteger(m) && m >= 0 && m < grid.n * grid.n) picked = m;
      else return { ok: false, reason: 'bad' };
      const correct = picked === pos;
      if (correct) mini.finds[p] += 1;
      mini.last = { by: p, n: grid.n, tiles: grid.tiles.slice(), pos, picked, correct };
      const next = oddGrid(mini.finds[p], needRng(rng));          // a new grid every move, at the player's level
      mini.grid[p] = next.grid; mini.pos[p] = next.pos;
      if (mini.finds[p] >= ODD.goal) return { ok: true, outcome: 'win', note: 'found' };
      return { ok: true, outcome: 'continue', note: correct ? 'found' : 'wrong' };
    }
    case 'hexapawn': {
      if (!Array.isArray(m) || m.length !== 2 || !m.every(k => Number.isInteger(k) && k >= 0 && k < HP.cols * HP.rows)) return { ok: false, reason: 'bad' };
      const [from, to] = m;
      if (!hpMoves(mini.cells, p).some(([a, b]) => a === from && b === to)) return { ok: false, reason: 'illegal' };
      const capture = mini.cells[to] === other(p);
      mini.cells[to] = p; mini.cells[from] = null;
      mini.last = { from, to, by: p, capture };
      if (Math.floor(to / HP.cols) === hpGoalRow(p)) return { ok: true, outcome: 'win', cells: [to], note: 'through' };
      // That is the only win. A player with no move here plays elsewhere; when neither can move, the
      // square resets (playMove sees that) like a drawn Tic-tac-toe.
      return { ok: true, outcome: 'continue', note: capture ? 'capture' : 'step' };
    }
  }
  return { ok: false, reason: 'bad' };
}

/* ===================== Computer player =====================
 * The computer plays fairly: every decision starts from publicMini(), which holds only what a
 * person looking at the screen could know. The hidden word, number, ship, treasure, face-down
 * cards and future dice or coin results never reach the code below.
 *
 * Each turn it scores the best local move in every open square:
 *   score = (value of the square on the main board) x (how much the move shifts the chance of claiming it)
 * and plays the highest. A move that claims a match-winning square is taken at once.
 */
const AI = { win: 1000, block: 600 };

// What a player can see of a mini-game. Hidden information is left out, not blanked.
function publicMini(mini) {
  switch (mini.type) {
    case 'ttt': case 'c4': case 'hex': case 'hexapawn': return { type: mini.type, cells: mini.cells.slice() };
    case 'golf': case 'pool': case 'bowling': { const c = JSON.parse(JSON.stringify(mini)); if (c.last) delete c.last.rec; return c; }   // (everything is in the open; the recording is not needed to choose)
    case 'dash': case 'lane': return { type: mini.type, cfg: mini.cfg, seed: { X: mini.seed.X, O: mini.seed.O }, dist: { X: mini.dist.X, O: mini.dist.O }, runs: { X: mini.runs.X, O: mini.runs.O } };
    case 'craps':   return { type: 'craps', wins: { X: mini.wins.X, O: mini.wins.O } };
    case 'takeover': return { type: 'takeover', cells: mini.cells.slice() };
    case 'seating': return { type: 'seating', color: mini.color.slice(), who: mini.who.slice(), next: mini.next };
    case 'districts': return { type: 'districts', map: mini.map, who: mini.who.slice() };
    case 'shelves': return { type: 'shelves', cells: mini.cells.slice() };
    case 'roads':   return { type: 'roads', segs: mini.segs.slice() };
    case 'flood':   return { type: 'flood', colors: mini.colors.slice(), owner: mini.owner.slice(), score: { X: mini.score.X, O: mini.score.O } };
    case 'bullseye': return { type: 'bullseye', cfg: Object.assign({}, mini.cfg), pts: { X: mini.pts.X, O: mini.pts.O }, speed: { X: mini.speed.X, O: mini.speed.O }, pos: mini.pos.slice() };
    case 'echo':    return { type: 'echo', level: { X: mini.level.X, O: mini.level.O } };
    case 'plinko':  return { type: 'plinko', win: mini.win };
    case 'pong':    return { type: 'pong', cups: { X: mini.cups.X.slice(), O: mini.cups.O.slice() } };
    // Trivia and Odd One Out: the computer plays to a success rate (it knows the answer about half the
    // time, else guesses among the options still standing; a find 90%, 70%, then 50%), so it is told the
    // answer here and makes up its mind from there. Online, a phone
    // never gets these (hideMini): only the server, which plays the bots, does.
    case 'trivia':  return { type: 'trivia', right: { X: mini.right.X, O: mini.right.O }, answer: Number.isInteger(mini.answer) ? mini.answer : null, crossed: (mini.crossed || []).slice(), ask: mini.ask && mini.ask.q ? { opts: mini.ask.opts.length } : null };
    case 'oddone':  return { type: 'oddone', finds: { X: mini.finds.X, O: mini.finds.O }, n: { X: mini.grid.X.n, O: mini.grid.O.n }, pos: mini.pos ? { X: mini.pos.X, O: mini.pos.O } : { X: null, O: null } };
    case 'bs':      return { type: 'bs', len: mini.len, revealed: mini.revealed.slice(), hits: mini.hits.slice() };
    case 'wordle':  return { type: 'wordle', guesses: mini.guesses.map(g => ({ by: g.by, word: g.word, marks: g.marks.slice() })) };
    case 'mastermind': return { type: 'mastermind', guesses: mini.guesses.map(g => ({ by: g.by, code: g.code.slice(), solid: g.solid, hollow: g.hollow })) };
    case 'hangman': {
      const hits = new Set(mini.letters.filter(x => x.hit).map(x => x.l));
      return { type: 'hangman', pattern: mini.word.split('').map(ch => (hits.has(ch) ? ch : null)), letters: mini.letters.map(x => ({ l: x.l, hit: x.hit })) };
    }
    case 'hilo':    return { type: 'hilo', lo: mini.lo, hi: mini.hi, guesses: mini.guesses.map(g => ({ by: g.by, n: g.n, res: g.res })) };
    case 'dice':    return { type: 'dice', totals: { X: mini.totals.X, O: mini.totals.O } };
    case 'memory': {
      const seen = (mini.seen || []).slice();
      return { type: 'memory', seen, cards: mini.cards.map((c, i) => (seen.includes(i) ? { s: c.s, c: c.c } : null)) };
    }
    case 'candy':   return { type: 'candy', track: mini.track.slice(), pos: { X: mini.pos.X, O: mini.pos.O } };
    case 'coins':   return { type: 'coins', coins: mini.coins.slice(), marks: mini.marks ? { by: mini.marks.by, coins: mini.marks.coins.slice() } : null };
    case 'snakes':  return { type: 'snakes', ladders: mini.ladders.map(x => x.slice()), snakes: mini.snakes.map(x => x.slice()), pos: { X: mini.pos.X, O: mini.pos.O } };
    case 'bump':    return { type: 'bump', pos: { X: mini.pos.X, O: mini.pos.O } };
    case 'pig':     return { type: 'pig', bank: { X: mini.bank.X, O: mini.bank.O }, turn: mini.turn ? { by: mini.turn.by, rolls: mini.turn.rolls.slice(), pot: mini.turn.pot } : null };
    case 'hunt':    return { type: 'hunt', dug: mini.dug.slice(), clues: mini.dug.map((d, i) => (d ? huntClue(mini, i) : null)) };   // bands only, never the distance
    case 'bj':      return { type: 'bj', wins: { X: mini.wins.X, O: mini.wins.O }, hand: mini.hand ? { by: mini.hand.by, cards: mini.hand.cards.slice(), up: mini.hand.up, doubled: !!mini.hand.doubled } : null };   // never the hole card or the deck
    case 'bus':     return { type: 'bus', prog: { X: mini.prog.X.slice(), O: mini.prog.O.slice() } };
    case 'rl':      return { type: 'rl', hits: { X: mini.hits.X, O: mini.hits.O } };
  }
  throw new Error('unknown mini-game: ' + mini.type);
}

// ---- what is still possible, from public information ----
function wordleCandidates(pm) {
  const out = [];
  for (const w of WORDS5) {
    const W = w.toUpperCase();
    if (pm.guesses.every(g => wordleMarks(g.word, W).join('') === g.marks.join(''))) out.push(W);
  }
  return out;
}
function hangmanCandidates(pm) {
  const wrong = pm.letters.filter(x => !x.hit).map(x => x.l), hits = pm.letters.filter(x => x.hit).map(x => x.l);
  const out = [];
  for (const w of WORDS_HANG) {
    const W = w.toUpperCase();
    if (W.length !== pm.pattern.length) continue;
    let ok = true;
    for (let i = 0; i < W.length && ok; i++) {
      const ch = W[i];
      ok = pm.pattern[i] ? pm.pattern[i] === ch : !hits.includes(ch) && !wrong.includes(ch);   // a found letter shows all its copies
    }
    if (ok) out.push(W);
  }
  return out;
}
// Battleship: the placements of the ship that still fit every hit and every miss.
function bsCandidates(pm) {
  const miss = new Set(pm.revealed.map((r, k) => (r && !pm.hits.includes(k) ? k : -1)).filter(k => k >= 0));
  return bsPlacements(pm.len).filter(cells => pm.hits.every(h => cells.includes(h)) && !cells.some(k => miss.has(k)));
}
function huntCandidates(pm) {
  const out = [];
  const n = huntSize(pm);
  for (let c = 0; c < pm.dug.length; c++) {
    if (pm.dug[c]) continue;
    if (pm.clues.every((k, d) => k == null || huntBand(huntDist(c, d, n)) === k)) out.push(c);
  }
  return out;
}

// ---- how far each side is from claiming a square: estimated moves still needed, with nobody interfering ----
const WINDOWS = {};
function windowsOf(W, H, K) {
  const key = W + 'x' + H + 'x' + K;
  if (WINDOWS[key]) return WINDOWS[key];
  const out = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
    const win = [];
    for (let k = 0; k < K; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= H || cc < 0 || cc >= W) break; win.push(rr * W + cc); }
    if (win.length === K) out.push(win);
  }
  return (WINDOWS[key] = out);
}
function lineNeeds(cells, W, H, K, p, playable) {
  let best = Infinity;
  for (const win of windowsOf(W, H, K)) {
    let mine = 0, bad = false, empty = null;
    for (const k of win) { const c = cells[k]; if (c === p) mine++; else if (c) { bad = true; break; } else empty = k; }
    if (bad) continue;
    let n = K - mine;
    if (n === 1 && playable && !playable(empty)) n = 2;        // Connect 4: a hole still needs a piece under it
    if (n < best) best = n;
  }
  return best;
}
function c4Playable(cells) { return k => k >= C4.cols * (C4.rows - 1) || !!cells[k + C4.cols]; }
// Hex: the fewest empty cells p still needs to connect its two edges (0 = connected, Infinity = cut off).
function hexDist(cells, p) {
  const N = HEX_N * HEX_N, o = other(p), dist = new Array(N).fill(Infinity);
  const isStart = p === 'X' ? i => i % HEX_N === 0 : i => i < HEX_N;
  const isEnd = p === 'X' ? i => i % HEX_N === HEX_N - 1 : i => i >= HEX_N * (HEX_N - 1);
  const cost = i => (cells[i] === p ? 0 : cells[i] === o ? Infinity : 1);
  for (let i = 0; i < N; i++) if (isStart(i)) dist[i] = cost(i);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < N; i++) {
      if (dist[i] === Infinity) continue;
      for (const n of hexNeighbors(i)) { const d = dist[i] + cost(n); if (d < dist[n]) { dist[n] = d; changed = true; } }
    }
  }
  let best = Infinity;
  for (let i = 0; i < N; i++) if (isEnd(i) && dist[i] < best) best = dist[i];
  return best;
}
// Candy race: expected spins to the finish from each position (index = position + 1, the start being -1).
function candyExpected(track) {
  const E = new Array(CANDY.len + 2).fill(0);
  for (let pos = CANDY.len - 1; pos >= -1; pos--) {
    let sum = 0;
    for (const color of CANDY.colors) {
      let to = CANDY.len;
      for (let i = pos + 1; i < CANDY.len; i++) if (track[i] === color) { to = i; break; }
      sum += E[to + 1];
    }
    E[pos + 1] = 1 + sum / CANDY.colors.length;
  }
  return E;
}
// Snakes and Ladders: expected rolls to the top from each space (0 = not on the board yet), the
// ladders and snakes included (a snake can send a piece back, so this is solved by iterating).
function snlExpected(pm) {
  const n = SNL.n, E = new Array(n + 1).fill(0), jump = {};
  for (const [a, b] of pm.ladders.concat(pm.snakes)) jump[a] = b;
  for (let it = 0; it < 500; it++) {
    let diff = 0;
    for (let k = n - 1; k >= 0; k--) {
      let sum = 0;
      for (let r = 1; r <= 6; r++) { const l = Math.min(k + r, n); sum += E[l < n && jump[l] != null ? jump[l] : l]; }
      const v = 1 + sum / 6;
      diff = Math.max(diff, Math.abs(v - E[k])); E[k] = v;
    }
    if (diff < 1e-7) break;
  }
  return E;
}
const COIN_NEEDS = [0, 2, 2.67, 3.14, 3.92, 4.55, 5.22];   // expected flips to turn n coins that aren't yours, flipping three at a time
function needsOf(pm, p) {
  switch (pm.type) {
    case 'dash': case 'lane': return runNeeds(pm.cfg, pm.dist[p]);
    case 'golf': case 'pool': case 'bowling': return physNeeds(pm, p);
    case 'bullseye': { let n = 0, pts = pm.pts[p], s = pm.speed[p]; while (pts < BULLS.goal && n < 60) { const r = bullsRates(s), e = r.bull * BULLS.bullPts + r.board * BULLS.boardPts; pts += e; s *= 1 + (pm.cfg.ramp - 1) * (r.bull + r.board); n++; } return Math.max(1, n); }   // throws to 5 at its expected points, slipping as it speeds up
    case 'craps':   return Math.max(1, (CRAPS.goal - pm.wins[p]) / CRAPS.winOdds);
    case 'takeover': { const e = pm.cells.filter(c => !c).length; return e ? raceNeeds(takeCount(pm.cells, p) - takeCount(pm.cells, other(p)), e / 5, 3) : Infinity; }
    case 'flood':   return Math.max(0.5, (FLOOD.goal - pm.score[p]) / 3.2);
    case 'seating': { const o = other(p), e = pm.who.filter(w => !w).length, half = q => pm.who.filter((w, i) => w === q && !pm.who[seatMate(i)]).length; return e ? raceNeeds(seatTables(pm.who, p) - seatTables(pm.who, o) + 0.4 * (half(p) - half(o)), e / 4, 1) : Infinity; }
    case 'districts': { const e = pm.who.filter(w => !w).length; return e ? raceNeeds(distEval(pm.map, pm.who, p), e / 2, 1.2) : Infinity; }
    case 'shelves': { const e = pm.cells.filter(c => !c).length; return e ? raceNeeds(shelfOn(pm.cells, p) - shelfOn(pm.cells, other(p)), e / 4, 1) : Infinity; }
    case 'roads':   { const e = pm.segs.filter(c => !c).length; return e ? raceNeeds(roadLongest(pm.segs, p).len - roadLongest(pm.segs, other(p)).len, e / 4, 1.2) : Infinity; }
    case 'echo':    { let n = 0; for (let l = pm.level[p]; l < ECHO.lengths.length; l++) n += 1 / ECHO.aiPass[l]; return Math.max(1, n); }
    case 'plinko':  return 1 / Math.max(...plinkoOdds(pm.win));            // dropped above the WIN bin, every time
    case 'pong':    return Math.max(1, pm.cups[p].filter(Boolean).length / 0.45);
    case 'trivia':  return Math.max(1, (TRIVIA.goal - pm.right[p]) / TRIVIA.aiRight);
    case 'oddone':  { let n = 0; for (let f = pm.finds[p]; f < ODD.goal; f++) n += 1 / ODD.aiFind[Math.min(f, ODD.aiFind.length - 1)]; return Math.max(1, n); }
    case 'ttt':     return lineNeeds(pm.cells, 3, 3, 3, p);
    case 'c4':      return lineNeeds(pm.cells, C4.cols, C4.rows, C4.k, p, c4Playable(pm.cells));
    case 'hex':     return hexDist(pm.cells, p);
    case 'bs':      { const n = bsCandidates(pm).length; return Math.max(1, pm.len - pm.hits.length + (n <= 1 ? 0 : Math.log2(n) / 2)); }
    case 'wordle':  { const n = wordleCandidates(pm).length; return n <= 1 ? 1 : Math.min((n + 1) / 2, 1 + Math.log(n) / Math.log(6)); }
    case 'hangman': { const n = hangmanCandidates(pm).length; const missing = pm.pattern.filter(ch => !ch).length; return n <= 1 ? 1 : 1 + Math.min(missing, 1 + Math.log(n)) / 2; }
    case 'hilo':    { const r = pm.hi - pm.lo + 1; return r <= 1 ? 1 : Math.log2(r + 1); }
    case 'dice':    return Math.max(1, (DICE_GOAL - pm.totals[p]) / 3.5);
    case 'snakes':  return Math.max(1, snlExpected(pm)[pm.pos[p]]);
    case 'bump':    return Math.max(1, (BUMP.n + 1 - pm.pos[p]) / 2);
    case 'candy':   return Math.max(1, candyExpected(pm.track)[pm.pos[p] + 1]);
    case 'memory':  { const known = pm.seen.filter(i => pm.cards[i]); return memoryPair(pm, known) ? 1 : 1 + (9 - pm.seen.length) / 2; }
    case 'coins':   return COIN_NEEDS[pm.coins.filter(c => c !== p).length];
    case 'pig':     { const pot = pm.turn && pm.turn.by === p ? pm.turn.pot : 0; return Math.max(1, (RISKY.goal - pm.bank[p] - pot) / 7); }
    case 'hunt':    { const n = huntCandidates(pm).length; return n <= 1 ? 1 : 1 + Math.log2(n) / 2.5; }
    case 'hexapawn': return hpNeeds(pm.cells, p);
    case 'mastermind': { const n = mmCandidates(pm).length; return n <= 1 ? 1 : Math.min((n + 1) / 2, 1 + Math.log(n) / Math.log(5)); }
    case 'bj':      return Math.max(1, (BJ.goal - pm.wins[p]) / 0.45);      // about 0.45 a hand, doubles and naturals included
    case 'bus': {                                                            // turns: one, plus one for every miss on the way
      const kept = pm.prog[p];
      let n = 1;
      for (let r = kept.length; r < BUS.rounds; r++) { const q = r === kept.length ? Math.max(...busOdds(kept).map(o => o.p)) : BUS_AVG[r]; n += (1 - q) / q; }
      return n;
    }
    case 'rl':      return Math.max(1, (RL.goal - pm.hits[p]) * RL.wheel.length / RL.pick);
  }
  return Infinity;
}
const BUS_AVG = [0.5, 0.72, 0.6, 0.26];   // Ride the Bus: the usual chance of the best guess in each round
function memoryPair(pm, known) {
  for (let x = 0; x < known.length; x++) for (let y = x + 1; y < known.length; y++) {
    const a = pm.cards[known[x]], b = pm.cards[known[y]];
    if (a.s === b.s && a.c === b.c) return [known[x], known[y]];
  }
  return null;
}
// Chance that the side needing `a` more moves claims the square before the side needing `b`.
function winChance(a, b) {
  if (a <= 0) return 1;
  if (b <= 0) return 0;
  if (a === Infinity && b === Infinity) return 0.5;        // a dead square: it will draw and reset
  if (a === Infinity) return 0;
  if (b === Infinity) return 1;
  return b / (a + b);
}

// ---- tactics inside one square: the best local move, from public information ----
// Each returns { move, win?, after?, q?, shared? }: `after` is the position after a move whose result is
// certain (and `win` whether it claims the square); `q` is the chance a chancy move claims it at once;
// `shared` marks games where every clue helps the other player just as much.
function tttMinimax(cells, me) {   // every move's value for me, from full minimax (alternating play within the square)
  const memo = new Map();
  const search = (p, depth) => {                    // best value for p, p to move
    const key = cells.map(c => c || '.').join('') + p;
    if (memo.has(key)) return memo.get(key);
    let best = -Infinity, any = false;
    for (let i = 0; i < 9; i++) {
      if (cells[i]) continue;
      any = true;
      cells[i] = p;
      const v = findRun(cells, 3, 3, 3, p) ? 10 - depth : cells.every(Boolean) ? 0 : -search(other(p), depth + 1);
      cells[i] = null;
      if (v > best) best = v;
    }
    if (!any) best = 0;
    memo.set(key, best);
    return best;
  };
  const out = [];
  for (let i = 0; i < 9; i++) {
    if (cells[i]) continue;
    cells[i] = me;
    const v = findRun(cells, 3, 3, 3, me) ? 10 : cells.every(Boolean) ? 0 : -search(other(me), 1);
    cells[i] = null;
    out.push({ i, v });
  }
  return out;
}
function c4Drop(cells, col) { for (let r = C4.rows - 1; r >= 0; r--) { const k = r * C4.cols + col; if (!cells[k]) return k; } return -1; }
function c4Eval(cells, me) {   // threats: open windows weighted by how full they are, plus the middle column
  const o = other(me);
  let s = 0;
  for (const w of windowsOf(C4.cols, C4.rows, C4.k)) {
    let m = 0, t = 0;
    for (const k of w) { if (cells[k] === me) m++; else if (cells[k] === o) t++; }
    if (m && !t) s += [0, 1, 10, 60][m]; else if (t && !m) s -= [0, 1, 10, 60][t];
  }
  const mid = Math.floor(C4.cols / 2);
  for (let r = 0; r < C4.rows; r++) { const c = cells[r * C4.cols + mid]; if (c === me) s += 3; else if (c === o) s -= 3; }
  return s;
}
const C4_ORDER = [3, 2, 4, 1, 5, 0, 6];      // the middle columns first: alpha-beta cuts sooner
function c4Search(cells, p, me, depth, alpha, beta) {   // negamax with alpha-beta: the value for p, p to move
  let best = -Infinity, any = false;
  for (const col of C4_ORDER) {
    const k = c4Drop(cells, col);
    if (k < 0) continue;
    any = true;
    cells[k] = p;
    let v;
    if (findRun(cells, C4.cols, C4.rows, C4.k, p)) v = 10000 + depth;
    else if (cells.every(Boolean)) v = 0;
    else if (depth === 0) v = p === me ? c4Eval(cells, me) : -c4Eval(cells, me);
    else v = -c4Search(cells, other(p), me, depth - 1, -beta, -alpha);
    cells[k] = null;
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}
const C4_DEPTH = 5;            // plies searched (7 columns: deeper gets slow on a phone)
function c4Moves(cells, me) {
  const out = [];
  for (const col of C4_ORDER) {
    const k = c4Drop(cells, col);
    if (k < 0) continue;
    cells[k] = me;
    const v = findRun(cells, C4.cols, C4.rows, C4.k, me) ? 10000 + C4_DEPTH : cells.every(Boolean) ? 0 : -c4Search(cells, other(me), me, C4_DEPTH - 1, -Infinity, Infinity);
    cells[k] = null;
    out.push({ i: col, v });
  }
  return out;
}
// Hexapawn: full minimax over the whole game (it is tiny). solve(cells, p) is the outcome with p to move
// and both sides playing on in this square: { win: true when p wins, plies } with plies counting both sides.
// A side with no move passes (it is stuck, not beaten), and the other moves.
const HP_MEMO = new Map();
// p to move. v: 1 when p gets a pawn through, -1 when the other side does, 0 when the square ends with
// nobody able to move (it resets). A side with no move here waits while the other moves on.
function hpSolve(cells, p) {
  const key = cells.map(c => c || '.').join('') + p;
  if (HP_MEMO.has(key)) return HP_MEMO.get(key);
  const o = other(p), moves = hpMoves(cells, p);
  let res;
  if (!moves.length && !hpMoves(cells, o).length) res = { v: 0, plies: 0 };            // nobody can move: the square resets
  else if (!moves.length) { const r = hpSolve(cells, o); res = { v: -r.v, plies: r.plies }; }   // stuck: the other side moves
  else {
    let best = null;
    const better = (r, b) => r.v > b.v || (r.v === b.v && (r.v > 0 ? r.plies < b.plies : r.plies > b.plies));
    for (const [a, b] of moves) {
      const next = cells.slice(); next[b] = p; next[a] = null;
      let r;
      if (Math.floor(b / HP.cols) === hpGoalRow(p)) r = { v: 1, plies: 1 };
      else { const q = hpSolve(next, o); r = { v: -q.v, plies: q.plies + 1 }; }
      if (!best || better(r, best)) best = r;
    }
    res = best;
  }
  HP_MEMO.set(key, res);
  return res;
}
// Every move's value for me: a forced win soon is best, a forced loss late is the least bad.
function hpMovesValued(cells, me) {
  const o = other(me);
  return hpMoves(cells, me).map(([a, b]) => {
    const next = cells.slice(); next[b] = me; next[a] = null;
    let v;
    if (Math.floor(b / HP.cols) === hpGoalRow(me)) v = 100;
    else { const q = hpSolve(next, o); v = q.v > 0 ? -100 + q.plies : q.v < 0 ? 100 - q.plies - 1 : 0; }
    return { move: [a, b], v, after: next };
  });
}
// How many of p's own moves p needs to claim the square, for weighing it on the board. Nobody has to
// move in a square, so "whoever is to move loses" lines from the minimax do not count here: the measure
// is the closest pawn's distance to the far row, one more when p is stuck for now, and 1 when p can
// get a pawn through at once.
function hpNeeds(cells, p) {
  if (!cells.includes(p)) return Infinity;
  const moves = hpMoves(cells, p);
  for (const [, b] of moves) if (Math.floor(b / HP.cols) === hpGoalRow(p)) return 1;
  let best = Infinity;
  cells.forEach((c, k) => { if (c === p) best = Math.min(best, Math.abs(Math.floor(k / HP.cols) - hpGoalRow(p))); });
  return best + (moves.length ? 0 : 1);
}
function hexMoves(cells, me) {   // win and block detection through connection distances, looking one reply ahead
  const o = other(me), N = HEX_N * HEX_N, out = [];
  for (let i = 0; i < N; i++) {
    if (cells[i]) continue;
    cells[i] = me;
    const mine = hexDist(cells, me);
    let v;
    if (mine === 0) v = 1000;
    else {
      let reply = -Infinity;
      for (let j = 0; j < N; j++) {
        if (cells[j]) continue;
        cells[j] = o;
        const od = hexDist(cells, o), r = od === 0 ? 1000 : hexDist(cells, me) - od;   // from the other side's view
        cells[j] = null;
        if (r > reply) reply = r;
      }
      v = reply === -Infinity ? hexDist(cells, o) - mine : -reply;
    }
    cells[i] = null;
    out.push({ i, v });
  }
  return out;
}
// Open lines weighted by how full they are: mine count for, the other side's against.
function threatScore(cells, W, H, K, me) {
  const o = other(me), w8 = [0, 1, 10, 100, 1000];
  let s = 0;
  for (const win of windowsOf(W, H, K)) {
    let m = 0, t = 0;
    for (const k of win) { if (cells[k] === me) m++; else if (cells[k] === o) t++; }
    if (m && !t) s += w8[m]; else if (t && !m) s -= w8[t];
  }
  return s;
}
// Pick among valued moves: the best value, then the position with the most open lines (or, in Hex, the biggest lead in distance).
function pickValued(pm, me, moves, place) {
  const o = other(me);
  let best = null;
  for (const mv of moves) {
    const after = { type: pm.type, cells: pm.cells.slice() };
    const k = place(after.cells, mv.i);
    after.cells[k] = me;
    const win = pm.type === 'hex' ? !!hexPath(after.cells, me) : !!findRun(after.cells, pm.type === 'ttt' ? 3 : C4.cols, pm.type === 'ttt' ? 3 : C4.rows, pm.type === 'ttt' ? 3 : C4.k, me);
    const h = pm.type === 'hex' ? Math.min(hexDist(after.cells, o), 9) - Math.min(hexDist(after.cells, me), 9)
      : pm.type === 'ttt' ? threatScore(after.cells, 3, 3, 3, me) : threatScore(after.cells, C4.cols, C4.rows, C4.k, me);
    if (!best || mv.v > best.v || (mv.v === best.v && h > best.h)) best = { move: mv.i, v: mv.v, h, after, win };
  }
  return best;
}
function localBest(pm, me, rng, style, ctx) {
  switch (pm.type) {
    case 'dash': case 'lane': return runAi(pm, me, rng);       // a run drawn to finish in about 4-5 of them
    case 'golf': case 'pool': case 'bowling': return physAi(pm, me, rng);   // the best of its candidate shots, with a little error
    case 'bullseye': {                                           // the bullseye, the board or a miss at its rates (15%, 45%, 40% at the start), and a spot to match
      const r = bullsRates(pm.speed[me]), u = rng(), cfg = pm.cfg, [cx, cy] = pm.pos;
      const kind = u < r.bull ? 'bull' : u < r.bull + r.board ? 'board' : 'miss';
      let pt;
      if (kind === 'miss') {
        for (let k = 0; k < 60; k++) { pt = [2 + rng() * (BULLS.w - 4), 2 + rng() * (BULLS.h - 4)]; if (Math.hypot(pt[0] - cx, pt[1] - cy) > cfg.board * 1.12 + 0.5) break; }
      } else {
        const lo = kind === 'bull' ? 0 : Math.min(cfg.bull * 1.12 + 0.2, cfg.board * 0.9), hi = kind === 'bull' ? cfg.bull * 0.85 : cfg.board * 0.92;
        const rad = lo + Math.sqrt(rng()) * (hi - lo), th = rng() * Math.PI * 2;
        pt = [cx + Math.cos(th) * rad, cy + Math.sin(th) * rad];
      }
      return { move: { x: r3(Math.max(0, Math.min(1, pt[0] / BULLS.w))), y: r3(Math.max(0, Math.min(1, pt[1] / BULLS.h))) }, q: Math.min(0.95, (r.bull * BULLS.bullPts + r.board) / 2) };
    }
    case 'echo': {                                               // it beats a pattern as often as its length allows (its taps come from the pattern itself: see cpuEcho)
      const q = ECHO.aiPass[Math.min(pm.level[me], ECHO.aiPass.length - 1)];
      return { move: { echo: rng() < q ? 'pass' : 'fail', at: rng() }, q };
    }
    case 'plinko': return { move: pm.win, q: plinkoOdds(pm.win)[pm.win] };   // dropped above the WIN bin
    case 'pong': {                                               // at a cup still standing, a little off
      const g = () => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
      const up = pm.cups[me].map((c, k) => (c ? k : -1)).filter(k => k >= 0);
      const k = up.length ? up[randInt(rng, up.length)] : 0, a = pongAimAt(k);
      return { move: { aim: Math.max(-1, Math.min(1, a.aim + g() * PONG.aiErr[0])), power: Math.max(0, Math.min(1, a.power + g() * PONG.aiErr[1])) }, q: 0.45 };
    }
    case 'trivia': {                                             // it knows it about half the time, else guesses among the options still standing (never one crossed out)
      const right = pm.answer, n = pm.ask ? pm.ask.opts : TRIVIA.options, crossed = pm.crossed || [];
      if (!Number.isInteger(right)) return { move: 'auto', q: 0 };
      const left = Array.from({ length: n }, (_, k) => k).filter(k => !crossed.includes(k));
      const q = TRIVIA.aiKnow + (1 - TRIVIA.aiKnow) / Math.max(1, left.length);
      if (left.length <= 1 || rng() < TRIVIA.aiKnow) return { move: right, q };
      return { move: left[randInt(rng, left.length)], q };
    }
    case 'oddone': {                                             // a find 90%, 70%, then 50% of the time
      const q = ODD.aiFind[Math.min(pm.finds[me], ODD.aiFind.length - 1)], pos = pm.pos[me], n = pm.n[me] * pm.n[me];
      if (!Number.isInteger(pos)) return { move: 'auto', q: 0 };
      if (rng() < q) return { move: pos, q };
      let w = randInt(rng, n - 1); if (w >= pos) w++;
      return { move: w, q };
    }
    case 'bj': {
      // Deal, then basic strategy; with a tally of 1 a won double takes the square, so it doubles more readily.
      const h = pm.hand && pm.hand.by === me ? pm.hand : null, need = BJ.goal - pm.wins[me];
      if (!h) return { move: 'deal', q: need <= 1 ? 0.43 : need === 2 ? 0.05 : 0 };
      return { move: bjStrategy(h.cards, h.up, need === 2), q: 0 };
    }
    case 'bus': {
      // The guess most likely right, from the cards left in its own deck (a tie: either).
      const kept = pm.prog[me], odds = busOdds(kept), top = Math.max(...odds.map(o => o.p));
      const best = odds.filter(o => o.p >= top - 1e-9), g = best[randInt(rng, best.length)];
      let q = g.p;
      for (let r = kept.length + 1; r < BUS.rounds; r++) q *= BUS_AVG[r];   // right all the way to the end, this turn
      return { move: g.guess, q };
    }
    case 'rl': {
      // A group, as a rule; now and then green 0: when the other side is one hit from a square that
      // matters (it would give them the match, or block a line of its own), or when well behind.
      const o = other(me), mine = pm.hits[me], theirs = pm.hits[o];
      const crit = !!ctx && ctx.value >= AI.block, behind = !!ctx && ctx.behind >= 2 && theirs > mine;
      const pz = theirs >= RL.goal - 1 && crit ? 0.4 : behind ? 0.25 : 0;
      if (pz && rng() < pz) return { move: 'zero', q: 1 / RL.wheel.length };
      return { move: ['g1', 'g2', 'g3'][randInt(rng, 3)], q: mine >= RL.goal - 1 ? RL.pick / RL.wheel.length : 0 };
    }
    case 'craps': return { move: 'roll', q: pm.wins[me] >= CRAPS.goal - 1 ? CRAPS.winOdds : 0 };   // no choices: it rolls
    case 'takeover': {
      const b = takeSearch(pm.cells, me, rng);
      const full = !b.after.includes(null);
      return { move: b.i, after: { type: 'takeover', cells: b.after }, win: full && takeCount(b.after, me) > takeCount(b.after, other(me)) };
    }
    case 'flood': { const b = floodSearch(pm, me, rng); return { move: b.c, after: b.after, win: b.win }; }
    case 'seating': { const b = seatPick(pm, me, rng), a = Object.assign({}, pm, { who: pm.who.slice() }); a.who[b.move] = me; return { move: b.move, after: a, win: seatTables(a.who, me) >= SEAT.goal }; }
    case 'districts': { const b = distSearch(pm, me, rng); return { move: b.k, after: { type: 'districts', map: pm.map, who: b.after } }; }
    case 'shelves': { const b = shelfPick(pm, me, rng), a = pm.cells.slice(); a[b.i] = me; return { move: b.i, after: { type: 'shelves', cells: a } }; }
    case 'roads':   { const b = roadPick(pm, me, rng); return { move: b.k, after: { type: 'roads', segs: b.after } }; }
    case 'ttt': return pickValued(pm, me, tttMinimax(pm.cells, me), (cells, i) => i);
    case 'c4':  return pickValued(pm, me, c4Moves(pm.cells, me), c4Drop);
    case 'hex': return pickValued(pm, me, hexMoves(pm.cells, me), (cells, i) => i);
    case 'mastermind': {
      const cand = mmCandidates(pm);
      if (!cand.length) return { move: mmCode(rng), q: 0, shared: true };
      if (cand.length === 1) return { move: cand[0].slice(), q: 1, shared: true };
      return { move: mmBestGuess(cand), q: 1 / cand.length, shared: true };
    }
    case 'hexapawn': {
      const moves = hpMovesValued(pm.cells, me);
      if (!moves.length) return { move: null, q: 0 };
      const ahead = mv => mv.after.reduce((s, c, k) => s + (c === me ? (me === 'X' ? HP.rows - 1 - Math.floor(k / HP.cols) : Math.floor(k / HP.cols)) : c ? -1 : 0), 0);
      let best = moves[0];
      for (const mv of moves) if (mv.v > best.v || (mv.v === best.v && ahead(mv) > ahead(best))) best = mv;
      return { move: best.move, win: best.v === 100, after: { type: 'hexapawn', cells: best.after } };
    }
    case 'bs': {
      // Fire where the ship most often still fits, given every hit and miss (so around a hit once there
      // is one); between equals, the shot most likely to sink it.
      const cand = bsCandidates(pm), open = pm.revealed.map((r, i) => (r ? -1 : i)).filter(i => i >= 0);
      if (!cand.length) return { move: open[randInt(rng, open.length)], q: 0, shared: true };
      const cover = new Array(BS.n * BS.n).fill(0), sinks = new Array(BS.n * BS.n).fill(0);
      for (const cells of cand) {
        const left = cells.filter(k => !pm.hits.includes(k));
        for (const k of left) cover[k]++;
        if (left.length === 1) sinks[left[0]]++;
      }
      let top = [];
      for (const k of open) {
        if (!top.length || cover[k] > cover[top[0]] || (cover[k] === cover[top[0]] && sinks[k] > sinks[top[0]])) top = [k];
        else if (cover[k] === cover[top[0]] && sinks[k] === sinks[top[0]]) top.push(k);
      }
      const move = top[randInt(rng, top.length)];
      return { move, q: sinks[move] / cand.length, shared: true };
    }
    case 'hunt': {
      const cand = huntCandidates(pm);
      if (!cand.length) { const open = pm.dug.map((d, i) => (d ? -1 : i)).filter(i => i >= 0); return { move: open[0], q: 0, shared: true }; }
      if (cand.length === 1) return { move: cand[0], q: 1, shared: true };
      let best = cand[0], bestSplit = Infinity;        // the dig that, if it misses, leaves the fewest candidates on average (by the band it would show)
      const n = huntSize(pm);
      for (const c of cand) {
        const groups = new Map();
        for (const x of cand) if (x !== c) { const k = huntBand(huntDist(c, x, n)); groups.set(k, (groups.get(k) || 0) + 1); }
        let split = 0;
        for (const g of groups.values()) split += g * g;
        if (split < bestSplit) { bestSplit = split; best = c; }
      }
      return { move: best, q: 1 / cand.length, shared: true };
    }
    case 'hilo': return { move: Math.floor((pm.lo + pm.hi) / 2), q: 1 / (pm.hi - pm.lo + 1), shared: true };
    case 'wordle': {
      const cand = wordleCandidates(pm);
      if (!cand.length) return { move: WORDS5[randInt(rng, WORDS5.length)].toUpperCase(), q: 0, shared: true };
      if (cand.length === 1) return { move: cand[0], q: 1, shared: true };
      let best = cand[0];
      if (cand.length > 24) {                                      // many left: the guess with the most common letters
        const freq = {};
        for (const w of cand) for (const ch of new Set(w)) freq[ch] = (freq[ch] || 0) + 1;
        let top = -1;
        for (const w of cand) { let sc = 0; for (const ch of new Set(w)) sc += freq[ch]; if (sc > top) { top = sc; best = w; } }
      } else {                                                     // few left: the guess that splits them best
        let bestSplit = Infinity;
        for (const g of cand) {
          const groups = new Map();
          for (const w of cand) if (w !== g) { const k = wordleMarks(g, w).join(''); groups.set(k, (groups.get(k) || 0) + 1); }
          let split = 0;
          for (const n of groups.values()) split += n * n;
          if (split < bestSplit) { bestSplit = split; best = g; }
        }
      }
      return { move: best, q: 1 / cand.length, shared: true };
    }
    case 'hangman': {
      const cand = hangmanCandidates(pm), tried = new Set(pm.letters.map(x => x.l));
      const count = {};
      for (const w of cand) for (const ch of new Set(w)) if (!tried.has(ch)) count[ch] = (count[ch] || 0) + 1;
      let best = null, top = 0;
      for (const ch of 'ETAOINSRHLDCUMFPGWYBVKXJQZ') { const n = count[ch] || 0; if (n > top) { top = n; best = ch; } }
      if (!best) for (const ch of 'ETAOINSRHLDCUMFPGWYBVKXJQZ') if (!tried.has(ch)) { best = ch; break; }
      return { move: best, q: cand.length === 1 ? 1 : cand.length ? 1 / cand.length : 0, shared: true };
    }
    case 'memory': {
      const known = pm.seen.filter(i => pm.cards[i]);
      const pair = memoryPair(pm, known);
      if (pair) return { move: pair, q: 1, shared: true };
      const unseen = [];
      for (let i = 0; i < 9; i++) if (!pm.seen.includes(i)) unseen.push(i);
      if (unseen.length >= 2) { shuffle(unseen, rng); return { move: [unseen[0], unseen[1]], q: 2 / (unseen.length * (unseen.length - 1)), shared: true }; }
      if (unseen.length === 1) return { move: [unseen[0], known[randInt(rng, known.length)]], q: 1 / known.length, shared: true };
      return { move: [known[0], known[1]], q: 0, shared: true };
    }
    case 'coins': {
      // Every coin that isn't mine gets flipped when there are three or fewer: each must land mine.
      // With none of my own showing, the flip could also land them all the other side's way.
      // With the coins already marked, the chances are exact: the rest must already all show one side.
      const theirs = pm.coins.filter(c => c !== me).length, flips = Math.min(theirs, COINS.max);
      const marked = coinMarksFor(pm, me);
      if (marked) {
        const rest = pm.coins.filter((c, k) => !marked.includes(k)), pw = Math.pow(0.5, marked.length);
        return { move: 'flip', q: rest.every(c => c === me) ? pw : 0, qLose: rest.every(c => c === other(me)) ? pw : 0 };
      }
      const q = theirs <= COINS.max ? Math.pow(0.5, theirs) : 0;
      const qLose = theirs === pm.coins.length && pm.coins.includes(COINS.mystery) ? flips / theirs * Math.pow(0.5, flips) : 0;
      return { move: 'flip', q, qLose };
    }
    case 'pig': {
      const t = pm.turn && pm.turn.by === me ? pm.turn : null;
      if (!t) return { move: 'roll', q: 0 };
      const bank = pm.bank[me];
      if (bank + t.pot >= RISKY.goal) return { move: 'bank', q: 1 };
      if (t.rolls.length >= RISKY.maxRolls) return { move: 'bank', q: 0 };
      const gap = pm.bank[other(me)] - bank;                      // positive when behind
      const target = Math.max(4, Math.min(20, Math.max(6, Math.min(14, 9 + Math.round(gap / 4))) + ((style && style.rollRisk) || 0)));   // riskier when behind, safer when ahead (a bolder or warier style shifts it)
      if (t.pot >= target || t.rolls.length / 6 > 0.5) return { move: 'bank', q: 0 };
      return { move: 'roll', q: 0 };
    }
    case 'dice': { const need = DICE_GOAL - pm.totals[me]; return { move: 1, q: need <= 6 ? (7 - need) / 6 : 0 }; }
    case 'snakes': { const need = SNL.n - pm.pos[me]; return { move: 'roll', q: need <= 6 ? (7 - need) / 6 : 0 }; }
    case 'bump': { const need = BUMP.n + 1 - pm.pos[me]; return { move: 'spin', q: need <= BUMP.max ? (BUMP.max + 1 - need) / BUMP.max : 0 }; }
    case 'candy': {
      let finishing = 0;
      for (const color of CANDY.colors) if (!pm.track.some((c, i) => i > pm.pos[me] && c === color)) finishing++;
      return { move: 1, q: finishing / CANDY.colors.length };
    }
  }
  throw new Error('no tactics for ' + pm.type);
}

// ---- the match: what a square is worth, what a move changes ----
// A playing style (the matchmaking bots' personalities; the computer opponent plays STYLE0): attack and
// defend weigh the lines still open for itself and for the other side, defend also how hard it blocks a
// line about to be completed; mistake is the chance of a careless move (any legal move in any open
// square); rollRisk adds to the score it banks at in Risky Rolls (bolder above zero, warier below).
const STYLE0 = { attack: 1, defend: 1, mistake: 0, rollRisk: 0 };
function squareValue(squares, i, me, style) {
  const s = style || STYLE0;
  const o = other(me);
  let v = 0.5, win = false, block = false;                 // every square counts a little
  for (const line of LINES) {
    if (!line.includes(i)) continue;
    const rest = line.filter(k => k !== i).map(k => squares[k].owner);
    const mine = rest.filter(x => x === me).length, theirs = rest.filter(x => x === o).length;
    if (mine === 2) win = true;
    if (theirs === 2) block = true;
    if (!theirs) v += s.attack * [1, 3, 0][mine];            // a line still open for me, better with my square on it
    if (!mine) v += s.defend * [1, 3, 0][theirs];            // a line still open for them, worth blocking
  }
  if (win) return AI.win;
  if (block) return AI.block * Math.min(1, s.defend) + v;
  return v;
}
// How much the local move shifts the chance of claiming the square (negative when it hands the other side more).
function moveGain(pm, me, local) {
  const o = other(me);
  const a = needsOf(pm, me), b = needsOf(pm, o), before = winChance(a, b);
  if (local.after) return (local.win ? 1 : winChance(needsOf(local.after, me), needsOf(local.after, o))) - before;
  const q = local.q || 0, qLose = local.qLose || 0;            // qLose: the chance the move hands the square to the other side
  const after = winChance(Math.max(0.5, a - 1), local.shared ? Math.max(0.5, b - 1) : b);
  return q * (1 - before) - qLose * before + (1 - q - qLose) * (after - before);
}
// Echo: the computer's attempt as taps, from its decision to pass or to slip (at a random step).
function cpuEcho(mini, me, plan, rng) {
  const seq = mini.seqs[me][Math.min(mini.level[me], ECHO.lengths.length - 1)];
  if (plan.echo === 'pass') return seq.slice();
  const at = Math.min(seq.length - 1, Math.floor(plan.at * seq.length));
  let wrong = randInt(needRng(rng), ECHO.pads - 1); if (wrong >= seq[at]) wrong++;
  return seq.slice(0, at).concat(wrong);
}
// The computer's move for the side to play: { square, move, score }. During a bonus move the square is fixed.
function cpuMove(state, rng, style) {
  rng = needRng(rng);
  const st = Object.assign({}, STYLE0, style || {});
  const me = state.turn;
  const open = state.lock != null ? [state.lock] : state.squares.map((s, i) => (s.owner || !canMove(s.mini, me) ? -1 : i)).filter(i => i >= 0);   // not a square where it is stuck
  if (st.mistake > 0 && open.length && rng() < st.mistake) {      // a careless move: anything legal, anywhere open
    const i = open[randInt(rng, open.length)], m = randomLegalMove(state.squares[i].mini, me, rng);
    if (m != null) return { square: i, move: m, score: 0, value: 0, gain: 0, careless: true };
  }
  let best = null;
  const owned = p => state.squares.filter(s => s.owner === p).length, behind = owned(other(me)) - owned(me);
  for (const i of open) {
    const pm = publicMini(state.squares[i].mini);
    const real = squareValue(state.squares, i, me, st);
    const local = localBest(pm, me, rng, st, { value: real, behind });
    const value = state.lock != null ? 1 : real;
    if (pm.type === 'echo' && local.move && local.move.echo) local.move = cpuEcho(state.squares[i].mini, me, local.move, rng);
    if (value >= AI.win && (local.win || local.q >= 1)) return { square: i, move: local.move, score: Infinity, value, gain: 1 };
    const gain = moveGain(pm, me, local);
    const score = value * Math.max(gain, 0.01);
    if (!best || score > best.score) best = { square: i, move: local.move, score, value, gain };
  }
  return best;
}

// A random legal move in a mini-game, for a player who ran out of time.
let VALID5_LIST = null;
function randomLegalMove(mini, p, rng) {
  rng = needRng(rng);
  const from = a => a[randInt(rng, a.length)];
  const empties = (arr, ok) => arr.map((c, k) => (ok(c) ? k : -1)).filter(k => k >= 0);
  switch (mini.type) {
    case 'ttt': case 'hex': return from(empties(mini.cells, c => !c));
    case 'dash': case 'lane': return 'auto';                           // a run that crashes after a short random distance
    case 'golf': case 'pool': case 'bowling': return physRandom(mini, p, rng);   // a random gentle shot
    case 'bullseye': return { x: r3(rng()), y: r3(rng()) };          // both lines stopped at random points
    case 'echo': return 'auto';                                        // a failed attempt
    case 'plinko': return randInt(rng, PLINKO.slots);                  // a random slot
    case 'pong': return 'auto';                                        // a random throw
    case 'trivia': return 'auto';                                      // one wrong pick: an option still standing is crossed out
    case 'oddone': return 'auto';                                      // counts as wrong
    case 'c4': return from(Array.from({ length: C4.cols }, (_, c) => c).filter(c => !mini.cells[c]));
    case 'hexapawn': { const ms = hpMoves(mini.cells, p); return ms.length ? from(ms) : null; }
    case 'mastermind': return mmCode(rng);
    case 'bs': return from(empties(mini.revealed, c => !c));
    case 'hunt': return from(empties(mini.dug, c => !c));
    case 'hilo': return mini.lo + randInt(rng, mini.hi - mini.lo + 1);
    case 'wordle': { if (!VALID5_LIST) VALID5_LIST = [...VALID5]; return from(VALID5_LIST); }
    case 'hangman': return from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !mini.letters.some(x => x.l === l)));
    case 'memory': { const a = randInt(rng, 9); let b = randInt(rng, 8); if (b >= a) b++; return [a, b]; }
    case 'dice': case 'candy': return 1;
    case 'snakes': return 'roll';
    case 'bump': return 'spin';
    case 'coins': return 'flip';
    case 'pig': return mini.turn && mini.turn.by === p && mini.turn.pot ? 'bank' : 'roll';
    case 'bj': return !mini.hand ? 'deal' : from(mini.hand.cards.length === 2 ? ['hit', 'stand', 'double'] : ['hit', 'stand']);
    case 'bus': return from(BUS.guesses[Math.min(mini.prog[p].length, BUS.rounds - 1)]);
    case 'rl': return from(['g1', 'g2', 'g3']);
    case 'craps': return 'roll';                                       // the round, rolled to its end
    case 'takeover': return from(empties(mini.cells, c => !c));
    case 'seating': case 'districts': return from(empties(mini.who, c => !c));
    case 'shelves': return from(empties(mini.cells, c => !c));
    case 'roads': return from(empties(mini.segs, c => !c));
    case 'flood': return from(Array.from({ length: FLOOD.colors }, (_, c) => c).filter(c => c !== mini.colors[0]));
  }
  return null;
}
// The player to move ran out of time. A second timeout in a row loses the match; otherwise a random
// legal move is made for them (Risky Rolls: one roll, then a bank if it did not bust; Hangman: one letter and
// the turn ends even if it hits; Wordle: a random word from the dictionary; Blackjack: stand, dealing first
// if no hand is in play, and again on any new hand a push brings; Ride the Bus: one random guess, and the
// turn ends; Roulette: a random group).
function timeoutMove(state, rng) {
  rng = needRng(rng);
  const p = state.turn, t = state.timer;
  if (state.winner || state.flash || state.done) return { ok: false, reason: 'busy' };
  t.timeouts[p] += 1; t.streak[p] += 1;
  if (t.streak[p] >= 2) {
    state.winner = other(p); state.winLine = null; state.winReason = 'timeout'; state.counts = null;
    state.lock = null; state.done = null; state.flash = null; state.spot = null; t.deadline = null;
    state.screen = 'win'; state.zoom = null;
    return { ok: true, lost: p };
  }
  const open = state.lock != null ? [state.lock] : state.squares.map((sq, i) => (sq.owner || !canMove(sq.mini, p) ? -1 : i)).filter(i => i >= 0);
  const i = open[randInt(rng, open.length)], mini = state.squares[i].mini;
  const m = mini.type === 'pig' ? (mini.turn && mini.turn.by === p ? 'bank' : 'roll') : mini.type === 'bj' ? 'auto' : randomLegalMove(mini, p, rng);   // Blackjack: stand (dealt first if need be) on every hand until one is won or lost; Roulette: a random group; Echo, Trivia, Odd One Out: a failed attempt or a wrong answer; Cup Pong: a random throw
  const r = playMove(state, i, m, rng, { forced: true, noAgain: mini.type === 'hangman' || mini.type === 'bs' || mini.type === 'bus' });   // a timed-out shot fires once; a timed-out guess ends the turn
  if (!r.ok) return r;
  t.bankNext = mini.type === 'pig' && m === 'roll' && state.lock === i;   // the roll kept the turn: bank it next
  return { ok: true, square: i, move: m };
}

// Main-board result: three claimed squares in a row wins. Once neither player can still make a line
// (every line holds a square of each), the match is a draw there and then (winner 'draw', reason
// 'blocked'): nobody has to play out squares that cannot change the result. (Matches from before this
// rule could end on 'majority': most squares once all nine were claimed. A full board with no line is
// now always a draw, since by then no line was open to anyone.)
// A tic-tac-toe line p can still complete: none of its cells holds the other player's mark. (Moves in a
// square need not alternate, a player can play the same square turn after turn, so no count of moves matters.)
function tttOpen(cells, p) { return LINES.some(line => line.every(k => cells[k] !== other(p))); }
function lineOpen(squares, p) { return LINES.some(line => line.every(k => squares[k].owner !== other(p))); }
function mainResult(squares) {
  for (const line of LINES) {
    const o = squares[line[0]].owner;
    if (o && o === squares[line[1]].owner && o === squares[line[2]].owner) return { winner: o, line, reason: 'line' };
  }
  if (!lineOpen(squares, 'X') && !lineOpen(squares, 'O')) {
    const x = squares.filter(s => s.owner === 'X').length, o = squares.filter(s => s.owner === 'O').length;
    return { winner: 'draw', line: null, reason: 'blocked', counts: { X: x, O: o } };
  }
  return null;
}
// The old rule, for checking results reported from before the change: most squares on a full board.
function majorityResult(squares) {
  if (!squares.every(s => s.owner) || LINES.some(l => l.every(k => squares[k].owner === squares[l[0]].owner))) return null;
  const x = squares.filter(s => s.owner === 'X').length;
  return { winner: x > 9 - x ? 'X' : 'O', line: null, reason: 'majority', counts: { X: x, O: 9 - x } };
}

// A full move: the player to move makes move m in square i. On success state.flash
// describes the result; the UI animates it, then calls endFlash, which leaves the result on
// show in the mini-game (state.done). The turn passes only when the player heads back to the
// board (leaveSquare), unless the mini-game grants the same player another move at once
// (flash.kind === 'again'). A square where neither player has a legal move resets like a draw,
// and a player with no legal move anywhere on the board is skipped (flash.pass) so the match
// never freezes.
function playMove(state, i, m, rng, opts) {
  rng = needRng(rng); opts = opts || {};
  if (state.winner) return { ok: false, reason: 'over' };
  if (state.flash) return { ok: false, reason: 'busy' };
  if (state.done) return { ok: false, reason: 'done' };          // one move per visit: head back to the board first
  if (state.lock != null && state.lock !== i) return { ok: false, reason: 'locked' };
  const sq = state.squares[i];
  if (!sq) return { ok: false, reason: 'bad' };
  if (sq.owner) return { ok: false, reason: 'claimed' };
  const p = state.turn;
  const range = sq.mini.type === 'hilo' ? [sq.mini.lo, sq.mini.hi] : null;   // the range before the guess, for the UI
  const bjFrom = sq.mini.type === 'bj' && sq.mini.hand ? sq.mini.hand.cards.length : 0;   // Blackjack: the player's cards before (0: this move deals)
  const bonus = state.lock === i;                               // a bonus move within the same turn (Hangman, Risky Rolls)
  const res = applyMove(sq.mini, p, m, rng);
  if (!res.ok) return res;
  const mini = sq.mini;
  if (mini.type === 'trivia' && res.outcome === 'continue') triviaDeal(state, sq, rng);   // a new question once the last was answered right (before the square is judged stuck), from the match's unasked ones
  if (!sq.mv) sq.mv = { X: 0, O: 0 };
  if (!bonus) sq.mv[p] += 1;                                    // turns each side has spent in this mini-game (for the stats)
  if (!Array.isArray(state.sqlog)) state.sqlog = [];
  let outcome = res.outcome, note = res.note || null;
  if (outcome === 'continue' && !canMove(mini, 'X') && !canMove(mini, 'O')) { outcome = 'draw'; note = 'stuck'; }
  const again = !!res.again && !opts.noAgain;                   // a timed-out player's lucky letter does not earn another go
  const flash = {
    kind: outcome === 'win' ? 'claim' : outcome === 'draw' ? 'draw' : again ? 'again' : 'move',
    by: p, next: p, square: i, type: mini.type, note, pass: null, timeout: !!opts.forced,
  };
  switch (mini.type) {
    case 'wordle': flash.word = m.toUpperCase(); break;
    case 'hangman': flash.letter = m.toUpperCase(); break;
    case 'hilo': flash.n = m; flash.range = range; break;
    case 'dice': flash.roll = mini.last.roll; flash.total = mini.totals[p]; break;
    case 'snakes': flash.roll = mini.last.roll; flash.from = mini.last.from; flash.land = mini.last.land; flash.to = mini.last.to; flash.via = mini.last.via; break;
    case 'bump': flash.spin = mini.last.spin; flash.from = mini.last.from; flash.to = mini.last.to; flash.bumped = mini.last.bumped; break;
    case 'memory': flash.reveal = [m[0], m[1]]; break;
    case 'candy': flash.color = mini.last.color; flash.from = mini.last.from; flash.to = mini.last.to; break;
    case 'coins': flash.n = mini.last.flipped.length; break;
    case 'bs': flash.hit = mini.hits.includes(m); flash.len = mini.len; break;
    case 'pig': flash.roll = mini.last.roll; flash.pot = mini.last.pot; flash.rolls = mini.last.rolls; flash.bank = mini.bank[p]; break;
    case 'hunt': flash.band = huntClue(mini, m); break;
    case 'hexapawn': flash.from = mini.last.from; flash.to = mini.last.to; flash.capture = mini.last.capture; break;
    case 'mastermind': { const g = mini.guesses[mini.guesses.length - 1]; flash.code = g.code.slice(); flash.solid = g.solid; flash.hollow = g.hollow; break; }
    case 'bj': {                                 // what the table shows after the move: never the hole card while a hand goes on
      const h = mini.hand, l = mini.last, wins = { X: mini.wins.X, O: mini.wins.O };
      const inPlay = () => ({ cards: h.cards.slice(), dealer: [h.up], hole: true, doubled: !!h.doubled });
      const over = r => ({ cards: r.cards.slice(), dealer: r.dealer.slice(), hole: false, doubled: !!r.doubled, res: r.res, gain: r.gain, natural: !!r.natural, dealerBj: !!r.dealerBj });
      const pushed = mini.pushed || [];
      if (pushed.length) {                        // the hand played pushed: it shows, then the new hand is dealt (in play, or a natural settled)
        flash.bj = Object.assign({ act: m, from: bjFrom, wins, pushes: pushed.length }, over(pushed[0]), { next: h ? inPlay() : over(l) });
      } else flash.bj = Object.assign({ act: m, from: bjFrom, wins }, h ? inPlay() : over(l));
      break;
    }
    case 'bus': { const l = mini.last; flash.bus = { round: l.round, guess: l.guess, card: l.card, right: l.right, kept: mini.prog[p].slice() }; break; }
    case 'craps': { const l = mini.last; flash.craps = { rolls: l.rolls.map(d => d.slice()), point: l.point, result: l.result, wins: { X: mini.wins.X, O: mini.wins.O } }; break; }
    case 'seating': { const l = mini.last; flash.seat = { seat: l.seat, z: l.z, zColor: l.zColor, table: l.table, next: l.next, tables: { X: seatTables(mini.who, 'X'), O: seatTables(mini.who, 'O') } }; break; }
    case 'districts': { const l = mini.last; flash.dist = { spot: l.spot, lead: distTally(mini.map, mini.who).lead }; break; }
    case 'shelves': { const l = mini.last; flash.shelf = { at: l.at, grey: l.grey, on: { X: shelfOn(mini.cells, 'X'), O: shelfOn(mini.cells, 'O') } }; break; }
    case 'roads': { const l = mini.last; flash.road = { seg: l.seg, block: l.block, len: { X: roadLongest(mini.segs, 'X').len, O: roadLongest(mini.segs, 'O').len } }; break; }
    case 'takeover': { const l = mini.last; flash.take = { at: l.at, took: l.took.slice(), flipped: l.flipped.slice(), counts: { X: takeCount(mini.cells, 'X'), O: takeCount(mini.cells, 'O') } }; break; }
    case 'flood': { const l = mini.last; flash.flood = { color: l.color, from: l.from, waves: l.waves.map(w => w.slice()), gain: l.gain, score: { X: mini.score.X, O: mini.score.O } }; break; }
    case 'rl': { const l = mini.last; flash.rl = { bet: Array.isArray(l.bet) ? l.bet.slice() : l.bet, n: l.n, hit: l.hit, hits: { X: mini.hits.X, O: mini.hits.O } }; break; }
    case 'golf': case 'pool': case 'bowling': { const l = mini.last; flash.phys = Object.assign(JSON.parse(JSON.stringify(l)), mini.type === 'golf' ? { balls: JSON.parse(JSON.stringify(mini.balls)), hole: mini.hole, holedNow: JSON.parse(JSON.stringify(mini.holed)) } : mini.type === 'pool' ? { pocketedNow: { X: mini.pocketed.X, O: mini.pocketed.O }, down: Object.assign({}, mini.down) } : { pins: { X: mini.pins.X, O: mini.pins.O } }); break; }
    case 'dash': case 'lane': { const l = mini.last; flash.run = { from: l.from, to: l.to, ms: l.ms, out: l.out, done: l.done, dist: { X: mini.dist.X, O: mini.dist.O }, runs: { X: mini.runs.X, O: mini.runs.O }, target: mini.cfg.target }; break; }
    case 'bullseye': { const l = mini.last; flash.bull = { x: l.x, y: l.y, at: l.at.slice(), d: l.d, pts: l.pts, pos: l.pos.slice(), next: mini.pos.slice(), total: { X: mini.pts.X, O: mini.pts.O }, speed: mini.speed[p] }; break; }
    case 'echo': { const l = mini.last; flash.echo = { level: l.level, len: l.len, pass: l.pass, failAt: l.failAt, taps: l.taps.slice(), levels: { X: mini.level.X, O: mini.level.O } }; break; }
    case 'plinko': { const l = mini.last; flash.plinko = { slot: l.slot, path: l.path.slice(), bin: l.bin, win: l.win, winBin: mini.win }; break; }
    case 'pong': { const l = mini.last; flash.pong = { aim: l.aim, power: l.power, x: l.x, y: l.y, cup: l.cup, rim: l.rim, sunk: l.sunk, cups: { X: mini.cups.X.slice(), O: mini.cups.O.slice() } }; break; }
    case 'trivia': { const l = mini.last; flash.trivia = Object.assign({ q: l.q, cat: l.cat, opts: l.opts.slice(), crossed: (l.crossed || []).slice(), picked: l.picked, correct: l.correct, counts: { X: mini.right.X, O: mini.right.O } }, l.correct ? { right: l.right } : {}, l.auto ? { auto: true } : {}); break; }   // (a wrong pick: no right answer in it)
    case 'oddone': { const l = mini.last; flash.odd = { n: l.n, tiles: l.tiles.slice(), pos: l.pos, picked: l.picked, correct: l.correct, finds: { X: mini.finds.X, O: mini.finds.O } }; break; }
  }
  if (outcome === 'win') {
    const w = res.winner || p;                   // a mini-game may hand the square to the other player
    sq.owner = w;
    state.sqlog.push(Object.assign({ t: mini.type, end: 'won', w, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(mini.type) ? runLog(mini) : {}));   // (a runner: its runs and crashes, for the tuning)
    mini.winCells = res.cells || null;
    flash.winner = w; flash.counts = res.counts || null;
    const mr = mainResult(state.squares);
    if (mr) {
      state.winner = mr.winner; state.winLine = mr.line; state.winReason = mr.reason; state.counts = mr.counts || null;
      flash.kind = 'match';
    }
  } else if (outcome === 'draw') {
    flash.drawn = mini;                          // keep the full board for the result overlay
    flash.counts = res.counts || null;
    const dealt = (state.games || []).filter(t => TYPES.includes(t) && dealable(t));      // an older match's list may name a game no longer dealt
    const pool = dealt.length ? dealt : TYPES.filter(dealable);
    state.sqlog.push(Object.assign({ t: mini.type, end: 'draw', w: null, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(mini.type) ? runLog(mini) : {}));
    sq.mv = { X: 0, O: 0 };
    sq.mini = newMini(pickType(pool, rng), rng); // the square resets with a new random mini-game from this match's list
    if (sq.mini.type === 'trivia') triviaDeal(state, sq, rng);
    flash.newType = sq.mini.type;
  }
  if (!opts.forced && state.timer) state.timer.streak[p] = 0;   // a move made in time
  if (again) {
    state.lock = i;
  } else {
    state.lock = null;
    let next = other(p);
    if (!state.winner && !anyMove(state, next) && anyMove(state, p)) { flash.pass = next; next = p; }
    flash.next = next;                           // who takes over once the phone goes back to the board
    if (!state.winner) markCoins(state, next, rng);   // their turn is about to start: the coins their flips would turn
    if (!state.winner) state.done = flash;       // the move is made; the turn itself passes in leaveSquare
  }
  state.draft = ''; state.pick = null; state.sel = [];
  state.moves += 1; state.lastSquare = i; state.lastBy = p;
  state.flash = flash;
  return { ok: true, flash };
}

// The result overlay is over: the win screen if the match is decided; the same mini-game if the
// mover goes again (bonus move) or if `hold` asks for the result to stay a moment longer (Memory's
// cards turning back over); otherwise straight back to the board, where the turn passes.
function endFlash(state, hold) {
  if (!state.flash) return false;
  const f = state.flash;
  state.flash = null;
  if (state.winner) { state.screen = 'win'; state.zoom = null; state.done = null; }
  else if (f.kind === 'again') { state.screen = 'mini'; state.zoom = state.lock; }
  else if (hold && state.done) { state.screen = 'mini'; state.zoom = f.square; }
  else leaveSquare(state);
  return true;
}

// Back to the board. This is where the turn passes: the mover keeps the turn indicator while the
// result is on show, and the next player takes over as the board comes back. Just looking at a
// square passes nothing. Refused while a result is still playing out, while a bonus move is owed,
// or once the match is over.
function leaveSquare(state) {
  if (state.flash || state.lock != null || state.winner) return false;
  const d = state.done;
  state.stamp = null;
  if (d) {
    state.turn = d.next;
    state.stamp = d.kind === 'claim' ? d.square : null;
    state.stampId = d.kind === 'claim' ? `${state.id || 'm'}:${state.moves}` : null;  // this claim's stamp: it plays once, whatever re-renders follow
    state.done = null;
  }
  state.screen = 'board'; state.zoom = null; state.draft = ''; state.pick = null; state.sel = []; state.notice = null;
  return true;
}

/* ===================== Online match records (what the shared database holds) =====================
 * Over the network a match is a record { state, secrets }: `state` is what either phone may render,
 * with the hidden values of unclaimed squares left out; `secrets` keeps those values, square by square.
 * To make a move the two are joined again, the usual move logic runs, the result is settled at once
 * (the turn passes here, not after an animation) and the record is split back. state.recent keeps the
 * last few moves, so a phone that was away can play back what it missed, one move at a time.
 */
const RECENT_MAX = 8;
const MATCH_FIELDS = ['id', 'seq', 'recent', 'games', 'squares', 'turn', 'lock', 'moves', 'winner', 'winLine', 'winReason', 'resigned', 'counts', 'lastSquare', 'lastBy', 'pick', 'pickSq', 'timer', 'sqlog'];
// The hidden part of a mini-game, or null when it has none.
function secretOf(mini) {
  switch (mini.type) {
    case 'wordle': case 'hangman': return { word: mini.word };
    case 'hilo': return { target: mini.target };
    case 'bs': return { ship: mini.ship.slice() };
    case 'hunt': return { treasure: mini.treasure };
    case 'memory': return { cards: mini.cards.map(c => ({ s: c.s, c: c.c })) };
    case 'mastermind': return { code: mini.code.slice() };
    case 'bj': return mini.hand && mini.hole ? { hole: mini.hole, deck: (mini.deck || []).slice() } : null;   // only while a hand is being played
    case 'trivia': return { answer: Number.isInteger(mini.answer) ? mini.answer : null };   // the right answer's place
    case 'oddone': return { pos: { X: mini.pos ? mini.pos.X : null, O: mini.pos ? mini.pos.O : null } };   // the odd tiles' places
  }
  return null;
}
// Strip a mini-game's secret in place, leaving only what the board is allowed to show: the Hangman
// word as its pattern, the Treasure hunt's clues, the Memory cards that have been seen (or picked).
function hideMini(m, k, st) {
  if (PHYS_TYPES.includes(m.type)) { if (m.last) delete m.last.rec; return; }   // nothing hidden; the recording rides the move's entry, not the square
  switch (m.type) {
    case 'wordle': delete m.word; break;
    case 'mastermind': delete m.code; break;
    case 'bj': delete m.hole; delete m.deck; break;
    case 'trivia': delete m.answer; delete m.answers; break;
    case 'oddone': delete m.pos; break;
    case 'hangman': { const hits = new Set(m.letters.filter(x => x.hit).map(x => x.l)); m.word = m.word.split('').map(ch => (hits.has(ch) ? ch : '_')).join(''); break; }
    case 'hilo': delete m.target; break;
    case 'bs': delete m.ship; break;
    case 'hunt': m.clues = m.dug.map((d, i) => (d ? huntClue(m, i) : null)); delete m.treasure; break;   // the bands only
    case 'memory': {
      const show = new Set(m.seen || []);
      if (st && st.pickSq === k && st.pick != null) show.add(st.pick);
      m.cards = m.cards.map((c, i) => (show.has(i) ? c : null));
      break;
    }
  }
}
// The record of a match from a full state: the public state and the secrets, kept apart.
function matchRecord(full) {
  const secrets = {};
  full.squares.forEach((sq, i) => { const s = secretOf(sq.mini); if (s) secrets[i] = s; });
  const state = {};
  for (const k of MATCH_FIELDS) if (full[k] !== undefined) state[k] = JSON.parse(JSON.stringify(full[k]));
  if (!Array.isArray(state.recent)) state.recent = [];
  if (!Number.isInteger(state.seq)) state.seq = 0;
  state.squares.forEach((sq, k) => { if (!sq.owner || PHYS_TYPES.includes(sq.mini.type)) hideMini(sq.mini, k, full); });
  return { state, secrets };
}
// The full state again, from a record: the secrets back in their squares, the screen-only fields blank.
function fullState(rec) {
  const st = JSON.parse(JSON.stringify(rec.state));
  const secrets = rec.secrets || {};
  st.squares.forEach((sq, k) => {
    const s = secrets[k];
    if (s) Object.assign(sq.mini, JSON.parse(JSON.stringify(s)));
    if (sq.mini.type === 'hunt') delete sq.mini.clues;
    upgradeMini(sq.mini);
  });
  Object.assign(st, { flash: null, done: null, screen: 'board', zoom: null, draft: '', sel: [], notice: null, stamp: null, spot: null, cpu: null, online: null, confirm: null });
  if (!st.timer) st.timer = newTimer(0);
  if (!Array.isArray(st.recent)) st.recent = [];
  if (!Array.isArray(st.sqlog)) st.sqlog = [];
  if (!Array.isArray(st.games) || !st.games.length) st.games = TYPES.slice();
  return st;
}
// The move just made is settled: its result goes on the record as an entry for the phones to play
// back, and the turn passes at once (or the mover keeps it for a bonus move). The entry has the square
// as the move left it (after) and, when known, as it was before (before, from the record as it stood):
// a phone playing the move back shows the square as it was until the move plays there.
function settle(full, before) {
  const f = full.flash, sq = full.squares[f.square];
  const after = JSON.parse(JSON.stringify(sq));
  if (!after.owner || PHYS_TYPES.includes(after.mini.type)) hideMini(after.mini, f.square, full);
  full.seq = (full.seq || 0) + 1;
  const entry = Object.assign(JSON.parse(JSON.stringify(f)), { seq: full.seq, moves: full.moves, after }, before ? { before: JSON.parse(JSON.stringify(before)) } : {});
  endFlash(full, false);
  full.recent = (full.recent || []).map(e => (e.phys && e.phys.rec ? Object.assign({}, e, { phys: Object.assign({}, e.phys, { rec: null }) }) : e)).concat([entry]).slice(-RECENT_MAX);   // (a physics recording rides only the latest entry: the record stays small)
  return entry;
}
// One move by `side`, applied to a record: { ok, rec, entries } or { ok: false, reason }.
function applyOnlineMove(rec, side, i, m, rng, opts) {
  const full = fullState(rec);
  if (full.winner) return { ok: false, reason: 'over' };
  if (full.turn !== side) return { ok: false, reason: 'turn' };
  const r = playMove(full, i, m, rng, opts);
  if (!r.ok) return r;
  const entries = [settle(full, rec.state.squares && rec.state.squares[i])];
  return { ok: true, rec: matchRecord(full), entries };
}
// The player on the move ran out of time: a random move for them (Risky Rolls: a roll, then the bank), or
// the match lost on a second timeout in a row.
function applyOnlineTimeout(rec, rng) {
  const full = fullState(rec);
  const r = timeoutMove(full, rng);
  if (!r.ok) return r;
  if (r.lost) return { ok: true, rec: matchRecord(full), entries: [], lost: r.lost };
  const entries = [settle(full, rec.state.squares && full.flash && rec.state.squares[full.flash.square])];
  if (full.timer.bankNext) {
    full.timer.bankNext = false;
    if (full.lock != null && full.squares[full.lock].mini.type === 'pig') {
      const b = playMove(full, full.lock, 'bank', rng, { forced: true });
      if (b.ok) entries.push(settle(full, entries[0].after));
    }
  }
  return { ok: true, rec: matchRecord(full), entries };
}
// Memory: the first card chosen is turned up for both phones (or turned back when tapped again).
function applyOnlinePick(rec, side, i, card) {
  const full = fullState(rec);
  if (full.winner || full.turn !== side) return { ok: false, reason: 'turn' };
  const sq = full.squares[i];
  if (!sq || sq.owner || sq.mini.type !== 'memory') return { ok: false, reason: 'bad' };
  if (full.lock != null && full.lock !== i) return { ok: false, reason: 'locked' };
  if (card != null && !(Number.isInteger(card) && card >= 0 && card < 9)) return { ok: false, reason: 'bad' };
  const same = full.pickSq === i && full.pick === card;
  full.pick = card == null || same ? null : card;
  full.pickSq = full.pick == null ? null : i;
  return { ok: true, rec: matchRecord(full) };
}
// A fresh match for a room: the names, the mini-games and the time per turn from the lobby.
function newOnlineMatch(setup, rng, id) {
  const st = newState(rng);
  st.setup = Object.assign(defaultSetup(), setup || {}, { mode: 'online' });
  if (setup && setup.games) st.setup.games = Object.assign({}, st.setup.games, setup.games);
  if (!startMatch(st, rng)) return null;
  st.id = id; st.seq = 0; st.recent = [];
  return matchRecord(st);
}

// ---------- playback: how long a settled move takes to play on a phone ----------
// The turn clock allows for it, so the next player gets the full time once the move has played out.
// The phones and the server use the same figures.
const PLAY = {
  spot: 1000,                                                             // the square glows on the board before the zoom
  flash: { move: 1000, again: 650, claim: 1500, draw: 1700, match: 1300, card: 1500 },   // the result stays up this long
  flip: 500,                                                              // Memory's cards turn back over
  die: 600, spin: 1000, hop: 130,                                          // a die's tumble, the candy wheel's spin, each hop of a token
  spin3: 700, slide: 750, knock: 650,                                     // Bump's 1-2-3 spinner; a ladder climb or a snake slide; a piece knocked Home
};
const diceSlot = t => (t <= 0 ? -1 : Math.min(t, DICE_GOAL) - 1);   // a Dice race total as a track slot
// The animation of one move. winLen: how many cells a Hex win lights up.
function playMs(f, winLen) {
  const won = f.kind === 'claim' || f.kind === 'match';
  switch (f.type) {
    case 'ttt':     return won ? 950 : 450;
    case 'c4':      return won ? 1150 : 600;
    case 'bs':      return won ? 1700 : 1100;
    case 'wordle':  return 1200;
    case 'hangman': return 650;
    case 'hex':     return won ? 900 + (winLen || 4) * 90 : 450;
    case 'hilo':    return 1100;
    case 'dice':    return PLAY.die + Math.max(1, diceSlot(f.total) - diceSlot(f.total - f.roll)) * PLAY.hop + 250;
    case 'memory':  return 500;
    case 'candy':   return PLAY.spin + Math.max(1, f.to - f.from) * PLAY.hop + 250;
    case 'snakes':  return PLAY.die + Math.max(1, f.land - f.from) * PLAY.hop + (f.via ? PLAY.slide : 0) + 250;
    case 'bump':    return PLAY.spin3 + Math.max(1, f.to - f.from) * PLAY.hop + (f.bumped ? PLAY.knock : 0) + 250;
    case 'coins':   return 1050 + (f.n - 1) * 80;
    case 'pig':     return f.note === 'bank' ? 1000 : f.note === 'bust' ? 1350 : 1050;
    case 'hunt':    return won ? 1400 : 800;
    case 'hexapawn': return (f.capture ? 1000 : 500) + (won ? 600 : 0);
    case 'mastermind': return 450 + MM.pegs * 250 + (won ? 900 : 0);
    case 'bj':      return bjMs(f.bj) + (won ? 600 : 0);
    case 'bus':     return BUST.pre + BUST.draw + BUST.flip + BUST.mark + (f.bus && f.bus.right ? BUST.fly : 0) + (won ? 600 : 0);
    case 'rl':      return RLT.spin + RLT.settle + RLT.hold + (won ? 600 : 0);
    case 'craps':   return (f.craps ? crapsTimes(f.craps.rolls, f.craps.point).end : CRAPS.roll) + CRAPS.hold + (won ? 600 : 0);
    case 'takeover': return TAKEOVER_MS.place + TAKEOVER_MS.flip + (won ? 900 : 0);
    case 'seating': return PLACE_MS.mark + (f.seat && f.seat.z != null ? PLACE_MS.walk : 0) + PLACE_MS.hold + (won ? 600 : 0);
    case 'districts': return PLACE_MS.mark + PLACE_MS.hold + (won ? 900 : 0);
    case 'shelves': return PLACE_MS.mark + (f.shelf && f.shelf.grey != null ? PLACE_MS.drop : 0) + PLACE_MS.hold + (won ? 600 : 0);
    case 'roads':   return PLACE_MS.mark + (f.road && f.road.block != null ? PLACE_MS.drop : 0) + PLACE_MS.hold + (won ? 600 : 0);
    case 'flood':   return FLOOD_MS.base + (f.flood ? f.flood.waves.length : 0) * FLOOD_MS.wave + (won ? 600 : 0);
    case 'dash': case 'lane': return RUNT.bar + RUNT.hold + (won ? 600 : 0);
    case 'golf':    return (f.phys ? f.phys.ms : 3000) + GOLF.hold + (won ? 600 : 0);
    case 'pool':    return (f.phys ? f.phys.ms : 3000) + POOLG.hold + (won ? 600 : 0);
    case 'bowling': return (f.phys ? f.phys.ms : 3000) + BOWLG.hold + (won ? 600 : 0) + (f.phys && f.phys.strike ? 500 : 0);
    case 'bullseye': return BULLT.fly + BULLT.hold + (won ? 600 : 0);
    case 'echo':    return ECHO.result + (won ? 600 : 0);
    case 'plinko':  return PLINKO.rows * PLINKO.step + PLINKO.land + (won ? 600 : 0);
    case 'pong':    return PONG.fly + PONG.hold + (won ? 600 : 0);
    case 'trivia':  return TRIVIA.reveal + (won ? 600 : 0);
    case 'oddone':  return ODD.reveal + (won ? 600 : 0);
  }
  return 500;
}
// Bullseye: the dart flies in and lands where the lines crossed, then the points hold a moment.
// Echo: the attempt's result shows (the pattern itself plays before the move, when the square opens).
const BULLT = { fly: 380, hold: 800, slide: 450 };
// Takeover: the cell pops in, then its neighbours turn over; Flood: the blob changes colour, then the cells
// it grabs fill in wave by wave out from it.
const TAKEOVER_MS = { place: 280, flip: 520 };
const FLOOD_MS = { base: 650, wave: 120 };
// Seating, Districts, Shelves and Roads: the mark goes down; then the customer walks to their seat, or the
// grey mark or the block drops in; a moment's hold.
const PLACE_MS = { mark: 350, walk: 900, drop: 500, hold: 400 };   // slide: the board gliding to its next spot, as the next throw is lined up
ECHO.result = 650;
// Blackjack: each card dealt slides in and turns over; at the end of a hand the hole card turns, the dealer
// draws card by card, and the result shows. Ride the Bus: the guess shows (the chosen answer lights up,
// when it is someone else's: the computer's, the other phone's, or a timed-out one), the card slides off
// the deck and turns over, the tick or cross shows, and only then, if right, the card moves into its slot.
// (The phone that made the guess skips the first part: BUST.pre is counted here for the turn clock.)
// Roulette: the wheel spins, the ball settles in its pocket, and the hit or miss holds a second more.
const BJT = { card: 260, flip: 300, reveal: 520, draw: 520, result: 500, pushHold: 700 };
const BUST = { pre: 800, draw: 380, flip: 380, mark: 450, fly: 480 };
const RLT = { spin: 2700, settle: 450, hold: 1000 };
// When each card of a Blackjack move comes in (ms into the move): the deal (player, dealer, player, then
// the dealer's card face down), a card drawn, then at the end of a hand the hole card turning over and the
// dealer's draws; the result shows at `end`. After a push (b.next): the push shows, the cards clear at
// `swap`, and the new hand is dealt (NP, ND), settled at once if it is a natural (`nEnd`).
function bjPlan(b) {
  const T = BJT, P = [], D = [];
  let t = 0;
  const dealAt = (P, D, t0) => {
    P[0] = { slideAt: t0, flipAt: t0 + T.card }; D[0] = { slideAt: t0 + T.card, flipAt: t0 + 2 * T.card };
    P[1] = { slideAt: t0 + 2 * T.card, flipAt: t0 + 3 * T.card }; D[1] = { slideAt: t0 + 3 * T.card, flipAt: null };
    return t0 + 4 * T.card + T.flip;
  };
  const dealerPlays = (hand, D, t0) => {
    D[1] = Object.assign({}, D[1], { flipAt: t0 }); t0 += T.reveal;
    for (let k = 2; k < hand.dealer.length; k++) { D[k] = { slideAt: t0, flipAt: t0 + T.card }; t0 += T.draw; }
    return t0;
  };
  if (!b.from) t = dealAt(P, D, 0);
  else for (let k = b.from; k < b.cards.length; k++) { P[k] = { slideAt: t, flipAt: t + T.card }; t += T.card + T.flip; }
  const plan = { P, D, pEnd: t, end: t };
  if (b.res) plan.end = t = dealerPlays(b, D, t);
  if (b.next) {
    t += T.result + T.pushHold;
    plan.swap = t;
    plan.NP = []; plan.ND = [];
    plan.nPEnd = plan.nEnd = t = dealAt(plan.NP, plan.ND, t);
    if (b.next.res) plan.nEnd = dealerPlays(b.next, plan.ND, t);
  }
  return plan;
}
function bjMs(b) {
  if (!b) return 800;
  const pl = bjPlan(b);
  if (b.next) return pl.nEnd + (b.next.res ? BJT.result : 0);
  return pl.end + (b.res ? BJT.result : 0);
}
// The whole playback of settled moves on the other phone: the glow, the move, its result.
function replayMs(entries) {
  return (entries || []).reduce((ms, e) => {
    const win = e.after && e.after.mini && e.after.mini.winCells ? e.after.mini.winCells.length : 4;
    return ms + PLAY.spot + playMs(e, win) + (PLAY.flash[e.kind] || 800) + (e.type === 'memory' && e.kind === 'move' ? PLAY.flip : 0);
  }, 0);
}
// After moves are settled: the turn clock starts for whoever is on the move, at `now` (server time).
function armClock(st, entries, now) {
  const t = st.timer;
  if (!t || !t.limit) return;
  if (st.winner) { t.deadline = null; t.for = null; return; }
  t.for = st.turn; t.deadline = now + replayMs(entries) + t.limit * 1000;
}
// A player gives up the match (leaving a matchmaking game through the menu): the other side wins.
function applyOnlineResign(rec, side) {
  const full = fullState(rec);
  if (full.winner) return { ok: false, reason: 'over' };
  if (side !== 'X' && side !== 'O') return { ok: false, reason: 'bad' };
  full.winner = other(side); full.winLine = null; full.winReason = 'resign'; full.resigned = side;
  full.lock = null; full.pick = null; full.pickSq = null;
  if (full.timer) { full.timer.deadline = null; full.timer.for = null; }
  return { ok: true, rec: matchRecord(full) };
}

// A local match left through the menu: it ends as a loss for the side that left.
function resignLocal(state, side) {
  if (state.winner || (side !== 'X' && side !== 'O')) return false;
  state.winner = other(side); state.winLine = null; state.winReason = 'resign'; state.resigned = side; state.counts = null;
  state.lock = null; state.flash = null; state.done = null; state.spot = null;
  return true;
}

// ---------- stats: what a finished (or abandoned) match adds to the anonymous game stats ----------
// Every mini-game played: how it ended ('won', 'draw' when it reset, or 'open' when the match ended
// first), who won it and the turns each side spent in it. A bonus move within a turn (a Risky Rolls roll,
// a Hangman letter after a hit) is part of the same turn.
function matchStats(st) {
  const squares = (Array.isArray(st.sqlog) ? st.sqlog : []).map(e => Object.assign({ t: e.t, end: e.end, w: e.w || null, X: e.X || 0, O: e.O || 0 }, e.run ? { run: e.run } : {}));
  for (const sq of st.squares || []) {
    if (sq.owner || !sq.mv || !(sq.mv.X + sq.mv.O)) continue;
    squares.push(Object.assign({ t: sq.mini.type, end: 'open', w: null, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(sq.mini.type) ? runLog(sq.mini) : {}));
  }
  const turns = squares.reduce((n, e) => n + e.X + e.O, 0);
  return { squares, turns, winner: st.winner || null, reason: st.winReason || null };
}

// Node (the Cloud Functions and the tests): the same names as a module.
if (typeof module !== "undefined" && module.exports) module.exports = { PHYS_TYPES, PHYSICS, setPhysics, physicsReady, GOLF, POOLG, BOWLG, poolMine, physShot, wrapAim, aimTo, poolSpot, physRun, golfClear, golfNext, golfAhead, golfLeft, physLast, physScore, physCandidates, physAi, physRandom, physNeeds, RUN_TYPES, RUN_DEFAULTS, RUN_LIMITS, RUN, RUNT, RUN_CFG, r2, runNorm, setRunConfig, runConfig, runSpeed, runSecs, runAfter, runGrace, DASH_OBS, DASH, LANE, weightedPick, laneRow, runCourse, runCheck, runAuto, gaussOf, normCdf, runAiMean, runAi, runNeeds, runLog, runStart, runJump, runRelease, runLane, runLaneX, overlap, runHit, runStep, runResult, TEST_TYPES, isReleased, releasedTypes, allowedTypes, restrictGames, dealable, CRAPS, crapsRound, crapsTimes, TAKE, takeNear, takeCount, takeApply, takeSearch, FLOOD, floodNear, floodWaves, floodGain, floodApply, floodSearch, raceNeeds, TAKEOVER_MS, FLOOD_MS, PLACE_MS, SEAT, seatTable, seatMate, seatTables, seatZ, seatPick, DIST, r1d, distClip, distMap, distTally, distEval, distSearch, SHELF, shelfOn, shelfPick, ROAD, ROAD_SEGS, roadLongest, roadPick, randomEmpty, BULLS, BULLT, BULL_DEFAULTS, BULL_LIMITS, BULL_CFG, bullsNorm, setBullsConfig, bullsConfig, bullsSpot, bullsScore, bullsRates, r3, ECHO, PLINKO, PONG, TRIVIA, ODD, bullsPeriod, echoSeqs, plinkoPath, plinkoOdds, pongThrow, pongAimAt, pongDist, setTriviaBank, triviaReady, triviaDeal, triviaUsed, oddGrid, cpuEcho, CARD, BJ, BUS, RL, BJT, BUST, RLT, BUS_AVG, cardDeck, isCard, cardRank, cardRed, cardName, bjValue, bjTotal, bjNatural, bjDealerPlay, bjOutcome, bjStrategy, bjPlan, bjMs, busRight, busDeck, busOdds, rlRed, rlBet, rlCovers, tttOpen, lineOpen, majorityResult, STYLE0, huntSize, huntBand, huntClue, normTimer, resignLocal, TYPES, OLD_TYPES, SNL, BUMP, snlRow, snlBoard, snlValid, snlExpected, coinPick, markCoins, coinMarksFor, normLocal, seatLocal, INFO, C4, HP, MM, HEX_N, HILO, CANDY, NAME_MAX, COINS, RISKY, BS, HUNT, DICE_GOAL, MEMORY, LINES, WORDS5, WORDS_HANG, VALID5, other, makeRng, needRng, randInt, randomType, shuffle, memoryDeck, wordleMarks, hexNeighbors, hexPath, canMove, hpMoves, mmFeedback, mmValid, MM_ALL, mmAll, mmCode, mmCandidates, mmBestGuess, hpGoalRow, upgradeMini, anyMove, huntDist, candyTrack, newMini, pickType, newSquare, CPU_NAME, defaultSetup, cpuSide, normSetup, syncNames, enabledGames, TIMER_OPTIONS, newTimer, playerName, newState, startMatch, newMatch, findRun, applyMove, AI, publicMini, wordleCandidates, hangmanCandidates, bsCandidates, bsPlacements, bsShip, huntCandidates, WINDOWS, windowsOf, lineNeeds, c4Playable, hexDist, candyExpected, COIN_NEEDS, needsOf, memoryPair, winChance, tttMinimax, c4Drop, c4Eval, C4_ORDER, c4Search, C4_DEPTH, c4Moves, HP_MEMO, hpSolve, hpMovesValued, hpNeeds, hexMoves, threatScore, pickValued, localBest, squareValue, moveGain, cpuMove, VALID5_LIST, randomLegalMove, timeoutMove, mainResult, playMove, endFlash, leaveSquare, RECENT_MAX, MATCH_FIELDS, secretOf, hideMini, matchRecord, fullState, settle, applyOnlineMove, applyOnlineTimeout, applyOnlinePick, newOnlineMatch, PLAY, diceSlot, playMs, replayMs, armClock, applyOnlineResign, matchStats };
