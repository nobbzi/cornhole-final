import React, { forwardRef } from 'react'
import clsx from 'clsx'

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={clsx(
      'h-10 w-full rounded-xl border border-black/30 bg-white/80 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/60',
      className
    )}
    {...props}
  />
))