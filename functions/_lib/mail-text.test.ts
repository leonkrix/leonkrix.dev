import { describe, expect, it } from 'vitest';

import { MAIL_SETTINGS } from './config';
import { buildMail } from './mail-text';

const contact = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hello Leon,\nnice site!',
};

describe('buildMail', () => {
  it('uses the agreed subject and the fixed sender and recipient', () => {
    const mail = buildMail(contact);
    expect(mail.subject).toBe('[leonkrix.dev] New message from Ada Lovelace');
    expect(mail.from).toBe(MAIL_SETTINGS.from);
    expect(mail.to).toBe(MAIL_SETTINGS.to);
  });

  it('puts the visitor only into Reply-To and the text', () => {
    const mail = buildMail(contact);
    expect(mail.replyTo).toBe('ada@example.com');
    expect(mail.from).not.toContain('example.com');
    expect(mail.to).not.toContain('example.com');
    expect(mail.text).toContain('Name: Ada Lovelace');
    expect(mail.text).toContain('Email: ada@example.com');
    expect(mail.text).toContain('Hello Leon,\nnice site!');
  });

  it('cannot inject headers through the name or the email', () => {
    const mail = buildMail({
      name: 'Eve\r\nBcc: victim@example.com',
      email: 'eve@example.com\r\nBcc: victim@example.com',
      message: 'x'.repeat(20),
    });
    for (const header of [mail.subject, mail.replyTo ?? '']) {
      expect(header).not.toMatch(/[\r\n]/);
    }
    expect(mail.subject).toBe('[leonkrix.dev] New message from Eve Bcc: victim@example.com');
  });

  it('treats unicode line separators and control characters in the name as spaces', () => {
    const separator = String.fromCodePoint(0x2028);
    const bell = String.fromCodePoint(0x07);
    const mail = buildMail({ ...contact, name: `Ada${separator}${bell}Lovelace` });
    expect(mail.subject).toBe('[leonkrix.dev] New message from Ada Lovelace');
  });

  it('keeps the message text unchanged', () => {
    expect(buildMail(contact).text).toContain(contact.message);
  });
});
