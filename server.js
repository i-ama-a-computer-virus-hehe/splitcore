const http=require("http"),fs=require("fs"),path=require("path"),WebSocket=require("ws");
const root=__dirname,players=new Map();let nextId=1;
function spawnPoint(){for(let i=0;i<100;i++){const x=100+Math.random()*2400,y=100+Math.random()*1600;if([...players.values()].every(p=>Math.hypot(p.x-x,p.y-y)>180))return {x,y};}return {x:1300,y:900};}
function resolvePlayerCollisions(){const ps=[...players.values()];for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,min=(a.r||24)+(b.r||24);if(d<min){const push=(min-d)/2,nx=dx/d,ny=dy/d;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;}}}
const REGEN_DELAY=180;
function updatePlayerHealth(p){if(p.hp==null||p.maxHp==null)return; if(p.hp<p.maxHp){p.regenTicks=(p.regenTicks||0)+1;if(p.regenTicks>REGEN_DELAY)p.hp=Math.min(p.maxHp,p.hp+0.025);}else p.regenTicks=0;}
function processShots(owner,shots){if(!Array.isArray(shots))return;for(const b of shots.slice(0,80)){if(!Number.isFinite(b.x)||!Number.isFinite(b.y))continue;for(const [id,p] of players){if(id===owner.id)continue;const dx=b.x-p.x,dy=b.y-p.y;const rr=(b.size||5)+(p.r||24);if(dx*dx+dy*dy<=rr*rr){p.hp=Math.max(0,(p.hp??p.maxHp??100)-(b.damage||1));p.regenTicks=0;break;}if(Array.isArray(p.droneList))for(const d of p.droneList){const ddx=b.x-d.x,ddy=b.y-d.y;const dr=(b.size||5)+(d.size||10);if(ddx*ddx+ddy*ddy<=dr*dr){d.hp=Math.max(0,(d.hp??d.maxHp??25)-(b.damage||1));break;}}}}}

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
const wss=new WebSocket.Server({server});wss.on('connection',ws=>{if(players.size>=12){ws.close(1013,'Server full');return}const id=nextId++;const spawn=spawnPoint();players.set(id,{id,name:'Unnamed Core',x:spawn.x,y:spawn.y,mass:0,drones:0,droneList:[],color:'#57a8ff'});ws.send(JSON.stringify({type:'welcome',id,maxPlayers:12}));ws.on('message',raw=>{try{const m=JSON.parse(raw);if(m.type==='name'){players.get(id).name=String(m.name||'Unnamed Core').slice(0,18)}if(m.type==='state'){Object.assign(players.get(id),m.state);
          processShots(players.get(id),m.state.bullets);
          updatePlayerHealth(players.get(id));resolvePlayerCollisions();if(Array.isArray(m.state.drones))players.get(id).droneList=m.state.drones.slice(0,60);const packet=JSON.stringify({type:'players',players:[...players.values()].map(p=>({...p,droneCount:(p.droneList||[]).length,drones:p.droneList||[]})),resources:serverResources});for(const c of wss.clients)if(c.readyState===1)c.send(packet)}}catch{}});ws.on('close',()=>players.delete(id));});server.listen(process.env.PORT||8080,'0.0.0.0',()=>console.log('Splitcore server: http://localhost:8080'));

setInterval(updateServerResources, 50);
