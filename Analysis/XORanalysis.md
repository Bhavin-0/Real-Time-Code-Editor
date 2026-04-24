# 1. Project Overview

This repository is a Next.js frontend for a collaborative code editor experience. The editor page is assembled from reusable UI primitives plus a collaboration layer implemented with Socket.IO.

Critical finding for your extraction goal:
- Monaco editor is **not** used in this codebase.
- The actual editor implementation is `react-simple-code-editor` + Prism highlighting.
- The "terminal" is not a true terminal emulator; it is a right-side panel showing typing status and code execution output text.

Primary entry points:
- `src/app/Editor/page.tsx`: Editor page composition, language selector, top-level code state.
- `src/components/code-editor.tsx`: Core editor implementation + collaboration wiring + output panel.
- `src/socket.jsx`: Socket.IO client singleton initialization.
- `src/components/app-sidebar.tsx`: Sidebar composition for team members and room actions.
- `src/components/animated-tooltip-demo.tsx`: Team member presence view fed by socket room updates.
- `src/services/compilerAPI.tsx`: Judge0 API integration for code execution.

Supporting session/login flow:
- `src/app/Collaborate/page.tsx`: Login screen route.
- `src/components/login.tsx`: Room/name capture and localStorage session bootstrap.
- `src/components/sidebar-opt-in-form.tsx`: Copy room ID / leave room behavior.

Layout foundation:
- `src/components/ui/sidebar.tsx`: Responsive/collapsible sidebar framework.
- `src/hooks/use-mobile.ts`: Mobile breakpoint logic used by sidebar system.

Global styling and typing indicator styles:
- `src/app/globals.css`

Dependency-level verification (`package.json`):
- Present: `react-simple-code-editor`, `prismjs`, `socket.io-client`.
- Absent: `monaco-editor`, `@monaco-editor/react`, `xterm`, `xterm-addon-fit`.

Implication:
- You can reuse substantial UI/layout pieces directly.
- If your target architecture requires Monaco, Monaco must be introduced as a replacement for `CodeEditor` internals.

---

# 2. Editor Architecture

## 2.1 Current editor engine

File:
- `src/components/code-editor.tsx`

Current implementation characteristics:
- Editor widget: `react-simple-code-editor` (`Editor` import from `react-simple-code-editor`).
- Syntax highlighting: Prism (`prismjs`) with language components imported for JS/TS/CSS/HTML/C++/Java/Python.
- Editor rendering: controlled by local `code` state initialized from `value` prop.
- Parent page (`src/app/Editor/page.tsx`) also stores code state and passes `onChange` callback.

Data flow:
1. Parent page keeps `code` and `language`.
2. `CodeEditor` copies incoming `value` into internal state once at initialization (`useState(value)`), then mutates local state.
3. On user input, `handleValueChange` updates local state and calls `onChange`.
4. On incoming `codeUpdate` socket event, local state is overwritten.

Hidden behavior:
- Potential state divergence risk because parent and child both hold source of truth.
- Parent changes to `value` after mount do not automatically sync child unless component remounts or additional sync effect exists (none observed).

## 2.2 Language handling

Language selection UI:
- `src/app/Editor/page.tsx` uses Radix-based `Select` with options:
  - javascript, jsx, typescript, tsx, css, html, cpp, java, python

Highlighting mapping in `CodeEditor`:
- Prism language object chosen via `switch`.
- Render callback actually uses `Prism.highlight(code, Prism.languages[language], language)` directly, not the helper `getLanguage`.

Execution language mapping:
- `LANGUAGE_CONFIG` in `CodeEditor` maps language signatures to Judge0 `language_id` values.
- `detectLanguage` checks source code identifiers first, selected language second.

Implication:
- For clean extraction, language mapping should be moved out into a dedicated adapter/service interface.

## 2.3 Keybindings

Implemented keybinding:
- Ctrl+Alt+N triggers code execution in `CodeEditor` via `document.addEventListener('keydown', ...)`.

Keybinding notes:
- Global document listener means shortcut works regardless of editor focus context.
- Could conflict with application/global shortcuts in host app.

## 2.4 Themes and visual styling

Editor visual style is hardcoded inline:
- Font family, font size, background color `#2d2d2d`, text color `#ccc`, min height.

Prism theme:
- `prism-tomorrow.css` imported in `code-editor.tsx`.

Global app theme:
- CSS variables in `src/app/globals.css` and Tailwind utility-based theming.

Observation:
- Editor theming currently partially independent from global design tokens.
- For reusable module, provide a style contract (CSS vars / className overrides) instead of fixed inline style.

## 2.5 File structure handling

No file tree/file tab abstraction exists in current code.
- No client-side model for multi-file project trees.
- No file open/save APIs.
- No editor tab management.

The "structure" is single-document editing only.

