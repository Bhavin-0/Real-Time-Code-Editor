# UI/UX Upgrade Analysis: Capstone ← Reference Project

---

# 1. Current Capstone UI Overview

**Stack:** React + Vite, TypeScript, Tailwind CSS, Monaco Editor  
**Transport:** STOMP over WebSocket (Spring Boot backend)  
**Execution:** HTTP POST `/execute` → Node runner → WebSocket stream

### Layout
- Single full-page route: `CollaborativeEditor.tsx` orchestrates everything
- Monaco editor takes primary space (left/center)
- Terminal output panel: below editor, manually resizable via drag handle (120px–500px clamp)
- Users/presence panel: `UsersPanel.tsx` — likely a sidebar or side column
- Top controls: `Topbar.tsx` — status indicators + action buttons
- Theme: light/dark toggle via `ThemeContext`, CSS variables in `index.css`

### Editor
- **Monaco** (`@monaco-editor/react`) — full-featured, professional
- Single document, no file tabs
- Language hardcoded to JavaScript in `EditorContainer.tsx`
- Options: minimap (scale 0.75), smooth cursor, automaticLayout, fontSize 14
- Theme driven by ThemeContext (vs-dark / vs-light)

### Terminal Panel
- Custom `<pre>` output log — NOT xterm.js
- Drag-resize handle for panel height (mouse events, manual)
- Output-only: no stdin, no prompt
- Streams stdout/stderr/end from Node WS runner

### Member/Presence Panel
- `UsersPanel.tsx` — shows collaborators and activity
- Identity is client-generated (userId + userName), not authenticated

### Entry Screen
- `EntryPage.tsx` — room/name capture
- Session stored in localStorage

---

# 2. Reference Project UI Overview

**Stack:** Next.js, TypeScript, Tailwind CSS, react-simple-code-editor + Prism  
**Transport:** Socket.IO (Node backend)  
**Execution:** Direct to Judge0 via RapidAPI

### Layout
- Editor page: `src/app/Editor/page.tsx` — breadcrumb header + content frame
- Editor: left 3/4 width (`w-3/4`), static, no resize
- Right panel: 1/4 width — typing status + output (labeled "User Terminal")
- Sidebar: `app-sidebar.tsx` — collapsible, responsive, Radix UI primitives
- Mobile support: `use-mobile.ts` hook wires sidebar collapse behavior

### Editor
- **react-simple-code-editor + Prism** — lightweight textarea-based
- Multi-language: JS/TS/JSX/TSX/CSS/HTML/C++/Java/Python (Radix Select UI)
- Style hardcoded inline: `#2d2d2d` bg, `#ccc` text, Prism Tomorrow theme
- No Monaco features (minimap, intellisense, diff, etc.)

### Terminal Panel
- Static right-side panel (no resize)
- Shows: animated typing user list + `<pre>` output block
- Shortcut: Ctrl+Enter triggers execution

### Member/Presence Panel
- `animated-tooltip-demo.tsx` — avatar tooltips with animation, fed by socket `updateRoom`
- Visually richer presence display — animated, stacked avatars with names on hover
- Identity mapped via `peopleId` index to static image array

### Entry Screen
- `login.tsx` — room + name capture, localStorage bootstrap
- Sidebar action: `sidebar-opt-in-form.tsx` — Copy Room ID / Leave Room

---

# 3. Key UI/UX Differences

| Area | Capstone | Reference | Winner (UX) |
|---|---|---|---|
| Editor engine | Monaco (professional) | react-simple-code-editor (basic) | **Capstone** |
| Language support | JS only (backend limit) | 9 languages | N/A — backend constraint |
| Terminal panel | Draggable resize | Static, fixed | **Capstone** |
| Output display | Streaming (stdout/stderr live) | Single response dump | **Capstone** |
| Member presence | UsersPanel (plain list) | Animated avatar tooltips | **Reference** |
| Sidebar | Unknown / possibly missing | Full collapsible sidebar w/ Radix | **Reference** |
| Theme | Light/dark toggle + CSS vars | Dark only, hardcoded | **Capstone** |
| Run shortcut | Run button only | Ctrl+Enter global hotkey | **Reference** |
| Connection status | Unknown | Not present | Build new |

