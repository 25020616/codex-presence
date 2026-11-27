import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Braces, CalendarDays, Copy,
  FolderCode, GitFork, Github, Mail, Monitor, Plus, Search, Terminal, UserRound, ZoomIn,
  type LucideIcon,
} from 'lucide-react'
import { Button, Card, LinkButton, PageHeading, RevealRow } from './ui'
import { email, previewImage, productUrl, repoUrl, type View } from './data'
import './views.css'

type PortfolioProps = {
  view: View
  onSearch: () => void
  onZoom: () => void
  onCopy: (text: string, label: string) => void | Promise<void>
}

const profileUrl = 'https://github.com/25020616'
const downloadUrl = productUrl + '#download'
const setupUrl = productUrl + '#setup'
const toolset = ['C# / WinForms', 'HTML / CSS', 'JavaScript', 'Git / GitHub']

function ShortcutMenu() {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return <div className="pv-shortcut-anchor" ref={anchor}>
    <Button ref={trigger} variant="icon" aria-label="Open shortcuts" aria-expanded={open} aria-controls={open ? 'pv-shortcuts' : undefined}
      onClick={() => setOpen(previous => !previous)}><Plus size={19} /></Button>
    <AnimatePresence>
      {open && <motion.div className="pv-shortcuts" id="pv-shortcuts" aria-label="Workspace shortcuts"
        initial={reduce ? false : { opacity: 0, y: -4, scale: .96, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 31 }}>
        <p className="pv-eyebrow">Workspace shortcuts</p>
        <LinkButton variant="quiet" href={setupUrl} onClick={() => setOpen(false)}><Terminal size={16} /> Setup guide</LinkButton>
        <LinkButton variant="quiet" href={repoUrl} target="_blank" rel="noopener" onClick={() => setOpen(false)}><Github size={16} /> GitHub source</LinkButton>
        <LinkButton variant="quiet" href="./#contact" onClick={() => setOpen(false)}><Mail size={16} /> Get in touch</LinkButton>
      </motion.div>}
    </AnimatePresence>
  </div>
}

const workspaceFacts = [
  { label: 'My projects', value: '01', note: 'Codex Presence', Icon: FolderCode, href: './#projects', spotlight: true },
  { label: 'Platform', value: 'Windows', note: 'x64 build', Icon: Monitor, href: downloadUrl },
  { label: 'Technology', value: 'C#', note: 'WinForms desktop app', Icon: Braces, href: './#about' },
  { label: 'Source code', value: 'GitHub', note: '25020616 / codex-presence', Icon: GitFork, href: repoUrl, external: true },
] as const

type Fact = { label: string; value: string; note: string; Icon: LucideIcon; href: string; spotlight?: boolean; external?: boolean }

function FactCard({ fact }: { fact: Fact }) {
  const { label, value, note, Icon, href, spotlight, external } = fact
  return <Card className={'pv-fact ' + (spotlight ? 'pv-fact-primary' : '')}>
    <LinkButton variant="quiet" className="pv-fact-link" href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined}>
      <span className="pv-fact-heading"><span className="pv-mark"><Icon size={15} /></span><span>{label}</span><span className="pv-corner" aria-hidden><ArrowUpRight size={15} /></span></span>
      <span className="pv-fact-value">{value}</span>
      <span className="pv-fact-note">{note}</span>
    </LinkButton>
  </Card>
}

function ProjectImage({ onZoom, className = '' }: { onZoom: () => void; className?: string }) {
  return <div className={'pv-image ' + className}>
    <LinkButton variant="quiet" className="pv-image-link" href={productUrl} aria-label="View Codex Presence">
      <img src={previewImage} alt="Screenshot of Codex Presence" width="962" height="652" />
    </LinkButton>
    <Button variant="icon" className="pv-zoom" aria-label="Enlarge the Codex Presence screenshot" title="Enlarge screenshot" onClick={onZoom}><ZoomIn size={17} /></Button>
  </div>
}

