import { Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../client/api';
import { useAccount } from '../../hooks/useAccount';
import { Sheet } from '../ui/Sheet';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 60;

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

function CodeInput({ value, onChange, onComplete, disabled }: { value: string; onChange: (code: string) => void; onComplete: (code: string) => void; disabled: boolean }) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '');

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, CODE_LENGTH);
    onChange(clean);
    if (clean.length === CODE_LENGTH) onComplete(clean);
    else inputs.current[clean.length]?.focus();
  };

  const onKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      commit(value.slice(0, i - 1));
      e.preventDefault();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    commit(e.clipboardData.getData('text'));
  };

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Código de seis dígitos">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          className="field h-12 w-10 px-0 text-center font-mono text-xl tabular-nums sm:w-11"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Dígito ${i + 1} de ${CODE_LENGTH}`}
          onChange={(e) => commit(value.slice(0, i) + e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={onKey(i)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

export function LoginSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const account = useAccount();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep('email');
      setCode('');
      setDevCode(null);
      setError(null);
      setCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const fail = (e: unknown) => setError(e instanceof ApiError && e.code === 'RATE_LIMITED' ? 'Demasiados intentos. Espera unos minutos.' : e instanceof Error ? e.message : String(e));

  const request = async () => {
    if (!isEmail(email)) {
      setError('Escribe un correo válido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.auth.requestCode(email.trim().toLowerCase(), name.trim() || undefined);
      setDevCode(res.devCode ?? null);
      setStep('code');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.auth.verify(email.trim().toLowerCase(), value, name.trim() || undefined);
      account.setToken(res.token, res.user);
      onClose();
    } catch (e) {
      fail(e);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title={step === 'email' ? 'Entrar con tu correo' : 'Revisa tu correo'} onClose={onClose}>
      {step === 'email' ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void request();
          }}
        >
          <p className="text-sm text-muted">Te enviamos un código de un solo uso. Sin contraseñas.</p>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Correo
            <input className="field" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Nombre (solo si es tu primera vez)
            <input className="field" autoComplete="nickname" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="Cómo te verán los demás" />
          </label>
          {error && <p className="text-xs text-danger" role="alert">{error}</p>}
          <button className="btn btn-primary h-11" type="submit" disabled={busy}>
            <Mail size={16} /> Enviar código
          </button>
          <button type="button" className="text-xs text-muted underline-offset-4 hover:underline" onClick={onClose}>
            Seguir como invitado
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Escribe el código de {CODE_LENGTH} dígitos que enviamos a <span className="font-medium text-ink">{email.trim()}</span>.
          </p>
          <CodeInput value={code} onChange={setCode} onComplete={(v) => void verify(v)} disabled={busy} />
          {devCode && (
            <p className="rounded-lg bg-accent/15 px-3 py-2 text-center text-xs text-accent">
              Modo desarrollo: tu código es <span className="font-mono text-sm font-bold tracking-widest">{devCode}</span>
            </p>
          )}
          {error && <p className="text-center text-xs text-danger" role="alert">{error}</p>}
          <div className="flex items-center justify-between text-xs">
            <button type="button" className="text-muted underline-offset-4 hover:underline" onClick={() => setStep('email')}>
              Cambiar correo
            </button>
            <button type="button" className="inline-flex items-center gap-1 text-muted disabled:opacity-50" disabled={cooldown > 0 || busy} onClick={() => void request()}>
              <RefreshCw size={12} /> {cooldown > 0 ? `Reenviar en ${cooldown} s` : 'Reenviar código'}
            </button>
          </div>
          <button className="btn btn-primary h-11" disabled={busy || code.length < CODE_LENGTH} onClick={() => void verify(code)}>
            <ShieldCheck size={16} /> Entrar
          </button>
          <button type="button" className="text-xs text-muted underline-offset-4 hover:underline" onClick={onClose}>
            Seguir como invitado
          </button>
        </div>
      )}
    </Sheet>
  );
}
