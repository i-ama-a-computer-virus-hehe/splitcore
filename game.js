const startMenu=document.getElementById('startMenu'),coreNameInput=document.getElementById('coreNameInput'),startBtn=document.getElementById('startBtn'),leaderboardList=document.getElementById('leaderboardList');
let coreName='Unnamed Core',gameStarted=false;
startBtn.addEventListener('click',()=>{coreName=(coreNameInput.value.trim()||'Unnamed Core').slice(0,18);gameStarted=true;startMenu.style.display='none';reset();});
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
let W=innerWidth,H=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
function resize(){W=innerWidth;H=innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);resize();

const keys={},mouse={x:W/2,y:H/2,down:false};
addEventListener('keydown',e=>{if(e.target===coreNameInput||e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;keys[e.key.toLowerCase()]=true;if(e.code==='Space')e.preventDefault();if(e.key.toLowerCase()==='r'&&gameOver)reset()});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY});
addEventListener('mousedown',e=>{if(e.button===0)mouse.down=true});
addEventListener('mouseup',e=>{if(e.button===0)mouse.down=false});

const playerCount=1;const world={w:2600+Math.max(0,playerCount-1)*500,h:1800+Math.max(0,playerCount-1)*350};
const colors=['#57a8ff','#b77cff','#55e06f','#f2ca52','#e06b6b','#777777'];
const resourceNames=['Verdant','Azure','Amber','Violet','Crimson'];
const SPAWN_INVINCIBILITY=1000000;
let player,enemies,resources,bullets,particles,gameOver=false,cam={x:0,y:0};
let zoom=1, targetZoom=1;
let xp=0, upgrades={regen:0,core:0,drones:0,coreSpeed:0,droneSpeed:0,splitting:0,mass:0,spikes:0,archetype:null};
const upgradeCosts={regen:[20,50,100,180,300],core:[160,360,640,1040,1600],drones:Array.from({length:40},(_,i)=>60+i*24),coreSpeed:[70,150,260],droneSpeed:[70,150,260],splitting:[200,440],mass:[80,180,320,520,800],spikes:[90,200,360,600,1000]};
const archetypeCosts={reanimater:5000,tank:7500,mega:10000};

function rand(a,b){return a+Math.random()*(b-a)}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function pointToWorld(){
  // Convert screen-space mouse coordinates into world coordinates while accounting
  // for the camera's centered, scaled transform.
  return {x:cam.x+(mouse.x-W/2)/zoom,y:cam.y+(mouse.y-H/2)/zoom};
}

const diamondResources=[
  {color:'#63e6ff',r:36,value:100,hp:1200,tier:5},
  {color:'#b77cff',r:48,value:250,hp:2200,tier:6},
  {color:'#ffe66d',r:62,value:500,hp:4000,tier:7}
];
function makeResource(){
  if(Math.random()<0.06){
    const d=diamondResources[Math.floor(Math.random()*diamondResources.length)];
    return {x:rand(d.r,world.w-d.r),y:rand(d.r,world.h-d.r),r:d.r,tier:d.tier,value:d.value,hp:d.hp,maxHp:d.hp,regen:0,vx:0,vy:0,diamond:true,color:d.color};
  }
  const tier=Math.floor(Math.random()*5),hp=(5+tier*3)*5;
  return {x:rand(40,world.w-40),y:rand(40,world.h-40),r:7+tier*2,tier,value:5+tier*8,hp,maxHp:hp,regen:0,vx:0,vy:0,diamond:false,color:colors[tier]};
}
function spawnResources(n=150){resources=Array.from({length:n},makeResource)}

