import { Check, Clock } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function TaskBar({ agentId }: { agentId: string }) {
  const tasks = useStore((s) => s.tasks.filter(t => t.assignedTo === agentId && t.status !== 'done'));
  const updateTaskStatus = useStore((s) => s.updateTaskStatus);

  if (tasks.length === 0) return null;

  return (
    <div className="border-t border-accent-purple/20 bg-bg-900/50 p-2 flex flex-col gap-2 max-h-40 overflow-y-auto flex-shrink-0">
      <div className="text-[9px] font-mono uppercase tracking-wider text-accent-violet/60 flex items-center gap-1">
        <Clock size={10} /> Tarefas Ativas
      </div>
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <div 
            key={task.id}
            className="flex items-center justify-between gap-2 p-1.5 rounded-sm bg-accent-purple/5 border border-accent-purple/10 group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-mono text-slate-200 truncate leading-none mb-1">{task.title}</p>
              <div className="flex items-center gap-2">
                <span className={`text-[8px] font-mono px-1 rounded-sm border uppercase ${
                  task.status === 'in_progress' 
                    ? 'border-accent-blue/30 text-accent-blue bg-accent-blue/10' 
                    : 'border-slate-600 text-slate-500'
                }`}>
                  {task.status === 'in_progress' ? 'em progresso' : 'pendente'}
                </span>
                {task.priority === 'high' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" title="Alta prioridade" />
                )}
              </div>
            </div>
            <button
              onClick={() => updateTaskStatus(task.id, task.status === 'pending' ? 'in_progress' : 'done')}
              title={task.status === 'pending' ? 'Iniciar tarefa' : 'Concluir tarefa'}
              className="w-6 h-6 flex items-center justify-center rounded-sm border border-accent-green/40 text-accent-green hover:bg-accent-green/20 transition-colors flex-shrink-0"
            >
              <Check size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
