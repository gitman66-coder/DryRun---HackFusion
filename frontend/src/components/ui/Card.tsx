import type { HTMLAttributes, ReactNode } from 'react'
export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <section className={`panel ${className}`} {...props}>{children}</section> }
export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) { return <div className="section-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>{action}</div> }
