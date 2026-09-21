/**
 * Opret-guiden til 2v2-kampe - tre trin: bane & tid, pris & kamptype, bekraeft.
 *
 * Flyttet ud af KampeTab uaendret. Al tilstand bor stadig i KampeTab; denne fil
 * er ren visning, saa den kan laeses og aabnes uden at have 4.000 linjer omkring
 * sig. Props er med vilje eksplicitte frem for et samlet objekt - saa fanger
 * ESLint det, hvis noget mangler.
 */
import { btn, inputStyle, labelStyle, theme } from '../../lib/platformTheme';
import { PillTabs } from '../PillTabs';
import { LevelRangeSlider } from '../LevelRangeSlider';
import { VenueRegionPicker } from '../VenueRegionPicker';
import { fieldValidationErrorStyle, fieldValidationMessage } from '../../lib/formValidationScroll';
import { TIME_OPTIONS } from '../../lib/timeSlotOptions';
import { isMatchVenueTbd, MATCH_VENUE_TBD, courtNameFromVenueSelection } from '../../lib/matchVenueOptions';
import { clampElo } from '../../lib/matchLevelRange';
import { timeToMinutes } from '../../lib/matchDisplayUtils';
import { eloToLevel, levelToElo, formatPlaytomicLevelRange, formatMatchLevelRangeLabel } from '../../lib/padelLevelUtils';

