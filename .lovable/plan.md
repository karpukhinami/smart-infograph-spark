# AI Infographic Generator — MVP Plan

A debugging-oriented prototype where the user controls every LLM call in a 4-stage pipeline: Input → Content Analysis → Design Brief + Wireframe → Final Image.

## Architecture

**Layout:** Two-pane workspace. Left = user inputs / controls / prompts. Right = stage results with mode switcher (Content / Wireframe / Final Image) and version history.

**Data entities (separate stores, per spec):**
- `SourceText`, `ContentSummary`, `StyleSpecification`, `DesignProfile`, `PromptForImageGeneration`, `Wireframe`, `FinalImage`
- Each result is versioned (kept in session). "Start over" button clears project versions but preserves edited base prompts and helper-page edits.

**State:** Zustand store with slices per entity + version arrays. Persisted to `sessionStorage` so prompt edits / style edits / profile edits survive within session.

## Routes

- `/` — main workspace (4-stage pipeline)
- `/styles` — manage infographic styles (edit, toggle on/off, reset to default)
- `/design-profiles` — manage color+font profiles (create, edit, set default)
- `/prompts` — view/edit base prompts (analysis prompt, design-brief prompt) — also editable inline via "show prompt" buttons on main page

## Stage 1 — Input (left top)

- Tabs: **Paste text** / **Upload file** (.txt, .md) / **Topic only**
- Topic mode adds: subject dropdown (all school subjects + "Other"), grade dropdown (1–11)
- "Additional instructions" textarea (user notes on emphasis)
- Right side: collapsible "Show analysis prompt" (editable, persisted) + model dropdown
- Left bottom: **Analyze** button → triggers Stage 2

## Stage 2 — Content Analysis

