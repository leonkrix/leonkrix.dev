import { hashSeed } from '../../shared/random';
import { type Story } from './stories';
import { skinWords } from './words';

/**
 * Titles and stories for levels made on the spot. The templates only speak about the victim and
 * say that exactly one suspect shared a room with it: no suspect, no room, no kind of room.
 */
const CASE_FILE_STORIES: readonly string[] = [
  '{victim} was found behind a closed door with exactly one suspect. Everybody else swears to have been somewhere else.',
  'Something went wrong after hours, and {victim} is the one who knows. Exactly one suspect shared a room with them.',
  '{victim} left the meeting early. Later it turned out that exactly one suspect had shared a room with them.',
  'Nobody saw {victim} leave. Looking at the map, exactly one suspect had been in the same room with them.',
  'The release is broken and {victim} is not answering. Exactly one suspect shared a room with them, and the clues will tell you who.',
  'A quiet hour, a lot of people and one {victim}. Of all the suspects, exactly one shared a room with them.',
];

const OUTAGE_STORIES: readonly string[] = [
  '{victim} dropped off the network. Exactly one other device shared a room with it. Find the root cause.',
  'The alert says {victim} is down. Looking back, exactly one other device had shared a room with it.',
  '{victim} stopped responding in the middle of the night. Only one device was in the same room with it. Which one?',
  'Graphs flat, pager loud: {victim} is gone. Exactly one device shared a room with it, and that one is your root cause.',
  'Nobody touched {victim}, and still it failed. Of all the devices, exactly one shared a room with it.',
  'A routine change, then silence from {victim}. Exactly one device shared a room with it. Which?',
];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The title and story of a random level. The same seed always gives the same text.
 * `victim` is the name of the failed device, or the role of the victim in Case file.
 */
export function randomStory(
  skin: 'case-file' | 'outage',
  seed: string,
  victim: { name: string; role: string },
): Story {
  const hash = hashSeed(seed);
  const code = hash.toString(36).toUpperCase().padStart(4, '0').slice(-4);
  if (skin === 'outage') {
    const template = OUTAGE_STORIES[hash % OUTAGE_STORIES.length] ?? '';
    return {
      title: `Incident ${code}`,
      story: template.replace('{victim}', victim.name),
    };
  }
  const noun = skinWords['case-file'].roles[victim.role]?.one ?? victim.role;
  const phrase = `the ${noun.replace(/^(an?|the) /, '')}`;
  const template = CASE_FILE_STORIES[hash % CASE_FILE_STORIES.length] ?? '';
  const text = template.replace('{victim}', phrase);
  return { title: `Case ${code}`, story: capitalize(text) };
}
