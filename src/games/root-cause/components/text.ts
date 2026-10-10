import { type SkinWords } from '../data/words';

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The name of a role for a label: "Developer", "CEO", "Access point" */
export function roleLabel(words: SkinWords, role: string): string {
  const noun = words.roles[role]?.one ?? role;
  return capitalize(noun.replace(/^(an?|the) /, ''));
}
