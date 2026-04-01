

## Plan: Client-Side Parsing + Direct Insert Pipeline

### Problem
The current pipeline uploads files to Storage, then an Edge Function parses + inserts them — but Edge Functions hit CPU/memory limits on large files.

### Solution
Parse files **in the browser** (no resource limits for reasonable files), then send small batches to a **lightweight Edge Function** that only does inserts. No Storage upload needed, no job tracking needed.

```text
Browser                          Edge Function
┌──────────────┐                ┌──────────────┐
│ Drag & drop  │                │ Receive JSON │
│ Parse XBRL   │──── batch ───>│ Insert rows  │
│ Show progress│<── response ──│ Return count │
└──────────────┘                └──────────────┘
```

### Changes

**1. New Edge Function: `insert-ubpr-batch`**
- Accepts `{ records: [{rssd, report_date, metrics, source_concepts}] }` (up to 100 per call)
- Upserts into `ubpr_data` using service_role
- Returns inserted/error counts
- Very simple, no parsing, no file I/O — stays well within limits

**2. Update `AdminUpload.tsx`**
- Move XBRL and tab-delimited parsing logic into client-side utility functions
- On file drop: read file as text, parse in browser, show record count
- Send records in batches of 100 to the new edge function
- Show progress bar as batches complete
- Remove the Storage upload + job-based processing flow

**3. New file: `src/lib/parseUBPR.ts`**
- Client-side XBRL parser (port the existing `parseXBRL` function using browser DOMParser)
- Client-side tab-delimited parser (port `parseTabDelimited`)

### What stays the same
- `ubpr_data` table schema unchanged
- All dashboard components read from the same table
- RLS policies unchanged (service_role inserts via edge function)

### Result
You drag and drop your files on `/admin/upload`, the browser parses them instantly, and records stream into the database in small batches with a progress bar. No timeouts, no storage intermediary.

