<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Match and direct chat delivery uses database realtime plus periodic read reconciliation, because browser subscriptions can disconnect silently.
- Staff match-chat review is a server-checked, auditable database function gated by the Privacy setting, because client-side settings cannot authorize private reads.
- Message flood and repetition checks run in database triggers, because client-only moderation is bypassable.
- Match searching lives in a module-level store (`src/lib/search.ts`) so a running search survives navigation between sections/routes; the match queue heartbeat in `find_or_create_match` keeps the row alive while the store polls.
- Auto re-match ("auto_next" on user_preferences, default true) is honored in index.tsx/CallRoom; when off, a partner leaving returns the user to Discover without auto-starting.
