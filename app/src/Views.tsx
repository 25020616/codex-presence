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
    <Button ref={trigger} variant="icon" aria-label="Mở lối tắt" aria-expanded={open} aria-controls={open ? 'pv-shortcuts' : undefined}
      onClick={() => setOpen(previous => !previous)}><Plus size={19} /></Button>
    <AnimatePresence>
      {open && <motion.div className="pv-shortcuts" id="pv-shortcuts" aria-label="Lối tắt workspace"
        initial={reduce ? false : { opacity: 0, y: -4, scale: .96, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 31 }}>
        <p className="pv-eyebrow">Lối tắt workspace</p>
        <LinkButton variant="quiet" href={setupUrl} onClick={() => setOpen(false)}><Terminal size={16} /> Hướng dẫn cài đặt</LinkButton>
        <LinkButton variant="quiet" href={repoUrl} target="_blank" rel="noopener" onClick={() => setOpen(false)}><Github size={16} /> Mã nguồn GitHub</LinkButton>
        <LinkButton variant="quiet" href="./#contact" onClick={() => setOpen(false)}><Mail size={16} /> Kết nối với mình</LinkButton>
      </motion.div>}
    </AnimatePresence>
  </div>
}

const workspaceFacts = [
  { label: 'Dự án của mình', value: '01', note: 'Codex Presence', Icon: FolderCode, href: './#projects', spotlight: true },
  { label: 'Nền tảng', value: 'Windows', note: 'Phiên bản x64', Icon: Monitor, href: downloadUrl },
  { label: 'Công nghệ', value: 'C#', note: 'Ứng dụng WinForms', Icon: Braces, href: './#about' },
  { label: 'Mã nguồn', value: 'GitHub', note: '25020616 / codex-presence', Icon: GitFork, href: repoUrl, external: true },
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
    <LinkButton variant="quiet" className="pv-image-link" href={productUrl} aria-label="Xem dự án Codex Presence">
      <img src={previewImage} alt="Ảnh giao diện Codex Presence" width="962" height="652" />
    </LinkButton>
    <Button variant="icon" className="pv-zoom" aria-label="Phóng lớn ảnh Codex Presence" title="Phóng lớn ảnh" onClick={onZoom}><ZoomIn size={17} /></Button>
  </div>
}

function Home({ onSearch, onZoom }: Pick<PortfolioProps, 'onSearch' | 'onZoom'>) {
  return <>
    <PageHeading title="Bạn muốn" emphasis="khám phá gì?" eyebrow="Gia Huy / Developer"
      description="Mình làm phần mềm. Đây là nơi mình chia sẻ chúng."
      actions={<>
        <LinkButton variant="secondary" href="./#projects"><FolderCode size={16} /> Dự án của mình</LinkButton>
        <LinkButton variant="primary" href={downloadUrl}><ArrowDownToLine size={16} /> Tải cho Windows</LinkButton>
      </>} />
    <RevealRow className="pv-facts" aria-label="Thông tin workspace">
      {workspaceFacts.map(fact => <FactCard key={fact.label} fact={fact} />)}
    </RevealRow>
    <RevealRow className="pv-home-row">
      <Card className="pv-featured">
        <div className="pv-feature-body">
          <div className="pv-panel-top"><span className="pv-index">#01</span><span className="pv-eyebrow">Dự án nổi bật</span></div>
          <div className="pv-feature-title">
            <span className="pv-feature-mark"><Terminal size={22} strokeWidth={1.8} /></span>
            <h2>Codex <em>Presence</em></h2>
          </div>
          <p>Hoạt động Codex. Hiển thị trên Discord.</p>
          <LinkButton variant="quiet" className="pv-feature-link" href={productUrl}>Khám phá Codex Presence <ArrowUpRight size={16} /></LinkButton>
        </div>
        <ProjectImage onZoom={onZoom} className="pv-feature-image" />
      </Card>
      <Card className="pv-command">
        <div className="pv-panel-top"><span className="pv-index">#02</span><span className="pv-eyebrow">Điều hướng nhanh</span></div>
        <div className="pv-command-title"><FolderCode size={19} /><h2>gia-huy <em>/ personal</em></h2></div>
        <Button variant="quiet" className="pv-search-field" onClick={onSearch}>
          <Search size={17} /><span>Tìm dự án, bản tải, hướng dẫn…</span><kbd>Ctrl K</kbd>
        </Button>
        <div className="pv-command-bottom">
          <div className="pv-shortcut"><ShortcutMenu /><span>Tìm trong website</span></div>
          <LinkButton variant="quiet" className="pv-context-project" href={productUrl}>Codex Presence <ArrowUpRight size={14} /></LinkButton>
        </div>
      </Card>
    </RevealRow>
    <RevealRow className="pv-resource-row" aria-label="Lối tắt dự án">
      <ResourceCard icon={Github} label="Xem mã nguồn" detail="25020616 / codex-presence" href={repoUrl} external />
      <ResourceCard icon={Terminal} label="Hướng dẫn cài đặt" detail="Tải, giải nén và kết nối với Discord" href={setupUrl} />
      <ResourceCard icon={UserRound} label="Về Gia Huy" detail="Một chút về người làm ra workspace này" href="./#about" />
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
    <PageHeading title="Những thứ" emphasis="mình xây." eyebrow="Dự án"
      description="Từ một nhu cầu nhỏ, đến một ứng dụng có thể dùng mỗi ngày."
      actions={<><LinkButton variant="secondary" href={repoUrl} target="_blank" rel="noopener"><Github size={17} /> Mã nguồn</LinkButton><LinkButton variant="primary" href={downloadUrl}><ArrowDownToLine size={16} /> Tải cho Windows</LinkButton></>} />
    <RevealRow className="pv-project-grid">
      <Card className="pv-project-view">
        <div className="pv-panel-top"><span className="pv-index">#01</span><span className="pv-eyebrow">Ứng dụng desktop</span></div>
        <div className="pv-project-heading">
          <span className="pv-project-mark"><Terminal size={26} /></span>
          <div><h2>Codex Presence</h2><p>C# · WinForms · Windows x64</p></div>
          <LinkButton variant="icon" className="pv-project-corner" href={productUrl} aria-label="Mở Codex Presence"><ArrowUpRight size={17} /></LinkButton>
        </div>
        <ProjectImage onZoom={onZoom} />
        <div className="pv-project-footer"><p>Chia sẻ hoạt động Codex desktop lên Discord. Có xem trước, tùy chỉnh model và tạm dừng.</p><LinkButton variant="primary" href={productUrl}>Khám phá dự án <ArrowRight size={16} /></LinkButton></div>
      </Card>
      <Card className="pv-project-details">
        <div className="pv-panel-top"><span className="pv-index">#02</span><span className="pv-eyebrow">Thông tin bản tải</span></div>
        <h2>Codex desktop <em>× Discord</em></h2>
        <dl>
          <div><dt><Monitor size={16} /> Nền tảng</dt><dd>Windows x64</dd></div>
          <div><dt><CalendarDays size={16} /> Ngày phát hành</dt><dd><time dateTime="2026-11-20">20/11/2026</time></dd></div>
          <div><dt><FolderCode size={16} /> Định dạng</dt><dd>ZIP portable</dd></div>
        </dl>
        <LinkButton variant="secondary" href={setupUrl}>Hướng dẫn cài đặt <ArrowUpRight size={15} /></LinkButton>
      </Card>
    </RevealRow>
  </>
}

