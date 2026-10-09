import { type TechTerm } from '../../shared/tech-term';
import { type WordLength } from '../logic/select';

/**
 * The terms of one word length. Every length is its own chunk, so a visitor downloads only the list
 * that is needed for the round (the five-letter list is the biggest one).
 */
export async function loadTerms(length: WordLength): Promise<readonly TechTerm[]> {
  switch (length) {
    case 3:
      return (await import('./terms-3')).terms3;
    case 4:
      return (await import('./terms-4')).terms4;
    case 5:
      return (await import('./terms-5')).terms5;
  }
}
