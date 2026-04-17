import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'ghost' | 'primary' | 'outline';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  ghost:
    'bg-transparent border border-accent-purple/30 text-slate-300 hover:border-accent-purple hover:text-white',
  primary:
    'bg-gradient-to-b from-accent-purple to-accent-indigo text-white border border-accent-purple/60 shadow-glow hover:brightness-110',
  outline:
    'bg-bg-800 border border-accent-purple/40 text-accent-violet hover:bg-accent-purple/10',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'ghost', className = '', children, ...rest }, ref) => (
    <button
      ref={ref}
      className={`px-3 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wider transition ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';