### Confirmed gaps in Capstone (after backend constraint):
1. **Presence panel** likely visually weak — reference has polished animated avatars
2. **No collapsible sidebar** — reference has a clean one with room actions
3. **No keyboard shortcut** for run
4. **No connection status indicator** visible to the user
5. **Terminal has no clear button or exit code display**

---

# 4. High-Impact Improvements (Fast to Implement)

Ranked by impact-to-effort ratio. Language selector is REMOVED — backend only supports JS.

### 🔴 Priority 1 — Animated Avatars in Topbar (1–2 hours)
- Reference's `animated-tooltip-demo.tsx` has stacked animated avatars with hover tooltips.
- Visually impressive in demos, shows "this is collaborative" at a glance.
- Copy-paste level work — just needs `participants[]` as a prop.

### 🔴 Priority 2 — Collapsible Left Sidebar (1.5–2 hours)
- Adds: room ID copy, leave room action — currently unclear where these live in Capstone.
- Copy shell from reference `src/components/ui/sidebar.tsx`, wire to existing leave/delete logic.

### 🟡 Priority 3 — Connection Status in Topbar (20 min)
- Green/red dot showing STOMP connection state.
- Single prop + two spans. Extremely fast, high trust signal for demo.

### 🟡 Priority 4 — Keyboard Shortcut for Run (20 min)
- Add Ctrl+Enter listener in `CollaborativeEditor.tsx`.
- One `useEffect`, three lines. Wire to existing run function.

### 🟢 Priority 5 — Terminal UX Polish (30 min)
- Clear output button
- Running / OK / Error status badge
- Exit code display from `type: end` WebSocket message

---

# 5. Component-Level Replacement Opportunities

### A. COPY DIRECTLY from Reference → Capstone

| Reference File | Target in Capstone | Notes |
|---|---|---|
| `src/components/ui/sidebar.tsx` | `frontend/src/components/ui/Sidebar.tsx` | Pure UI, zero backend coupling |
| `src/components/animated-tooltip-demo.tsx` | Inline into `Topbar.tsx` | Strip socket logic, pass `participants[]` as prop |
| `src/app/globals.css` (typing indicator styles) | `frontend/src/index.css` | Copy relevant CSS additions only |

### B. ADAPT (copy + modify data wiring)

| Reference File | Target in Capstone | Change Needed |
|---|---|---|
| `src/components/app-sidebar.tsx` | New `EditorSidebar.tsx` | Replace socket room data with STOMP participant data |
| `src/components/sidebar-opt-in-form.tsx` | Into `EditorSidebar.tsx` | Replace localStorage with props (roomId, onLeave) |
| Ctrl+Enter keydown from `code-editor.tsx` | `CollaborativeEditor.tsx` | Wire to existing run function |

### C. DO NOT COPY

| Reference File | Reason |
|---|---|
| `src/socket.jsx` | Socket.IO — conflicts with STOMP |
| `src/services/compilerAPI.tsx` | Judge0/RapidAPI — not your backend |
| `src/components/login.tsx` | localStorage room model differs |
| Language selector from `src/app/Editor/page.tsx` | Backend only supports JS — not needed |
| All socket event handlers in `code-editor.tsx` | Socket.IO incompatible |

---

# 6. Final UI Changes Plan

**Decisions locked in:**
- Terminal: keep drag-resize as-is ✅
- Presence: top-bar avatars only → strip `UsersPanel.tsx`, add avatars to `Topbar.tsx`
- Language selector: SKIPPED — backend only supports JavaScript ✅
- Theme: keep existing light/dark toggle ✅
- Layout: balanced multi-panel — sidebar + editor + terminal all visible

---

### Target Layout (after changes)

```
┌─────────────────────────────────────────────────────────────┐
│  Topbar: [≡] [Room: abc123] [Run ▶] [● Connected] [Avatars] [Theme] │
├────────┬────────────────────────────────────────────────────┤
│        │                                                     │
│Sidebar │             Monaco Editor                          │
│[RoomID]│             (flex-grow)                            │
│[Copy]  │                                                     │
│[Leave] │                                                     │
│        ├────────────────────────────────────────────────────┤
│        │  Terminal [Running…|OK|Exit 1] [Clear]  (resize)   │
└────────┴────────────────────────────────────────────────────┘
```

