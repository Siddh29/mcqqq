import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import bodyParser from 'body-parser'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import multer from 'multer'

const SECRET = process.env.JWT_SECRET || 'dev_secret'
const DBDIR = path.resolve('./data')
if(!fs.existsSync(DBDIR)) fs.mkdirSync(DBDIR)
const USERS_FILE = path.join(DBDIR,'users.json')
const SCORES_FILE = path.join(DBDIR,'scores.json')
const QUESTIONS_FILE = path.join(DBDIR,'questions.json')

const app = express(); app.use(cors()); app.use(bodyParser.json());

// helpers
const readJSON = (file, fallback=[])=>{ try{ return JSON.parse(fs.readFileSync(file,'utf8')||'null') }catch(e){ return fallback } }
const writeJSON = (file, data)=> fs.writeFileSync(file, JSON.stringify(data,null,2))

// ensure files
if(!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE,[])
if(!fs.existsSync(SCORES_FILE)) writeJSON(SCORES_FILE,[])
if(!fs.existsSync(QUESTIONS_FILE)) writeJSON(QUESTIONS_FILE, readJSON(path.join(process.cwd(),'web','src','questions.json'),[]))

// auth
app.post('/api/auth/signup', async (req,res)=>{
  const { username, password } = req.body
  const users = readJSON(USERS_FILE,[])
  if(users.find(u=>u.username===username)) return res.status(400).json({error:'exists'})
  const hash = await bcrypt.hash(password,10)
  const user = { id:Date.now(), username, password:hash }
  users.push(user); writeJSON(USERS_FILE, users)
  const token = jwt.sign({ id:user.id, username }, SECRET)
  res.json({ token })
})

app.post('/api/auth/login', async (req,res)=>{
  const { username, password } = req.body
  const users = readJSON(USERS_FILE,[])
  const user = users.find(u=>u.username===username)
  if(!user) return res.status(401).json({error:'no'})
  const ok = await bcrypt.compare(password, user.password)
  if(!ok) return res.status(401).json({error:'no'})
  const token = jwt.sign({ id:user.id, username }, SECRET)
  res.json({ token })
})

// middleware
const auth = (req,res,next)=>{
  const hdr = req.headers.authorization
  if(!hdr) return res.status(401).end()
  const token = hdr.replace('Bearer ','')
  try{ req.user = jwt.verify(token, SECRET); next() }catch(e){ res.status(401).end() }
}

// questions endpoint
app.get('/api/questions', (req,res)=>{
  const level = (req.query.level||'A1')
  const all = readJSON(QUESTIONS_FILE,[])
  const filtered = level==='ALL' ? all : all.filter(q=> q.level===level)
  res.json(filtered)
})

// save score (auth optional)
app.post('/api/scores', auth, (req,res)=>{
  const payload = req.body
  const scores = readJSON(SCORES_FILE,[])
  payload.id = Date.now(); payload.user = req.user.username; scores.push(payload); writeJSON(SCORES_FILE,scores)
  res.json({ok:true})
})

// anonymous save
app.post('/api/scores/anon', (req,res)=>{
  const payload = req.body
  const scores = readJSON(SCORES_FILE,[])
  payload.id = Date.now(); scores.push(payload); writeJSON(SCORES_FILE,scores)
  res.json({ok:true})
})

// leaderboard
app.get('/api/leaderboard', (req,res)=>{
  const scores = readJSON(SCORES_FILE,[])
  const top = scores.sort((a,b)=> b.score - a.score).slice(0,20)
  res.json(top)
})

// CSV/JSON import endpoint (protected)
const upload = multer({ dest: path.join(process.cwd(),'tmp') })
app.post('/api/import', auth, upload.single('file'), (req,res)=>{
  const file = req.file.path
  const csv = fs.readFileSync(file,'utf8')
  // very simple CSV parse (id,level,q,opt1,opt2,opt3,opt4,a,explain)
  const rows = csv.split('\n').map(r=> r.trim()).filter(Boolean)
  const questions = rows.map(r=>{ const parts = r.split(','); return { id: Date.now()+Math.random(), level:parts[1]||'A1', q:parts[2], opts: parts.slice(3,7), a: Number(parts[7]), explain: parts[8]||'' } })
  const all = readJSON(QUESTIONS_FILE,[])
  const merged = all.concat(questions)
  writeJSON(QUESTIONS_FILE, merged)
  res.json({ok:true, added: questions.length})
})

// export endpoint
app.get('/api/questions/export', (req,res)=>{
  res.download(QUESTIONS_FILE)
})

// serve static (optional) for production build
app.use(express.static(path.join(process.cwd(),'web','dist')))
app.get('*', (req,res)=> res.sendFile(path.join(process.cwd(),'web','dist','index.html')))

const port = process.env.PORT || 4000
app.listen(port, ()=> console.log('Server up', port))