function About() {
  return <>
    <PageHeading title="Chào, mình là" emphasis="Gia Huy." eyebrow="Một chút về mình"
      description="Mình thích bắt đầu từ một nhu cầu nhỏ, rồi làm ra thứ có thể mở lên và sử dụng."
      actions={<><LinkButton variant="secondary" href={profileUrl} target="_blank" rel="noopener"><Github size={17} /> GitHub của mình</LinkButton><LinkButton variant="primary" href="./#contact"><Mail size={16} /> Cùng trao đổi</LinkButton></>} />
    <RevealRow className="pv-about-grid">
      <Card className="pv-about-bio">
        <div className="pv-about-avatar" aria-hidden>GH</div>
        <h2>Nguyễn Gia Huy</h2>
        <p>Mình là Nguyễn Gia Huy. Mình viết phần mềm, mày mò giao diện và quan tâm đến những chi tiết khiến công việc mỗi ngày dễ chịu hơn.</p>
        <p>Codex Presence là một trong những công cụ mình xây dựng: kết nối hoạt động Codex desktop với Discord, gọn gàng và đủ dùng.</p>
      </Card>
      <Card className="pv-about-tools">
        <div className="pv-panel-top"><span className="pv-index">#01</span><span className="pv-eyebrow">Bộ công cụ</span></div>
        <h2>Những công cụ <em>mình dùng</em></h2>
        <ul>{toolset.map(tool => <li key={tool}>{tool}</li>)}</ul>
      </Card>
    </RevealRow>
  </>
}

function Contact({ onCopy }: Pick<PortfolioProps, 'onCopy'>) {
  return <>
    <PageHeading title="Bắt đầu bằng" emphasis="một lời chào." eyebrow="Liên hệ"
      description="Góp ý cho một dự án, cùng làm một công cụ, hoặc đơn giản là kết nối." />
    <RevealRow className="pv-contact-grid">
      <Card className="pv-contact-card">
        <div className="pv-panel-top"><span className="pv-mark"><Mail size={18} /></span><span className="pv-eyebrow">Email của mình</span></div>
        <a className="pv-email" href={'mailto:' + email}>{email}</a>
        <div className="pv-contact-actions">
          <LinkButton variant="primary" href={'mailto:' + email}><Mail size={17} /> Viết email</LinkButton>
          <Button variant="secondary" onClick={() => void onCopy(email, 'email')}><Copy size={17} /> Sao chép</Button>
        </div>
      </Card>
      <ResourceCard icon={Github} label="Hoặc ghé GitHub / 25020616" detail="Hồ sơ và mã nguồn công khai" href={profileUrl} external />
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
