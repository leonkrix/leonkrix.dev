/**
 * Example words for the kinds of things that can be hidden in the German Word Radar (our own
 * list). OdeNet says which nouns have a sense that is an everyday thing, but its senses are not
 * always right ("Macht" has the sense of a starch, "Kinder" of a young animal), so a noun is only
 * hidden when its numbers are also close to these examples: the words of each kind are averaged
 * and a candidate has to be near one of those averages (see `german.ts`, `nearestKind`).
 */
export const seedWords: Readonly<Record<string, readonly string[]>> = {
  animals:
    `hund katze pferd kuh schwein schaf ziege huhn hase fuchs wolf bär löwe tiger elefant affe
    maus ratte igel reh hirsch adler eule ente gans taube spatz frosch schlange fisch hai wal delfin
    biene ameise schmetterling spinne käfer krebs esel hamster kanarienvogel pinguin giraffe zebra
    krokodil schildkröte eichhörnchen`.split(/\s+/),
  plants: `baum blume rose tulpe gras busch eiche tanne birke farn moos kaktus pilz klee weizen mais
    sonnenblume gänseblümchen lavendel efeu bambus palme buche kiefer weide`.split(/\s+/),
  food: `brot käse butter milch ei apfel birne banane tomate kartoffel nudel reis suppe kuchen
    schokolade wurst schinken honig zucker salz kaffee tee bier wein saft keks marmelade joghurt
    erdbeere kirsche zitrone gurke karotte salat bohne pizza torte brötchen`.split(/\s+/),
  body: `hand fuß kopf arm bein auge ohr nase mund zahn zunge herz lunge knie finger haar rücken bauch
    schulter hals daumen zeh ellbogen lippe stirn wange kinn hüfte magen`.split(/\s+/),
  things:
    `tisch stuhl bett schrank lampe uhr messer gabel löffel teller tasse glas flasche schlüssel
    tür fenster spiegel hammer säge schere auto fahrrad zug schiff flugzeug haus brücke turm kirche
    schuh hose jacke hut brille buch stift telefon computer regenschirm koffer kissen decke
    teppich sofa herd kühlschrank eimer seife handtuch kerze schlüssel`.split(/\s+/),
  nature:
    `regen schnee wind sturm donner blitz nebel wolke sonne mond stern feuer eis berg fluss see
    meer wüste vulkan insel strand wald wiese tal hügel quelle bach welle gewitter regenbogen
    sand erde`.split(/\s+/),
  vehicles: `auto bus zug fahrrad schiff boot flugzeug traktor lkw motorrad straßenbahn hubschrauber
    taxi lokomotive wagen roller kutsche rakete`.split(/s+/),
  buildings: `haus hotel bahnhof kirche schule schloss museum kino fabrik garage scheune stall turm
    brücke bank restaurant bäckerei krankenhaus flughafen hütte burg supermarkt bibliothek theater`.split(
    /s+/,
  ),
  clothes: `hose jacke hut schuh kleid mantel pullover socke mütze schal handschuh hemd rock gürtel
    stiefel krawatte anzug bluse`.split(/s+/),
  tools: `hammer säge schere zange schraube nagel bohrer schaufel axt leiter pinsel besen werkzeug
    schlüssel kamera lampe batterie kabel`.split(/s+/),
  instruments: `gitarre klavier geige trompete flöte trommel orgel harfe saxophon violine`.split(
    /s+/,
  ),
  materials:
    `holz stein eisen gold silber glas papier sand wasser öl wolle leder plastik beton stahl
    kupfer ton lehm gummi stoff seide baumwolle kohle salz`.split(/\s+/),
};

/**
 * Example names (first names, surnames, places and countries). The Wiktionary has pages for names,
 * and a name is no word of the game; names are found by their numbers: a word that is close to
 * these examples and unknown to OdeNet is left out (see `build-data-de.ts`).
 */
export const nameSeeds: Readonly<Record<string, readonly string[]>> = {
  first: `anna maria peter michael thomas andreas stefan markus julia sabine katharina alexander
    daniel lisa laura sophie hans karl max lena christian martin jan tim paul lukas felix jonas
    sarah nicole petra monika susanne claudia barbara helmut wolfgang jürgen klaus uwe frank`.split(
    /\s+/,
  ),
  last: `müller schmidt schneider fischer weber meyer wagner becker schulz hoffmann krüger schäfer
    koch bauer richter klein wolf schröder neumann braun zimmermann krause`.split(/\s+/),
  places: `berlin hamburg münchen köln frankfurt stuttgart leipzig dresden bremen hannover nürnberg
    deutschland österreich schweiz frankreich italien spanien england london paris wien zürich
    bayern sachsen hessen thüringen brandenburg europa amerika russland polen`.split(/\s+/),
};
