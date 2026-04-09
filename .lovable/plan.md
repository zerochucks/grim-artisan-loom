

## Fix: Server-Side Filtering for Batch Queue

### Problem

Filters (tier, status, category) are applied **client-side** on the current page of 100 assets only. Changing filters doesn't re-query the database, so you only see matches within the loaded page. Changing pages re-fetches but still ignores filters. This is **not** a preview-only issue — it will behave the same in production.

### Solution

Move all three filters into the Supabase query so the database returns only matching rows, with correct pagination and counts.

### Changes (single file: `src/pages/BatchQueuePage.tsx`)

1. **Add filters to `fetchAssets` dependency array** — include `filterTier`, `filterStatus`, `filterCategory` in the `useCallback` deps so the query re-runs when filters change.

2. **Apply filters server-side in the query**:
   - If `filterTier !== 'all'` → `.eq('tier', filterTier)`
   - If `filterStatus !== 'all'` → `.eq('qa_status', filterStatus)`
   - If `filterCategory !== 'all'` → `.eq('category', filterCategory)` (handle null category with `.or('category.eq.misc,category.is.null')` when filtering for "misc")

3. **Reset page to 0 when any filter changes** — add `setPage(0)` to each filter's `onChange` handler so pagination restarts from page 1.

4. **Remove client-side `getFilteredAssets` filter logic** — the `filter` call in `getFilteredAssets` becomes a passthrough since the DB already filtered. Keep the function but remove the tier/status/category checks (or inline `assets` directly).

5. **Update status summary counts** — the current status counts (`pending`, `generated`, etc. shown in the toolbar) are derived from the loaded page. Add a separate lightweight query (or use the `count` from unfiltered) to show global counts. Simplest: keep a one-time summary query on mount that groups by `qa_status`.

