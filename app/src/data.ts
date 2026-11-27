export const productUrl = 'https://codexpresence.giahuydevtrai.online/'
export const repoUrl = 'https://github.com/25020616/codex-presence'
export const release = repoUrl + '/releases/tag/build-2026.11.20'
export const releaseZip = repoUrl + '/releases/download/build-2026.11.20/CodexPresence-Windows-x64.zip'
export const email = 'giahuydeeptry2007@gmail.com'
export const previewImage = '/assets/codex-presence.jpg'
export const searchItems = [
  { title: 'Codex Presence', description: 'Ứng dụng Windows · Codex desktop × Discord', href: productUrl, type: 'Dự án', keywords: 'project app ung dung rich presence' },
  { title: 'Tải Codex Presence cho Windows', description: 'ZIP portable · Build 20/11/2026', href: productUrl + '#download', type: 'Bản tải', keywords: 'download exe zip tai xuong' },
  { title: 'Hướng dẫn cài đặt', description: 'Tải, giải nén và kết nối với Discord', href: productUrl + '#setup', type: 'Hướng dẫn', keywords: 'setup install help cai dat su dung' },
  { title: 'Mã nguồn trên GitHub', description: '25020616 / codex-presence', href: repoUrl, type: 'GitHub', keywords: 'source code git repo csharp' },
  { title: 'Về Gia Huy', description: 'Một chút về người làm ra workspace này', href: '/#about', type: 'Giới thiệu', keywords: 'nguyen gia huy developer about' },
  { title: 'Liên hệ Gia Huy', description: email, href: '/#contact', type: 'Liên hệ', keywords: 'contact email mail ket noi' },
]
export type View = 'home' | 'projects' | 'about' | 'contact'
export const viewFromHash = (): View => {
  const current = location.hash.slice(1)
  return current === 'projects' || current === 'about' || current === 'contact' ? current : 'home'
}
