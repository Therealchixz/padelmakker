/**
 * Afmeld mails med ét klik, uden login (padelmakker.dk/afmeld?t=<token>).
 *
 * Linket i mailene peger på email-unsubscribe-funktionen, som sender videre
 * hertil. Siden lå før på supabase.co, men Supabase viser ikke HTML derfra som
 * en side, så en bruger så rå kode i stedet for knappen (ejeren 7. okt. 2026).
 *
 * Siden afmelder ALDRIG af sig selv — mailscannere åbner links automatisk.
 * Først når brugeren trykker på knappen, sendes POST til funktionen.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { font, theme, btn } from '../lib/platformTheme';
import { isValidUnsubscribeToken, postEmailUnsubscribe } from '../lib/emailUnsubscribe.js';

const cardStyle = {
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 14,
  padding: '28px 24px',
  maxWidth: 460,
  width: '100%',
};
const titleStyle = { fontSize: 20, margin: '0 0 12px', letterSpacing: '-0.3px', color: theme.text };
const textStyle = { fontSize: 15, lineHeight: 1.55, color: theme.textMid, margin: '0 0 14px' };
const linkStyle = { display: 'block', textAlign: 'center', marginTop: 16, fontSize: 14, color: theme.accent };

export function EmailUnsubscribePage() {
  const [params] = useSearchParams();
  const token = String(params.get('t') || params.get('token') || '').trim();
  const validToken = isValidUnsubscribeToken(token);
  const [state, setState] = useState(validToken ? 'confirm' : 'invalid');

  const unsubscribe = async () => {
    setState('busy');
    setState(await postEmailUnsubscribe(token));
  };

  let body;
  if (state === 'done') {
    body = (
      <>
        <h1 style={titleStyle}>Du er afmeldt</h1>
        <p style={textStyle}>
          Du får ikke flere mails fra os om nye makkere. Der kan nå at være én undervejs, som allerede var sendt.
        </p>
        <p style={textStyle}>Fortrudt? Du kan slå det til igen under Notifikationer i appen.</p>
        <a href="/" style={linkStyle}>Tilbage til PadelMakker</a>
      </>
    );
  } else if (state === 'invalid') {
    body = (
      <>
        <h1 style={titleStyle}>Linket virker ikke</h1>
        <p style={textStyle}>
          Linket er ufuldstændigt eller hører ikke til en konto. Prøv at åbne det fra mailen igen — nogle
          mailprogrammer klipper lange links over.
        </p>
        <p style={textStyle}>
          Du kan også slå mails fra under Notifikationer i appen, eller skrive til{' '}
          <a href="mailto:kontakt@padelmakker.dk" style={{ color: theme.accent }}>kontakt@padelmakker.dk</a>.
        </p>
      </>
    );
  } else {
    body = (
      <>
        <h1 style={titleStyle}>Vil du afmelde?</h1>
        <p style={textStyle}>
          Så holder vi op med at sende dig mail, når nogen søger makker i dit område. Du kan stadig bruge appen som
          før, og du kan altid slå det til igen inde i PadelMakker.
        </p>
        {state === 'error' ? (
          <p role="alert" style={{ ...textStyle, color: theme.red }}>
            Vi kunne ikke afmelde dig lige nu. Prøv igen om lidt, eller skriv til kontakt@padelmakker.dk, så gør vi
            det manuelt.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => { void unsubscribe(); }}
          disabled={state === 'busy'}
          style={{ ...btn(true), width: '100%', minHeight: 48, justifyContent: 'center', fontSize: 15, opacity: state === 'busy' ? 0.6 : 1 }}
        >
          {state === 'busy' ? 'Afmelder…' : 'Ja, afmeld mig'}
        </button>
        <a href="/" style={linkStyle}>Nej, tag mig tilbage til PadelMakker</a>
      </>
    );
  }

  return (
    <div
      style={{
        fontFamily: font,
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: theme.bg,
      }}
    >
      <div style={cardStyle}>
        <p style={{ fontSize: 13, color: theme.textMid, margin: '0 0 18px', fontWeight: 600 }}>PadelMakker</p>
        {body}
      </div>
    </div>
  );
}