function Home({ onSearch, onZoom }: Pick<PortfolioProps, 'onSearch' | 'onZoom'>) {
  return <>
    <PageHeading title="What would you like" emphasis="to explore?" eyebrow="Gia Huy / Developer"
      description="I build software and share my projects here."
      actions={<>
        <LinkButton variant="secondary" href="./#projects"><FolderCode size={16} /> My projects</LinkButton>
        <LinkButton variant="primary" href={downloadUrl}><ArrowDownToLine size={16} /> Download for Windows</LinkButton>
      </>} />
    <RevealRow className="pv-facts" aria-label="Workspace at a glance">
      {workspaceFacts.map(fact => <FactCard key={fact.label} fact={fact} />)}
    </RevealRow>
    <RevealRow className="pv-home-row">
      <Card className="pv-featured">
        <div className="pv-feature-body">
          <div className="pv-panel-top"><span className="pv-index">#01</span><span className="pv-eyebrow">Featured project</span></div>
          <div className="pv-feature-title">
            <span className="pv-feature-mark"><Terminal size={22} strokeWidth={1.8} /></span>
            <h2>Codex <em className="float-text float-secondary">Presence</em></h2>
          </div>
          <p>Show your Codex activity on Discord.</p>
          <LinkButton variant="quiet" className="pv-feature-link" href={productUrl}>Explore Codex Presence <ArrowUpRight size={16} /></LinkButton>
        </div>
        <ProjectImage onZoom={onZoom} className="pv-feature-image" />
      </Card>
      <Card className="pv-command">
        <div className="pv-panel-top"><span className="pv-index">#02</span><span className="pv-eyebrow">Quick navigation</span></div>
        <div className="pv-command-title"><FolderCode size={19} /><h2>gia-huy <em>/ personal</em></h2></div>
        <Button variant="quiet" className="pv-search-field" onClick={onSearch}>
          <Search size={17} /><span>Search projects, downloads, and guides…</span><kbd>Ctrl K</kbd>
        </Button>
        <div className="pv-command-bottom">
          <div className="pv-shortcut"><ShortcutMenu /><span>Search the site</span></div>
          <LinkButton variant="quiet" className="pv-context-project" href={productUrl}>Codex Presence <ArrowUpRight size={14} /></LinkButton>
        </div>
      </Card>
    </RevealRow>
    <RevealRow className="pv-resource-row" aria-label="Project shortcuts">
      <ResourceCard icon={Github} label="View source on GitHub" detail="25020616 / codex-presence" href={repoUrl} external />
      <ResourceCard icon={Terminal} label="Setup guide" detail="Download, extract, and connect to Discord" href={setupUrl} />
      <ResourceCard icon={UserRound} label="About Gia Huy" detail="Meet the developer behind this workspace" href="./#about" />
    </RevealRow>
  </>
}

function ResourceCard({ icon: Icon, label, detail, href, external }: { icon: LucideIcon; label: string; detail: string; href: string; external?: boolean }) {
  return <Card className="pv-resource">
    <LinkButton variant="quiet" className="pv-resource-link" href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined}>
      <span className="pv-mark"><Icon size={18} /></span><span className="pv-resource-copy"><strong>{label}</strong><small>{detail}</small></span><span className="pv-corner" aria-hidden><ArrowUpRight size={15} /></span>
    </LinkButton>
  </Card>
}

