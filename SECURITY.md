# Security

adlab can move real money once connected to a live ad account. Please report vulnerabilities
privately via GitHub Security Advisories on this repository rather than in public issues.

Design guarantees we treat as security bugs if broken:

- An agent token can never approve spend, release the kill switch or rate variants.
- Live platform writes are impossible unless `ADLAB_ENV=prod` and `ADLAB_ALLOW_LIVE_WRITES=true`.
- No launch exceeds the account or brief weekly cap (budget governor runs before every launch).
- Every platform write is idempotent; retries never duplicate campaigns.
