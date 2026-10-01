import type { ContactInput } from '../../src/lib/contact';
import { MAIL_SETTINGS } from './config';
import type { OutgoingMail } from './smtp-mailer';

/** Anything that could end a header line or smuggle another header becomes a space. */
function singleLine(text: string): string {
  let result = '';
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isControl = codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);
    const isLineSeparator = codePoint === 0x2028 || codePoint === 0x2029;
    result += isControl || isLineSeparator ? ' ' : character;
  }
  return result.replace(/ {2,}/g, ' ').trim();
}

/**
 * The mail to Leon. Sender and recipient are fixed (this is not a relay), the visitor only appears
 * as Reply-To and in the text. The input must already have passed validateContact.
 */
export function buildMail(contact: ContactInput): OutgoingMail {
  const name = singleLine(contact.name);
  const email = singleLine(contact.email);
  return {
    from: MAIL_SETTINGS.from,
    to: MAIL_SETTINGS.to,
    replyTo: email,
    subject: `[leonkrix.dev] New message from ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      '',
      contact.message,
      '',
      '--',
      'Sent through the contact form on leonkrix.dev. Reply to this mail to answer the sender.',
    ].join('\n'),
  };
}
