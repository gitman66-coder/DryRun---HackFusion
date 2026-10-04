import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: ReactNode; loading?: boolean }
export function Button({ variant = 'primary', icon, loading, children, className = '', ...props }: Props) {
  return <button className={`button button-${variant} ${className}`} {...props}>{loading ? <LoaderCircle size={16} className="spin" /> : icon}{children}</button>
}
