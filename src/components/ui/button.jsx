import React from 'react'
import clsx from 'clsx'

export const Button = ({ className, variant='default', size='default', ...props }) => {
  const base = 'inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium shadow transition active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed';
  const variants = {
    default: 'bg-black text-white hover:opacity-90',
    secondary: 'bg-white text-black border border-black/30 hover:bg-gray-50',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'bg-transparent border border-black/30 text-black hover:bg-black/5',
  };
  const sizes = { sm: 'h-8 px-2', lg: 'h-11 px-6', default: 'h-10 px-4' };
  return <button className={clsx(base, variants[variant]||variants.default, sizes[size]||sizes.default, className)} {...props} />;
}