- Prompt template has TWO variables: `withContentTemplate` and `topicOnlyTemplate`. App picks based on input mode.
- Assembled prompt = base template + user additional instructions + list of enabled styles (name + short description from `/styles` page).
- Model must return strict JSON: `{ "content": "<markdown+latex>", "recommendedStyle": "<styleId>" }`.
- JSON validation + repair attempt; surface errors.
- **Right pane (Content mode):** rendered markdown + KaTeX, editable textarea, **Regenerate** button.
- **Left pane:** two dropdowns appear — Style (preselected to model's recommendation) and Design Profile (preselected to default). Below: "Show design-brief prompt" button + model dropdown + **Create design brief** button.

## Stage 3 — Design Brief + Wireframe

- Assembled prompt = base design-brief prompt (the spec's English placeholder) + ContentSummary + full StyleSpecification rules + DesignProfile JSON.
- Model returns strict JSON: `{ "PromptForImageGeneration": "...", "WireframeDescription": {...} }`.
- `WireframeDescription` is a structured layout schema (rows/columns of blocks with type, label, approx size, connections, illustration markers, main visual flag) so the UI can render an ASCII/SVG wireframe AND the same description goes into the image prompt — single source of truth.
- **Right pane (Wireframe mode):** SVG wireframe (boxes only, no colors/fonts) + Regenerate.
- **Left pane:** "Additional wishes" textarea (appended to prompt on regenerate, priority). Third button "View image prompt" (shows PromptForImageGeneration, editable) + model dropdown + **Generate image** button.

## Stage 4 — Image Generation

- Calls image model with PromptForImageGeneration (+ user "additional wishes" if non-empty, with priority).
- **Right pane (Final Image mode):** rendered image + Regenerate. Left pane unchanged.

## Models

Dropdown next to each LLM step. Sources:
1. **Built-in:** Lovable AI Gateway models (`google/gemini-3-flash-preview` default for text; `openai/gpt-image-2` for image stage).
2. **OpenRouter:** loaded from `src/data/openrouter-models.json` (placeholder file with a few entries; user will provide full list). API key placeholder in `src/lib/openrouter.ts` as `const OPENROUTER_API_KEY = ""; // TODO: paste key`.

Text calls go through a TanStack server route at `/api/llm` that dispatches to either Lovable Gateway (using `LOVABLE_API_KEY`) or OpenRouter (using hard-coded key) based on selected model. Image generation uses streaming `/api/generate-image` route.

## Styles (helper page + storage)

`src/data/default-styles.json` with 5 stubs: Modern Bento, School Reference Card, Timeline, Exam Cheat Sheet, Editorial Education Poster. Each style:
```json
{
  "id": "...",
  "name": "...",
  "shortDescription": "...",
  "enabled": true,
  "rules": {
    "composition": "bento",
    "symmetry": "moderate",
    "primaryCarrier": "mixed",
    "colorApproach": "...",
    "typography": "...",
    "illustration": "...",
    "character": "..."
  }
}
```
Page: list, edit any field, toggle enabled, save (sessionStorage).

## Design Profiles (helper page + storage)

`src/data/default-design-profile.json` with the spec's example `DefaultBentoStyle`. Page: form to edit palette (bg, primary, secondary, additional accents), fonts (primary/secondary family + weights), usage rules, card style (radius, border, shadow — shadow forced "none" for MVP), spacing, notesForAI. Save new profiles → appear in main-page dropdown for the session.

## Base Prompts (files)

- `src/data/prompts/analysis-with-content.txt`
- `src/data/prompts/analysis-topic-only.txt`
- `src/data/prompts/design-brief.txt` (the English placeholder from spec)

Loaded into store on first run; edits persisted in sessionStorage.

## Regeneration warnings

When user changes SourceText / ContentSummary / StyleSpecification / DesignProfile, a confirm dialog lists downstream effects per spec rules. Old versions kept; new version created on confirm. FinalImage NEVER regenerates automatically. Wireframe NOT regenerated if only DesignProfile (visual-only) changes.

## Version history

Each entity holds `versions: T[]` + `activeVersionId`. Right-pane mode switcher includes a small version selector per mode.

## File map (new)

```
src/
  routes/
    index.tsx                    # main workspace
    styles.tsx                   # style manager
    design-profiles.tsx          # profile manager
    prompts.tsx                  # base prompt manager
    api/
      llm.ts                     # text LLM dispatcher (Lovable/OpenRouter)
      generate-image.ts          # streaming image gen
  components/
    workspace/
      LeftPanel.tsx
      RightPanel.tsx
      Stage1Input.tsx
      Stage2Controls.tsx
      Stage3Controls.tsx
      Stage4Controls.tsx
      PromptDisclosure.tsx
      ModelPicker.tsx
      ContentView.tsx            # markdown + katex render + edit
      WireframeView.tsx          # SVG renderer from WireframeDescription
      FinalImageView.tsx
      VersionSwitcher.tsx
      RegenerateWarningDialog.tsx
  store/
    useProjectStore.ts           # zustand: entities + versions
    useSettingsStore.ts          # prompts, styles, profiles (session-persisted)
  lib/
    llm-client.ts                # client wrapper -> /api/llm
    openrouter.ts                # OPENROUTER_API_KEY placeholder + model list loader
    json-repair.ts               # strict JSON parse + cleanup
    wireframe-schema.ts          # zod schema for WireframeDescription
  data/
    default-styles.json
    default-design-profile.json
    openrouter-models.json       # placeholder
    prompts/
      analysis-with-content.txt
      analysis-topic-only.txt
      design-brief.txt
```

Markdown rendered with `react-markdown` + `remark-math` + `rehype-katex`. Wireframe drawn as SVG from structured description.

## Out of scope for MVP

- PDF/DOCX upload
- Cross-session persistence (sessionStorage only, per spec)
- Auth / multi-user
- Real OpenRouter model catalog (placeholder list; user will supply)

## After approval

Enable Lovable Cloud (needed only for `LOVABLE_API_KEY` server-side — no DB required for MVP since storage is session-only), then scaffold in the order: data files → store → API routes → workspace UI → helper pages.
