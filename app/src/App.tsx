import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Check, ChevronDown, Code2, Command, FlaskConical, FolderKanban, Github, House, Mail, Menu, Moon, Search, Share2, Sun, Terminal, UserRound } from 'lucide-react'
import { email, previewImage, productUrl, repoUrl, searchItems, viewFromHash, type View } from './data'
import { Button, cascade, ease, LinkButton, Modal, spring, Tabs } from './ui'
import { PortfolioView } from './Views'

const navigation = [
  { key: 'home', name: 'Khám phá', href: '/', Icon: House },
  { key: 'projects', name: 'Dự án', href: '/#projects', Icon: FolderKanban },
  { key: 'about', name: 'Về Gia Huy', href: '/#about', Icon: UserRound },
  { key: 'contact', name: 'Liên hệ', href: '/#contact', Icon: Mail },
] as const
const readStorage = (key: string) => { try { return sessionStorage.getItem(key) } catch { return null } }
const writeStorage = (key: string, value: string) => { try { sessionStorage.setItem(key, value) } catch { /* preference is optional */ } }

export function App() {
  const [view, setView] = useState(viewFromHash)
  const [dark, setDark] = useState(() => readStorage('giahuy.theme') === 'dark')
  const [menu, setMenu] = useState<'workspace' | 'mobile'>()
  const [dialog, setDialog] = useState<'search' | 'preview'>()
  const [feedback, setFeedback] = useState<{ message: string; stamp: number }>()
  const reduced = useReducedMotion()
  const header = useRef<HTMLElement>(null)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const page = useRef<HTMLElement>(null)

  useEffect(() => {
    const handleRoute = () => {
      setView(viewFromHash())
      setMenu(undefined)
      window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })
    }
    window.addEventListener('hashchange', handleRoute)
    window.addEventListener('popstate', handleRoute)
    return () => {
      window.removeEventListener('hashchange', handleRoute)
      window.removeEventListener('popstate', handleRoute)
    }
  }, [reduced])

  useEffect(() => {
    const title = navigation.find(item => item.key === view)?.name
    document.title = view === 'home' ? 'Gia Huy · Personal workspace' : title + ' — Gia Huy · Personal workspace'
  }, [view])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (document.querySelector('dialog[open]')) return
        event.preventDefault()
        setMenu(undefined)
        setDialog('search')
      } else if (event.key === 'Escape' && header.current?.contains(document.activeElement)) {
        setMenu(previous => {
          if (previous) menuTrigger.current?.focus()
          return undefined
        })
      }
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setMenu(undefined)
    }
    document.addEventListener('keydown', keyboard)
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('keydown', keyboard)
      document.removeEventListener('pointerdown', outside)
    }
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(undefined), 3200)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setFeedback({ message: 'Đã sao chép ' + label, stamp: Date.now() })
    } catch {
      setFeedback({ message: 'Chưa sao chép được. Bạn có thể chọn ' + label + ' và sao chép trực tiếp.', stamp: Date.now() })
    }
  }
  function toggleTheme() {
    setDark(!dark)
    writeStorage('giahuy.theme', dark ? 'light' : 'dark')
  }
  function openSearch() {
    setMenu(undefined)
    setDialog('search')
  }
  function openMenu(next: 'workspace' | 'mobile', trigger: HTMLButtonElement) {
    menuTrigger.current = trigger
    setMenu(previous => previous === next ? undefined : next)
  }
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    setMenu(undefined)
    if (location.pathname + location.hash === href) return
    history.pushState(null, '', href)
    setView(viewFromHash())
    window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })
  }
  const boot = (delay: number) => ({
    initial: reduced ? false as const : { opacity: 0, y: 5, filter: 'blur(7px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: reduced ? 0 : .37, delay: reduced ? 0 : delay, ease },
  })
  const innerNavigation = navigation.map(({ key, href, name, Icon }) => ({ key, href, label: <><Icon size={16}/><span>{name}</span></> }))

  return <>
    <a className="skip" href="#main" onClick={event => { event.preventDefault(); page.current?.focus() }}>Đến nội dung chính</a>
    <motion.header className="chrome" ref={header} {...boot(0)}>
      <div className="chrome-top">
        <div className="chrome-identity">
          <motion.a href="/" className="brand" aria-label="Gia Huy, trang chủ" onClick={event => navigate(event, '/')} {...boot(.04)}>
            <motion.span className="brand-mark" initial={reduced ? false : { rotate: -18, scale: .7 }} animate={{ rotate: 0, scale: 1 }} transition={spring}><Terminal size={20} aria-hidden /></motion.span>
            <span>Gia Huy <i>Dev</i></span>
          </motion.a>
          <motion.div className="menu-anchor workspace" {...boot(.08)}>
            <Button variant="quiet" className="workspace-toggle" aria-expanded={menu === 'workspace'} aria-label="Không gian làm việc" onClick={event => openMenu('workspace', event.currentTarget)}>
              <span className="workspace-icon"><Code2 size={15} /></span><span>Workspace</span><ChevronDown size={13}/>
            </Button>
            <Popover label="Workspace" open={menu === 'workspace'}>
              <LinkButton variant="quiet" href="/#projects" onClick={event => navigate(event, '/#projects')}><FolderKanban size={16}/> Dự án của mình</LinkButton>
              <LinkButton variant="quiet" href={productUrl}><Terminal size={16}/> Codex Presence <ArrowUpRight size={13}/></LinkButton>
              <LinkButton variant="quiet" href="/crm/"><FlaskConical size={16}/> Code XR CRM <ArrowUpRight size={13}/></LinkButton>
              <Button variant="quiet" onClick={toggleTheme}>{dark ? <Sun size={16}/> : <Moon size={16}/>} {dark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}</Button>
            </Popover>
          </motion.div>
        </div>
        <motion.div className="chrome-search-wrap" {...boot(.12)}>
          <Button variant="quiet" className="chrome-search" onClick={openSearch} aria-label="Tìm kiếm website"><Search size={17}/><span>Tìm dự án, bản tải, hướng dẫn…</span><kbd><Command size={11}/> K</kbd></Button>
        </motion.div>
        <motion.div className="chrome-tools" {...boot(.16)}>
          <LinkButton variant="quiet" className="header-github" href="https://github.com/25020616" target="_blank" rel="noopener" aria-label="GitHub của Gia Huy"><Github size={17}/></LinkButton>
          <Button className="share-button" onClick={() => copy(location.href, 'link trang')} aria-label="Chia sẻ"><Share2 size={16}/><span>Chia sẻ</span></Button>
          <div className="menu-anchor mobile-menu">
            <Button variant="icon" aria-label="Mở thanh bên" aria-expanded={menu === 'mobile'} onClick={event => openMenu('mobile', event.currentTarget)}><Menu size={19}/></Button>
            <Popover label="Thanh bên" open={menu === 'mobile'} alignRight>
              {navigation.map(({ key, name, href, Icon }) => <LinkButton variant="quiet" key={key} href={href} onClick={event => navigate(event, href)}><Icon size={16}/> {name}</LinkButton>)}
              <LinkButton variant="quiet" href={productUrl}><Terminal size={16}/> Codex Presence</LinkButton>
              <LinkButton variant="quiet" href="/crm/"><FlaskConical size={16}/> Code XR CRM</LinkButton>
              <Button variant="quiet" onClick={toggleTheme}>{dark ? <Sun size={16}/> : <Moon size={16}/>} {dark ? 'Giao diện sáng' : 'Giao diện tối'}</Button>
            </Popover>
          </div>
        </motion.div>
      </div>
      <motion.div className="chrome-bottom" {...boot(.20)}>
        <Tabs<View> value={view} items={innerNavigation} onNavigate={navigate} />
        <motion.a className="workspace-status" aria-label="Xem dự án đang mở Codex Presence" href={productUrl} {...boot(.24)}><span aria-hidden/> Codex Presence <ArrowUpRight size={12}/></motion.a>
      </motion.div>
    </motion.header>

    <main id="main" ref={page} tabIndex={-1} className="app-main">
      <AnimatePresence mode="wait" onExitComplete={() => page.current?.focus({ preventScroll: true })}>
        <motion.div key={view} className="page-view" variants={cascade} initial={reduced ? false : 'hidden'} animate="visible"
          exit={reduced ? { opacity: 1, transition: { duration: 0 } } : { opacity: 0, y: -8, scale: .988, filter: 'blur(10px)', transition: { duration: .14, ease: 'easeOut' } }}>
          <PortfolioView view={view} onSearch={openSearch} onZoom={() => setDialog('preview')} onCopy={copy}/>
        </motion.div>
      </AnimatePresence>
    </main>

    <footer className="app-footer"><span>© {new Date().getFullYear()} <strong>Nguyễn Gia Huy</strong></span><div><a href="/crm/">Code XR CRM</a><a href={repoUrl} target="_blank" rel="noopener">GitHub <ArrowUpRight size={12}/></a><a href={'mailto:' + email}>Liên hệ <ArrowUpRight size={12}/></a></div></footer>
    {dialog === 'search' && <SearchPalette onClose={() => setDialog(undefined)}/>}
    {dialog === 'preview' && <Modal title="Giao diện Codex Presence" className="image-dialog" onClose={() => setDialog(undefined)}><img src={previewImage} width="962" height="652" alt="Giao diện Codex Presence với thẻ xem trước Discord"/></Modal>}
    <div className="toast-slot" role="status"><AnimatePresence>{feedback && <motion.div className="toast" key={feedback.stamp} initial={reduced ? false : { y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}><Check size={17}/>{feedback.message}</motion.div>}</AnimatePresence></div>
  </>
}

function Popover({ open, label, alignRight, children }: { open: boolean; label: string; alignRight?: boolean; children: ReactNode }) {
  const reduced = useReducedMotion()
  return <AnimatePresence>{open && <motion.div className={'popover ' + (alignRight ? 'popover-right' : '')} role="group" aria-label={label}
    initial={reduced ? false : { y: -6, opacity: 0, scale: .96, filter: 'blur(6px)' }}
    animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
    exit={{ opacity: 0, transition: { duration: reduced ? 0 : .12 } }} transition={reduced ? { duration: 0 } : spring}>
    {children}
  </motion.div>}</AnimatePresence>
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll('đ', 'd')
function SearchPalette({ onClose }: { onClose: () => void }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const matches = searchItems.filter(item => normalize(query).trim().split(/\s+/).every(term => normalize(item.title + ' ' + item.description + ' ' + item.keywords).includes(term)))
  useEffect(() => {
    document.getElementById(id + '-' + active)?.scrollIntoView({ block: 'nearest' })
  }, [active, id])
  return <Modal title="Tìm kiếm website" onClose={onClose} className="search-dialog">
    <div className="palette-search"><Search size={19}/>
      <input autoFocus role="combobox" aria-label="Tìm trong website" aria-autocomplete="list" aria-expanded="true" aria-controls={id}
        aria-activedescendant={matches[active] ? id + '-' + active : undefined} placeholder="Thử “Codex”, “tải” hoặc “liên hệ”…"
        value={query} onChange={event => { setQuery(event.target.value); setActive(0) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || !matches.length) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setActive(previous => (previous + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length)
          } else if (event.key === 'Enter') {
            event.preventDefault()
            onClose()
            location.assign(matches[active].href)
          }
        }} />
    </div>
    <div role="listbox" aria-label="Kết quả tìm kiếm" className="palette-results" id={id}>
      {matches.map((item, index) => <a className={'palette-result ' + (index === active ? 'is-selected' : '')} key={item.href}
        href={item.href} onClick={onClose} onPointerEnter={() => setActive(index)} role="option" tabIndex={-1} aria-selected={index === active} id={id + '-' + index}>
        <span className="palette-icon"><Terminal size={16}/></span><span><strong>{item.title}</strong><small>{item.description}</small></span><span className="palette-type">{item.type}</span><ArrowRight size={15}/>
      </a>)}
    </div>
    {!matches.length && <p className="no-results" role="status">Chưa tìm thấy nội dung. Thử “Codex”, “tải” hoặc “liên hệ”.</p>}
    <div className="palette-footer"><span><ArrowUp size={12}/><ArrowDown size={12}/> Di chuyển</span><span><kbd>Enter</kbd> Mở kết quả</span><span><kbd>Esc</kbd> Đóng</span></div>
  </Modal>
}
