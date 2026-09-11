const http=require("http"),fs=require("fs"),path=require("path"),WebSocket=require("ws");
const root=__dirname,players=new Map();let nextId=1;

const serverResources = Array.from({length: 180}, (_, i) => ({
  id: i,
  x: 80 + Math.random() * 2440,
  y: 80 + Math.random() * 1640,
  vx: 0,
  vy: 0,
  r: 10 + Math.random() * 12,
  hp: 25,
  maxHp: 25,
  tier: Math.floor(Math.random() * 5),
  value: 5
}));

function updateServerResources() {
  for (const r of serverResources) {
    r.x += r.vx; r.y += r.vy;
    r.vx *= 0.88; r.vy *= 0.88;
    r.x = Math.max(r.r, Math.min(2600-r.r, r.x));
    r.y = Math.max(r.r, Math.min(1800-r.r, r.y));
    if (r.hp < r.maxHp) r.hp = Math.min(r.maxHp, r.hp + 0.002);
  }
}
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{let f=(req.url||'/').split('?')[0];if(f==='/'||f==='')f='/index.html';const file=path.resolve(root,'.'+f);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end('Not found');res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(fs.readFileSync(file));});
const wss=new WebSocket.Server({server});wss.on('connection',ws=>{if(players.size>=12){ws.close(1013,'Server full');return}const id=nextId++;players.set(id,{id,name:'Unnamed Core',x:0,y:0,mass:0,drones:0,droneList:[],color:'#57a8ff'});ws.send(JSON.stringify({type:'welcome',id,maxPlayers:12}));ws.on('message',raw=>{try{const m=JSON.parse(raw);if(m.type==='name'){players.get(id).name=String(m.name||'Unnamed Core').slice(0,18)}if(m.type==='state'){Object.assign(players.get(id),m.state);if(Array.isArray(m.state.drones))players.get(id).droneList=m.state.drones.slice(0,60);const packet=JSON.stringify({type:'players',players:[...players.values()].map(p=>({...p,droneCount:(p.droneList||[]).length,drones:p.droneList||[]})),resources:serverResources});for(const c of wss.clients)if(c.readyState===1)c.send(packet)}}catch{}});ws.on('close',()=>players.delete(id));});server.listen(process.env.PORT||8080,'0.0.0.0',()=>console.log('Splitcore server: http://localhost:8080'));

setInterval(updateServerResources, 50);
