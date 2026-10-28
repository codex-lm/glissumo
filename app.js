import { createGame, stepGame, chooseBotAction } from './engine.js';
import { createNetwork } from './network.js';
import { createRenderer } from './renderer.js';
import { languages } from './i18n.js';
import { createAudio } from './audio.js';

const $=id=>document.getElementById(id);
const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,String(value))}catch{}};
let lang=read('glissumo.language',navigator.language.slice(0,2));if(!languages[lang])lang='en';
let state=createGame(20261028),mode='menu',role=0,held=null,tap=null,screen='menu',statusKey='idle';
let lastEffect=0,roundId=state.seed,lastHud=0,toastUntil=0,countdownUntil=0,readyInfo={local:false,remote:false};
let best=Number(read('glissumo.best','0'))||0;
const audio=createAudio();audio.setEnabled(read('glissumo.sound','off')==='on');audio.setMusicEnabled(read('glissumo.music','off')==='on');
const renderer=createRenderer($('arena'));
const network=createNetwork({
  onState(next){const starting=next.phase==='playing'&&(screen!=='play'||mode!=='network'||next.seed!==roundId);state=next;mode='network';if(starting){roundId=next.seed;lastEffect=0;renderer.reset();screen='play';document.body.classList.add('playing');clearInput();updateScreen();}if(next.phase==='finished')finish();},
  onRole(value){role=value;updateHud();},
  onStatus(value){statusKey=value;if(value==='lobby'){screen='lobby';mode='network';}if(value==='error'||value==='closed'){screen='menu';mode='menu';document.body.classList.remove('playing');}updateScreen();},
  onReady(info){readyInfo=info;updateScreen();},
  onEnded(reason){clearInput();mode='menu';screen='menu';document.body.classList.remove('playing');statusKey=reason==='closed'?'closed':'error';updateScreen();}
});
const tr=key=>languages[lang][key]||languages.en[key]||key;
const color=i=>tr(i?'coral':'mint');
const button=(id,key,symbol)=>{$(id).replaceChildren(document.createTextNode(tr(key)+' '));const span=document.createElement('span');span.textContent=symbol;$(id).append(span);};

