import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { CityPlaceSearchField } from '../components/CityPlaceSearchField';
import {
  isValidCityPlace,
  hasIncompleteCityProfile,
  resolveCityPlaceFromName,
} from '../lib/dawaPlaceSearch';
import { isValidSignupEmail, isValidSignupPhone, normalizePhoneToE164 } from '../lib/validationHelpers';
import { mapAuthErrorMessage } from '../lib/authErrorMessages';
import { mapUserFacingError } from '../lib/userFacingErrors';
import { writePendingSignupEmail } from '../lib/signupEmailPending';
import {
  getLoginCompletenessGaps,
  writePrefillPhone,
} from '../lib/profileCompleteness';
import { isPhoneVerificationExempt } from '../lib/phoneVerification';
import { scrollToFieldById } from '../lib/formValidationScroll';

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, profile, phoneVerificationExempt, updateProfile, signOut } = useAuth();
  const phoneExempt = isPhoneVerificationExempt(user, profile, phoneVerificationExempt);
  const gaps = useMemo(
    () => getLoginCompletenessGaps(user, profile, { phoneExempt }),
    [user, profile, phoneExempt],
  );

  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [place, setPlace] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const incompleteCity = hasIncompleteCityProfile(profile);
  const cityReady = isValidCityPlace(place);
  const emailReady = isValidSignupEmail(email) && email.trim().toLowerCase() === emailConfirm.trim().toLowerCase();
  const phoneReady = isValidSignupPhone(phone);
  const canSubmit =
    (!gaps.email || emailReady)
    && (!gaps.phone || phoneReady)
    && (!gaps.city || cityReady || incompleteCity);

  const handleSubmit = async () => {
    if (gaps.email && !isValidSignupEmail(email)) {
      setErr('Indtast en gyldig e-mail.');
      scrollToFieldById('complete-email');
      return;
    }
    if (gaps.email && email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
      setErr('E-mailene skal være ens.');
      scrollToFieldById('complete-email-confirm');
      return;
    }
    if (gaps.phone && !isValidSignupPhone(phone)) {
      setErr('Indtast et gyldigt telefonnummer (fx 20112233).');
      scrollToFieldById('complete-phone');
      return;
    }

    setSaving(true);
    setErr('');
    try {
      let cityPlace = place;
      if (gaps.city && !isValidCityPlace(cityPlace) && incompleteCity) {
        cityPlace = await resolveCityPlaceFromName(profile.city);
        if (!isValidCityPlace(cityPlace)) {
          setErr('Vælg din by fra listen, så vi kan vise afstand til andre makkere.');
          scrollToFieldById('complete-city');
          return;
        }
        setPlace(cityPlace);
      }
      if (gaps.city) {
        if (!isValidCityPlace(cityPlace)) {
          setErr('Vælg din by fra listen.');
          scrollToFieldById('complete-city');
          return;
        }
        await updateProfile({
          city: cityPlace.city,
          latitude: cityPlace.latitude,
          longitude: cityPlace.longitude,
        });
      }

      const normalizedPhone = gaps.phone ? normalizePhoneToE164(phone) : '';
      if (normalizedPhone) writePrefillPhone(normalizedPhone);

      if (gaps.email) {
        const normalizedEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.updateUser({ email: normalizedEmail });
        if (error) throw error;
        writePendingSignupEmail({
          email: normalizedEmail,
          phone: normalizedPhone || user?.phone || undefined,
        });
        try {
          await supabase.from('profiles').update({ email: normalizedEmail }).eq('id', user.id);
        } catch {
          /* email-kolonnen er skjult for API — ignorér */
        }
        navigate('/opret/bekraeft-email', {
          replace: true,
          state: { email: normalizedEmail, phone: normalizedPhone || '' },
        });
        return;
      }

      if (gaps.phone) {
        navigate('/opret/bekraeft-telefon', {
          replace: true,
          state: { prefillPhone: normalizedPhone },
        });
      }
      // By gemt: routing sender videre når profilen er opdateret.
    } catch (e) {
      const raw = String(e?.message || '');
      const authMapped = mapAuthErrorMessage(raw, 'forgot');
      setErr(
        authMapped !== raw
          ? authMapped
          : mapUserFacingError(e, 'Kunne ikke gemme. Prøv igen.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="pm-root"
      style={{
        fontFamily: font,
        background: theme.bg,
        minHeight: '100dvh',
        color: theme.text,
        paddingBottom: 'max(96px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="pm-auth-narrow">
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <picture>
            <source srcSet="/logo-brand-nav.webp" type="image/webp" />
            <img src="/logo-brand.png" alt="PadelMakker" style={{ height: 38, display: 'inline-block' }} />
          </picture>
          <h1 style={{ ...heading('22px'), letterSpacing: '-0.3px', marginTop: 22, marginBottom: 0 }}>
            Færdiggør din profil
          </h1>
          <p style={{ color: theme.textMid, fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
            Vi mangler et par oplysninger, før du kan fortsætte. Det tager kun et øjeblik.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          {gaps.email ? (
            <>
              <label htmlFor="complete-email" style={labelStyle}>E-mail</label>
              <input
                id="complete-email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErr(''); }}
                placeholder="din@email.dk"
                style={{ ...inputStyle, marginBottom: 13 }}
              />
              <label htmlFor="complete-email-confirm" style={labelStyle}>Bekræft e-mail</label>
              <input
                id="complete-email-confirm"
                autoComplete="email"
                inputMode="email"
                value={emailConfirm}
                onChange={(e) => { setEmailConfirm(e.target.value); setErr(''); }}
                placeholder="din@email.dk"
                style={{ ...inputStyle, marginBottom: 13 }}
              />
            </>
          ) : null}

          {gaps.phone ? (
            <>
              <label htmlFor="complete-phone" style={labelStyle}>Telefonnummer</label>
              <input
                id="complete-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setErr(''); }}
                placeholder="Fx 20112233"
                style={{ ...inputStyle, marginBottom: 6 }}
              />
              <p style={{ color: theme.textMid, fontSize: 12, lineHeight: 1.45, margin: '0 0 13px' }}>
                Vi sender en SMS-kode på næste side, så nummeret er bekræftet.
              </p>
            </>
          ) : null}

          {gaps.city ? (
            <div id="complete-city" style={{ marginBottom: 16 }}>
              <label htmlFor="complete-city-input" style={labelStyle}>
                By <span style={{ color: theme.red }}>*</span>
              </label>
              <p style={{ color: theme.textMid, fontSize: 12, lineHeight: 1.45, margin: '0 0 8px' }}>
                {incompleteCity
                  ? `Du har angivet "${profile.city}", men vi mangler præcis placering. Bekræft byen eller vælg den fra listen.`
                  : 'Vælg din by, så andre kan se ca. afstand til dig. Vi følger dig ikke med GPS.'}
              </p>
              <CityPlaceSearchField
                id="complete-city-input"
                required
                value={place}
                onChange={setPlace}
                seedQuery={profile?.city || ''}
                inputStyle={{ ...inputStyle, marginBottom: 0 }}
                placeholder="Søg efter by eller postnummer…"
              />
            </div>
          ) : null}

          {err ? (
            <p style={{ color: theme.red, fontSize: 13, marginBottom: 14 }}>{err}</p>
          ) : null}

          <button
            type="submit"
            disabled={saving || !canSubmit}
            style={{ ...btn(true), width: '100%', justifyContent: 'center', opacity: saving || !canSubmit ? 0.55 : 1 }}
          >
            {saving ? 'Gemmer…' : 'Gem og fortsæt'}
          </button>
        </form>

        <button
          type="button"
          onClick={async () => {
            try { await signOut(); } catch { /* ignore */ }
            navigate('/login', { replace: true });
          }}
          style={{
            marginTop: 18,
            border: 'none',
            background: 'transparent',
            color: theme.textLight,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
            fontFamily: font,
          }}
        >
          Log ud
        </button>
        <PublicLegalFooter />
      </div>
    </div>
  );
}
