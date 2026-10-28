// All audio is bundled locally. See assets/audio/PROVENANCE.md for generated media.
export function createAudio() {
  let context, enabled=false, musicEnabled=false, active=false, last=0, loading=false, musicSource=null, musicGain=null;
  const buffers=new Map();
  function syncMusic(){
    const shouldPlay=context&&musicEnabled&&active&&!document.hidden&&buffers.has('music');
    if(!shouldPlay&&musicSource){musicSource.stop();musicSource=null;}
    if(shouldPlay&&!musicSource){musicSource=context.createBufferSource();musicSource.buffer=buffers.get('music');musicSource.loop=true;musicGain=context.createGain();musicGain.gain.value=.65;musicSource.connect(musicGain);musicGain.connect(context.destination);musicSource.start();}
  }
  function unlock(){try{context ||= new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume().catch(()=>{});
    if(!loading&&(enabled||musicEnabled)){loading=true;for(const name of ['music','collect','bank','steal'])fetch(`assets/audio/${name}.mp3`).then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{buffers.set(name,buffer);syncMusic();}).catch(()=>{});}
  }catch{}}
  function play(type) {
    if(!enabled||document.hidden)return;
    unlock();if(!context)return;
    const now=context.currentTime;if(now-last<.045)return;last=now;
    if(buffers.has(type)){const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(type);gain.gain.value=.6;source.connect(gain);gain.connect(context.destination);source.start();if(musicGain&&['bank','steal'].includes(type)){musicGain.gain.cancelScheduledValues(now);musicGain.gain.setTargetAtTime(.25,now,.02);musicGain.gain.setTargetAtTime(.65,now+.5,.2);}return;}
    const notes={collect:[660,880],bank:[440,660,880],steal:[420,260],bump:[160],shift:[95],hop:[180],finish:[523,659,784,1047]}[type];
    if(!notes)return;
    notes.forEach((frequency,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),at=now+i*.075;oscillator.type=type==='shift'?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,at);oscillator.frequency.exponentialRampToValueAtTime(frequency*.85,at+.14);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(type==='shift'||type==='hop'?.025:.09,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+.2);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.23);});
  }
  document.addEventListener('visibilitychange',syncMusic);
  return {play,unlock,setEnabled(value){enabled=!!value;if(enabled)unlock();},setMusicEnabled(value){musicEnabled=!!value;if(musicEnabled)unlock();syncMusic();},setActive(value){active=!!value;syncMusic();},get enabled(){return enabled;},get musicEnabled(){return musicEnabled;}};
}
