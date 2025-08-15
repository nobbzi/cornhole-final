import React from 'react'
import clsx from 'clsx'

export const Card = ({ className, style, ...props }) => (
  <div className={clsx('rounded-2xl border bg-white/80 text-black shadow', className)} style={style} {...props} />
)

export const CardHeader = ({ className, ...props }) => (
  <div className={clsx('p-4 border-b border-black/20', className)} {...props} />
)

export const CardTitle = ({ className, ...props }) => (
  <h3 className={clsx('text-xl font-bold', className)} {...props} />
)

export const CardContent = ({ className, ...props }) => (
  <div className={clsx('p-4', className)} {...props} />
)