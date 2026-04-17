import { HTMLAttributes } from 'react';

export function Card({
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`panel hover:border-accent-purple/50 transition-colors ${className}`}
      {...rest}
    />
  );
}
