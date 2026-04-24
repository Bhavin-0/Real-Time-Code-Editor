# 1. Project Overview

This repository contains:

- A React + Vite frontend in [frontend/src](frontend/src) and [frontend/src/components](frontend/src/components).
- A Java Spring Boot collaboration backend (STOMP over WebSocket + REST) in [src/main/java/com/collaborative/editor](src/main/java/com/collaborative/editor).
- A separate Node execution service for code run streaming in [execution-service/runner](execution-service/runner).

For your goal (extract only reusable Editor UI layer), the critical observation is:

- Monaco editor + page layout + terminal visual panel are in frontend components and are reusable.
- Collaboration transport and execution transport are tightly coupled in one UI shell component and must be separated.

Primary frontend composition:

- Router and app shell: [frontend/src/App.tsx](frontend/src/App.tsx), [frontend/src/main.tsx](frontend/src/main.tsx)
- Entry screen: [frontend/src/components/EntryPage.tsx](frontend/src/components/EntryPage.tsx)
- Main editor screen (mixed UI + backend logic): [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx)
- Monaco wrapper: [frontend/src/components/EditorContainer.tsx](frontend/src/components/EditorContainer.tsx)
- Presence/activity panel: [frontend/src/components/UsersPanel.tsx](frontend/src/components/UsersPanel.tsx)
- Header controls/status: [frontend/src/components/Topbar.tsx](frontend/src/components/Topbar.tsx)
- Theme state: [frontend/src/context/ThemeContext.tsx](frontend/src/context/ThemeContext.tsx)
- Transport adapter (STOMP + SockJS): [frontend/src/services/collaborationStomp.ts](frontend/src/services/collaborationStomp.ts)
- REST room delete adapter: [frontend/src/services/roomApi.ts](frontend/src/services/roomApi.ts)

Also present but currently not wired into the route tree:

- Room-list sidebar component: [frontend/src/components/Sidebar.tsx](frontend/src/components/Sidebar.tsx)

Visual system and tokens:

- CSS variables and light/dark tokens: [frontend/src/index.css](frontend/src/index.css)
- Tailwind token mapping: [frontend/tailwind.config.js](frontend/tailwind.config.js)
- Initial theme hydration in HTML: [frontend/index.html](frontend/index.html)

Dependencies relevant to extraction:

- Monaco: @monaco-editor/react, monaco-editor in [frontend/package.json](frontend/package.json)
- Collaboration transport libs (to remove/replace if desired): @stomp/stompjs, sockjs-client in [frontend/package.json](frontend/package.json)

# 2. Editor Architecture

## 2.1 Editor Component Stack

Current stack on room page:

1. [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx) orchestrates everything:
- Connection state
- User presence/activity
- Editor text state
- Run-code flow and output rendering
- Terminal panel resizing

2. [frontend/src/components/EditorContainer.tsx](frontend/src/components/EditorContainer.tsx) wraps Monaco and receives:
- onMount callback
- onChange callback
- value string

3. Monaco instance reference is lifted to parent and used to apply remote content.

## 2.2 Monaco Integration Details

Implemented in [frontend/src/components/EditorContainer.tsx](frontend/src/components/EditorContainer.tsx):

- Editor component: @monaco-editor/react Editor.
- Language: javascript (defaultLanguage).
- Theme switch driven by ThemeContext (vs-dark vs vs-light).
- Controlled value via prop value.
- onMount and onChange provided by parent.
- Options set:
  - readOnly false
  - renderLineHighlight all
  - colorDecorators true
  - cursorBlinking smooth
  - minimap enabled, scale 0.75
  - fontSize 14
  - custom font stack
  - scrollBeyondLastLine false
  - automaticLayout true
  - padding top/bottom 16
  - smoothScrolling true
  - tabSize 2

What is missing (important for reuse expectations):

- No Monaco model-per-file management.
- No tab/file tree abstraction.
- No custom keybindings via Monaco API.
- No Monaco language worker/plugin extension configuration.
- No diff editor mode.

So this is a single-document editor wrapper, not a multi-file IDE abstraction.

## 2.3 Editor State Flow

In [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx):

- editorContent state stores current full text.
- editorRef stores Monaco editor instance.
- applyingRemoteRef flag prevents echo loop when remote content is applied.
- schedulePublish debounces outbound sync (~240ms).
- Remote content is applied via setValue on the Monaco instance (replace-all strategy).

Current algorithm:

- Local typing triggers onChange.
- onChange updates state and (if connected) schedules publish full document.
- Incoming CODE_SYNC/SNAPSHOT events set full document via setValue.

Implication:

- Collaboration is full-document sync, not operational transform or CRDT.
- Large documents or high-latency rooms will show churn risks.

## 2.4 Theme and Editor Appearance

Theme architecture:

- Context/provider in [frontend/src/context/ThemeContext.tsx](frontend/src/context/ThemeContext.tsx)
- Theme toggle control in [frontend/src/components/ThemeToggle.tsx](frontend/src/components/ThemeToggle.tsx)
- HTML classes light/dark and CSS vars in [frontend/src/index.css](frontend/src/index.css)
- Early class hydration in [frontend/index.html](frontend/index.html) to avoid flash.

Monaco theme is coupled only to resolved light/dark and can be reused directly.

# 3. Terminal Architecture (if exists)

A terminal-like UI exists, but it is not a true terminal emulator.

## 3.1 Rendering Mechanism

In [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx):

- Output is rendered in a pre element.
- Text is appended from WebSocket messages.
- Auto-scroll implemented by setting scrollTop to scrollHeight on output change.

There is no xterm.js dependency in [frontend/package.json](frontend/package.json), therefore terminal is custom plain text rendering.

## 3.2 Resize Handling

Resize logic is manual, also in [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx):

- Drag handle captures mouse down.
- mousemove computes new panel height with clamped min/max (120 to 500).
- mouseup removes listeners.

This controls container height only; there is no terminal character grid resize API because no emulator is used.

## 3.3 Input/Output Handling

Current behavior:

- Output only (stdout/stderr/end messages from websocket).
- No interactive stdin field in UI.
- No command prompt emulation.

Protocol expected by UI from execution WS:

- type stdout or stderr with data string.
- type end to finish run.

Message source is Node service implementation in:

- [execution-service/runner/wsServer.js](execution-service/runner/wsServer.js)
- [execution-service/runner/jobManager.js](execution-service/runner/jobManager.js)

# 4. UI vs Backend Separation

## 4.1 Classification Summary

A. PURE UI (reusable directly)

- [frontend/src/components/EditorContainer.tsx](frontend/src/components/EditorContainer.tsx): Monaco visual container and options.
- [frontend/src/components/Topbar.tsx](frontend/src/components/Topbar.tsx): status and action buttons UI.
- [frontend/src/components/UsersPanel.tsx](frontend/src/components/UsersPanel.tsx): collaborator and activity rendering.
- [frontend/src/components/ThemeToggle.tsx](frontend/src/components/ThemeToggle.tsx): toggle button.
- [frontend/src/context/ThemeContext.tsx](frontend/src/context/ThemeContext.tsx): theme state persistence and html class management.
- [frontend/src/index.css](frontend/src/index.css) + [frontend/tailwind.config.js](frontend/tailwind.config.js): design tokens and utility mapping.
- Terminal panel markup/styling pattern in [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx): reusable if extracted as isolated presentational component.

B. BACKEND-DEPENDENT (must be rewritten or wrapped)

- STOMP client creation and protocol parsing in [frontend/src/services/collaborationStomp.ts](frontend/src/services/collaborationStomp.ts).
- Room deletion API call in [frontend/src/services/roomApi.ts](frontend/src/services/roomApi.ts).
- Execution HTTP + WebSocket flow in [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx) currently hardcoded to localhost:8080 and localhost:3001.
- Room/session route assumptions and localStorage keys in:
  - [frontend/src/components/EntryPage.tsx](frontend/src/components/EntryPage.tsx)
  - [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx)

C. MIXED (must be split)

- [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx) combines:
  - page layout
  - editor state
  - collaboration transport
  - execution transport
  - terminal behavior

This file is the main refactor target.

## 4.2 Recommended Decoupling Shape

Split into:

1. Presentation layer:
- EditorPageLayout
- EditorPane
- TerminalPane
- PresencePane
- HeaderBar

2. Domain hooks:
- useEditorDocumentState
- useTerminalPanelResize
- useActivityLog

3. Ports/adapters interfaces:
- CollaborationGateway
- ExecutionGateway
- RoomAdminGateway

4. Infrastructure adapters:
- StompCollaborationGateway (optional, if you still use STOMP)
- RawWsCollaborationGateway (if backend speaks plain WS)
- HttpExecutionGateway

This lets you preserve UI while replacing transport.

# 5. WebSocket Event Contracts

This section extracts actual contracts first, then defines backend-agnostic contracts.

## 5.1 Existing Frontend -> Backend Events (Collaboration)

Source: [frontend/src/services/collaborationStomp.ts](frontend/src/services/collaborationStomp.ts)

1. Destination /app/join-room
Payload:
- roomId string
- userId string
- userName string

2. Destination /app/code-sync
Payload:
- roomId string
- content string (full document)
- userId string

