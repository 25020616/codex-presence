import { copyFile, cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const app = fileURLToPath(new URL('./', import.meta.url))
const site = path.resolve(app, '..')
const crmBuild = path.resolve(site, '../lumen-crm/dist')
const portfolioBuild = path.join(app, 'dist')

await mkdir(path.join(site, 'crm'), { recursive: true })
await cp(path.join(portfolioBuild, 'portfolio'), path.join(site, 'portfolio'), { recursive: true })
await cp(path.join(crmBuild, 'assets'), path.join(site, 'crm', 'assets'), { recursive: true })
await copyFile(path.join(crmBuild, 'lumen.svg'), path.join(site, 'crm', 'lumen.svg'))
await copyFile(path.join(app, 'node_modules/@fontsource-variable/plus-jakarta-sans/LICENSE'), path.join(site, 'portfolio/plus-jakarta-sans-OFL.txt'))
await copyFile(path.join(app, 'node_modules/@fontsource/instrument-serif/LICENSE'), path.join(site, 'portfolio/instrument-serif-OFL.txt'))
await copyFile(path.join(crmBuild, 'index.html'), path.join(site, 'crm', 'index.html'))
await copyFile(path.join(portfolioBuild, 'index.html'), path.join(site, 'index.html'))
