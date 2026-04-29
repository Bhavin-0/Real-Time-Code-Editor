# ⚡ Real-Time Code Editor

A production-grade collaborative code editor where multiple developers can write, run, and share code together — in real time.

Built with **React + Monaco Editor** on the frontend, **Spring Boot + STOMP WebSockets** for collaboration, and a **Node.js Docker-based execution service** to safely run code in isolated environments.

---

## ✨ Features

- **Live Collaboration** — Multiple users edit the same document simultaneously with instant sync via WebSockets
- **Monaco Editor** — The same editor that powers VS Code, with syntax highlighting, auto-complete, and smooth editing
- **Real-Time Presence** — See who else is in the room with you via a live participant panel
- **Code Execution** — Run code and stream stdout/stderr output directly into the terminal panel
- **Light / Dark Theme** — System-aware theme toggle with flash-free hydration
- **Room-based Sessions** — Create or join a named room; collaborate without accounts

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│          React + Vite Frontend       │
│  Monaco Editor │ UsersPanel │ Topbar │
│  CollaborativeEditor (orchestrator)  │
└──────────┬──────────────┬───────────┘
           │ STOMP / WS   │ HTTP + WS
           ▼              ▼
┌───────────────┐  ┌────────────────────┐
│  Spring Boot  │  │  Node Execution    │
│  Collab. WS   │  │  Service (Docker)  │
│  REST API     │  │  stdout/stderr     │
└───────────────┘  └────────────────────┘
```

### Three-service design

| Service | Tech Stack | Purpose |
|---|---|---|
| `frontend/` | React, Vite, TypeScript, Monaco | UI, editor, presence |
| `src/` | Java 17, Spring Boot, STOMP WS | Room management, real-time sync |
| `execution-service/` | Node.js, Docker | Isolated code execution + streaming |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Java 17+
- Maven
- Docker (for execution service)

---

### 1. Clone the repo

```bash
git clone https://github.com/Bhavin-0/Real-Time-Code-Editor.git
cd Real-Time-Code-Editor
```

---

### 2. Start the Spring Boot backend

```bash
# From project root
mvn spring-boot:run
```

The backend starts on `http://localhost:8080`.

WebSocket endpoint: `ws://localhost:8080/ws`

---

### 3. Start the Node execution service

```bash
cd execution-service/runner
npm install
node wsServer.js
```

Execution service starts on `ws://localhost:3001`.

> Make sure Docker is running — code is executed inside isolated containers.

---

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on `http://localhost:5173`.

---

### Environment Variables (Frontend)

Create a `.env` file inside `frontend/`:

```env
VITE_WS_BASE=http://localhost:8080
VITE_EXECUTION_HTTP=http://localhost:8080
VITE_EXECUTION_WS=ws://localhost:3001
```

---

## 📁 Project Structure

```
Real-Time-Code-Editor/
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── CollaborativeEditor.tsx   # Main orchestrator
│   │   │   ├── EditorContainer.tsx       # Monaco wrapper
│   │   │   ├── UsersPanel.tsx            # Presence panel
│   │   │   ├── Topbar.tsx                # Header + controls
│   │   │   ├── EntryPage.tsx             # Room join screen
│   │   │   └── Sidebar.tsx               # Room list (inactive)
│   │   ├── context/
│   │   │   └── ThemeContext.tsx
│   │   ├── services/
│   │   │   ├── collaborationStomp.ts     # STOMP adapter
│   │   │   └── roomApi.ts                # REST room API
│   │   └── index.css                     # CSS variables + tokens
│   └── tailwind.config.js
│
├── src/                       # Spring Boot backend
│   └── main/java/com/collaborative/editor/
│       ├── controller/        # WebSocket + REST controllers
│       ├── model/dto/         # Event payload models
│       └── config/            # WebSocket config
│
├── execution-service/         # Node.js code runner
│   └── runner/
│       ├── wsServer.js        # WebSocket server
│       └── jobManager.js      # Docker job manager
│
└── pom.xml
```

---

## 🔌 WebSocket Event Reference

### Collaboration (STOMP over WebSocket)

#### Client → Server

| Destination | Payload | Description |
|---|---|---|
| `/app/join-room` | `{ roomId, userId, userName }` | Join a room |
| `/app/leave-room` | `{ roomId, userId }` | Leave a room |
| `/app/code-sync` | `{ roomId, userId, content }` | Broadcast code change |

#### Server → Client

Subscribe to: `/topic/room/{roomId}`

| Kind | Description |
|---|---|
| `SNAPSHOT` | Full document state on join |
| `CODE_SYNC` | Incoming code change from another user |
| `USER_JOINED` | A new participant joined |
| `USER_LEFT` | A participant left |
| `USER_LIST` | Updated participant list |
| `ROOM_DELETED` | Room was closed (last user left) |

### Execution (Raw WebSocket)

1. `POST /execute` → `{ jobId: string }`
2. Connect to `ws://localhost:3001/ws?jobId={jobId}`
3. Receive stream events:

| Type | Payload |
|---|---|
| `stdout` | `{ type: "stdout", data: string }` |
| `stderr` | `{ type: "stderr", data: string }` |
| `end` | `{ type: "end", exitCode: number, executionTime: number }` |

---

## 🧰 Tech Stack

### Frontend
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) + TypeScript
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`)
- [@stomp/stompjs](https://stomp-js.github.io/) + `sockjs-client`
- [Tailwind CSS](https://tailwindcss.com/)

### Backend
- [Spring Boot](https://spring.io/projects/spring-boot) (Java 17)
- Spring WebSocket + STOMP
- Spring MVC REST

### Execution Service
- Node.js + `ws` library
- Docker (sandboxed code execution)

---

## 🤝 Contributing

Contributions are very welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

Quick start for contributors:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes with clear commits
4. Push and open a Pull Request

---

## 🗺️ Roadmap

- [ ] Multi-file / project tree support
- [ ] Operational Transform or CRDT for conflict-free concurrent editing
- [ ] Authentication + persistent rooms
- [ ] Multi-language execution (Python, Java, C++, etc.)
- [ ] Interactive stdin input in terminal panel
- [ ] xterm.js integration for true terminal emulation
- [ ] Monaco language server protocol (LSP) integration
- [ ] Export / share session as Gist or link

---

## ⚠️ Known Limitations

- Collaboration uses full-document replacement sync (not OT/CRDT) — concurrent edits may cause cursor jumps
- Execution service currently supports JavaScript/Node only
- No authentication; room membership is client-generated
- Hardcoded service URLs in some places (see `.env` setup above)

---

## 📄 License

MIT © [Bhavin-0](https://github.com/Bhavin-0)

---

## 🙏 Acknowledgements

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the incredible editor experience
- [Spring Boot](https://spring.io/) for making WebSocket infrastructure straightforward
- [Judge0](https://judge0.com/) — original inspiration for the execution approach
