import React, { useCallback, useMemo, useState } from "react";
import { Info } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   Typer — resultatstruktur til gemning/API
═══════════════════════════════════════════════════════════════════════════ */

export interface PadelSet {
  setNumber: 1 | 2 | 3;
  gamesTeam1: number;
  gamesTeam2: number;
  tiebreakTeam1?: number;
  tiebreakTeam2?: number;
}

export interface PadelMatchResult {
  team1: string;
  team2: string;
  sets: PadelSet[];
  winner: "team1" | "team2" | null;
  completed: boolean;
}

export interface PadelMatchResultInputProps {
  initialData?: PadelMatchResult | null;
  onSubmit: (result: PadelMatchResult) => void;
  onCancel?: () => void;
  /** Om holdnavne kan redigeres (default true) */
  playersEditable?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hjælpere — tomme felter vs. tal
═══════════════════════════════════════════════════════════════════════════ */

function numOrUndef(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

function strFromNum(n: number | undefined): string {
  return n === undefined || Number.isNaN(n) ? "" : String(n);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tiebreak-validering
   Tennis/padel tiebreak: mindst 7 point til vinderen, og mindst 2 points forspring.
   Gyldige: 7-0 … 7-5, 8-6, 9-7, … (altså max≥7 og |diff|≥2)
═══════════════════════════════════════════════════════════════════════════ */

export function isValidTiebreak(t1: number, t2: number): boolean {
  if (t1 < 0 || t2 < 0) return false;
  const hi = Math.max(t1, t2);
  const lo = Math.min(t1, t2);
  if (hi < 7) return false;
  return hi - lo >= 2;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sæt uden tiebreak (normale games)
   Gyldige afsluttede sæt:
   - 6-0, 6-1, 6-2, 6-3, 6-4 (og omvendt): vinder til 6, mindst 2 games forspring, modstander max 4
   - 7-5 (og 5-7): unntaget score efter 5-5
   Ugyldige: 6-5 (ingen forspring 2 ved 6), 5-5, 7-4, osv.
   Bemærk: 6-6 er IKKE gyldigt som slutstand — kræver tiebreak → registreres som 7-6.
═══════════════════════════════════════════════════════════════════════════ */

export function isValidGamesWithoutTiebreak(g1: number, g2: number): boolean {
  if (g1 < 0 || g2 < 0) return false;
  const hi = Math.max(g1, g2);
  const lo = Math.min(g1, g2);
  if (g1 === 6 && g2 === 6) return false;

  if (hi === 6 && lo <= 4) return true;
  if (hi === 7 && lo === 5) return true;
  return false;
}

/** 6-6 → tiebreak påkrævet */
export function needsTiebreakAtSixAll(g1: number, g2: number): boolean {
  return g1 === 6 && g2 === 6;
}

/** 7-6 / 6-7 betyder altid at tiebreak er spillet efter 6-6 */
export function isSevenSixScore(g1: number, g2: number): boolean {
  return (g1 === 7 && g2 === 6) || (g1 === 6 && g2 === 7);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Fuld sæt-validering → fejltekst på dansk eller null hvis OK
═══════════════════════════════════════════════════════════════════════════ */

export function validatePadelSet(set: PadelSet): string | null {
  const { gamesTeam1: a, gamesTeam2: b, tiebreakTeam1: t1, tiebreakTeam2: t2 } = set;

  if (a < 0 || b < 0) return "Games kan ikke være negative.";

  if (needsTiebreakAtSixAll(a, b)) {
    if (t1 === undefined || t2 === undefined) return "Ved 6-6 skal tiebreak-resultat udfyldes.";
    if (!isValidTiebreak(t1, t2)) return "Ugyldigt tiebreak: mindst 7 point og mindst 2 points forspring (fx 7-5, 8-6).";
    return null;
  }

  if (isSevenSixScore(a, b)) {
    if (t1 === undefined || t2 === undefined) return "Ved 7-6 skal tiebreak-point udfyldes.";
    if (!isValidTiebreak(t1, t2)) return "Ugyldigt tiebreak-score.";
    return null;
  }

  if (!isValidGamesWithoutTiebreak(a, b)) {
    if (a === 6 && b === 5) return "6-5 er ikke en gyldig slutstand — spil til 7-5 eller til 6-6 med tiebreak.";
    if (a === 5 && b === 6) return "5-6 er ikke en gyldig slutstand.";
    if (Math.max(a, b) >= 7 && !isSevenSixScore(a, b) && !(a === 7 && b === 5) && !(a === 5 && b === 7)) {
      return "Kun 7-5 eller 7-6 (med tiebreak) er gyldige ved 7 games.";
    }
    return "Ugyldigt sæt. Tilladt: 6-0 … 6-4, 7-5, eller 6-6 med tiebreak → 7-6.";
  }

  if (t1 !== undefined || t2 !== undefined) {
    return "Tiebreak må kun udfyldes ved 6-6 eller 7-6.";
  }

  return null;
}

/** Hvem vandt sættet (efter validering). null hvis ugyldigt eller uafgjort input */
export function getSetWinner(set: PadelSet): "team1" | "team2" | null {
  if (validatePadelSet(set) !== null) return null;
  const { gamesTeam1: a, gamesTeam2: b, tiebreakTeam1: t1, tiebreakTeam2: t2 } = set;

  if (needsTiebreakAtSixAll(a, b) && t1 !== undefined && t2 !== undefined) {
    return t1 > t2 ? "team1" : "team2";
  }
  if (isSevenSixScore(a, b)) {
    return a > b ? "team1" : "team2";
  }
  return a > b ? "team1" : "team2";
}

/** Konverter 6-6 + tiebreak til 7-6 i output-struktur */
function normalizeSetForResult(set: PadelSet): PadelSet {
  const { gamesTeam1: a, gamesTeam2: b, tiebreakTeam1: t1, tiebreakTeam2: t2 } = set;
  if (needsTiebreakAtSixAll(a, b) && t1 !== undefined && t2 !== undefined) {
    const w = t1 > t2 ? "team1" : "team2";
    return {
      setNumber: set.setNumber,
      gamesTeam1: w === "team1" ? 7 : 6,
      gamesTeam2: w === "team2" ? 7 : 6,
      tiebreakTeam1: t1,
      tiebreakTeam2: t2,
    };
  }
  return { ...set };
}

type SetForm = {
  games1: string;
  games2: string;
  tb1: string;
  tb2: string;
};

const emptySetForm = (): SetForm => ({ games1: "", games2: "", tb1: "", tb2: "" });

function formToPadelSet(n: 1 | 2 | 3, f: SetForm): PadelSet {
  const g1 = numOrUndef(f.games1);
  const g2 = numOrUndef(f.games2);
  const t1 = numOrUndef(f.tb1);
  const t2 = numOrUndef(f.tb2);
  return {
    setNumber: n,
    gamesTeam1: g1 ?? -1,
    gamesTeam2: g2 ?? -1,
    ...(t1 !== undefined ? { tiebreakTeam1: t1 } : {}),
    ...(t2 !== undefined ? { tiebreakTeam2: t2 } : {}),
  };
}

function padelSetToForm(s: PadelSet): SetForm {
  return {
    games1: strFromNum(s.gamesTeam1 >= 0 ? s.gamesTeam1 : undefined),
    games2: strFromNum(s.gamesTeam2 >= 0 ? s.gamesTeam2 : undefined),
    tb1: strFromNum(s.tiebreakTeam1),
    tb2: strFromNum(s.tiebreakTeam2),
  };
}

function isSetEmpty(f: SetForm): boolean {
  return f.games1.trim() === "" && f.games2.trim() === "" && f.tb1.trim() === "" && f.tb2.trim() === "";
}

function isSetPartiallyFilled(f: SetForm): boolean {
  const g1 = f.games1.trim() !== "";
  const g2 = f.games2.trim() !== "";
  const anyTb = f.tb1.trim() !== "" || f.tb2.trim() !== "";
  return g1 || g2 || anyTb;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Komponent
═══════════════════════════════════════════════════════════════════════════ */

const RULES_SUMMARY =
  "Sæt vindes ved 6 games med mindst 2 games forspring (6-0 … 6-4), eller 7-5. Ved 6-6 spilles tiebreak (mindst 7 point, vind med 2). Du kan enten registrere ét afsluttet sæt (fx 6-2) som hele kampen, eller spille bedst af 3 — først til 2 sæt vinder.";

export default function PadelMatchResultInput({
  initialData = null,
  onSubmit,
  onCancel,
  playersEditable = true,
}: PadelMatchResultInputProps) {
  const [team1, setTeam1] = useState(initialData?.team1 ?? "");
  const [team2, setTeam2] = useState(initialData?.team2 ?? "");

  const initialForms = useMemo((): [SetForm, SetForm, SetForm] => {
    if (!initialData?.sets?.length) {
      return [emptySetForm(), emptySetForm(), emptySetForm()];
    }
    const arr = initialData.sets;
    const f = (i: number): SetForm => {
      const s = arr.find((x) => x.setNumber === ((i + 1) as 1 | 2 | 3));
      return s ? padelSetToForm(s) : emptySetForm();
    };
    return [f(0), f(1), f(2)];
  }, [initialData]);

  const [forms, setForms] = useState<[SetForm, SetForm, SetForm]>(initialForms);

  const updateForm = useCallback((index: 0 | 1 | 2, patch: Partial<SetForm>) => {
    setForms((prev) => {
      const next: [SetForm, SetForm, SetForm] = [...prev] as [SetForm, SetForm, SetForm];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const padelSets = useMemo(
    () =>
      ([0, 1, 2] as const).map((i) =>
        formToPadelSet((i + 1) as 1 | 2 | 3, forms[i])
      ) as [PadelSet, PadelSet, PadelSet],
    [forms]
  );

  const showTiebreak = (i: 0 | 1 | 2) => {
    const g1 = numOrUndef(forms[i].games1);
    const g2 = numOrUndef(forms[i].games2);
    if (g1 === undefined || g2 === undefined) return false;
    return needsTiebreakAtSixAll(g1, g2) || isSevenSixScore(g1, g2);
  };

  /** Efter 2 fuldt gyldige sæt: er kampen allerede afgjort? */
  const matchDecidedAfterTwo = useMemo(() => {
    const s1 = padelSets[0];
    const s2 = padelSets[1];
    if (isSetEmpty(forms[0]) || isSetEmpty(forms[1])) return false;
    const e1 = validatePadelSet({ ...s1, gamesTeam1: s1.gamesTeam1 < 0 ? 0 : s1.gamesTeam1, gamesTeam2: s1.gamesTeam2 < 0 ? 0 : s1.gamesTeam2 });
    const e2 = validatePadelSet({ ...s2, gamesTeam1: s2.gamesTeam1 < 0 ? 0 : s2.gamesTeam1, gamesTeam2: s2.gamesTeam2 < 0 ? 0 : s2.gamesTeam2 });
    if (e1 || e2) return false;
    const w1 = getSetWinner(s1);
    const w2 = getSetWinner(s2);
    if (!w1 || !w2) return false;
    return w1 === w2;
  }, [forms, padelSets]);

  /** Kun sæt 1 udfyldt og gyldigt — kampen kan gemmes som ét sæt (fx 6-2). */
  const matchCompleteWithOneSet = useMemo(() => {
    if (!isSetEmpty(forms[1]) || !isSetEmpty(forms[2])) return false;
    if (isSetEmpty(forms[0])) return false;
    const s0 = padelSets[0];
    const s0n = {
      ...s0,
      gamesTeam1: s0.gamesTeam1 < 0 ? 0 : s0.gamesTeam1,
      gamesTeam2: s0.gamesTeam2 < 0 ? 0 : s0.gamesTeam2,
    };
    if (validatePadelSet(s0n) !== null) return false;
    return getSetWinner(s0n) !== null;
  }, [forms, padelSets]);

  const setErrors = useMemo(() => {
    return padelSets.map((raw, i) => {
      const f = forms[i as 0 | 1 | 2];
      if (matchDecidedAfterTwo && i === 2) return null;
      if (matchCompleteWithOneSet && (i === 1 || i === 2)) return null;
      if (isSetEmpty(f)) {
        if (i === 0) return "Sæt 1 skal udfyldes.";
        if (i === 1) {
          if (isSetEmpty(forms[0])) return "Udfyld sæt 1 først.";
          const w1 = getSetWinner(padelSets[0]);
          if (!w1) return "Udfyld først et gyldigt sæt 1.";
          return "Sæt 2 skal udfyldes.";
        }
        if (i === 2) {
          if (matchDecidedAfterTwo) return null;
          if (isSetEmpty(forms[1]) && isSetPartiallyFilled(f)) return "Udfyld sæt 2 før sæt 3.";
          const w1 = getSetWinner(padelSets[0]);
          const w2 = getSetWinner(padelSets[1]);
          if (!w1 || !w2) return "Udfyld sæt 1 og 2 først.";
          if (w1 === w2) return null;
          return "Sæt 3 skal udfyldes ved 1-1.";
        }
        return null;
      }
      const s = {
        ...raw,
        gamesTeam1: raw.gamesTeam1 < 0 ? 0 : raw.gamesTeam1,
        gamesTeam2: raw.gamesTeam2 < 0 ? 0 : raw.gamesTeam2,
      };
      if (isSetPartiallyFilled(f) && (numOrUndef(f.games1) === undefined || numOrUndef(f.games2) === undefined)) {
        return "Indtast games for begge hold.";
      }
      return validatePadelSet(s);
    });
  }, [forms, padelSets, matchDecidedAfterTwo, matchCompleteWithOneSet]);

  const setsWon = useMemo(() => {
    let t1 = 0;
    let t2 = 0;
    const limit = matchCompleteWithOneSet ? 1 : matchDecidedAfterTwo ? 2 : 3;
    for (let i = 0; i < limit; i++) {
      if (setErrors[i] || isSetEmpty(forms[i as 0 | 1 | 2])) continue;
      const w = getSetWinner(padelSets[i]);
      if (w === "team1") t1++;
      if (w === "team2") t2++;
    }
    return { t1, t2 };
  }, [padelSets, setErrors, forms, matchDecidedAfterTwo, matchCompleteWithOneSet]);

  const team1Trim = team1.trim();
  const team2Trim = team2.trim();
  const namesOk = team1Trim.length > 0 && team2Trim.length > 0;

  const formValid = useMemo(() => {
    if (!namesOk) return false;
    if (matchCompleteWithOneSet) {
      return !setErrors[0] && !isSetEmpty(forms[0]);
    }
    for (let i = 0; i < 3; i++) {
      if (matchDecidedAfterTwo && i === 2) continue;
      if (setErrors[i]) return false;
      if (isSetEmpty(forms[i as 0 | 1 | 2])) return false;
    }
    /* Kamp færdig: 2 sæt til samme hold, eller ét gyldigt sæt (håndteres af matchCompleteWithOneSet) */
    if (setsWon.t1 < 2 && setsWon.t2 < 2) return false;
    return true;
  }, [namesOk, setErrors, forms, matchDecidedAfterTwo, setsWon, matchCompleteWithOneSet]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;

    const normalized: PadelSet[] = [];
    const maxSet = matchCompleteWithOneSet ? 1 : matchDecidedAfterTwo ? 2 : 3;
    for (let i = 0; i < maxSet; i++) {
      normalized.push(normalizeSetForResult(padelSets[i]));
    }

    const winner: "team1" | "team2" | null =
      setsWon.t1 > setsWon.t2 ? "team1" : setsWon.t2 > setsWon.t1 ? "team2" : null;

    onSubmit({
      team1: team1Trim,
      team2: team2Trim,
      sets: normalized,
      winner,
      completed: true,
    });
  };

  const step = (idx: 0 | 1 | 2, field: keyof SetForm, dir: 1 | -1, maxVal: number) => {
    const cur = numOrUndef(forms[idx][field]) ?? 0;
    const next = Math.max(0, Math.min(maxVal, cur + dir));
    updateForm(idx, { [field]: String(next) });
  };

  const cntBtn = (idx: 0 | 1 | 2, field: keyof SetForm, dir: 1 | -1, maxVal: number, disabled: boolean) => {
    const isPlus = dir === 1;
    const cur = numOrUndef(forms[idx][field]) ?? 0;
    const atLimit = isPlus ? cur >= maxVal : cur <= 0;
    return (
      <button
        type="button"
        disabled={disabled || atLimit}
        onClick={() => step(idx, field, dir, maxVal)}
        aria-label={isPlus ? 'Tilføj' : 'Fjern'}
        style={{
          width: 40, height: 40, borderRadius: 10, border: isPlus ? 'none' : '1.5px solid var(--pm-border)',
          background: isPlus ? (disabled ? 'var(--pm-text-light)' : 'var(--pm-accent)') : 'var(--pm-surface)',
          color: isPlus ? 'var(--pm-on-accent)' : (atLimit ? 'var(--pm-text-light)' : 'var(--pm-accent)'),
          fontSize: 18, fontWeight: 600,
          cursor: disabled || atLimit ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit', flexShrink: 0, padding: 0,
          opacity: isPlus && disabled ? 0.6 : 1,
        }}
      >
        {isPlus ? '+' : '−'}
      </button>
    );
  };

  const setCard = (index: 0 | 1 | 2) => {
    const n = (index + 1) as 1 | 2 | 3;
    const disabled = index === 2 && matchDecidedAfterTwo;
    const f = forms[index];
    const err = setErrors[index];
    const tb = showTiebreak(index);
    const t1Name = team1.trim() || 'Hold 1';
    const t2Name = team2.trim() || 'Hold 2';
    const reqLabel = n === 3
      ? (matchDecidedAfterTwo ? 'IKKE NØDVENDIGT' : 'VED 1–1 I SÆT')
      : 'OBLIGATORISK';

    const scoreCol = (field: keyof SetForm, teamName: string, maxVal: number) => (
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#16377E', fontWeight: 600, marginBottom: 9 }}>{teamName}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {cntBtn(index, field, -1, maxVal, disabled)}
          <span style={{ fontSize: 25, fontWeight: 700, color: '#16377E', width: 32, textAlign: 'center' }}>
            {numOrUndef(f[field]) ?? 0}
          </span>
          {cntBtn(index, field, 1, maxVal, disabled)}
        </div>
      </div>
    );

    return (
      <div
        key={n}
        role="group"
        aria-label={`Sæt ${n}`}
        style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E6EAF1',
          boxShadow: '0 2px 8px rgba(13,39,82,0.06)', padding: 16, marginBottom: 13,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b style={{ fontSize: '13.5px', fontWeight: 700 }}>
            Sæt {n}{n === 3 ? ' (Tiebreak)' : ''}
          </b>
          <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.2px', color: '#5E6B81' }}>
            {reqLabel}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {scoreCol('games1', t1Name, 7)}
          {scoreCol('games2', t2Name, 7)}
        </div>

        {tb && (
          <div style={{ marginTop: 14, background: '#FAEFDC', borderRadius: 10, padding: 12, border: '1px solid #EDD9B5' }}>
            <p style={{ fontSize: '11.5px', fontWeight: 600, color: '#92400E', marginBottom: 10 }}>Tiebreak-point</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {scoreCol('tb1', t1Name, 99)}
              {scoreCol('tb2', t2Name, 99)}
            </div>
          </div>
        )}

        {err && (
          <p style={{ marginTop: 10, fontSize: '12px', color: '#E5484D' }} role="alert">
            {err}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '4px 0 8px', fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif' }} noValidate>
      {playersEditable && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <label htmlFor="padel-team1" style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#5E6B81', marginBottom: 5 }}>Hold 1</label>
            <input
              id="padel-team1"
              type="text"
              value={team1}
              onChange={(e) => setTeam1(e.target.value)}
              style={{ width: '100%', borderRadius: 10, border: '1px solid #E6EAF1', padding: '10px 12px', fontSize: 14, color: '#101A2E', background: '#fff', boxSizing: 'border-box' as const }}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="padel-team2" style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#5E6B81', marginBottom: 5 }}>Hold 2</label>
            <input
              id="padel-team2"
              type="text"
              value={team2}
              onChange={(e) => setTeam2(e.target.value)}
              style={{ width: '100%', borderRadius: 10, border: '1px solid #E6EAF1', padding: '10px 12px', fontSize: 14, color: '#101A2E', background: '#fff', boxSizing: 'border-box' as const }}
              autoComplete="off"
            />
          </div>
        </div>
      )}
      {playersEditable && !namesOk && (
        <p style={{ fontSize: '12px', color: '#E5484D', marginBottom: 10 }} role="alert">Begge holdnavne skal udfyldes.</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 10px' }}>
        <h3 style={{ fontSize: '15.5px', fontWeight: 600, letterSpacing: '-0.2px', margin: 0 }}>Indtast score</h3>
        {(setsWon.t1 > 0 || setsWon.t2 > 0) && (
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#16377E' }} role="status" aria-live="polite">
            {setsWon.t1}–{setsWon.t2} sæt
          </span>
        )}
      </div>

      {setCard(0)}
      {setCard(1)}
      {setCard(2)}

      <p style={{ textAlign: 'center', fontSize: '11.5px', color: '#5E6B81', lineHeight: 1.6, padding: '4px 16px 12px' }}>
        Resultatet sendes til modstanderne til godkendelse. Sørg for at begge hold er enige før indsendelse.
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: '13px', borderRadius: 10, border: '1.5px solid #E6EAF1',
              background: '#fff', color: '#16377E', fontSize: '14.5px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Annuller
          </button>
        )}
        <button
          type="submit"
          disabled={!formValid}
          style={{
            flex: 2, padding: '14px', borderRadius: 10, border: 'none',
            background: formValid ? '#16377E' : '#C9D3E1',
            color: '#fff', fontSize: '14.5px', fontWeight: 600,
            cursor: formValid ? 'pointer' : 'default', fontFamily: 'inherit',
            boxShadow: formValid ? '0 6px 14px rgba(22,55,126,0.32)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          Bekræft resultat
        </button>
      </div>
    </form>
  );
}
