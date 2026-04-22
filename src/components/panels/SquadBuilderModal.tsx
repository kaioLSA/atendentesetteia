import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cpu, X, Rocket, Loader2 } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function SquadBuilderModal() {
  const isOpen = useStore((s) => s.isSquadBuilderOpen);
  const setOpen = useStore((s) => s.setSquadBuilderOpen);
  const execute = useStore((s) => s.executeSquadBuilder);
  
  const [name, setName] = useState('SQUAD DE CONTEÚDO');
  const [business, setBusiness] = useState('');
  const [audience, setAudience] = useState('');
  const [platform, setPlatform] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Botão clicado! Iniciando execução...');
    setLoading(true);
    
    try {
      await execute({ name, business, audience, platform });
      setOpen(false);
      setName('SQUAD DE CONTEÚDO');
      setBusiness('');
      setAudience('');
      setPlatform('');
    } catch (err) {
      console.error('Erro ao executar SquadBuilder:', err);
      alert('Erro ao criar squad. Verifique o console ou sua chave de API.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="panel w-full max-w-lg overflow-hidden border-accent-cyan/30 shadow-[0_0_50px_rgba(34,211,238,0.1)]">
        <header className="panel-header border-b border-white/10">
          <div className="flex items-center gap-2 text-accent-cyan font-mono text-xs uppercase tracking-widest">
            <Cpu size={14} className={loading ? 'animate-spin' : ''} />
            Squad Builder AI
          </div>
          {!loading && (
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          )}
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Monte seu Esquadrão</h2>
            <p className="text-xs text-slate-400">O CEO irá orquestrar tudo automaticamente.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Nome do Esquadrão</label>
              <input
                required
                className="w-full bg-slate-900 border border-white/10 rounded p-3 text-sm text-white focus:border-accent-cyan/50 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Squad de Vendas"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">O que você vende?</label>
              <input
                required
                className="w-full bg-slate-900 border border-white/10 rounded p-3 text-sm text-white focus:border-accent-cyan/50 outline-none"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="Ex: Marketing Digital"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Público-alvo?</label>
              <input
                required
                className="w-full bg-slate-900 border border-white/10 rounded p-3 text-sm text-white focus:border-accent-cyan/50 outline-none"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ex: Empresários"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Plataforma?</label>
              <input
                required
                className="w-full bg-slate-900 border border-white/10 rounded p-3 text-sm text-white focus:border-accent-cyan/50 outline-none"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="Ex: Instagram"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-cyan text-black py-4 rounded font-bold text-sm hover:bg-white transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>CRIANDO SQUAD...</span>
              </>
            ) : (
              <>
                <Rocket size={18} />
                <span>LANÇAR AGORA</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