---

### Change 1 — Animated Avatars in Topbar (replace UsersPanel)

**File to modify:** `frontend/src/components/Topbar.tsx`  
**File to deprecate:** `frontend/src/components/UsersPanel.tsx` (stop rendering, don't delete)  
**Action:** Copy avatar pattern from reference, strip socket logic, wire to STOMP participants

Add to right side of `Topbar.tsx`:

```tsx
// Add this prop to Topbar: participants: { id: string; name: string }[]
// Paste this JSX into the right section of your Topbar

<div className="flex items-center">
  {participants.map((p, i) => (
    <div
      key={p.id}
      title={p.name}
      style={{ marginLeft: i === 0 ? 0 : -8, zIndex: participants.length - i }}
      className="relative w-8 h-8 rounded-full bg-indigo-500 border-2 border-background
                 flex items-center justify-center text-xs font-bold text-white
                 hover:z-50 hover:scale-110 transition-transform cursor-default select-none"
    >
      {p.name.charAt(0).toUpperCase()}
    </div>
  ))}
</div>
```

`participants` state already lives in `CollaborativeEditor.tsx` from STOMP `USER_LIST` / `USER_JOINED` / `USER_LEFT` events. Pass it down to `Topbar` as a prop.

In `CollaborativeEditor.tsx`:
- Stop rendering `<UsersPanel />` — comment it out
- Pass `participants={participants}` to `<Topbar />`

---

### Change 2 — Collapsible Left Sidebar

**New file:** `frontend/src/components/EditorSidebar.tsx`  
**File to modify:** `frontend/src/components/CollaborativeEditor.tsx`  
**Action:** New component built from reference pattern

Props:
```ts
interface EditorSidebarProps {
  roomId: string;
  isOpen: boolean;
  onToggle: () => void;
  onLeaveRoom: () => void;
}
```

Full component to create:
```tsx
// frontend/src/components/EditorSidebar.tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, LogOut } from 'lucide-react';

export function EditorSidebar({ roomId, isOpen, onToggle, onLeaveRoom }: EditorSidebarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`flex flex-col border-r border-border bg-sidebar transition-all duration-200 shrink-0
                  ${isOpen ? 'w-56' : 'w-12'}`}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 border-b border-border hover:bg-accent"
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 p-3 text-sm">
          {/* Room ID */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Room ID</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-1 py-0.5 rounded truncate flex-1">{roomId}</code>
              <button onClick={handleCopy} title="Copy" className="shrink-0 hover:text-primary">
                <Copy size={13} />
              </button>
            </div>
            {copied && <p className="text-xs text-green-500 mt-1">Copied!</p>}
          </div>

          {/* Leave room */}
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-2 text-red-500 hover:text-red-400 text-xs mt-auto"
          >
            <LogOut size={13} /> Leave Room
          </button>
        </div>
      )}
    </div>
  );
}
```

In `CollaborativeEditor.tsx`:
```tsx
// Add state
const [sidebarOpen, setSidebarOpen] = useState(true);

// Wrap your existing layout in flex-row:
<div className="flex flex-row flex-1 overflow-hidden">
  <EditorSidebar
    roomId={roomId}
    isOpen={sidebarOpen}
    onToggle={() => setSidebarOpen(o => !o)}
    onLeaveRoom={handleLeaveRoom} // your existing leave function
  />
  <div className="flex flex-col flex-1 overflow-hidden">
    {/* Monaco editor here */}
    {/* Terminal panel here — unchanged */}
  </div>
</div>
```

---

### Change 3 — Connection Status in Topbar

**File to modify:** `frontend/src/components/Topbar.tsx`  
**Action:** Add `isConnected: boolean` prop, render dot + label

```tsx
// Add to Topbar props: isConnected: boolean
// Paste into Topbar JSX (next to run button):
<div className="flex items-center gap-1.5">
  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
  <span className="text-xs text-muted-foreground hidden sm:inline">
    {isConnected ? 'Connected' : 'Disconnected'}
  </span>
</div>
```

Derive `isConnected` in `CollaborativeEditor.tsx` from your STOMP client — check `collaborationStomp.ts` for a `connected` boolean or `connectionState()` method. Pass it down to `<Topbar />`.

---

### Change 4 — Keyboard Shortcut for Run

**File to modify:** `frontend/src/components/CollaborativeEditor.tsx`  
**Action:** Add one `useEffect`

```tsx
// Add inside CollaborativeEditor, next to your other useEffects:
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCode(); // your existing run function name
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [handleRunCode]);
```

Also add a tooltip/label on your Run button: `title="Run (Ctrl+Enter)"`.

---

### Change 5 — Terminal Panel UX Polish

**File to modify:** `frontend/src/components/CollaborativeEditor.tsx` (terminal section only)  
**Action:** Add 2 state variables + tweak terminal header JSX

Add state:
```tsx
const [isRunning, setIsRunning] = useState(false);
const [lastExitCode, setLastExitCode] = useState<number | null>(null);
```

Update your `type: end` WebSocket handler to:
```tsx
case 'end':
  setIsRunning(false);
  setLastExitCode(msg.exitCode ?? 0);
  break;
```

Set `setIsRunning(true)` when run starts.

Replace your terminal panel header with:
```tsx
<div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-xs">
  <div className="flex items-center gap-2">
    <span className="font-medium">Output</span>
    {isRunning && <span className="text-yellow-400">Running…</span>}
    {!isRunning && lastExitCode === 0 && <span className="text-green-400">✓ OK</span>}
    {!isRunning && lastExitCode !== null && lastExitCode !== 0 && (
      <span className="text-red-400">Exit {lastExitCode}</span>
    )}
  </div>
  <button
    onClick={() => setOutput('')}
    className="text-muted-foreground hover:text-foreground"
  >
    Clear
  </button>
</div>
```

---

# 7. Quick Implementation Plan

Do these in order. Each step is independently shippable.

---

### Step 1 — Avatars in Topbar, kill UsersPanel (30 min)

1. Open `CollaborativeEditor.tsx` — find where `participants` (user list) is stored in state
2. Add `participants` prop to `Topbar.tsx` interface
3. Paste the avatar stack JSX into the right side of `Topbar.tsx` (code in Change 1)
4. Comment out `<UsersPanel />` in `CollaborativeEditor.tsx`
5. Verify layout doesn't break — reclaim the space with `flex-1` on the editor container

---

### Step 2 — Connection status in Topbar (20 min)

1. Check `collaborationStomp.ts` for how to read connected state
2. Add `isConnected` to `CollaborativeEditor.tsx` state (or derive from client)
3. Add `isConnected` prop to `Topbar.tsx` and paste the dot JSX (code in Change 3)

---

### Step 3 — Keyboard shortcut for run (20 min)

1. Paste the `useEffect` from Change 4 into `CollaborativeEditor.tsx`
2. Make sure the function name matches your actual run handler
3. Add `title="Run (Ctrl+Enter)"` to your run button

---

### Step 4 — Left sidebar (60–75 min)

1. Create `frontend/src/components/EditorSidebar.tsx` (full code in Change 2)
2. Add `sidebarOpen` state to `CollaborativeEditor.tsx`
3. Wrap existing layout in `flex flex-row` and insert `<EditorSidebar>` to the left
4. Wire `onLeaveRoom` to whatever function currently handles leaving/deleting the room
5. Test collapse/expand

---

### Step 5 — Terminal UX (20 min)

1. Add `isRunning` and `lastExitCode` state to `CollaborativeEditor.tsx`
2. Set them in the WS message handler
3. Replace terminal panel header with the new header JSX (code in Change 5)

---

### Total estimated time: ~2.5 hours

| Step | What | Time |
|---|---|---|
| 1 | Animated avatars in Topbar | 30 min |
| 2 | Connection status dot | 20 min |
| 3 | Ctrl+Enter run shortcut | 20 min |
| 4 | Collapsible left sidebar | 70 min |
| 5 | Terminal status + clear | 20 min |
| | **Total** | **~160 min (~2.5 hrs)** |

---

### What we are NOT touching

- Monaco editor internals — already good
- Terminal drag-resize logic — keep as-is
- STOMP transport layer — no changes
- ThemeContext / light-dark toggle — no changes
- `EntryPage.tsx` — no changes
- Language selector — not needed, backend is JS only

---

*Last updated: JS-only backend confirmed. Language selector removed. Sections 6 and 7 finalized.*
