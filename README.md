# Pixel Agents

A virtual top-down pixel office where AI agents collaborate. Built with **React 18 + TypeScript + Tailwind + Framer Motion + Zustand**.

## Stack
- React 18 + TS (Vite)
- Tailwind CSS (custom dark/pixel palette)
- Framer Motion (panel + avatar transitions)
- Lucide React (icons)
- Zustand (global store)

## Folder structure
```
pixel-agents/
├── src/
│   ├── components/
│   │   ├── office/        # Grid, Desk, AgentAvatar
│   │   ├── ui/            # Button, Card, Modal
│   │   └── panels/        # TopBar, ChatContainer, CompanySidebar, DocumentCenter, AddAgentModal
│   ├── hooks/             # useAgentLogic, useLogs
│   ├── services/
│   │   ├── agents/        # agentEngine (LLM stub)
│   │   └── sharedMemory.ts
│   ├── store/             # zustand store
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── shared_memory/         # local "filesystem" for agents
│   ├── context.json
│   └── documents/
├── tailwind.config.js
└── vite.config.ts
```

## Run

```bash
cd pixel-agents
npm install
npm run dev
```

Open http://localhost:5173

## Features

- **Top-down pixel office** with desks, chairs and a meeting room (pure CSS — no sprite assets needed).
- **Agent tabs** in the top bar; click an avatar in the office or a tab to switch chat context.
- **Chat sidebar** with `@mention` autocomplete. Mentioning an agent (`@miguel`, `@sofia`) triggers a reply from them in the same thread.
- **Company Context sidebar** — edit Mission, Products, Culture, Notes. Hitting **Save & Apply to all agents** writes `shared_memory/context.json` (mirrored to `localStorage`).
- **Documents & Summaries** modal that lists artifacts produced by agents.
- **Add Agent** modal to spawn new pixel coworkers at runtime.

## Vibe coding tips

The app is intentionally modular. Some quick prompts to iterate with Claude Code:

- *"Add a meeting room with a round table on the right side of the grid."*
- *"Replace `agentEngine.generateAgentReply` with a real call to the Claude API using `@anthropic-ai/sdk`."*
- *"Persist `shared_memory` to disk through a small Vite dev plugin instead of localStorage."*
- *"Add a kanban panel above the office."*
