import { describe, expect, it } from 'vitest';

import {
  countCharacters,
  isHoneypotFilled,
  isValidEmail,
  LIMITS,
  validateContact,
  type ValidationResult,
} from './contact';

const goodName = 'Leon Krix';
const goodEmail = 'visitor@example.com';
const goodMessage = 'Hello Leon, I would like to talk about a project.';

function validate(overrides: Record<string, unknown> = {}): ValidationResult {
  return validateContact({ name: goodName, email: goodEmail, message: goodMessage, ...overrides });
}

/** The error code of one field, or undefined when the field is valid. */
function codeOf(field: 'name' | 'email' | 'message', value: unknown): string | undefined {
  const result = validate({ [field]: value });
  return result.ok ? undefined : result.errors[field]?.code;
}

describe('countCharacters', () => {
  it('counts what a person sees: an emoji is one character', () => {
    expect(countCharacters('abc')).toBe(3);
    expect(countCharacters('😀')).toBe(1);
    expect(countCharacters('😀'.repeat(10))).toBe(10);
  });
});

describe('name', () => {
  it.each(['Leon Krix', 'Ng', 'Zoë', 'Ольга Иванова', '李雷', "O'Brien-Smith", 'Jean-Luc', '12'])(
    'accepts "%s"',
    (name) => {
      expect(codeOf('name', name)).toBeUndefined();
    },
  );

  it('trims, collapses inner spaces and treats line breaks and tabs as spaces', () => {
    for (const [input, expected] of [
      ['  Leon   Krix  ', 'Leon Krix'],
      ['Leon\nKrix', 'Leon Krix'],
      ['Leon\r\n\tKrix', 'Leon Krix'],
    ] as const) {
      const result = validate({ name: input });
      expect(result.ok && result.value.name).toBe(expected);
    }
  });

  it('normalizes Unicode to the composed form (NFC)', () => {
    const result = validate({ name: 'Zoé' });
    expect(result.ok && result.value.name).toBe('Zoé');
  });

  describe('length boundaries', () => {
    it('1 character is too short, 2 is the minimum', () => {
      expect(codeOf('name', 'a')).toBe('too_short');
      expect(codeOf('name', 'ab')).toBeUndefined();
    });

    it('80 characters are fine, 81 are too long', () => {
      expect(codeOf('name', 'a'.repeat(LIMITS.name.max))).toBeUndefined();
      expect(codeOf('name', 'a'.repeat(LIMITS.name.max + 1))).toBe('too_long');
    });

    it('counts emoji as one character each', () => {
      expect(codeOf('name', `${'😀'.repeat(LIMITS.name.max - 1)}a`)).toBeUndefined();
      expect(codeOf('name', `${'😀'.repeat(LIMITS.name.max)}a`)).toBe('too_long');
    });

    it('does not count spaces at the edges', () => {
      expect(codeOf('name', ` a${' '.repeat(10)} `)).toBe('too_short');
    });
  });

  it.each([undefined, null, '', '   ', '\n\t', 123, true, [], {}, ['Leon']])(
    'requires a text, got %j',
    (value) => {
      expect(codeOf('name', value)).toBe('required');
    },
  );

  it.each(['😀😀', '!!', '--', '. .'])(
    'needs at least one letter or digit, "%s" has none',
    (name) => {
      expect(codeOf('name', name)).toBe('no_letters');
    },
  );

  it('treats a byte order mark at the edge of a name like whitespace and removes it', () => {
    const result = validate({ name: '\uFEFFLeon\uFEFF' });
    expect(result.ok && result.value.name).toBe('Leon');
  });

  it.each(['Le\u0000on', 'Leon\u0007', 'Leon\u007F', 'Leon\u0085', 'Leon\u202EKrix'])(
    'rejects control and spoofing characters in %j',
    (name) => {
      expect(codeOf('name', name)).toBe('invalid_characters');
    },
  );
});

