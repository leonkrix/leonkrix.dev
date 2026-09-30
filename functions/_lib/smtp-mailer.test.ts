import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendMail, type SmtpEnv } from './smtp-mailer';

// worker-mailer needs the Workers runtime (cloudflare:sockets), so it is replaced in unit tests.
// The real SMTP round trip was verified with the spike against IONOS, locally and on Cloudflare.
const { connect, send, close } = vi.hoisted(() => ({
  connect: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
}));
vi.mock('worker-mailer', () => ({ WorkerMailer: { connect } }));

const env: SmtpEnv = {
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_USER: 'user@example.test',
  SMTP_PASSWORD: 'secret-password',
};

const mail = { from: 'a@example.test', to: 'b@example.test', subject: 'Hi', text: 'Body' };

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue(undefined);
  close.mockResolvedValue(undefined);
  connect.mockResolvedValue({ send, close });
});

describe('sendMail', () => {
  it('connects with STARTTLS and authentication, sends the mail and closes', async () => {
    await sendMail(env, mail);

    expect(connect).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 587,
      secure: false,
      startTls: true,
      authType: 'plain',
      credentials: { username: 'user@example.test', password: 'secret-password' },
    });
    expect(send).toHaveBeenCalledWith({
      from: 'a@example.test',
      to: 'b@example.test',
      subject: 'Hi',
      text: 'Body',
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it('sets the reply address when given', async () => {
    await sendMail(env, { ...mail, replyTo: 'visitor@example.test' });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ reply: 'visitor@example.test' }));
  });

  it('closes the connection even when sending fails, and passes the error on', async () => {
    send.mockRejectedValue(new Error('550 mailbox unavailable'));
    await expect(sendMail(env, mail)).rejects.toThrow('550 mailbox unavailable');
    expect(close).toHaveBeenCalledOnce();
  });

  it('passes a connection error on without trying to send', async () => {
    connect.mockRejectedValue(new Error('connection refused'));
    await expect(sendMail(env, mail)).rejects.toThrow('connection refused');
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'] as const)(
    'refuses to run without %s and never connects',
    async (key) => {
      await expect(sendMail({ ...env, [key]: '' }, mail)).rejects.toThrow('not configured');
      await expect(sendMail({ ...env, [key]: undefined }, mail)).rejects.toThrow('not configured');
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it.each(['abc', '0', '70000', '58.7', '-1'])('rejects the invalid port "%s"', async (port) => {
    await expect(sendMail({ ...env, SMTP_PORT: port }, mail)).rejects.toThrow('valid port');
    expect(connect).not.toHaveBeenCalled();
  });

  it('never puts the password into an error message', async () => {
    connect.mockRejectedValue(new Error('535 authentication failed'));
    await expect(sendMail(env, mail)).rejects.not.toThrow('secret-password');
  });
});