export function CreateMatchForm({
  newMatch,
  setNewMatch,
  creating,
  createMatch,
  myElo,
  venueOptions,
  createVenueOptions,
  courtBookedTabs,
  matchTypeTabs,
  padelCreateStep,
  setPadelCreateStep,
  goPadelCreateNext,
  padelCreateFieldError,
  setPadelCreateFieldError,
  setShowCreate,
  padelCreateFormRef,
  padelCreateDateFieldRef,
  padelCreateTimeFieldRef,
  padelCreateVenueFieldRef,
  padelCreateDurationFieldRef,
}) {
  return (
    <div
      ref={padelCreateFormRef}
      className="pm-ui-card pm-create-form-anchor pm-create-form-panel"
      style={{
        padding: "clamp(16px,3vw,20px)",
        marginBottom: "20px",
        border: `2px solid ${theme.accent}40`,
        boxShadow: theme.shadow,
      }}
    >
      <div className="pm-wiz" style={{ margin: "0 0 16px" }}>
        {[{ n: 1, label: "Info" }, { n: 2, label: "Pris" }, { n: 3, label: "Bekræft" }].map((s, i, arr) => {
          const state = s.n < padelCreateStep ? "done" : s.n === padelCreateStep ? "on" : "";
          return (
            <span key={s.n} style={{ display: "contents" }}>
              <div className={`pm-wiz-step${state ? ` ${state}` : ""}`}>
                <div className="pm-wiz-num">{state === "done" ? "✓" : s.n}</div>
                <span className="pm-wiz-label">{s.label}</span>
              </div>
              {i < arr.length - 1 && <div className="pm-wiz-line" />}
            </span>
          );
        })}
      </div>

      {padelCreateStep === 1 && (() => {
        const padelGeneralError = fieldValidationMessage(padelCreateFieldError, 'general');
        const padelVenueError = fieldValidationMessage(padelCreateFieldError, 'venue');
        const padelDateError = fieldValidationMessage(padelCreateFieldError, 'date');
        const padelTimeError = fieldValidationMessage(padelCreateFieldError, 'time');
        const padelDurationError = fieldValidationMessage(padelCreateFieldError, 'duration');
        return (
        <>
          {padelGeneralError && (
            <div role="alert" style={{ margin: '0 0 12px', color: theme.red, fontSize: 12, fontWeight: 600 }}>
              {padelGeneralError}
            </div>
          )}
          <p style={{ fontSize: "13px", color: theme.textMid, margin: "0 0 16px" }}>
            Din ELO <strong>{myElo}</strong> — du sættes automatisk på Hold 1.
          </p>
          <div className="pm-form-2col">
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Har du booket en bane?</label>
              <PillTabs
                tabs={courtBookedTabs}
                value={newMatch.court_booked === true ? "yes" : "no"}
                onChange={(id) => {
                  const booked = id === "yes";
                  setNewMatch((m) => {
                    let nextCourtId = m.court_id;
                    if (booked) {
                      if (!nextCourtId || isMatchVenueTbd(nextCourtId)) {
                        nextCourtId = venueOptions[0]?.id ?? "";
                      }
                    } else if (!nextCourtId || !isMatchVenueTbd(nextCourtId)) {
                      nextCourtId = MATCH_VENUE_TBD;
                    }
                    return { ...m, court_booked: booked, court_id: nextCourtId };
                  });
                }}
                ariaLabel="Bane booket"
                size="sm"
                style={{ marginTop: "4px" }}
              />
            </div>
            <div ref={padelCreateVenueFieldRef} style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                {newMatch.court_booked ? "Hvilken bane er booket?" : "Hvor vil du helst spille? (valgfrit)"}
              </label>
              <VenueRegionPicker
                value={newMatch.court_id}
                onChange={(id) => {
                  setNewMatch((m) => ({ ...m, court_id: id }));
                  if (padelCreateFieldError?.field === 'venue') setPadelCreateFieldError(null);
                }}
                options={createVenueOptions}
                placeholder={newMatch.court_booked ? "Vælg booket center" : "Ikke valgt endnu"}
                emptyLabel="Indlæser centre…"
                ariaLabel={newMatch.court_booked ? "Vælg booket bane" : "Vælg foretrukket center"}
              />
              <p style={{ fontSize: "11px", color: theme.textLight, marginTop: "6px", lineHeight: 1.45 }}>
                {newMatch.court_booked
                  ? "Vælg det center, hvor du har booket tid."
                  : "Vælg «Ikke valgt endnu», eller peg på et center du overvejer — du behøver ikke have booket endnu."}
              </p>
              {padelVenueError && (
                <div id="padel-create-venue-error" role="alert" style={{ color: theme.red, fontSize: 12, marginTop: 6 }}>
                  {padelVenueError}
                </div>
              )}
            </div>
            <div ref={padelCreateDateFieldRef} style={{ minWidth: 0 }}>
              <label style={labelStyle}>Dato</label>
              <input
                type="date"
                value={newMatch.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  setNewMatch((m) => ({ ...m, date: e.target.value }));
                  if (padelCreateFieldError?.field === 'date') setPadelCreateFieldError(null);
                }}
                style={{
                  ...inputStyle,
                  fontSize: "13px",
                  appearance: "none",
                  WebkitAppearance: "none",
                  ...fieldValidationErrorStyle(Boolean(padelDateError)),
                }}
                aria-invalid={padelDateError ? true : undefined}
                aria-describedby={padelDateError ? 'padel-create-date-error' : undefined}
              />
              {padelDateError && (
                <div id="padel-create-date-error" role="alert" style={{ color: theme.red, fontSize: 12, marginTop: 6 }}>
                  {padelDateError}
                </div>
              )}
            </div>
            <div ref={padelCreateTimeFieldRef}>
              <label style={labelStyle}>Starttid</label>
              <select
                value={newMatch.time}
                onChange={(e) => {
                  setNewMatch((m) => ({ ...m, time: e.target.value }));
                  if (padelCreateFieldError?.field === 'time') setPadelCreateFieldError(null);
                }}
                style={{ ...inputStyle, fontSize: "13px", ...fieldValidationErrorStyle(Boolean(padelTimeError)) }}
                aria-invalid={padelTimeError ? true : undefined}
                aria-describedby={padelTimeError ? 'padel-create-time-error' : undefined}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {padelTimeError && (
                <div id="padel-create-time-error" role="alert" style={{ color: theme.red, fontSize: 12, marginTop: 6 }}>
                  {padelTimeError}
                </div>
              )}
            </div>
            <div ref={padelCreateDurationFieldRef} style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Varighed</label>
              <select
                value={newMatch.duration}
                onChange={(e) => {
                  setNewMatch((m) => ({ ...m, duration: e.target.value }));
                  if (padelCreateFieldError?.field === 'duration') setPadelCreateFieldError(null);
                }}
                style={{ ...inputStyle, fontSize: "13px", ...fieldValidationErrorStyle(Boolean(padelDurationError)) }}
                aria-invalid={padelDurationError ? true : undefined}
                aria-describedby={padelDurationError ? 'padel-create-duration-error' : undefined}
              >
                <option value="60">1 time</option>
                <option value="90">1½ time</option>
                <option value="120">2 timer</option>
                <option value="150">2½ timer</option>
                <option value="180">3 timer</option>
              </select>
              {padelDurationError && (
                <div id="padel-create-duration-error" role="alert" style={{ color: theme.red, fontSize: 12, marginTop: 6 }}>
                  {padelDurationError}
                </div>
              )}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Hvilket niveau søger du?</label>
              {(() => {
                const lvlMin = eloToLevel(Number(newMatch.level_min) || clampElo(myElo - 100, myElo));
                const lvlMax = eloToLevel(Number(newMatch.level_max) || clampElo(myElo + 100, myElo));
                return (
                  <>
                    <div className="pm-level-range-box">
                      <LevelRangeSlider
                        minVal={lvlMin}
                        maxVal={lvlMax}
                        step={0.1}
                        onMinChange={(v) => setNewMatch((m) => ({ ...m, level_min: String(levelToElo(v)) }))}
                        onMaxChange={(v) => setNewMatch((m) => ({ ...m, level_max: String(levelToElo(v)) }))}
                      />
                    </div>
                    <p className="pm-level-range-hint">
                      Spillere på niveau {formatPlaytomicLevelRange(lvlMin, lvlMax)} matcher kampen.
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
          <div style={{ margin: "14px 0 0", background: "var(--pm-surface-muted)", border: "1px solid var(--pm-americano-tie-border)", borderRadius: 12, padding: "12px 14px", fontSize: 11.5, color: theme.textLight, lineHeight: 1.55 }}>
            Pris, betaling og kamptype konfigureres i næste trin.
          </div>
        </>
        );
      })()}

      {padelCreateStep === 2 && (
        <>
          <label style={{ ...labelStyle, marginTop: 0 }}>
            Beskrivelse <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfrit)</span>
          </label>
          <input
            value={newMatch.description}
            onChange={(e) => setNewMatch((m) => ({ ...m, description: e.target.value }))}
            placeholder="F.eks. 'Søger venstreside-spiller' eller 'Begyndervenlig kamp'"
            style={{ ...inputStyle, marginBottom: "14px" }}
          />
          <div className="pm-form-2col" style={{ marginBottom: "14px" }}>
            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>
                Pris pr. person <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfrit)</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newMatch.price_per_person}
                  onChange={(e) => setNewMatch((m) => ({ ...m, price_per_person: e.target.value }))}
                  placeholder="0"
                  style={{ ...inputStyle, fontSize: "13px", paddingRight: "32px" }}
                />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: theme.textLight, pointerEvents: "none" }}>kr.</span>
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>Betaling</label>
              <select
                value={newMatch.payment_method}
                onChange={(e) => setNewMatch((m) => ({ ...m, payment_method: e.target.value }))}
                style={{ ...inputStyle, fontSize: "13px" }}
              >
                <option value="mobilepay">MobilePay</option>
                <option value="cash">Ved fremmøde</option>
                <option value="free">Gratis</option>
              </select>
            </div>
          </div>
          <label style={labelStyle}>Kamptype</label>
          <PillTabs
            tabs={matchTypeTabs}
            value={newMatch.match_type === "closed" ? "closed" : "open"}
            onChange={(id) => setNewMatch((m) => ({ ...m, match_type: id }))}
            ariaLabel="Kamptype"
            size="sm"
            style={{ marginTop: "4px" }}
          />
          <p style={{ fontSize: "11px", color: theme.textLight, marginTop: "6px", lineHeight: 1.45 }}>
            {newMatch.match_type === "open"
              ? "Alle kan tilmelde sig direkte."
              : "Alle kan se kampen, men skal anmode om at deltage — du godkender selv."}
          </p>
        </>
      )}

      {padelCreateStep === 3 && (() => {
        const courtLabel = courtNameFromVenueSelection(newMatch.court_id, createVenueOptions) || "Ikke valgt endnu";
        const lvlMin = eloToLevel(Number(newMatch.level_min) || clampElo(myElo - 100, myElo));
        const lvlMax = eloToLevel(Number(newMatch.level_max) || clampElo(myElo + 100, myElo));
        const startM = timeToMinutes(newMatch.time);
        const dur = parseInt(newMatch.duration, 10) || 120;
        const endM = Number.isFinite(startM) ? startM + dur : null;
        const endTime = endM != null
          ? `${String(Math.floor(endM / 60) % 24).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`
          : "";
        const paymentLabels = { mobilepay: "MobilePay", cash: "Ved fremmøde", free: "Gratis" };
        const priceNum = newMatch.payment_method === "free"
          ? 0
          : parseFloat(String(newMatch.price_per_person).replace(",", "."));
        const priceLabel = newMatch.payment_method === "free" || !Number.isFinite(priceNum) || priceNum <= 0
          ? "Gratis"
          : `${priceNum % 1 === 0 ? priceNum : priceNum.toFixed(2).replace(".", ",")} kr.`;
        const dateLabel = newMatch.date
          ? new Date(`${newMatch.date}T12:00:00`).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })
          : "—";
        const summaryRows = [
          { label: "Bane", value: courtLabel },
          { label: "Tid", value: `${dateLabel} · ${newMatch.time}${endTime ? `–${endTime}` : ""}` },
          { label: "Niveau", value: formatMatchLevelRangeLabel(newMatch.level_min, newMatch.level_max) || `Niveau ${formatPlaytomicLevelRange(lvlMin, lvlMax)}` },
          { label: "Kamptype", value: newMatch.match_type === "closed" ? "Lukket (godkendelse)" : "Åben" },
          { label: "Pris", value: `${priceLabel} · ${paymentLabels[newMatch.payment_method] || newMatch.payment_method}` },
        ];
        if (newMatch.description?.trim()) {
          summaryRows.push({ label: "Beskrivelse", value: newMatch.description.trim() });
        }
        return (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "1.2px", margin: "0 0 10px" }}>
              Opsummering
            </div>
            <div style={{ margin: "0 0 14px", border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.surface, overflow: "hidden" }}>
              {summaryRows.map((row, i) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                    padding: "9px 14px",
                    borderBottom: i < summaryRows.length - 1 ? `1px solid ${theme.border}` : "none",
                  }}
                >
                  <span style={{ fontSize: 12.5, color: theme.textLight, flexShrink: 0 }}>{row.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, textAlign: "right" }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--pm-surface-muted)", border: "1px solid var(--pm-americano-tie-border)", borderRadius: 12, padding: "12px 14px", fontSize: 11.5, color: theme.textLight, lineHeight: 1.6, marginBottom: 4 }}>
              Kampen bliver synlig for spillere i dit område og niveau-interval. Du kan redigere detaljer ved at gå tilbage.
            </div>
          </>
        );
      })()}

      <div className="pm-form-submit pm-form-submit-actions" style={{ marginTop: 16 }}>
        {padelCreateStep > 1 ? (
          <button
            type="button"
            onClick={() => { setPadelCreateStep((s) => s - 1); setPadelCreateFieldError(null); }}
            disabled={creating}
            style={{ ...btn(false, { size: "md", fontWeight: 600 }), flex: 1 }}
          >
            ← Tilbage
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setShowCreate(false); setPadelCreateStep(1); setPadelCreateFieldError(null); }}
            disabled={creating}
            style={{ ...btn(false, { size: "md", fontWeight: 600 }), flex: 1 }}
          >
            Annullér
          </button>
        )}
        {padelCreateStep < 3 ? (
          <button
            type="button"
            onClick={goPadelCreateNext}
            style={{ ...btn(true, { size: "md", fontWeight: 600 }), flex: 2 }}
          >
            {padelCreateStep === 1 ? "Næste: Pris & kamptype →" : "Næste: Bekræft →"}
          </button>
        ) : (
          <button
            type="button"
            onClick={createMatch}
            disabled={
              creating ||
              venueOptions.length === 0 ||
              (newMatch.court_booked && (!newMatch.court_id || isMatchVenueTbd(newMatch.court_id)))
            }
            style={{ ...btn(true, { size: "md", fontWeight: 600 }), flex: 2, opacity: creating ? 0.55 : 1 }}
          >
            {creating ? "Opretter..." : "Opret kamp ✓"}
          </button>
        )}
      </div>
    </div>
  );
}