If your target needs file explorer + multi-file Monaco model:
- This must be newly designed.

---

# 3. Terminal Architecture (if exists)

## 3.1 What exists today

File:
- `src/components/code-editor.tsx`

Right panel labeled "User Terminal" includes:
- Typing user list with animated dots.
- "Output" block (`<pre>`) populated from Judge0 execution results.

This is a status/output panel, not a true terminal.

## 3.2 What does NOT exist

No xterm.js terminal stack:
- No `xterm` package.
- No terminal viewport/canvas setup.
- No PTY integration.
- No bidirectional shell stream handling.
- No terminal resize addon/fit logic.

## 3.3 Current input/output behavior

Input:
- No interactive shell input field.
- Only editor keystroke shortcut triggers execution.

Output:
- `executeCode()` calls Judge0 HTTP API and returns stdout/stderr.
- Result text displayed in output panel.

Resize handling:
- No terminal-specific resize behavior.
- Panel width is static split (`w-3/4` editor, `w-1/4` side panel).

Conclusion:
- "Terminal UI" is reusable as a generic execution output widget.
- For real terminal behavior, you need a complete replacement (e.g., xterm.js + backend stream protocol).

---

# 4. UI vs Backend Separation

## 4.1 Classification matrix

### A. PURE UI (reusable directly with minimal/no change)

- `src/components/ui/sidebar.tsx`
  - Generic responsive/collapsible sidebar system.
  - Not tied to Socket.IO or Node backend.

- `src/hooks/use-mobile.ts`
  - Generic media-query mobile detection.

- `src/app/Editor/page.tsx` (layout portions)
  - Breadcrumb/header/content frame.
  - Language selector shell and page structure.
  - Keep while replacing data hooks.

- `src/components/app-sidebar.tsx` (structural shell)
  - Sidebar composition itself is reusable.
  - Child widgets currently backend-dependent.

- `src/app/globals.css` (global theme variables + utility styles)
  - Mostly reusable, except collaboration-specific class names if undesired.

### B. BACKEND-DEPENDENT or SESSION-DEPENDENT (rewrite required)

- `src/socket.jsx`
  - Socket.IO transport/protocol binding.
  - Needs replacement for STOMP/raw WebSocket abstraction.

- `src/components/code-editor.tsx`
  - Contains mixed concerns:
    - UI editor rendering (reusable conceptually)
    - realtime room join/leave/change events (backend-dependent)
    - typing events (backend-dependent)
    - Judge0 execution API calls (backend/service-dependent)
    - localStorage session assumptions (app-dependent)
  - Must be decomposed before reuse.

- `src/components/animated-tooltip-demo.tsx`
  - Presence data sourced from socket `updateRoom` event.

- `src/components/typing-indicator.tsx`
  - Depends on socket typing events and event names.

- `src/components/room-profiles.tsx`
  - Socket-dependent (`requestProfiles`, `updateProfiles`).
  - Also appears not actively integrated in editor page.

- `src/components/login.tsx`
  - Hardcoded room/member model persisted in localStorage.
  - Local simulation of member list (`room-${roomId}` key) is not backend-authoritative.

- `src/components/sidebar-opt-in-form.tsx`
  - Leave/copy behavior uses localStorage room data as source of truth.

- `src/services/compilerAPI.tsx`
  - Direct external execution service call to Judge0 via RapidAPI keys.
  - Not tied to Node backend specifically, but backend/service dependent and likely unsuitable for production frontend direct key usage.

## 4.2 Recommended concern split for reusable module

Split into 4 layers:

1) `editor-ui` (pure presentational)
- Monaco/Editor rendering component.
- Toolbars, language selector, output panel, typing visual widgets.
- No socket/web API calls.

2) `collab-domain` (framework-level state)
- Room/session/editor state model.
- Reducers/stores for participants, document, presence, connection status.

3) `transport-adapter` (protocol-specific)
- Socket.IO adapter OR STOMP adapter OR raw WebSocket adapter.
- Normalized events to domain actions.

4) `execution-adapter` (code run service)
- Pluggable execution provider (Judge0, internal sandbox, Java service).

---

# 5. WebSocket Event Contracts

Below is the exact event behavior observed in frontend code.

## 5.1 Frontend -> Backend events (observed)

### `joinRoom`
Emitted from:
- `src/components/code-editor.tsx`
- `src/components/animated-tooltip-demo.tsx`

Payload shape (object):
```ts
{
  roomId: string;
  name: string;
}
```

### `leaveRoom`
Emitted from:
- `src/components/code-editor.tsx` cleanup

Payload shape (string):
```ts
roomId: string
```

Note: payload shape inconsistency with `joinRoom` (object vs plain string) may complicate backend handlers.

### `codeChange`
Emitted from:
- `src/components/code-editor.tsx`