3. Destination /app/leave-room
Payload:
- roomId string
- userId string

## 5.2 Existing Backend -> Frontend Events (Collaboration)

STOMP topic subscription:

- /topic/room/{roomId} (from [frontend/src/services/collaborationStomp.ts](frontend/src/services/collaborationStomp.ts))

Server event shapes defined by Java model:

- [src/main/java/com/collaborative/editor/model/dto/RoomEventPayload.java](src/main/java/com/collaborative/editor/model/dto/RoomEventPayload.java)
- [src/main/java/com/collaborative/editor/model/dto/RoomEventKind.java](src/main/java/com/collaborative/editor/model/dto/RoomEventKind.java)

Kinds:
- SNAPSHOT
- CODE_SYNC
- USER_LIST
- USER_JOINED
- USER_LEFT
- ROOM_DELETED

Envelope fields:
- kind
- roomId
- userId
- userName
- content (nullable or empty by kind)
- users (nullable or list by kind)

Behavioral mapping from [src/main/java/com/collaborative/editor/controller/CollaborationWebSocketController.java](src/main/java/com/collaborative/editor/controller/CollaborationWebSocketController.java):

- join-room emits SNAPSHOT, then USER_JOINED (if first join), then USER_LIST.
- code-sync emits CODE_SYNC.
- leave-room emits ROOM_DELETED (if room emptied) else USER_LEFT and USER_LIST.

## 5.3 Existing Execution Channel Contracts

Frontend send:

1. HTTP POST /execute
Source: [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx)
Payload:
- code string

Expected response:
- jobId string

2. WebSocket connect ws://localhost:3001/ws?jobId={jobId}
Source: [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx)

Execution websocket message shapes from Node runner:

- [execution-service/runner/jobManager.js](execution-service/runner/jobManager.js)
- [execution-service/runner/wsServer.js](execution-service/runner/wsServer.js)

Messages:
- { type: stdout, data: string }
- { type: stderr, data: string }
- { type: end, exitCode: number, executionTime: number }

Frontend currently only consumes:
- type stdout/stderr -> append data
- type end -> stop loading

## 5.4 Backend-Agnostic Contract Proposal

Define transport-independent TypeScript contracts (for UI domain layer):

1. Collaboration outbound commands

- JoinRoomCommand:
  - roomId
  - actor: { id, name }

- LeaveRoomCommand:
  - roomId
  - actorId

- SyncDocumentCommand:
  - roomId
  - actorId
  - document: { content, version? }

2. Collaboration inbound events

- RoomSnapshotEvent:
  - roomId
  - actor
  - document: { content, version? }
  - participants

- DocumentPatchedEvent or DocumentReplacedEvent:
  - roomId
  - actorId
  - document

- PresenceChangedEvent:
  - roomId
  - action: joined | left | list
  - actor
  - participants

- RoomClosedEvent:
  - roomId
  - closedByActorId?

3. Execution contracts

- StartExecutionRequest:
  - sourceCode
  - language
  - stdin?

- StartExecutionResponse:
  - runId

- ExecutionStreamEvent:
  - stream: stdout | stderr | system
  - chunk
  - timestamp?

- ExecutionCompletedEvent:
  - runId
  - exitCode
  - durationMs

Transport binding:

- STOMP adapter maps contracts to destination names.
- Raw WS adapter maps contracts to JSON messages with action field.

# 6. Required Changes for Java Backend

## 6.1 What to Remove

Remove direct infrastructure calls from UI page component:

- createStompCollaborationClient usage in [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx)
- deleteRoomApi usage in [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx)
- direct fetch POST to localhost:8080 execute in [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx)
- direct WebSocket connection to localhost:3001 in [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx)

Remove Node-specific assumptions:

- hardcoded execution websocket URL format with query jobId
- dependency on Node message type strings without abstraction

## 6.2 What to Rewrite

1. Collaboration adapter

Current:
- [frontend/src/services/collaborationStomp.ts](frontend/src/services/collaborationStomp.ts) is tied to specific destinations and event parsing.

Rewrite into interface + adapter implementation:

- interface CollaborationGateway
  - connect(roomId, actor)
  - disconnect()
  - sendDocument(content)
  - onEvent(callback)

- implementation 1: StompCollaborationGateway
  - Use Spring endpoint /ws and app prefix /app.
  - Subscribe to /topic/room/{roomId}.

- implementation 2: RawWebSocketCollaborationGateway
  - If your Java backend exposes plain WS, map command/event envelopes manually.

2. Execution adapter

Current execution path is split between Spring controller and Node service. For your Java backend objective, define:

- interface ExecutionGateway
  - startExecution(sourceCode, language, stdin?) -> Promise<runId>
  - subscribe(runId, handlers)
  - cancel(runId?) optional

Then provide Java-side implementations:

- STOMP stream option:
  - subscribe /topic/execution/{runId}
  - send start to /app/execution/start

- Raw WS stream option:
  - open ws endpoint /ws/execution/{runId}

3. Room admin adapter

Current:
- [frontend/src/services/roomApi.ts](frontend/src/services/roomApi.ts) performs DELETE API.

Keep concept, but hide URL and query shape behind:

- interface RoomAdminGateway
  - deleteRoom(roomId, actorId)

## 6.3 What Interfaces to Create (exact)

In frontend domain layer (example file grouping):

- src/domain/collaboration/contracts.ts
- src/domain/collaboration/gateway.ts
- src/domain/execution/contracts.ts
- src/domain/execution/gateway.ts
- src/domain/roomAdmin/gateway.ts

Minimum interfaces:

1. CollaborationGateway
- connect(params: { roomId: string; actorId: string; actorName: string }): Promise<void>
- disconnect(): void
- publishDocument(content: string): void
- leaveRoom(): void
- onEvent(handler: (event: CollaborationEvent) => void): () => void
- connectionState(): disconnected | connecting | connected

2. ExecutionGateway
- startExecution(request: { sourceCode: string; language: string; stdin?: string }): Promise<{ runId: string }>
- subscribe(runId: string, handler: (event: ExecutionEvent) => void): { close: () => void }

3. RoomAdminGateway
- deleteRoom(roomId: string, actorId: string): Promise<boolean>

## 6.4 STOMP vs Raw WebSocket Notes for Spring Boot

If STOMP:

- Matches existing Java backend in [src/main/java/com/collaborative/editor/config/WebSocketConfig.java](src/main/java/com/collaborative/editor/config/WebSocketConfig.java).
- Keep @stomp/stompjs and optionally SockJS.
- Keep destination-based command routing.

If raw WebSocket:

- Remove STOMP/SockJS libs from frontend.
- Introduce custom action field in all messages, for example:
  - { action: join-room, payload: ... }
  - { action: code-sync, payload: ... }
- Rebuild reconnect and heartbeats in client adapter.
- Rebuild pub/sub semantics server-side (STOMP currently provides this).

Recommendation:

- For least change and fastest migration to Java, keep STOMP first.
- Only move to raw WebSocket if you need protocol control or want to drop STOMP broker model.

# 7. Risks / Hidden Coupling Issues

1. Full-document replacement sync

- CODE_SYNC currently replaces entire editor content.
- Risk: race conditions and cursor jumps under concurrent edits.
- Hidden coupling between local typing debounce and remote apply flag.

2. Hardcoded language and run backend assumptions

- Editor says JavaScript and execution service runs Node code in Docker.
- If your Java backend supports multiple languages, UI contracts need language field.

3. Single component orchestration complexity

- [frontend/src/components/CollaborativeEditor.tsx](frontend/src/components/CollaborativeEditor.tsx) has many responsibilities.
- High risk of regressions when transport behavior changes.

4. Event shape nullability mismatch

- Java broadcasts may omit content/users for some kinds.
- Frontend parser normalizes some values to defaults.
- Contract docs must keep nullable semantics explicit.

5. Presence and identity trust model

- userId and userName are client-generated and not authenticated.
- If backend adds auth later, gateway contracts need auth context injection.

6. Terminal panel is display-only

- Named Terminal in UI but behaves as output log panel.
- If interactive terminal is required later, component architecture must change (stdin, prompt state, emulator integration).

7. Inactive/unused component drift

- [frontend/src/components/Sidebar.tsx](frontend/src/components/Sidebar.tsx) exists but is not routed in current app shell.
- If copied blindly, it may add dead UI paths.

8. URL and environment coupling

- Collaboration base URL reads VITE_WS_BASE in [frontend/src/services/collaborationStomp.ts](frontend/src/services/collaborationStomp.ts).
- Execution endpoints in editor page are hardcoded, not env-driven.

9. Minor source inconsistency in Java docs

- Comment in [src/main/java/com/collaborative/editor/model/dto/RoomEventPayload.java](src/main/java/com/collaborative/editor/model/dto/RoomEventPayload.java) references CODE symbol, but enum actually uses CODE_SYNC.
- Treat enum as source of truth.

10. Unclear points (explicit)

- No frontend-side file explorer or multi-file model exists in current codebase, so file-structure handling inside editor is effectively absent.
- No frontend automated tests were provided for UI behavior in extracted files.
- No xterm.js or terminal emulator integration exists.