function translate(){
  document.documentElement.lang=lang;document.title=tr('title');$('language').value=lang;
  $('brand').textContent='Glissumo';$('eyebrow').textContent=tr('eyebrow');$('tagline').innerHTML=tr('tagline');$('pitch').innerHTML=tr('pitch');
  for(const [id,key]of Object.entries({'difficulty-label':'rival','hop-label':'hop','slide-label':'slide','footer-rule':'footer','leave':'leave'}))$(id).textContent=tr(key);
  $('difficulty').options[0].textContent=tr('easy');$('difficulty').options[1].textContent=tr('normal');
  $('control-hint').replaceChildren(document.createTextNode(tr('hold')),document.createElement('br'));const keySpan=document.createElement('span');keySpan.textContent=tr('keys');$('control-hint').append(keySpan);
  for(const [action,key]of Object.entries({up:'hopUp',down:'hopDown',left:'slideLeft',right:'slideRight'}))document.querySelector(`[data-action="${action}"]`).setAttribute('aria-label',tr(key));
  $('sound').setAttribute('aria-label',tr('sound'));$('music').setAttribute('aria-label',tr('music'));updateSound();updateHud();updateScreen();
}
function show(id,value){$(id).classList.toggle('hidden',!value);}
function updateScreen(){
  audio.setActive(screen==='play');
  const live=screen==='play';show('overlay',!live);show('solo',screen==='menu');show('connect',screen==='menu');show('ready',screen==='lobby');show('rematch',screen==='result');show('difficulty-wrap',screen==='menu');show('leave',mode!=='menu'||network.phase==='connecting');
  $('solo').disabled=live||network.phase==='connecting';$('connect').disabled=live||network.phase==='connecting';
  button('solo','solo','↗');button('connect','connect','↔');button('ready',readyInfo.local?'waitReady':'ready','✓');button('rematch',mode==='network'&&readyInfo.local?'waitReady':'rematch','↻');
  $('ready').disabled=readyInfo.local;$('rematch').disabled=mode==='network'&&readyInfo.local;
  $('menu-kicker').textContent=tr(screen==='result'?'finished':'kicker');
  if(screen==='menu'){$('menu-title').innerHTML=tr('menuTitle');$('menu-text').innerHTML=tr('rules');$('menu-note').textContent=tr('note');}
  if(screen==='lobby'){$('menu-title').textContent=tr('readyTitle');$('menu-text').innerHTML=tr('readyText').replace('{color}',color(role)).replace('{side}',tr(role?'right':'left'));$('menu-note').textContent=readyInfo.remote?tr('rivalReady'):tr('lobby');}
  if(screen==='result'){const own=state.players[role].score,other=state.players[1-role].score;const result=own>other?'win':own<other?'lose':'draw';$('menu-title').textContent=tr(result);$('menu-text').textContent=`${tr('score')} · ${own} — ${other}. ${tr(result+'Text')}`;$('menu-note').textContent=mode==='solo'?`${tr('best')} · ${best}`:readyInfo.remote?tr('rivalReady'):tr('note');}
  $('status').textContent=tr(statusKey);document.querySelectorAll('[data-action]').forEach(el=>el.disabled=!live||countdownUntil>performance.now());
}
function updateHud(){
  for(let i=0;i<2;i++){const p=state.players[i];$('score'+i).textContent=p.score;$('cargo'+i).textContent='● '.repeat(p.cargo)+'○ '.repeat(3-p.cargo);$('name'+i).textContent=(i?'■ ':'● ')+color(i)+(i===role?' · '+tr('you'):mode==='solo'?' · '+tr('bot'):'');}
  const seconds=Math.ceil(state.timeLeft/1000);$('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  $('timer').style.color=seconds<=10?'var(--coral)':'';$('mode-label').textContent=tr(mode==='solo'?'soloMode':mode==='network'?'duelMode':'welcomeMode');$('round-label').textContent=tr(state.phase==='finished'?'finished':seconds<=10?'finalStretch':'makeMove');
  $('identity').style.color=role?'var(--coral)':'var(--mint)';$('identity-title').textContent=tr('youAre')+' '+color(role);$('identity-goal').textContent=tr(role?'rightBank':'leftBank');
  $('arena').setAttribute('aria-label',`${color(role)}: ${state.players[role].score}. ${state.players[role].cargo}/3. ${$('timer').textContent}`);
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');toastUntil=performance.now()+1300;}
function effects(){for(const e of state.effects){if(e.id<=lastEffect)continue;lastEffect=e.id;if(e.player===role||e.type==='finish')audio.play(e.type);if(e.type==='bank'&&e.player===role)toast(`+${e.amount} · ${tr('bank')}`);if(e.type==='steal')toast(tr(e.player===role?'stolen':'robbed'));if(e.type==='collect'&&e.player===role&&state.players[role].cargo===3)toast(tr('full'));}}
function startSolo(){network.leave();role=0;mode='solo';screen='play';statusKey='makeMove';state=createGame(crypto.getRandomValues(new Uint32Array(1))[0]);roundId=state.seed;lastEffect=0;clearInput();renderer.reset();document.body.classList.add('playing');countdownUntil=performance.now()+2200;audio.unlock();updateHud();updateScreen();}
function finish(){if(screen==='result')return;clearInput();screen='result';statusKey='finished';countdownUntil=0;show('countdown',false);if(mode==='solo'){best=Math.max(best,state.players[0].score);save('glissumo.best',best);}updateScreen();}
function setInput(action){if(screen!=='play'||performance.now()<countdownUntil)return;audio.unlock();if(held!==action){held=action;tap=action;if(mode==='network')network.setInput(action);}document.querySelectorAll('[data-action]').forEach(el=>el.classList.toggle('active',el.dataset.action===action));}
function clearInput(){held=null;tap=null;network?.setInput(null);document.querySelectorAll('[data-action]').forEach(el=>el.classList.remove('active'));}
function releaseInput(){const pending=tap;clearInput();if(mode==='solo')tap=pending;}
function updateSound(){$('sound').setAttribute('aria-pressed',audio.enabled);$('sound-label').textContent=audio.enabled?'ON':'OFF';$('music').setAttribute('aria-pressed',audio.musicEnabled);$('music-label').textContent=audio.musicEnabled?'ON':'OFF';}
$('solo').addEventListener('click',startSolo);
$('connect').addEventListener('click',()=>{if(window.parent===window){statusKey='localOnly';updateScreen();return;}audio.unlock();clearInput();mode='network';network.connect();});
$('ready').addEventListener('click',()=>{audio.unlock();network.ready();});
$('rematch').addEventListener('click',()=>mode==='network'?network.ready():startSolo());
$('leave').addEventListener('click',()=>{network.leave();mode='menu';screen='menu';clearInput();document.body.classList.remove('playing');countdownUntil=0;show('countdown',false);state=createGame(20261028);statusKey='idle';updateHud();updateScreen();});
$('language').addEventListener('change',e=>{lang=e.target.value;save('glissumo.language',lang);translate();});
$('sound').addEventListener('click',()=>{audio.setEnabled(!audio.enabled);save('glissumo.sound',audio.enabled?'on':'off');updateSound();if(audio.enabled)audio.play('collect');});
$('music').addEventListener('click',()=>{audio.setMusicEnabled(!audio.musicEnabled);save('glissumo.music',audio.musicEnabled?'on':'off');updateSound();});
for(const control of document.querySelectorAll('[data-action]')){control.addEventListener('pointerdown',e=>{e.preventDefault();control.setPointerCapture(e.pointerId);setInput(control.dataset.action);});control.addEventListener('pointerup',()=>{if(held===control.dataset.action)releaseInput();});control.addEventListener('pointercancel',clearInput);control.addEventListener('lostpointercapture',()=>{if(held===control.dataset.action)releaseInput();});}
const keys={ArrowUp:'up',KeyW:'up',KeyZ:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',KeyQ:'left',ArrowRight:'right',KeyD:'right'};
window.addEventListener('keydown',e=>{if(e.target.closest('select,input,textarea'))return;const direction=keys[e.code];if(direction&&screen==='play'){e.preventDefault();setInput(direction);}});
window.addEventListener('keyup',e=>{if(keys[e.code]===held)releaseInput();});window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{clearInput();if(mode==='solo'){$('status').textContent=tr(document.hidden?'paused':'makeMove');}});
window.addEventListener('pagehide',event=>{if(!event.persisted)network.leave();});
// Desktop-site mode on a phone can advertise a 980px viewport. Fit the game to
// the physical screen without relying on a mobile UA or hiding browser controls.
if(navigator.maxTouchPoints>0&&screenWidth()<600){document.documentElement.classList.add('touch-phone');const viewport=document.querySelector('meta[name="viewport"]');viewport.content=`width=${screenWidth()}, initial-scale=1, viewport-fit=cover`;}
function screenWidth(){return Math.min(window.screen.width,window.screen.height);}
let previous=performance.now(),accumulator=0;
setInterval(()=>{const now=performance.now(),elapsed=Math.min(1000,now-previous);previous=now;if(mode==='network'){network.poll(elapsed);effects();}else if(mode==='solo'&&screen==='play'&&!document.hidden&&now>=countdownUntil){accumulator+=Math.min(250,elapsed);while(accumulator>=20){const action=tap||held;const canMove=state.players[0].cooldown<=20;stepGame(state,20,[action,chooseBotAction(state,1,$('difficulty').value)]);if(canMove)tap=null;accumulator-=20;}effects();if(state.phase==='finished')finish();}if(now-lastHud>90){updateHud();lastHud=now;}},20);
function frame(now){renderer.draw(state,role,now);if(countdownUntil){const remaining=countdownUntil-now;if(remaining>0){show('countdown',true);$('countdown').textContent=remaining>1200?'2':remaining>200?'1':tr('go');}else{countdownUntil=0;show('countdown',false);updateScreen();}}if(toastUntil&&now>toastUntil){$('toast').classList.remove('show');toastUntil=0;}requestAnimationFrame(frame);}
translate();requestAnimationFrame(frame);
