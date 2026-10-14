# Meta ad policy pack (core)

Pre-flight checks every variant's copy and template text against these rules. Edit freely:
any line shaped like the ones below becomes a rule (`- \`id\` [error|warning] /regex/flags — message`).
This is a starting point, **not** legal advice or a complete copy of Meta's Advertising Standards.
Review https://transparency.meta.com/policies/ad-standards/ for your market.

## Personal attributes (Meta prohibits asserting or implying them)

- `personal-attributes-health` [error] /\b(are you|you're|you are)\s+(overweight|obese|fat|depressed|anxious|diabetic|sick)\b/i — Do not assert or imply personal health attributes
- `personal-attributes-finance` [error] /\b(are you|you're|you are)\s+(broke|in debt|poor|bankrupt)\b/i — Do not assert or imply financial status
- `personal-attributes-identity` [error] /\b(are you|you're|you are)\s+(gay|lesbian|christian|muslim|jewish|black|asian|latino)\b/i — Do not assert or imply identity attributes

## Misleading claims

- `guarantee` [warning] /\bguarantee(d)?\b/i — Unqualified guarantees often get flagged; add terms or soften
- `cure` [error] /\b(cures?|heals?)\s+\w+/i — No medical cure claims
- `miracle` [warning] /\b(miracle|magic pill|overnight results)\b/i — Sensational claims get disapproved
- `free-money` [error] /\b(free money|get rich quick|instant cash)\b/i — Prohibited financial claims
- `before-after` [warning] /\bbefore\s*(and|&|\/)\s*after\b/i — Before/after imagery is restricted for health and weight loss

## Formatting

- `all-caps` [warning] /\b[A-Z]{6,}\b/ — Excessive capitalisation reads as spam
- `exclaim` [warning] /!{2,}/ — Repeated exclamation marks read as spam
