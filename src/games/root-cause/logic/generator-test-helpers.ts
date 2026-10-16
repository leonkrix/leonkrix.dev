import { caseFile, outage } from '../data/skins';
import { type Skin } from './skin';

export const SKINS: readonly Skin[] = [caseFile, outage];

/** Generating takes a moment: these tests get more time than the usual five seconds */
export const SLOW = 120_000;

/** A value the test cannot go on without: fails with a clear message when it is missing */
export function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error('Expected ' + what + ', but there was none');
  }
  return value;
}
