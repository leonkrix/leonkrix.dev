import { describe, expect, it } from 'vitest';

import { activeFormSecret, MAIL_SETTINGS, smtpEnv } from './config';

describe('MAIL_SETTINGS', () => {
  it('uses the IONOS submission port with STARTTLS (587) and valid addresses', () => {
    expect(MAIL_SETTINGS.host).toBe('smtp.ionos.de');
    expect(MAIL_SETTINGS.port).toBe('587');
    for (const address of [MAIL_SETTINGS.user, MAIL_SETTINGS.from, MAIL_SETTINGS.to]) {
      expect(address).toMatch(/^[^@\s]+@leonkrix\.dev$/);
    }
  });

  it('contains no secret: no password or token like fields', () => {
    expect(Object.keys(MAIL_SETTINGS).join(' ')).not.toMatch(/pass|secret|token/i);
  });
});

describe('activeFormSecret', () => {
  const secret = 'x'.repeat(32);

  it('returns the secret only when the form is switched on and the secret is long enough', () => {
    expect(activeFormSecret({ FORM_SECRET: secret, CONTACT_ENABLED: 'true' })).toBe(secret);
    expect(activeFormSecret({ FORM_SECRET: secret })).toBeUndefined();
    expect(activeFormSecret({ FORM_SECRET: secret, CONTACT_ENABLED: 'yes' })).toBeUndefined();
    expect(activeFormSecret({ CONTACT_ENABLED: 'true' })).toBeUndefined();
    expect(
      activeFormSecret({ FORM_SECRET: 'x'.repeat(31), CONTACT_ENABLED: 'true' }),
    ).toBeUndefined();
  });
});

describe('smtpEnv', () => {
  it('combines the fixed settings with the password from the secret', () => {
    expect(smtpEnv({ SMTP_PASSWORD: 'pw' })).toEqual({
      SMTP_HOST: 'smtp.ionos.de',
      SMTP_PORT: '587',
      SMTP_USER: 'hello@leonkrix.dev',
      SMTP_PASSWORD: 'pw',
    });
  });

  it('leaves the password undefined when the secret is missing', () => {
    expect(smtpEnv({}).SMTP_PASSWORD).toBeUndefined();
  });
});
