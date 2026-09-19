import { Resend } from 'resend';
import { config } from '../config';

export interface Mailer {
  readonly configured: boolean;
  sendLoginCode(email: string, code: string): Promise<void>;
}

const subject = (code: string) => `Tu código para entrar en Capichan: ${code}`;

const text = (code: string) => `Tu código para entrar en Capichan es ${code}. Caduca en 10 minutos. Si no lo pediste, ignora este correo.`;

const html = (code: string) => `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#111">
<p style="font-size:14px;color:#555;margin:0 0 12px">Capichan</p>
<p style="font-size:16px;margin:0 0 16px">Tu código para entrar:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:0.3em;margin:0 0 16px">${code}</p>
<p style="font-size:13px;color:#555;margin:0">Caduca en 10 minutos. Si no lo pediste, ignora este correo.</p>
</div>`;

class ResendMailer implements Mailer {
  readonly configured = true;
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async sendLoginCode(email: string, code: string): Promise<void> {
    const { error } = await this.client.emails.send({ from: config.resendFrom, to: email, subject: subject(code), text: text(code), html: html(code) });
    if (error) throw new Error(`resend: ${error.message}`);
  }
}

class ConsoleMailer implements Mailer {
  readonly configured = false;

  async sendLoginCode(email: string, code: string): Promise<void> {
    console.info(`[mail] login code for ${email}: ${code}`);
  }
}

export function createMailer(): Mailer {
  return config.resendApiKey ? new ResendMailer(config.resendApiKey) : new ConsoleMailer();
}
