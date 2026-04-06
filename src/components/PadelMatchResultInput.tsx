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
  "Sæt vindes ved 6 games med mindst 2 games forspring (6-0 … 6-4), eller 7-5. Ved 6-6 spilles tiebreak (mindst 7 point, vind med 2). Kampen er bedst af 3 sæt — først til 2 sæt vinder.";

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

  const setErrors = useMemo(() => {
    return padelSets.map((raw, i) => {
      const f = forms[i as 0 | 1 | 2];
      if (matchDecidedAfterTwo && i === 2) return null;
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
  }, [forms, padelSets, matchDecidedAfterTwo]);

  const setsWon = useMemo(() => {
    let t1 = 0;
    let t2 = 0;
    const limit = matchDecidedAfterTwo ? 2 : 3;
    for (let i = 0; i < limit; i++) {
      if (setErrors[i] || isSetEmpty(forms[i as 0 | 1 | 2])) continue;
      const w = getSetWinner(padelSets[i]);
      if (w === "team1") t1++;
      if (w === "team2") t2++;
    }
    return { t1, t2 };
  }, [padelSets, setErrors, forms, matchDecidedAfterTwo]);

  const team1Trim = team1.trim();
  const team2Trim = team2.trim();
  const namesOk = team1Trim.length > 0 && team2Trim.length > 0;

  const formValid = useMemo(() => {
    if (!namesOk) return false;
    for (let i = 0; i < 3; i++) {
      if (matchDecidedAfterTwo && i === 2) continue;
      if (setErrors[i]) return false;
      if (isSetEmpty(forms[i as 0 | 1 | 2])) return false;
    }
    /* Kamp færdig: mindst ét hold har 2 sæt (2-0, 2-1 eller omvendt) */
    if (setsWon.t1 < 2 && setsWon.t2 < 2) return false;
    return true;
  }, [namesOk, setErrors, forms, matchDecidedAfterTwo, setsWon]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;

    const normalized: PadelSet[] = [];
    for (let i = 0; i < 3; i++) {
      if (matchDecidedAfterTwo && i === 2) break;
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

  const setCard = (index: 0 | 1 | 2) => {
    const n = (index + 1) as 1 | 2 | 3;
    const disabled = index === 2 && matchDecidedAfterTwo;
    const f = forms[index];
    const err = setErrors[index];
    const errId = `set-${n}-error`;
    const tb = showTiebreak(index);

    return (
      <div
        key={n}
        role="group"
        aria-label={`Sæt ${n}`}
        aria-disabled={disabled}
        className={`rounded-xl border p-4 shadow-sm transition-opacity ${
          disabled ? "border-slate-200 bg-slate-50 opacity-60" : "border-slate-200 bg-white"
        }`}
        aria-describedby={err ? errId : undefined}
      >
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            Sæt {n}
            {disabled && <span className="ml-2 font-normal text-slate-500">(ikke nødvendigt)</span>}
          </h3>
          <button
            type="button"
            disabled={disabled}
            className="ml-auto rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:pointer-events-none disabled:opacity-40"
            title="Gyldige sæt: 6-0 til 6-4, 7-5, eller 6-6/7-6 med tiebreak (min. 7 point, vind med 2)."
            aria-label={`Hjælp til sæt ${n}`}
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`g1-${n}`} className="mb-1 block text-xs font-medium text-slate-600">
              Games hold 1
            </label>
            <input
              id={`g1-${n}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={7}
              value={f.games1}
              onChange={(e) => updateForm(index, { games1: e.target.value })}
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:bg-slate-100"
              aria-invalid={!!err}
            />
          </div>
          <div>
            <label htmlFor={`g2-${n}`} className="mb-1 block text-xs font-medium text-slate-600">
              Games hold 2
            </label>
            <input
              id={`g2-${n}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={7}
              value={f.games2}
              onChange={(e) => updateForm(index, { games2: e.target.value })}
              disabled={disabled}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:bg-slate-100"
              aria-invalid={!!err}
            />
          </div>
        </div>

        {tb && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="mb-2 text-xs font-medium text-amber-900">Tiebreak</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`tb1-${n}`} className="mb-1 block text-xs text-slate-600">
                  Point hold 1
                </label>
                <input
                  id={`tb1-${n}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={f.tb1}
                  onChange={(e) => updateForm(index, { tb1: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
              <div>
                <label htmlFor={`tb2-${n}`} className="mb-1 block text-xs text-slate-600">
                  Point hold 2
                </label>
                <input
                  id={`tb2-${n}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={f.tb2}
                  onChange={(e) => updateForm(index, { tb2: e.target.value })}
                  disabled={disabled}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>
        )}

        {err && (
          <p id={errId} className="mt-2 text-sm text-red-600" role="alert">
            {err}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-lg sm:p-6"
      noValidate
    >
      <header className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Kampresultat</h2>
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="leading-snug">{RULES_SUMMARY}</p>
        </div>
      </header>

      {/* Live stilling */}
      <div
        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Stilling (sæt)</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {setsWon.t1} – {setsWon.t2}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {setsWon.t1 >= 2 || setsWon.t2 >= 2
            ? `Vinder: ${setsWon.t1 > setsWon.t2 ? team1Trim || "Hold 1" : team2Trim || "Hold 2"}`
            : "Kampen afgøres ved først til 2 sæt"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="padel-team1" className="mb-1 block text-sm font-medium text-slate-700">
            Hold 1
          </label>
          <input
            id="padel-team1"
            type="text"
            value={team1}
            onChange={(e) => setTeam1(e.target.value)}
            disabled={!playersEditable}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="padel-team2" className="mb-1 block text-sm font-medium text-slate-700">
            Hold 2
          </label>
          <input
            id="padel-team2"
            type="text"
            value={team2}
            onChange={(e) => setTeam2(e.target.value)}
            disabled={!playersEditable}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
            autoComplete="off"
          />
        </div>
      </div>
      {!namesOk && (
        <p className="text-sm text-red-600" role="alert">
          Begge holdnavne skal udfyldes.
        </p>
      )}

      <div className="space-y-4">
        {setCard(0)}
        {setCard(1)}
        {setCard(2)}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Annuller
          </button>
        )}
        <button
          type="submit"
          disabled={!formValid}
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        >
          Gem kampresultat
        </button>
      </div>
    </form>
  );
}
