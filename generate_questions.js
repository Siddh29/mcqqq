import fs from 'fs'
import path from 'path'

const out = path.join(process.cwd(),'data','questions.json')
const base = JSON.parse(fs.readFileSync(path.join(process.cwd(),'web','src','questions.json'),'utf8') || '[]')
let id = base.length? Math.max(...base.map(b=>b.id))+1 : 1000
const extras = []
const templates = [
  { level:'A1', q:'Ich ___ gern Tee.', opts:['trinke','trinkt','trinken','trinkst'], a:0, explain:'ich trinke' },
  { level:'A1', q:'Er ___ gestern ins Kino.', opts:['geht','ging','gegangen','gehen'], a:1, explain:'ging = past but keep present practice' },
  { level:'A2', q:'Wenn ich Zeit habe, ___ ich dich.', opts:['besuche','besuchst','besuchen','besucht'], a:0, explain:'besuchen ich' }
]

for(let i=0;i<300;i++){
  const t = templates[i%templates.length]
  extras.push({ id: id++, level:t.level, q: t.q.replace('___', '_____'), opts: t.opts, a: t.a, explain: t.explain })
}

const merged = base.concat(extras)
fs.writeFileSync(out, JSON.stringify(merged,null,2))
console.log('Generated', extras.length, 'questions to', out)
