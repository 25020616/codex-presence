import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGroup, motion, useReducedMotion, type HTMLMotionProps, type Variants } from 'motion/react'
import { X } from 'lucide-react'

export const ease = [0.22, 1, 0.36, 1] as const
export const spring = { type: 'spring', stiffness: 460, damping: 32, mass: .85 } as const
const still: Variants = { hidden: { opacity: 1 }, visible: { opacity: 1 } }
export const cascade: Variants = { hidden: {}, visible: { transition: { staggerChildren: .05 } } }
export const rise: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(12px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: .43, ease } },
}
type Variant = 'primary' | 'secondary' | 'quiet' | 'icon'
export function Button({ variant = 'secondary', className = '', ...props }: HTMLMotionProps<'button'> & { variant?: Variant }) {
  const reduced = useReducedMotion()
  return <motion.button type="button" whileTap={reduced ? undefined : { scale: .96 }} transition={spring} {...props} className={'button button-' + variant + ' ' + className} />
}
export function LinkButton({ variant = 'secondary', className = '', ...props }: HTMLMotionProps<'a'> & { variant?: Variant }) {
  const reduced = useReducedMotion()
  return <motion.a whileTap={reduced ? undefined : { scale: .96 }} transition={spring} {...props} className={'button button-' + variant + ' ' + className} />
}
export function Card({ className = '', ...props }: HTMLMotionProps<'div'>) {
  const reduced = useReducedMotion()
  return <motion.div variants={reduced ? still : rise} {...props} className={'bento ' + className} />
}
export function RevealRow(props: HTMLMotionProps<'div'>) {
  const reduced = useReducedMotion()
  const [seen, setSeen] = useState(false)
  return <motion.div {...props} initial={reduced ? false : 'hidden'} whileInView="visible" animate={reduced || seen ? 'visible' : 'hidden'}
    variants={reduced ? still : cascade} viewport={{ once: true, amount: .18 }} onViewportEnter={() => setSeen(true)} onFocusCapture={() => setSeen(true)} />
}
export function PageHeading({ title, emphasis, eyebrow, description, actions }: {
  title: string; emphasis: string; eyebrow?: string; description?: ReactNode; actions?: ReactNode
}) {
  const reduced = useReducedMotion()
  return <motion.header className="page-heading" variants={reduced ? still : cascade}>
    <div>
      {eyebrow && <motion.p variants={reduced ? still : rise} className="eyebrow page-eyebrow"><span aria-hidden />{eyebrow}</motion.p>}
      <h1><motion.span variants={reduced ? still : rise}>{title}</motion.span> <motion.em variants={reduced ? still : {
        hidden: rise.hidden, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: .43, delay: .05, ease } },
      }}>{emphasis}</motion.em></h1>
      {description && <motion.p className="page-description" variants={reduced ? still : rise}>{description}</motion.p>}
    </div>
    {actions && <motion.div className="toolbar page-actions" variants={reduced ? still : rise}>{actions}</motion.div>}
  </motion.header>
}
export function Tabs<T extends string>({ value, items, onNavigate }: {
  value: T
  items: { key: T; label: ReactNode; href: string }[]
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
}) {
  const [hovered, setHovered] = useState<T>()
  const reduced = useReducedMotion()
  const id = useId()
  return <LayoutGroup id={id}>
    <nav className="main-nav" aria-label="Điều hướng chính" onPointerLeave={() => setHovered(undefined)}>
      {items.map(item => <motion.a key={item.key} href={item.href} aria-current={item.key === value ? 'page' : undefined} onClick={event => onNavigate(event, item.href)}
        whileTap={reduced ? undefined : { scale: .96 }} onPointerEnter={event => {
          if (event.pointerType !== 'touch') setHovered(item.key)
        }} onFocus={() => setHovered(item.key)} onBlur={() => setHovered(undefined)}>
        {item.key === value && <motion.span layoutId="active" aria-hidden className="selected-pill" transition={reduced ? { duration: 0 } : spring} />}
        {item.key === hovered && item.key !== value && <motion.span layoutId="hover" aria-hidden className="ghost-pill" transition={reduced ? { duration: 0 } : spring} />}
        {item.label}
      </motion.a>)}
    </nav>
  </LayoutGroup>
}
export function Modal({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    const trigger = document.activeElement
    el.showModal()
    document.body.classList.add('modal-open')
    return () => {
      el.close()
      document.body.classList.remove('modal-open')
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} className={'dialog ' + className}
    onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.currentTarget === event.target) onClose() }}>
    <motion.div className="dialog-surface" initial={reduced ? false : { opacity: 0, scale: .975, y: 9, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: .25, ease }}>
      <div className="dialog-heading"><h2 id={titleId}>{title}</h2><Button variant="icon" onClick={onClose} aria-label="Đóng hộp thoại"><X size={19}/></Button></div>
      {children}
    </motion.div>
  </dialog>, document.body)
}