function Projects({ onZoom }: Pick<PortfolioProps, 'onZoom'>) {
  return <>
    <PageHeading title="Things" emphasis="I build." eyebrow="Projects"
      description="Small ideas turned into tools you can use every day."
      actions={<><LinkButton variant="secondary" href={repoUrl} target="_blank" rel="noopener"><Github size={17} /> Source code</LinkButton><LinkButton variant="primary" href={downloadUrl}><ArrowDownToLine size={16} /> Download for Windows</LinkButton></>} />
    <RevealRow className="pv-project-grid">
      <Card className="pv-project-view">
        <div className="pv-panel-top"><span className="pv-index">#01</span><span className="pv-eyebrow">Desktop application</span></div>
        <div className="pv-project-heading">
          <span className="pv-project-mark"><Terminal size={26} /></span>
          <div><h2>Codex Presence</h2><p>C# · WinForms · Windows x64</p></div>
          <LinkButton variant="icon" className="pv-project-corner" href={productUrl} aria-label="Open Codex Presence"><ArrowUpRight size={17} /></LinkButton>
        </div>
        <ProjectImage onZoom={onZoom} />
        <div className="pv-project-footer"><p>Share Codex desktop activity on Discord. Preview your status, choose which model details to show, and pause sharing anytime.</p><LinkButton variant="primary" href={productUrl}>Explore project <ArrowRight size={16} /></LinkButton></div>
      </Card>
      <Card className="pv-project-details">
        <div className="pv-panel-top"><span className="pv-index">#02</span><span className="pv-eyebrow">Release details</span></div>
        <h2>Codex desktop <em>× Discord</em></h2>
        <dl>
          <div><dt><Monitor size={16} /> Platform</dt><dd>Windows x64</dd></div>
          <div><dt><CalendarDays size={16} /> Release date</dt><dd><time dateTime="2026-11-20">Nov 20, 2026</time></dd></div>
          <div><dt><FolderCode size={16} /> Format</dt><dd>Portable ZIP</dd></div>
        </dl>
        <LinkButton variant="secondary" href={setupUrl}>Setup guide <ArrowUpRight size={15} /></LinkButton>
      </Card>
    </RevealRow>
  </>
}

function About() {
  return <>
    <PageHeading title="Hi, I’m" emphasis="Gia Huy." eyebrow="About me"
      description="I like turning small, practical problems into tools you can open and use."
      actions={<><LinkButton variant="secondary" href={profileUrl} target="_blank" rel="noopener"><Github size={17} /> My GitHub</LinkButton><LinkButton variant="primary" href="./#contact"><Mail size={16} /> Get in touch</LinkButton></>} />
    <RevealRow className="pv-about-grid">
      <Card className="pv-about-bio">
        <div className="pv-about-avatar float-text float-secondary" aria-hidden>GH</div>
        <h2>Nguyễn Gia Huy</h2>
        <p>I’m Nguyễn Gia Huy. I write software, experiment with interfaces, and care about the details that make everyday work easier.</p>
        <p>I built Codex Presence to share Codex desktop activity on Discord with a simple set of controls.</p>
      </Card>
      <Card className="pv-about-tools">
        <div className="pv-panel-top"><span className="pv-index">#01</span><span className="pv-eyebrow">Toolkit</span></div>
        <h2>Tools <em>I use</em></h2>
        <ul>{toolset.map(tool => <li key={tool}>{tool}</li>)}</ul>
      </Card>
    </RevealRow>
  </>
}

function Contact({ onCopy }: Pick<PortfolioProps, 'onCopy'>) {
  return <>
    <PageHeading title="Start with" emphasis="a hello." eyebrow="Contact"
      description="Send feedback, talk about building something together, or just say hello." />
    <RevealRow className="pv-contact-grid">
      <Card className="pv-contact-card">
        <div className="pv-panel-top"><span className="pv-mark"><Mail size={18} /></span><span className="pv-eyebrow">My email</span></div>
        <a className="pv-email" href={'mailto:' + email}>{email}</a>
        <div className="pv-contact-actions">
          <LinkButton variant="primary" href={'mailto:' + email}><Mail size={17} /> Send an email</LinkButton>
          <Button variant="secondary" onClick={() => void onCopy(email, 'email')}><Copy size={17} /> Copy</Button>
        </div>
      </Card>
      <ResourceCard icon={Github} label="Find me on GitHub / 25020616" detail="Profile and public repositories" href={profileUrl} external />
    </RevealRow>
  </>
}

export function PortfolioView({ view, onSearch, onZoom, onCopy }: PortfolioProps) {
  const contents: Record<View, ReactNode> = {
    home: <Home onSearch={onSearch} onZoom={onZoom} />,
    projects: <Projects onZoom={onZoom} />,
    about: <About />,
    contact: <Contact onCopy={onCopy} />,
  }
  return <div className={'portfolio-view portfolio-view-' + view}>{contents[view]}</div>
}
