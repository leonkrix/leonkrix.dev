import { describe, expect, it } from 'vitest';

import { MAIL_SETTINGS, smtpEnv } from './config';

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