describe('email', () => {
  const valid = [
    'a@b.co',
    'visitor@example.com',
    'first.last+tag@sub.example.com',
    "o'brien@example.ie",
    'user_name@exa-mple.org',
    'x@a1.b2.example.co.uk',
    'user@example.xn--p1ai',
    'UPPER@EXAMPLE.COM',
  ];
  const invalid = [
    'plain',
    'a@',
    '@b.co',
    'a@@b.co',
    'a@b@c.co',
    'a b@c.co',
    '.a@b.co',
    'a.@b.co',
    'a..b@c.co',
    'a@localhost',
    'a@b.c',
    'a@-b.co',
    'a@b-.co',
    'a@b..co',
    'a@.co',
    'a@b.co.',
    'a@b.123',
    'a@[127.0.0.1]',
    'ä@b.co',
    'a@bü.de',
    '"a b"@c.co',
    '<a@b.co>',
    'Name <a@b.co>',
    'a@b.co,c@d.com',
    'a@b.co;c@d.com',
    'a@b.co c@d.com',
  ];

  it.each(valid)('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
    expect(codeOf('email', email)).toBeUndefined();
  });

  it.each(invalid)('rejects %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
    expect(codeOf('email', email)).toBe('invalid_email');
  });

  it('trims spaces around the address', () => {
    const result = validate({ email: '  visitor@example.com  ' });
    expect(result.ok && result.value.email).toBe('visitor@example.com');
  });

  it('keeps the case the visitor typed', () => {
    const result = validate({ email: 'Visitor@Example.com' });
    expect(result.ok && result.value.email).toBe('Visitor@Example.com');
  });

  describe('length boundaries', () => {
    it('allows 64 characters before the @ and rejects 65', () => {
      expect(isValidEmail(`${'a'.repeat(LIMITS.email.localMax)}@b.co`)).toBe(true);
      expect(isValidEmail(`${'a'.repeat(LIMITS.email.localMax + 1)}@b.co`)).toBe(false);
    });

    it('allows exactly 254 characters in total and rejects 255', () => {
      const domain = (lastLabel: number) =>
        `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(lastLabel)}.com`;
      const at254 = `${'a'.repeat(64)}@${domain(57)}`;
      const at255 = `${'a'.repeat(64)}@${domain(58)}`;
      expect(at254).toHaveLength(254);
      expect(at255).toHaveLength(255);
      expect(codeOf('email', at254)).toBeUndefined();
      expect(codeOf('email', at255)).toBe('too_long');
    });

    it('allows domain labels of 63 characters and rejects 64', () => {
      expect(isValidEmail(`a@${'b'.repeat(63)}.co`)).toBe(true);
      expect(isValidEmail(`a@${'b'.repeat(64)}.co`)).toBe(false);
    });
  });

  it.each([undefined, null, '', '   ', 42, [], {}])('requires a text, got %j', (value) => {
    expect(codeOf('email', value)).toBe('required');
  });

  describe('header injection', () => {
    // The address becomes the Reply-To header of a mail. Nothing with a line break may pass.
    it.each([
      'a@b.co\nBcc: attacker@example.com',
      'a@b.co\r\nSubject: hacked',
      'a@b.co%0ABcc:x@y.com',
      'a@b.co\u0000',
      'a@b.co\u2028Bcc: x@y.com',
    ])('rejects %j', (email) => {
      expect(isValidEmail(email)).toBe(false);
      expect(codeOf('email', email)).toBe('invalid_email');
    });
  });

  it('checks long hostile input in linear time (no catastrophic backtracking)', () => {
    const started = performance.now();
    for (const email of [
      `${'a.'.repeat(120)}@`,
      `${'a'.repeat(250)}!`,
      `a@${'b-'.repeat(120)}`,
      `a@${'b.'.repeat(120)}`,
      `${'!'.repeat(200)}@${'x'.repeat(40)}`,
    ]) {
      isValidEmail(email);
    }
    expect(performance.now() - started).toBeLessThan(100);
  });
});

describe('message', () => {
  const text = (length: number) => 'x'.repeat(length);

  describe('length boundaries', () => {
    it('19 characters are too short, 20 are the minimum', () => {
      expect(codeOf('message', text(LIMITS.message.min - 1))).toBe('too_short');
      expect(codeOf('message', text(LIMITS.message.min))).toBeUndefined();
    });

    it('2000 characters are fine, 2001 are too long', () => {
      expect(codeOf('message', text(LIMITS.message.max))).toBeUndefined();
      expect(codeOf('message', text(LIMITS.message.max + 1))).toBe('too_long');
    });

    it('does not count spaces and line breaks at the edges', () => {
      expect(codeOf('message', `  \n${text(LIMITS.message.min - 1)}\n  `)).toBe('too_short');
      expect(codeOf('message', `  \n${text(LIMITS.message.min)}\n  `)).toBeUndefined();
    });

    it('counts emoji as one character each', () => {
      expect(codeOf('message', '😀'.repeat(LIMITS.message.min))).toBeUndefined();
      expect(codeOf('message', '😀'.repeat(LIMITS.message.max))).toBeUndefined();
      expect(codeOf('message', '😀'.repeat(LIMITS.message.max + 1))).toBe('too_long');
    });
  });

  it.each([undefined, null, '', '   ', '\n\n\t', 0, [], {}, ['text']])(
    'requires a text, got %j',
    (value) => {
      expect(codeOf('message', value)).toBe('required');
    },
  );

  it('normalizes Windows and old Mac line breaks to "\\n"', () => {
    const result = validate({ message: 'first line is long enough\r\nsecond line\rthird line' });
    expect(result.ok && result.value.message).toBe(
      'first line is long enough\nsecond line\nthird line',
    );
  });

  it('keeps line breaks and tabs inside the message', () => {
    const result = validate({ message: 'First paragraph here.\n\n\tIndented second paragraph.' });
    expect(result.ok && result.value.message).toBe(
      'First paragraph here.\n\n\tIndented second paragraph.',
    );
  });

  it('accepts emoji sequences with joiners (a family emoji contains U+200D)', () => {
    expect(codeOf('message', 'Hello 👨‍👩‍👧 this is a nice message')).toBeUndefined();
  });

  it('accepts text in other scripts', () => {
    expect(codeOf('message', 'Привет! Меня зовут Иван, я хочу поговорить.')).toBeUndefined();
    expect(codeOf('message', '你好，我想和你谈谈一个项目合作的事情，请回复我。')).toBeUndefined();
  });

  it.each([
    'null byte \u0000 inside the message text',
    'backspace \u0008 inside the message text',
    'escape \u001B[31m inside the message text',
    'delete \u007F inside the message text',
    'next line \u0085 inside the message text',
    'right to left \u202E override in the text',
    'isolate \u2066 in the message text here',
    'byte order mark \uFEFF in the message text',
  ])('rejects control and spoofing characters in %j', (message) => {
    expect(codeOf('message', message)).toBe('invalid_characters');
  });

  it('treats text that looks like mail headers as plain text (it only ends up in the body)', () => {
    const result = validate({
      message: 'Hello there, please read this.\r\nBcc: attacker@example.com\r\nSubject: hacked',
    });
    expect(result.ok && result.value.message).toBe(
      'Hello there, please read this.\nBcc: attacker@example.com\nSubject: hacked',
    );
  });

  it('normalizes Unicode to the composed form (NFC)', () => {
    const result = validate({ message: `Café ${'x'.repeat(20)}` });
    expect(result.ok && result.value.message.startsWith('Café')).toBe(true);
  });
});