function makeDrone(x,y,size,tier){
  const hp=(12+size*.35+tier*5)*2;
  const upgradedHp=hp*(1+upgrades.spikes*.08);
  return {x,y,size,tier,hp:upgradedHp,maxHp:upgradedHp,regen:0,angle:0,material:Math.round(size*.6+tier*20),vx:0,vy:0};
}
function makePlayer(){
  return {x:world.w/2,y:world.h/2,r:30,mass:100,maxMass:1000,tier:0,hp:30,maxHp:30,
    drones:[],capacity:10,shootCd:0,regen:0,angle:0,spawnInvincible:true,splitCount:0,displayR:30,vx:0,vy:0};
}
function reset(){
  if(!gameStarted)return;
  player=makePlayer();enemies=[];bullets=[];particles=[];gameOver=false;zoom=1;targetZoom=1;cam.x=player.x;cam.y=player.y;
  spawnResources();
  document.getElementById('message').style.display='none';
}
function spawnEnemy(){
  const e={x:rand(200,world.w-200),y:rand(200,world.h-200),r:rand(32,50),mass:rand(140,320),
    tier:Math.floor(rand(0,3)),hp:25,maxHp:25,drones:[],angle:0,regen:0,dead:false};
  const count=4+Math.floor(Math.random()*4);
  for(let i=0;i<count;i++)e.drones.push(makeDrone(e.x+rand(-80,80),e.y+rand(-80,80),rand(16,27),e.tier));
  enemies.push(e);
}
function splitCore(core){
  if(core.drones.length>=core.capacity || core.r<18 || core.mass<20)return false;
  const newSize=clamp(core.r*.55,12,46);
  core.mass*=.5;
  core.r=Math.max(18,core.r*.68);
  core.maxHp=(110+core.r*2.8+core.tier*35)/4;
  core.hp=Math.min(core.hp,core.maxHp);
  const a=Math.random()*Math.PI*2;
  core.drones.push(makeDrone(core.x+Math.cos(a)*core.r*1.8,core.y+Math.sin(a)*core.r*1.8,newSize,core.tier));
  if(core.drones.length<core.capacity)core.drones.push(makeDrone(core.x-Math.cos(a)*core.r*1.8,core.y-Math.sin(a)*core.r*1.8,newSize,core.tier));
  core.splitCount++;
  if(core===player){
    core.spawnInvincible=false;
    burst(core.x,core.y,18,'#ffffff');
  }
  return true;
}
function shoot(x,y,tx,ty,damage,size,owner){
  const a=Math.atan2(ty-y,tx-x),speed=owner==='player'?8:5.2;
  bullets.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,damage,size,owner,life:110});
}
function burst(x,y,n,color){
  for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),s=rand(1,4);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:30,color})}
}
function updateCoreConcentration(){
  player.maxMass=1000*(1+upgrades.core*.25);
  if(upgrades.archetype==='mega')player.maxMass*=2;
  player.r=28+Math.sqrt(player.mass)*1.55/(1+upgrades.core*.23);
  player.maxHp=(110+player.r*2.8+player.tier*35)/4;
  player.hp=Math.min(player.maxHp,player.hp);
}
function addMass(value){
  const oldMass=player.mass;
  player.mass=Math.min(player.maxMass,player.mass+value*(1+[1,1.1,1.3,1.5,1.7,2][upgrades.mass]||1));
  xp+=Math.max(1,Math.floor(value*.35));
  if(player.mass===oldMass)return;
  value=player.mass-oldMass;
  updateCoreConcentration();
  player.hp=Math.min(player.maxHp,player.hp+value*.15);
}
function update(){
  if(gameOver)return;
  // Smooth/eased Core movement: accelerate toward the requested direction,
  // then gently decelerate when the keys are released.
  let dx=(keys.d?1:0)-(keys.a?1:0),dy=(keys.s?1:0)-(keys.w?1:0);
  const len=Math.hypot(dx,dy);
  if(len>0){
    dx/=len; dy/=len;
  }
  const maxSpeed=3.2*(1+upgrades.coreSpeed*.18)*(upgrades.archetype==='tank'?1.7:upgrades.archetype==='mega'?.55:1);
  const acceleration=0.24;
  player.vx+=(dx*maxSpeed-player.vx)*acceleration;
  player.vy+=(dy*maxSpeed-player.vy)*acceleration;
  if(len===0){ player.vx*=0.82; player.vy*=0.82; }
  player.x+=player.vx;
  player.y+=player.vy;
  if(player.x<player.r){player.x=player.r;player.vx=0;}
  if(player.x>world.w-player.r){player.x=world.w-player.r;player.vx=0;}
  if(player.y<player.r){player.y=player.r;player.vy=0;}
  if(player.y>world.h-player.r){player.y=world.h-player.r;player.vy=0;}

  const target=pointToWorld();
  player.angle=Math.atan2(target.y-player.y,target.x-player.x);
  if(mouse.down){
    player.shootCd--;
    // The Core gun is always available, including during spawn invincibility.
    // Spawn invincibility protects the Core itself; it does not disable its weapon.
    if(player.shootCd<=0){
      const gunScale=clamp(player.r/30,0.75,2.25);
      const bulletDamage=(4+player.tier*1.2)*Math.pow(gunScale,0.55);
      const bulletSize=4.5*Math.pow(gunScale,0.8);
      shoot(player.x,player.y,target.x,target.y,bulletDamage,bulletSize,'player');
      player.shootCd=15;
    }
  }

  if(keys[' ']){if(!player._space){splitCore(player);player._space=true}}else player._space=false;

  // Overseer-style drones: while holding LMB they seek the cursor; on release they return to the Core.
  for(const d of player.drones){
    const tx=mouse.down?target.x:player.x,ty=mouse.down?target.y:player.y;
    const desiredAngle=Math.atan2(ty-d.y,tx-d.x);
    const desiredSpeed=(mouse.down?5.4:6.2)*(1+upgrades.droneSpeed*.18)*(upgrades.archetype==='tank'?1.15:upgrades.archetype==='mega'?.75:1);
    const desiredVx=Math.cos(desiredAngle)*desiredSpeed,desiredVy=Math.sin(desiredAngle)*desiredSpeed;
    const droneEase=0.16;
    d.vx+=(desiredVx-d.vx)*droneEase;
    d.vy+=(desiredVy-d.vy)*droneEase;
    d.x+=d.vx;d.y+=d.vy;
    d.x=clamp(d.x,d.size,world.w-d.size);d.y=clamp(d.y,d.size,world.h-d.size);
    d.angle=Math.atan2(d.vy,d.vx)+Math.PI/2;
    regenEntity(d,.08);
  }

  // Remove destroyed player drones. Drone death is permanent until the Core is split again.
  for(let i=player.drones.length-1;i>=0;i--){
    if(player.drones[i].hp<=0){
      const d=player.drones[i];
      burst(d.x,d.y,12,'#dbe7ff');
      player.drones.splice(i,1);
    }
  }

  // Player drones collide with the Core and with each other, like physical entities.
  for(let i=0;i<player.drones.length;i++){
    const d=player.drones[i];
    resolveCircleCollision(d,player,player.r*.65);
    for(let j=i+1;j<player.drones.length;j++)resolveDroneCollision(d,player.drones[j]);
  }

  // Drones attack by ramming.
  for(const d of player.drones){
    for(const e of enemies){
      if(dist(d,e)<d.size+e.r){
        const ramDamage=0.12*d.size+0.8+d.tier*0.8;
        hitEntity(e,ramDamage);d.regen=0;d.hp=Math.max(0,d.hp-0.08*e.r);
      }
      for(const ed of e.drones){
        if(dist(d,ed)<d.size+ed.size){
          const myPower=d.size*(1+d.tier*.2),enemyPower=ed.size*(1+ed.tier*.2);
          hitEntity(ed,0.45*myPower);hitEntity(d,0.16*enemyPower);d.regen=0;ed.regen=0;
        }
      }
    }
  }

  // Core collisions deal light contact damage instead of being an instant kill.
  // This keeps the Core physical without making simply touching something decisive.
  if(!player.spawnInvincible){
    for(const e of enemies){
      if(dist(player,e)<player.r+e.r){
        contactDamage(player,e,0.72*(player.mass/100),0.8);
      }
      for(const ed of e.drones){
        if(dist(player,ed)<player.r+ed.size){
          if(!ed.bodyHitCd || ed.bodyHitCd<=0){ hitEntity(ed,0.06); hitEntity(player,0.35); ed.bodyHitCd=12; }
          if(ed.bodyHitCd>0)ed.bodyHitCd--;
        }
      }
    }
  }

  // Core body damage has a cooldown so continuous overlap cannot deal damage every frame.
  // Core body damage is stronger and scales with the Core's current Mass.
  function contactDamage(a,b,damageToB,damageToA){
    if(!a.contactTimers)a.contactTimers=new WeakMap();
    const now=performance.now();
    const last=a.contactTimers.get(b)||0;
    if(now-last<180)return;
    a.contactTimers.set(b,now);
    hitEntity(b,damageToB);
    hitEntity(a,damageToA);
  }

  // Resources are physical objects. They stay still unless a Core or drone hits them.
  // The Core and drones both take damage when they collide with resources; drones also damage and push them.
  for(let ri=resources.length-1;ri>=0;ri--){
    const r=resources[ri];
    r.x+=r.vx;r.y+=r.vy;
    r.vx*=.88;r.vy*=.88;
    r.x=clamp(r.x,r.r,world.w-r.r);r.y=clamp(r.y,r.r,world.h-r.r);

    // The Core has very low body damage. Touching a resource pushes it and
    // slowly damages it; it no longer instantly deletes/collects the resource.
    if(dist(player,r)<player.r+r.r){
      pushEntity(r,player,0.65);
      if(!r.bodyHitCd || r.bodyHitCd<=0){
        hitEntity(r,0.08);
        if(!player.spawnInvincible)hitEntity(player,r.diamond?1.1:0.7);
        r.bodyHitCd=12;
      }
    }
    if(r.bodyHitCd>0)r.bodyHitCd--;

    for(const d of player.drones){
      if(dist(d,r)<d.size+r.r){
        const ramDamage=(.16*d.size+.8+d.tier*.5)*(1+upgrades.spikes*.22);
        hitEntity(r,ramDamage);
        if(!r.droneHitCd)r.droneHitCd=new WeakMap();
        const lastDroneHit=r.droneHitCd.get(d)||0;
        const now=performance.now();
        if(now-lastDroneHit>=180){
          hitEntity(d,r.diamond?1.1:0.7);
          r.droneHitCd.set(d,now);
        }
        pushEntity(r,d,1.15);
        d.vx-=((r.x-d.x)/(dist(d,r)||1))*0.12;
        d.vy-=((r.y-d.y)/(dist(d,r)||1))*0.12;
        d.regen=0;
      }
    }
    // Keep resources from sitting on top of the Core/drones after being pushed.
    for(const d of player.drones)resolveResourceCollision(r,d);
    regenEntity(r,.02);
    if(r.hp<=0){
      addMass(r.value);
      burst(r.x,r.y,7,r.color||colors[r.tier]);
      resources.splice(ri,1);
    }
  }

  updateBullets();
  updateParticles();
  if(resources.length<100)for(let i=0;i<30;i++)resources.push(makeResource());

  if(player.hp<=0){gameOver=true;showMessage('CORE DESTROYED','Press R to restart')}
  // Smooth the visual size so Mass changes never make the Core pop instantly.
  player.displayR += (player.r-player.displayR)*0.12;
  // Larger Cores see more of the battlefield; smaller Cores see less.
  targetZoom=clamp(Math.pow(30/Math.max(18,player.r),0.52),0.64,1.14);
  zoom += (targetZoom-zoom)*0.08;
  const viewW=W/zoom,viewH=H/zoom;
  cam.x=clamp(player.x,viewW/2,world.w-viewW/2);
  cam.y=clamp(player.y,viewH/2,world.h-viewH/2);
}
function resolveCircleCollision(a,b,minimumDistance){
  const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||.001;
  const minD=a.size+minimumDistance;
  if(d<minD){const nx=dx/d,ny=dy/d,push=minD-d;a.x+=nx*push*.75;a.y+=ny*push*.75;a.vx+=nx*.35;a.vy+=ny*.35}
}