Payload shape:
```ts
{
  roomId: string;
  code: string;
}
```

### `userTyping`
Emitted from:
- `src/components/code-editor.tsx`

Payload shape:
```ts
{
  roomId: string;
  name: string;
}
```

### `userStoppedTyping`
Emitted from:
- `src/components/code-editor.tsx`

Payload shape:
```ts
{
  roomId: string;
  name: string;
}
```

### `requestProfiles` (possibly unused in active flow)
Emitted from:
- `src/components/room-profiles.tsx`

Payload shape:
```ts
roomId: string
```

## 5.2 Backend -> Frontend events (observed)

### `codeUpdate`
Handled in:
- `src/components/code-editor.tsx`

Payload shape:
```ts
updatedCode: string
```

### `updateRoom`
Handled in:
- `src/components/animated-tooltip-demo.tsx`

Payload shape:
```ts
members: Array<{
  name: string;
  roomId?: string;
  peopleId: number;
}>
```

Note: shape inferred from usage (`member.peopleId`, `member.name`).

### `userTyping`
Handled in:
- `src/components/code-editor.tsx`
- `src/components/typing-indicator.tsx`

Payload shape:
```ts
{ name: string }
```

### `userStoppedTyping`
Handled in:
- `src/components/code-editor.tsx`
- `src/components/typing-indicator.tsx`

Payload shape:
```ts
{ name: string }
```

### `updateProfiles` (possibly unused in active flow)
Handled in:
- `src/components/room-profiles.tsx`

Payload shape:
```ts
Record<string, { name: string; peopleId: number }>
```

## 5.3 Backend-agnostic normalized contracts

Define normalized message contracts independent of Socket.IO naming:

```ts
// Shared domain types
export type RoomId = string;
export type UserId = string;

export interface Participant {
  userId: UserId;
  name: string;
  avatarId?: number;
}

export interface JoinRoomRequest {
  roomId: RoomId;
  participant: Participant;
}

export interface LeaveRoomRequest {
  roomId: RoomId;
  userId: UserId;
}

export interface DocumentChanged {
  roomId: RoomId;
  documentId: string; // support future multi-file
  content: string;
  revision?: number;
  authorUserId: UserId;
  timestamp: string;
}

export interface TypingStateChanged {
  roomId: RoomId;
  userId: UserId;
  isTyping: boolean;
  timestamp: string;
}

export interface RoomSnapshot {
  roomId: RoomId;
  participants: Participant[];
}

export interface EditorSnapshot {
  roomId: RoomId;
  documentId: string;
  content: string;
  revision?: number;
}
```

Protocol-agnostic channel map recommendation:

```ts
// semantic channels
"room.join"
"room.leave"
"room.snapshot"
"editor.change"
"editor.snapshot"
"presence.typing"
"presence.participants"
```

You can then map these semantic channels to Socket.IO events, STOMP destinations, or raw WebSocket JSON `type` fields.

---

# 6. Required Changes for Java Backend

You asked for compatibility with Spring Boot WebSocket backend and guidance for STOMP or raw WebSocket.

## 6.1 Immediate removals

Remove or isolate these Node/socket-specific bindings:
- `src/socket.jsx` (Socket.IO singleton and options).
- Socket usage inside `src/components/code-editor.tsx`, `src/components/animated-tooltip-demo.tsx`, `src/components/typing-indicator.tsx`, `src/components/room-profiles.tsx`.
- localStorage-as-room-authority logic in `src/components/login.tsx` and `src/components/sidebar-opt-in-form.tsx`.

Optional remove/replace:
- `src/services/compilerAPI.tsx` if execution should route through Java backend.

## 6.2 Refactor targets

### 1) Extract pure editor shell
Create a protocol-free component boundary:

```ts
interface EditorShellProps {
  code: string;
  language: string;
  isConnected: boolean;
  participants: Participant[];
  typingUsers: string[];
  output?: string;
  onCodeChange(code: string): void;
  onRunCode(): void;
  onLanguageChange(language: string): void;
}
```

`EditorShell` should only render UI and raise callbacks.

### 2) Create collaboration client interface

```ts
interface CollaborationClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  joinRoom(input: JoinRoomRequest): void;
  leaveRoom(input: LeaveRoomRequest): void;
  sendDocumentChange(change: DocumentChanged): void;
  sendTyping(state: TypingStateChanged): void;
  onRoomSnapshot(cb: (snapshot: RoomSnapshot) => void): () => void;
  onEditorSnapshot(cb: (snapshot: EditorSnapshot) => void): () => void;
  onTyping(cb: (state: TypingStateChanged) => void): () => void;
}
```

Then inject one of:
- `StompCollaborationClient`
- `RawWebSocketCollaborationClient`

### 3) Session identity abstraction
Replace direct localStorage calls with a session provider:

```ts
interface SessionStore {
  getCurrentUser(): { userId: string; name: string } | null;
  setCurrentUser(user: { userId: string; name: string; roomId: string }): void;
  clearCurrentUser(): void;
}
```

## 6.3 Spring Boot STOMP mapping option

Typical Spring config:
- Client send prefix: `/app`
- Broker topics: `/topic`
- User queue (optional): `/user/queue`

Suggested mapping:

Frontend publish:
- `/app/room.join`
- `/app/room.leave`
- `/app/editor.change`
- `/app/presence.typing`

Frontend subscribe:
- `/topic/rooms/{roomId}/participants`
- `/topic/rooms/{roomId}/editor`
- `/topic/rooms/{roomId}/typing`

Payload format:
- JSON matching normalized contracts in section 5.3.

Client library choices (frontend):
- `@stomp/stompjs` + `sockjs-client` (if SockJS fallback desired).

## 6.4 Spring Boot raw WebSocket mapping option

Single endpoint example:
- `/ws/collab`

Message envelope recommendation:

```json
{
  "type": "editor.change",
  "roomId": "abc123",
  "payload": {
    "documentId": "main",
    "content": "...",
    "revision": 17,
    "authorUserId": "u-1",
    "timestamp": "2026-04-23T12:34:56.000Z"
  }
}
```

Advantages:
- No STOMP frame overhead.
- Full control over protocol evolution/versioning.

Tradeoff:
- You must implement subscription semantics and routing conventions manually.

## 6.5 Monaco-specific adaptation path (since Monaco is absent)

Because current project has no Monaco, add a Monaco adapter component:

```ts
interface EditorEngineAdapter {
  mount(container: HTMLElement, initialCode: string, language: string): void;
  setValue(code: string): void;
  getValue(): string;
  setLanguage(language: string): void;
  onChange(cb: (code: string) => void): () => void;
  dispose(): void;
}
```

Implementation candidates:
- `MonacoEngineAdapter` with `@monaco-editor/react`.
- Temporary `SimpleCodeEditorAdapter` to preserve current behavior while migrating.

## 6.6 Execution pipeline changes

Current execution is direct browser -> Judge0 (RapidAPI keys in public env vars).

For Java backend compatibility/security:
- Route execution through Spring endpoint (`POST /api/execute` or WS request/reply).
- Keep keys/server credentials in backend only.
- Return normalized execution response:

```ts
interface ExecutionResponse {
  stdout: string;
  stderr: string;
  status: "success" | "compile_error" | "runtime_error" | "timeout" | "error";
  exitCode?: number;
}
```

---

# 7. Risks / Hidden Coupling Issues

1. Editor state duplication risk
- `src/app/Editor/page.tsx` and `src/components/code-editor.tsx` both hold code state.
- Can create stale renders or accidental overwrite race.

2. Inconsistent event payload contracts
- `leaveRoom` sends plain string while `joinRoom` sends object.
- Hard to maintain across protocol migration.

3. Transport lock-in to Socket.IO semantics
- Event names and callback style tightly coupled to `socket.io-client`.
- Must be abstracted before STOMP/raw migration.

4. localStorage used as authoritative room membership source
- `login.tsx` and `sidebar-opt-in-form.tsx` mutate local room member lists.
- Conflicts with backend truth in real multi-client scenarios.

5. Presence duplication and potential duplicate room join emits
- `CodeEditor` and `AnimatedTooltipPreview` both emit `joinRoom`.
- Can produce duplicate join side effects depending on backend implementation.

6. Unused or partially integrated components
- `TypingIndicator` imported in `code-editor.tsx` but not rendered.
- `RoomProfiles` appears detached from active editor page.
- Indicates possible drift between intended and actual architecture.

7. Global keydown side effects
- Ctrl+Alt+N bound on `document`, not scoped to editor focus.

8. Public execution credentials risk
- `NEXT_PUBLIC_RAPID_API_KEY` usage exposes sensitive key path to browser bundle.

9. No file model despite collaborative editor framing
- Single-document contract may become a blocker when adding project/file tree.

10. Missing operational metadata in collaboration protocol
- No revision numbers, op IDs, conflict resolution metadata (OT/CRDT), or server ACKs.
- Race conditions likely under concurrent edits and packet reordering.

11. Socket lifecycle handling quirks
- Socket disconnect called in one component lifecycle; shared singleton might impact other subscribers unexpectedly if reused across mounted components.

12. UI assumption coupling
- Team avatar mapping depends on `peopleId` index to static image array in `animated-tooltip-demo.tsx`.
- Non-portable when user identity model changes.

---

If you want, next iteration can transform this analysis into a concrete extraction checklist with target folder structure and interface-first TypeScript skeletons (while still keeping this same file only, per your requirement).
