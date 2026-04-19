import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TopBar } from './components/panels/TopBar';
import { Grid } from './components/office/Grid';
import { ChatContainer } from './components/panels/ChatContainer';
import { CompanySidebar } from './components/panels/CompanySidebar';
import { DocumentCenter } from './components/panels/DocumentCenter';
import { AddAgentModal } from './components/panels/AddAgentModal';
import { SettingsModal } from './components/panels/SettingsModal';
import { NotesModal } from './components/panels/NotesModal';
import { HireConfirmModal } from './components/panels/HireConfirmModal';
import { LogsPanel } from './components/panels/LogsPanel';
import { useStore } from './store/useStore';
import { useDailyBriefing } from './hooks/useDailyBriefing';

export default function App() {
  // Feature 5: daily briefing timer
  useDailyBriefing();

  const agents = useStore((s) => s.agents);
  const documents = useStore((s) => s.documents);
  const messages = useStore((s) => s.messages);
  const pendingHire = useStore((s) => s.pendingHire);
  const setPendingHire = useStore((s) => s.setPendingHire);
  const confirmHire = useStore((s) => s.confirmHire);

  const [contextOpen, setContextOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);


  const totalChats = Object.values(messages).filter((m) => m.length > 0).length;

  return (
    <div className="h-screen w-screen flex flex-col text-slate-200">
      <TopBar
        onOpenDocs={() => setDocsOpen(true)}
        onOpenContext={() => setContextOpen(true)}
        onOpenAddAgent={() => setAddOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenNotes={() => setNotesOpen(true)}
        onOpenLogs={() => setLogsOpen((v) => !v)}
        logsOpen={logsOpen}
      />

      <main className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 right-[340px] p-6">
          <Grid />
        </div>

        <ChatContainer />
        <AnimatePresence>
          {contextOpen && (
            <CompanySidebar
              open={contextOpen}
              onClose={() => setContextOpen(false)}
            />
          )}
        </AnimatePresence>

        <footer className="absolute bottom-2 left-2 right-[352px] flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-accent-violet/80 pointer-events-none">
          <div className="px-2 py-1 panel border-accent-purple/40 pointer-events-auto">
            {agents.length} agent{agents.length !== 1 && 's'} ·{' '}
            {totalChats} chat{totalChats !== 1 && 's'} ·{' '}
            {documents.length} doc{documents.length !== 1 && 's'}
          </div>
          <div className="px-2 py-1 text-accent-violet/60">
            shared_memory/context.json
          </div>
        </footer>

        <DocumentCenter open={docsOpen} onClose={() => setDocsOpen(false)} />
        <AddAgentModal open={addOpen} onClose={() => setAddOpen(false)} />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
        <NotesModal open={notesOpen} onClose={() => setNotesOpen(false)} />
        <HireConfirmModal
          proposal={pendingHire}
          onConfirm={confirmHire}
          onDecline={() => setPendingHire(null)}
        />
        <LogsPanel open={logsOpen} onClose={() => setLogsOpen(false)} />
      </main>
    </div>
  );
}
