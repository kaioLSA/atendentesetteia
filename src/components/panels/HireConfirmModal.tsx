import { AnimatePresence, motion } from 'framer-motion';
import { UserPlus, X } from 'lucide-react';
import type { HireProposal } from '../../types';
import { ROLE_DEFAULTS } from '../../services/agents/rolePrompts';
import { CharacterSprite } from '../office/CharacterSprite';

interface Props {
  proposal: HireProposal | null;
  onConfirm: (p: HireProposal) => void;
  onDecline: () => void;
}

export function HireConfirmModal({ proposal, onConfirm, onDecline }: Props) {
  return (
    <AnimatePresence>
      {proposal && (
        <motion.div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDecline}
        >
          <motion.div
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            className="panel w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="panel-header">
              <div className="flex items-center gap-2 text-accent-violet font-mono text-sm uppercase tracking-wider">
                <UserPlus size={14} />
                Nova Contratação
              </div>
              <button onClick={onDecline} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </header>

            <div className="p-5 space-y-4">
              {/* Avatar + name block */}
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-16 h-16 flex items-end justify-center">
                  <CharacterSprite
                    gender={proposal.gender}
                    facing="down"
                    walking={false}
                    size={56}
                    accent={proposal.color}
                    skinTone={proposal.skinTone}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{proposal.emoji}</span>
                    <h2 className="text-white font-mono text-lg font-bold truncate">
                      {proposal.name}
                    </h2>
                  </div>
                  <span
                    className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-widest"
                    style={{
                      background: `${proposal.color}22`,
                      color: proposal.color,
                      border: `1px solid ${proposal.color}55`,
                    }}
                  >
                    {proposal.title}
                  </span>
                </div>
              </div>

              {/* Role badge */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Área
                </span>
                <span
                  className="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider"
                  style={{
                    background: `${ROLE_DEFAULTS[proposal.role]?.color ?? proposal.color}22`,
                    color: ROLE_DEFAULTS[proposal.role]?.color ?? proposal.color,
                    border: `1px solid ${ROLE_DEFAULTS[proposal.role]?.color ?? proposal.color}44`,
                  }}
                >
                  {ROLE_DEFAULTS[proposal.role]?.emoji} {proposal.role}
                </span>
              </div>

              {/* Specialty */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Especialidade
                </p>
                <p className="text-sm text-slate-200 leading-snug">{proposal.specialty}</p>
              </div>

              {/* Description */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Sobre o candidato
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">{proposal.description}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onConfirm(proposal)}
                  className="flex-1 py-2 rounded-sm font-mono text-xs uppercase tracking-widest text-white shadow-glow hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${proposal.color}cc, ${proposal.color}88)`,
                  }}
                >
                  <UserPlus size={13} />
                  Contratar
                </button>
                <button
                  onClick={onDecline}
                  className="px-4 py-2 rounded-sm border border-slate-600/50 text-slate-400 hover:text-white hover:border-slate-400 font-mono text-xs uppercase tracking-widest transition-all"
                >
                  Recusar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
