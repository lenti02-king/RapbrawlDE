// Arena catalogue for the arena select screen (ids match GameView's arena switch). Thumbnails are in-game renders
// made by scripts/arena-thumbs.mjs. Locked entries are announced arenas without a scene yet.
import PODCAST from './img/arena-podcast.jpg?inline';
import TOON from './img/arena-toon.jpg?inline';
import CLUB from './img/arena-club.jpg?inline';
import COURT from './img/arena-courtyard.jpg?inline';
import FESTIVAL from './img/arena-festival.jpg?inline';
import BAHNHOF from './img/arena-bahnhof.jpg?inline';

export interface ArenaInfo {
  id: string;
  name: string;
  district: string;
  desc: string;
  time: string;
  mood: string;
  crowd: string;
  img: string;
  locked?: boolean;
}

export const ARENAS: ArenaInfo[] = [
  {
    id: 'festival',
    name: 'FESTIVAL-BÜHNE',
    district: 'OPEN AIR · BAGGERSEE',
    desc: 'Sonnenuntergang zwischen den alten Riesenbaggern: Main Stage, CO2-Kanonen, Lichtkegel – und vorne eskaliert der Moshpit.',
    time: 'SONNENUNTERGANG',
    mood: 'FESTIVAL',
    crowd: 'MOSHPIT',
    img: FESTIVAL,
  },
  {
    id: 'bahnhof',
    name: 'BAHNHOFSVIERTEL',
    district: 'FRANKFURT · 069',
    desc: 'Nasser Asphalt, Neon, Kiosk an der Ecke. Die Rockergang vor der Bar schaut ganz genau zu, wer hier steht.',
    time: 'NACHT',
    mood: 'GEFÄHRLICH',
    crowd: 'ROCKER',
    img: BAHNHOF,
  },
  {
    id: 'podcast',
    name: 'BLOCK BEATS STUDIO',
    district: 'STUDIO · BLOCK 1',
    desc: 'Der Podcast, in dem Beef entsteht – und geklärt wird. Mikros an, Kamera läuft, die Couch hat schon Schlimmeres gesehen.',
    time: 'NACHT',
    mood: 'ON AIR',
    crowd: 'LIVESTREAM',
    img: PODCAST,
  },
  {
    id: 'toon',
    name: 'HINTERHOF-BÜHNE',
    district: 'HINTERHOF · BLOCK 3',
    desc: 'Blockparty zwischen Boxentürmen und bunten Kisten. Die ganze Nachbarschaft hängt aus den Fenstern und filmt mit.',
    time: 'ABEND',
    mood: 'BLOCKPARTY',
    crowd: 'NACHBARN',
    img: TOON,
  },
  {
    id: 'club',
    name: 'NEON KELLER',
    district: 'KELLER · BLOCK 5',
    desc: 'Bass bis in die Knochen, LED-Wand, Nebel. Hier unten wird jeder Drop zum Finisher.',
    time: '3 UHR',
    mood: 'RAVE',
    crowd: 'AUSVERKAUFT',
    img: CLUB,
  },
  {
    id: 'courtyard',
    name: 'STREET COURT',
    district: 'KÄFIG · BLOCK 9',
    desc: 'Basketballkäfig unterm Hallendach, Soundsystem auf der Bühne, Asphalt mit Geschichte.',
    time: 'NACHT',
    mood: 'ROH',
    crowd: 'STREET',
    img: COURT,
  },
  { id: 'roof', name: 'DACHTERRASSE', district: 'BALD', desc: 'Skyline-Kampf über den Dächern. Kommt in Saison 2.', time: '?', mood: '?', crowd: '?', img: TOON, locked: true },
  { id: 'ubahn', name: 'U-BAHN', district: 'BALD', desc: 'Letzte Bahn, keine Regeln. Kommt in Saison 2.', time: '?', mood: '?', crowd: '?', img: CLUB, locked: true },
];

export function arenaInfo(id: string): ArenaInfo {
  return ARENAS.find((a) => a.id === id && !a.locked) ?? ARENAS[0];
}
