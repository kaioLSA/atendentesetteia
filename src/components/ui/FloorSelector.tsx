import { Layers } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function FloorSelector() {
  const currentFloor = useStore((s) => s.currentFloor);
  const setFloor = useStore((s) => s.setFloor);
  
  const floors = [0, 1, 2];
  
  return (
    <div className="absolute left-6 bottom-20 flex flex-col gap-2 z-20 pointer-events-auto">
      <div className="text-[10px] font-mono uppercase tracking-wider text-accent-violet/60 mb-1 ml-1 flex items-center gap-1">
        <Layers size={10} /> Andar
      </div>
      <div className="flex flex-col gap-1.5 p-1.5 rounded-sm bg-bg-900/80 border border-accent-purple/20 backdrop-blur-md">
        {floors.map((f) => (
          <button
            key={f}
            onClick={() => setFloor(f)}
            className={`w-8 h-8 rounded-sm font-mono text-xs flex items-center justify-center transition-all ${
              currentFloor === f
                ? 'bg-accent-purple text-white shadow-glow border border-accent-purple/50'
                : 'text-slate-400 hover:bg-accent-purple/20 hover:text-slate-200 border border-transparent'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