function pushEntity(resource,source,strength){
  const dx=resource.x-source.x,dy=resource.y-source.y,d=Math.hypot(dx,dy)||.001;
  resource.vx+=(dx/d)*strength;
  resource.vy+=(dy/d)*strength;
}
function resolveResourceCollision(r,d){
  const dx=r.x-d.x,dy=r.y-d.y,distance=Math.hypot(dx,dy)||.001,minD=r.r+d.size;
  if(distance<minD){
    const nx=dx/distance,ny=dy/distance,push=(minD-distance);
    r.x+=nx*push*.8;r.y+=ny*push*.8;
    r.vx+=nx*.18;r.vy+=ny*.18;
  }
}

function resolveDroneCollision(a,b){
  const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||.001,minD=a.size+b.size;
  if(d<minD){const nx=dx/d,ny=dy/d,push=(minD-d)/2;a.x+=nx*push;a.y+=ny*push;b.x-=nx*push;b.y-=ny*push;
    const av=a.vx*nx+a.vy*ny,bv=b.vx*nx+b.vy*ny;
    if(av<bv){const impulse=(bv-av)*.45;a.vx+=nx*impulse;a.vy+=ny*impulse;b.vx-=nx*impulse;b.vy-=ny*impulse}
  }
}
function regenEntity(o,amount){
  o.regen++;
  // Health regeneration is intentionally 10x slower than before.
  if(o.regen>100)o.hp=Math.min(o.maxHp,o.hp+amount*0.1);
}
function hitEntity(o,damage){o.hp-=damage;o.regen=0;burst(o.x,o.y,2,'#dbe7ff')}
function updateEnemies(){
  for(let ei=enemies.length-1;ei>=0;ei--){
    const e=enemies[ei],a=Math.atan2(player.y-e.y,player.x-e.x),d=dist(e,player);
    if(d>480){e.x+=Math.cos(a)*1.2;e.y+=Math.sin(a)*1.2}else if(d<350){e.x-=Math.cos(a)*.7;e.y-=Math.sin(a)*.7}
    e.regen++;if(e.regen>120)e.hp=Math.min(e.maxHp,e.hp+.12);
    e.drones.forEach((dr,i)=>{
      const target=i%2===0?player:{x:e.x,y:e.y};
      if(target===player&&dist(dr,player)<700){const aa=Math.atan2(player.y-dr.y,player.x-dr.x);dr.x+=Math.cos(aa)*2.2;dr.y+=Math.sin(aa)*2.2}
      else{const aa=Math.atan2(e.y-dr.y,e.x-dr.x);dr.x+=Math.cos(aa)*2;dr.y+=Math.sin(aa)*2}
      regenEntity(dr,.07);
      if(dist(dr,player)<player.r+dr.size*.8&&!player.spawnInvincible){hitEntity(player,.6);dr.hp-=.08}
    });
    if(e.hp<=0){e.dead=true;burst(e.x,e.y,25,'#ff6969');enemies.splice(ei,1);for(let i=0;i<12;i++)resources.push({...makeResource(),x:e.x+rand(-40,40),y:e.y+rand(-40,40),value:12})}
  }
}
function updateBullets(){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.x+=b.vx;b.y+=b.vy;b.life--;
    if(b.life<=0||b.x<0||b.y<0||b.x>world.w||b.y>world.h){bullets.splice(i,1);continue}
    if(b.owner==='player'){
      let hit=false;
      for(const e of enemies){
        if(dist(b,e)<b.size+e.r){hitEntity(e,b.damage); hit=true;break}
        for(const d of e.drones)if(dist(b,d)<b.size+d.size){hitEntity(d,b.damage);hit=true;break}
        if(hit)break;
      }
      if(!hit)for(const r of resources)if(dist(b,r)<b.size+r.r){r.hp-=b.damage; r.regen=0; pushEntity(r,b,0.35+ b.size*0.04); hit=true; if(r.hp<=0){addMass(r.value);burst(r.x,r.y,7,r.color||colors[r.tier]);resources.splice(resources.indexOf(r),1)}break}
      if(hit)bullets.splice(i,1);
    }else if(!player.spawnInvincible&&dist(b,player)<b.size+player.r){hitEntity(player,b.damage);bullets.splice(i,1)}
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.95;p.vy*=.95;p.life--;if(p.life<=0)particles.splice(i,1)}
}
function draw(){
  ctx.clearRect(0,0,W,H);ctx.save();
  ctx.translate(W/2,H/2);ctx.scale(zoom,zoom);ctx.translate(-cam.x,-cam.y);
  ctx.fillStyle='#0b1020';ctx.fillRect(cam.x-viewW/2,cam.y-viewH/2,viewW,viewH);
  ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=1;
  for(let x=0;x<=world.w;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,world.h);ctx.stroke()}
  for(let y=0;y<=world.h;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(world.w,y);ctx.stroke()}
  resources.forEach(drawResource);
  // Bullets render behind Cores and drones so they visually emerge from inside the Core.
  bullets.forEach(b=>{ctx.beginPath();ctx.fillStyle=b.owner==='player'?'#eaf8ff':'#ff8c8c';ctx.arc(b.x,b.y,b.size,0,Math.PI*2);ctx.fill()});
  enemies.forEach(e=>{drawCore(e,true);e.drones.forEach(drawDrone)});
  player.drones.forEach(drawDrone);drawCore(player,false);ctx.save();ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="bold 14px system-ui";ctx.fillText(coreName,player.x,player.y-player.r-14);ctx.restore();
  particles.forEach(p=>{ctx.globalAlpha=p.life/30;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);ctx.globalAlpha=1});
  ctx.restore();updateHUD();
}
function drawHealthBar(x,y,width,hp,maxHp){
  const ratio=clamp(hp/maxHp,0,1);ctx.save();ctx.translate(x,y);
  const h=6,r=3;
  ctx.fillStyle='rgba(0,0,0,.8)';
  ctx.beginPath();ctx.roundRect(-width/2,-h/2,width,h,r);ctx.fill();
  ctx.fillStyle=ratio>.5?'#55e06f':ratio>.25?'#f2ca52':'#ff5555';
  if(ratio>0){ctx.beginPath();ctx.roundRect(-width/2,-h/2,Math.max(1,width*ratio),h,r);ctx.fill()}
  ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-width/2,-h/2,width,h,r);ctx.stroke();ctx.restore();
}
function drawResource(r){
  ctx.save();ctx.translate(r.x,r.y);
  const c=r.color||colors[r.tier];
  ctx.fillStyle=c;ctx.strokeStyle=darkenColor(c,.58);ctx.lineWidth=r.diamond?3:2;
  if(r.diamond){
    ctx.beginPath();
    ctx.moveTo(0,-r.r);ctx.lineTo(r.r*.72,0);ctx.lineTo(0,r.r);ctx.lineTo(-r.r*.72,0);ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.globalAlpha=.35;
    ctx.beginPath();ctx.moveTo(0,-r.r*.72);ctx.lineTo(r.r*.48,0);ctx.lineTo(0,r.r*.72);ctx.lineTo(-r.r*.48,0);ctx.closePath();ctx.stroke();
  }else{
    ctx.rotate(Math.PI/4);ctx.globalAlpha=.9;
    ctx.beginPath();ctx.roundRect(-r.r*.72,-r.r*.72,r.r*1.44,r.r*1.44,Math.max(2,r.r*.18));ctx.fill();ctx.stroke();
  }
  ctx.restore();
  if(r.hp<r.maxHp)drawHealthBar(r.x,r.y-r.r-9,r.r*2.4,r.hp,r.maxHp);
}
function drawGun(o,enemy){
  // Cannon-like Core weapon: a chunky rounded rectangle mounted behind the Core,
  // with a darker outline so it reads as a physical part of the Core.
  const angle=o.angle||0;
  ctx.save();ctx.translate(o.x,o.y);ctx.rotate(angle);
  const visualR=o===player && Number.isFinite(o.displayR) ? o.displayR : o.r;
  const length=Math.max(42,visualR*1.35), width=Math.max(12,visualR*.42);
  // Start inside the Core so it looks mounted, but extend well beyond the edge.
  const start=-visualR*.28, radius=Math.min(5,width*.32);
  ctx.fillStyle=enemy?darkenColor('#b84b68',.48):darkenColor('#4c9cff',.62);
  ctx.strokeStyle=enemy?darkenColor('#b84b68',.30):darkenColor('#4c9cff',.34);
  ctx.lineWidth=Math.max(2,o.r*.055);
  ctx.beginPath();
  ctx.roundRect(start,-width/2,length,width,radius);
  ctx.fill();ctx.stroke();
  // Slight inner face makes the cannon look attached rather than like a floating box.
  ctx.fillStyle=enemy?darkenColor('#b84b68',.36):darkenColor('#4c9cff',.48);
  ctx.beginPath();
  ctx.roundRect(start+length*.72,-width*.42,length*.28,width*.84,radius*.75);
  ctx.fill();
  ctx.restore();
}
function drawCore(o,enemy){
  // Barrel sits behind the Core body, like a Diep.io cannon.
  drawGun(o,enemy);
  const vr=o===player && Number.isFinite(o.displayR)?o.displayR:o.r;
  const coreColor=enemy?'#b84b68':(colors[Math.min(upgrades.core,colors.length-1)]||colors[0]);
  ctx.beginPath();ctx.fillStyle=coreColor;ctx.arc(o.x,o.y,vr,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=3;ctx.strokeStyle=enemy?'#702d43':darkenColor(coreColor,.42);ctx.stroke();
  ctx.beginPath();ctx.fillStyle=enemy?'#7d324a':darkenColor(coreColor,.72);ctx.arc(o.x,o.y,vr*.55,0,Math.PI*2);ctx.fill();
  drawHealthBar(o.x,o.y-vr-10,Math.max(38,vr*2.2),o.hp,o.maxHp);
  if(!enemy&&player.spawnInvincible){ctx.beginPath();ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.arc(o.x,o.y,o.r+7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
}
function drawDrone(d){
  ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.angle);
  // Exact equilateral triangle: three vertices separated by exactly 120 degrees.
  const s=d.size;ctx.beginPath();
  for(let i=0;i<3;i++){const a=-Math.PI/2+i*2*Math.PI/3;const x=Math.cos(a)*s,y=Math.sin(a)*s;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}
  ctx.closePath();ctx.fillStyle=colors[d.tier]||'#fff';ctx.fill();
  ctx.strokeStyle=darkenColor(colors[d.tier]||'#fff',.42);ctx.lineWidth=2.5;ctx.stroke();ctx.restore();
  drawHealthBar(d.x,d.y-d.size-8,d.size*2.3,d.hp,d.maxHp);
}
function darkenColor(hex,amount){
  const n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return `rgb(${Math.round(r*amount)},${Math.round(g*amount)},${Math.round(b*amount)})`;
}
function buyUpgrade(key){
  const optionalKeys=['coreSpeed','droneSpeed','splitting','mass','spikes'];
  const optionalTotal=optionalKeys.reduce((sum,k)=>sum+upgrades[k],0);
  if(optionalKeys.includes(key)&&optionalTotal>=10)return;
  const level=upgrades[key]; if(level>=upgradeCosts[key].length)return;
  const cost=upgradeCosts[key][level]; if(xp<cost)return; xp-=cost; upgrades[key]++;
  if(key==='drones')player.capacity=10+upgrades.drones;
  if(key==='core'){player.tier=upgrades.core;updateCoreConcentration();}
  if(key==='mass'){player.maxMass=1000*[1,1.1,1.3,1.5,1.7,2][upgrades.mass];}
  if(key==='splitting'){}
  updateHUD();
  renderUpgrades();
}
function chooseArchetype(type){if(upgrades.archetype||player.drones.length)return;const cost=archetypeCosts[type];if(xp<cost)return;xp-=cost;upgrades.archetype=type;if(type==='mega'){player.maxMass*=2;player.capacity+=10;}if(type==='tank'){player.capacity=Math.max(1,Math.floor(player.capacity/4));}updateHUD();renderUpgrades()}
function updateHUD(){
  const mass=Math.min(100,player.mass/player.maxMass*100);
  document.getElementById('stats').innerHTML=
  `<div class="stat">Mass: <b>${Math.floor(player.mass)}</b> / <b>${player.maxMass}</b></div>
   <div class="bar"><div class="fill mass" style="width:${mass}%"></div></div>
   <div class="stat">XP: <b>${xp}</b></div><div class="stat">Core tier: <b>${player.tier+1}</b> &nbsp; Drones: <b>${player.drones.length}/${player.capacity}</b></div>
   <div class="stat">${player.spawnInvincible?'Spawn protection: <b>ACTIVE</b>':'Core vulnerable'}</div>`;
}
function showMessage(a,b){const m=document.getElementById('message');m.innerHTML=`${a}<small>${b}</small>`;m.style.display='flex'}
function updateLeaderboard(){const rows=[{name:coreName,drones:player.drones.length,mass:Math.floor(player.totalMass||player.mass||0)}];leaderboardList.innerHTML=rows.map((r,i)=>`${i+1}. ${r.name} — ${r.drones} drones — ${r.mass} mass`).join('<br>');}
function loop(){if(gameStarted){update();draw();updateLeaderboard()}requestAnimationFrame(loop)}
reset();loop();
const upgradeBtn=document.getElementById('upgradeBtn'),upgradePanel=document.getElementById('upgradePanel'),upgradeList=document.getElementById('upgradeList');
upgradeBtn.onclick=()=>{upgradePanel.style.display=upgradePanel.style.display==='none'?'block':'none';renderUpgrades()};
function renderUpgrades(){const names={regen:'Faster Regeneration',core:'Better Core',drones:'More Drones',coreSpeed:'Core speed',droneSpeed:'Drone speed',splitting:'More splitting',mass:'More Mass',spikes:'Spiked Drones'};const optionalKeys=['coreSpeed','droneSpeed','splitting','mass','spikes'];const optionalTotal=optionalKeys.reduce((sum,k)=>sum+upgrades[k],0);upgradeList.innerHTML='<div>Optional upgrades used: <b>'+optionalTotal+'/10</b></div>'+Object.keys(names).map(k=>{const locked=optionalKeys.includes(k)&&optionalTotal>=10;const maxed=upgrades[k]>=upgradeCosts[k].length;const cost=upgradeCosts[k][upgrades[k]]??'MAX';return `<button class="upgrade-choice" data-upgrade="${k}" ${locked||maxed?'disabled':''}>${names[k]} (${upgrades[k]}/${upgradeCosts[k].length}) — ${cost} XP</button>`}).join('')+'<hr><b>Choose one archetype</b>'+['reanimater','tank','mega'].map(t=>`<button class="archetype-choice" data-archetype="${t}" ${upgrades.archetype?'disabled':''}>${t==='reanimater'?'Reanimater':t==='tank'?'Tank Smasher':'Megacore'}${upgrades.archetype===t?' (SELECTED)':' — '+archetypeCosts[t]+' XP'}</button>`).join('');upgradeList.querySelectorAll('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>buyUpgrade(b.dataset.upgrade)));upgradeList.querySelectorAll('[data-archetype]').forEach(b=>b.addEventListener('click',()=>chooseArchetype(b.dataset.archetype)));}