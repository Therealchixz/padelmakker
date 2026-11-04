---
target: oprettelse og login
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/padelmakker/src/pages/OnboardingPage.jsx"
target_fingerprint: "sha256:948c98aa2bef7a4720d8a3abf7ef050870ca615a01f6b6826ac313998db1883a"
target_path: /home/user/padelmakker/src/pages/OnboardingPage.jsx
timestamp: 2026-11-04T07-38-46Z
slug: src-pages-onboardingpage-jsx
---
# Critique: signup + login flow (/opret, SMS, email, /login, reset, /profil/fuldfoer)
Method: dual-agent (A: design review · B: detector). Overlay skipped (cloud). No accounts created, no SMS/email sent.
Heuristics 22/40 (55%, Acceptable).
1:2 progress contradicts (Fire korte trin vs Trin 2 af 3) | 2:3 | 3:2 forced logout after SMS, wrong-number dead end | 4:2 two visual systems, no brand font | 5:2 breach/email-in-use errors only at step 4 | 6:3 | 7:2 no show-password, no draft | 8:2 step 1 = 10 controls | 9:2 wrong-field messages, raw English on reset | 10:2 no help at SMS/email moments
Detector: placeholders 2.5:1 (Tailwind base beats token), tiny text 10-11.5px, overused-font; text-occlusion = FP (dropdown).
A11y: no visible keyboard focus on buttons (inline boxShadow beats non-!important focus rule, variables.css:235); errors without role=alert (Onboarding:1186, Login:166, PhoneVerification:504, CompleteProfile:237, Reset:52); chips without aria-pressed; birthday fields without autocomplete; forgot-email type=text.
## Priority
- [P1] Funnel 7 screens + forced logout + 2 captchas; progress lies -> distill/onboard
- [P1] SMS page: resend active at once (resendAtMs=0), code boxes below phone+captcha, wrong-number dead end, error not announced, boxes overflow at 390 -> harden/layout
- [P1] Step 1 wall of 10 fields; errors on keystroke; breach/in-use errors appear at step 4 -> distill
- [P2] Error copy names wrong field/no action; phone-only users can't reset password -> clarify/harden
- [P2] Trust/brand drop: Google consent shows supabase.co domain; no .pm-brand on auth pages -> typeset/colorize (+ owner config: custom auth domain)
