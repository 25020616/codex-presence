export const productUrl = 'https://codexpresence.giahuydevtrai.online/'
export const repoUrl = 'https://github.com/25020616/codex-presence'
export const release = repoUrl + '/releases/tag/build-2026.11.20'
export const releaseZip = repoUrl + '/releases/download/build-2026.11.20/CodexPresence-Windows-x64.zip'
export const email = 'giahuydeeptry2007@gmail.com'
export const previewImage = '/assets/codex-presence.jpg'
export const searchItems = [
  { title: 'Codex Presence', description: 'Windows app · Codex desktop × Discord', href: productUrl, type: 'Project', keywords: 'project app ung dung rich presence' },
  { title: 'Download Codex Presence for Windows', description: 'Portable ZIP · Nov 20, 2026 build', href: productUrl + '#download', type: 'Download', keywords: 'download exe zip tai xuong ban tai' },
  { title: 'Setup guide', description: 'Download, extract, and connect to Discord', href: productUrl + '#setup', type: 'Guide', keywords: 'setup install help huong dan cai dat su dung' },
  { title: 'Source code on GitHub', description: '25020616 / codex-presence', href: repoUrl, type: 'GitHub', keywords: 'source code git repo csharp ma nguon' },
  { title: 'About Gia Huy', description: 'Meet the developer behind this workspace', href: '/#about', type: 'About', keywords: 'nguyen gia huy developer about' },
  { title: 'Contact Gia Huy', description: email, href: '/#contact', type: 'Contact', keywords: 'contact email mail lien he ket noi' },
]
export type View = 'home' | 'projects' | 'about' | 'contact'
export const viewFromHash = (): View => {
  const current = location.hash.slice(1)
  return current === 'projects' || current === 'about' || current === 'contact' ? current : 'home'
}
