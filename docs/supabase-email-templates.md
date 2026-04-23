# Supabase Email Templates (PadelMakker)

Brug skabelonerne her i Supabase:

1. `Authentication` -> `Email` -> `Templates`
2. Vælg template (fx `Reset Password`)
3. Indsæt `Subject`, `HTML` og `Plain text`
4. Gem og test med en rigtig reset-mail

## Reset Password

### Subject

```text
Nulstil din adgangskode - PadelMakker
```

### HTML

```html
<!doctype html>
<html lang="da">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nulstil adgangskode</title>
  </head>
  <body style="margin:0; padding:0; background:#eef2f7; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7; padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px; background:#ffffff; border:1px solid #dbe5f1; border-radius:14px; overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 8px 28px;">
                <div style="font-size:13px; letter-spacing:0.08em; font-weight:700; text-transform:uppercase; color:#2f5fff;">PadelMakker</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;">
                <h1 style="margin:0; font-size:30px; line-height:1.2; color:#0b1530;">Nulstil din adgangskode</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0 28px;">
                <p style="margin:0; font-size:18px; line-height:1.45; color:#1e293b;">Hej,</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;">
                <p style="margin:0; font-size:18px; line-height:1.55; color:#1e293b;">
                  Vi har modtaget en anmodning om at nulstille adgangskoden til din konto.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;">
                <p style="margin:0; font-size:18px; line-height:1.55; color:#1e293b;">
                  Tryk på knappen herunder for at vælge en ny adgangskode.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 10px 28px;">
                <a
                  href="{{ .ConfirmationURL }}"
                  style="display:inline-block; background:#2f5fff; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:10px; font-size:18px; font-weight:700;"
                >
                  Nulstil adgangskode
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 28px 0 28px;">
                <p style="margin:0; font-size:15px; line-height:1.6; color:#64748b;">
                  Hvis knappen ikke virker, kan du kopiere dette link:
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;">
                <p style="margin:0; font-size:14px; line-height:1.6; color:#2f5fff; word-break:break-all;">
                  {{ .ConfirmationURL }}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0 28px;">
                <p style="margin:0; font-size:15px; line-height:1.6; color:#64748b;">
                  Hvis du ikke selv har bedt om at nulstille adgangskoden, kan du trygt ignorere denne mail.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 30px 28px;">
                <p style="margin:0; font-size:14px; line-height:1.6; color:#94a3b8;">
                  Hilsen<br />
                  PadelMakker
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

### Plain text

```text
Nulstil din adgangskode

Vi har modtaget en anmodning om at nulstille adgangskoden til din konto.
Åbn linket her for at vælge en ny adgangskode:
{{ .ConfirmationURL }}

Hvis du ikke selv har bedt om dette, kan du ignorere denne mail.

Hilsen
PadelMakker
```