describe('validateContact', () => {
  it('returns the normalized values of a valid form', () => {
    const result = validateContact({
      name: '  Leon   Krix ',
      email: ' visitor@example.com ',
      message: `  ${goodMessage}\r\n `,
    });
    expect(result).toEqual({
      ok: true,
      value: { name: 'Leon Krix', email: 'visitor@example.com', message: goodMessage },
    });
  });

  it('reports all problems at once, so the visitor can fix them in one go', () => {
    const result = validateContact({ name: 'a', email: 'nope', message: 'short' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['email', 'message', 'name']);
      expect(result.errors.name?.code).toBe('too_short');
      expect(result.errors.email?.code).toBe('invalid_email');
      expect(result.errors.message?.code).toBe('too_short');
    }
  });

  it('gives every error a readable message for the visitor', () => {
    const result = validateContact({ name: 'a', email: 'nope', message: 'short' });
    if (!result.ok) {
      for (const error of Object.values(result.errors)) {
        expect(error.message).toMatch(/^[A-Z].*\.$/);
      }
    }
  });

  it.each([undefined, null, 'text', 42, true, [], [{ name: goodName }]])(
    'treats %j as an empty form',
    (input) => {
      const result = validateContact(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(Object.keys(result.errors).sort()).toEqual(['email', 'message', 'name']);
        for (const error of Object.values(result.errors)) {
          expect(error.code).toBe('required');
        }
      }
    },
  );

  it('ignores unknown fields and returns only the three known ones', () => {
    const result = validateContact({
      name: goodName,
      email: goodEmail,
      message: goodMessage,
      isAdmin: true,
      to: 'someone@else.com',
      subject: 'injected',
      website: '',
    });
    expect(result.ok && Object.keys(result.value).sort()).toEqual(['email', 'message', 'name']);
  });

  it('is not affected by prototype pollution payloads', () => {
    const hostile = JSON.parse(
      `{"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}, ` +
        `"name": "${goodName}", "email": "${goodEmail}", "message": "${goodMessage}"}`,
    ) as unknown;
    const result = validateContact(hostile);
    expect(result.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('handles very large input without trouble', () => {
    const started = performance.now();
    const result = validateContact({
      name: 'a'.repeat(1_000_000),
      email: 'b'.repeat(1_000_000),
      message: 'c'.repeat(1_000_000),
    });
    expect(result.ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('isHoneypotFilled', () => {
  it.each([undefined, null, '', '   ', '\n'])('is false for %j', (website) => {
    expect(isHoneypotFilled({ website })).toBe(false);
  });

  it.each(['https://spam.example', 'x', 1, true, {}, []])('is true for %j', (website) => {
    expect(isHoneypotFilled({ website })).toBe(true);
  });

  it('is false when the field is missing or the input is not an object', () => {
    expect(isHoneypotFilled({})).toBe(false);
    expect(isHoneypotFilled(null)).toBe(false);
    expect(isHoneypotFilled('website')).toBe(false);
    expect(isHoneypotFilled(undefined)).toBe(false);
  });
});

describe('LIMITS', () => {
  it('matches the agreed rules', () => {
    expect(LIMITS.name).toEqual({ min: 2, max: 80 });
    expect(LIMITS.email.max).toBe(254);
    expect(LIMITS.email.localMax).toBe(64);
    expect(LIMITS.message).toEqual({ min: 20, max: 2000 });
  });
});
