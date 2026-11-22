/* Symbo boot loader, adapted from the Partner Success Portal loader. Call SY_LOADER.ready({partners, programs}) when the app is ready. */
(function(){
  var L=document.getElementById('sy-loader'); if(!L) return; 
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MIN=reduce?400:2400, t0=performance.now();
  document.documentElement.style.overflow='hidden';

  // data streams
  function hex(n){var s='';for(var i=0;i<n;i++)s+='0123456789ABCDEF'[Math.random()*16|0];return s}
  ['sy-sl','sy-sr'].forEach(function(id){var h='';for(var i=0;i<90;i++){h+=(i%7==0?'PTR_'+hex(3):'0x'+hex(6))+'<br>'}var el=document.getElementById(id);if(el)el.innerHTML=h+h;});

  // circuit traces converging on the emblem
  var c=document.getElementById('sy-canvas'), x=c.getContext('2d'), W,H,dpr,traces=[];
  function build(){
    dpr=Math.min(window.devicePixelRatio||1,2); W=innerWidth; H=innerHeight;
    c.width=W*dpr; c.height=H*dpr; x.setTransform(dpr,0,0,dpr,0,0);
    var em=document.querySelector('#sy-loader .sy-emblem'), r=em?em.getBoundingClientRect():null; var cx=r?r.left+r.width/2:W/2, cy=r?r.top+r.height/2:H*0.4, R=124; traces=[];
    for(var i=0;i<26;i++){
      var s, a=(i/26)*Math.PI*2+0.12, ca=Math.cos(a), sa=Math.sin(a);
      var ex=cx+ca*R, ey=cy+sa*R;
      var side=Math.abs(ca)>Math.abs(sa)?(ca<0?0:1):(sa<0?2:3);
      if(side===0) s=[-10, ey+(Math.random()-.5)*160];
      else if(side===1) s=[W+10, ey+(Math.random()-.5)*160];
      else if(side===2) s=[ex+(Math.random()-.5)*160, -10];
      else s=[ex+(Math.random()-.5)*160, H+10];
      var p=[s], horiz=side<2;
      if(horiz){var d=Math.abs(ey-s[1]), dir=Math.sign(ex-s[0]), mid=s[0]+(ex-s[0])*(.35+Math.random()*.3);
        p.push([mid,s[1]]); p.push([mid+dir*d,ey]); p.push([ex,ey]);}
      else {var d2=Math.abs(ex-s[0]), dir2=Math.sign(ey-s[1]), mid2=s[1]+(ey-s[1])*(.35+Math.random()*.3);
        p.push([s[0],mid2]); p.push([ex,mid2+dir2*d2]); p.push([ex,ey]);}
      var seg=[],Ln=0; for(var k=1;k<p.length;k++){var l=Math.hypot(p[k][0]-p[k-1][0],p[k][1]-p[k-1][1]);seg.push(l);Ln+=l}
      traces.push({p:p,seg:seg,L:Ln,delay:Math.random()*.5,speed:.9+Math.random()*.5,off:Math.random()});
    }
  }
  function at(t,d){var acc=0;for(var i=0;i<t.seg.length;i++){if(d<=acc+t.seg[i]){var f=(d-acc)/(t.seg[i]||1),a=t.p[i],b=t.p[i+1];return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]}acc+=t.seg[i]}return t.p[t.p.length-1]}
  function path(t,d){x.beginPath();x.moveTo(t.p[0][0],t.p[0][1]);var acc=0;for(var i=0;i<t.seg.length;i++){if(d>=acc+t.seg[i]){x.lineTo(t.p[i+1][0],t.p[i+1][1]);acc+=t.seg[i]}else{var q=at(t,d);x.lineTo(q[0],q[1]);break}}x.stroke()}
  var ease=function(v){v=Math.max(0,Math.min(1,v));return 1-Math.pow(1-v,3)};
  var raf, running=true;
  function frame(now){
    if(!running) return;
    var t=(now-t0)/1000; x.clearRect(0,0,W,H); x.lineCap='round'; x.lineJoin='round';
    for(var i=0;i<traces.length;i++){var tr=traces[i], pr=ease((t-tr.delay)/(1.1/tr.speed)); if(pr<=0) continue; var d=pr*tr.L;
      x.globalAlpha=pr<1?.55:.22; x.strokeStyle='#00C98F'; x.lineWidth=1.5; path(tr,d);
      x.globalAlpha=.7; x.beginPath(); x.arc(tr.p[0][0],tr.p[0][1],3.5,0,7); x.lineWidth=1.2; x.stroke();
      if(pr<1){var h=at(tr,d), tl=at(tr,Math.max(0,d-70)); x.globalAlpha=1; x.strokeStyle='#7DFFD6'; x.lineWidth=2.2; x.beginPath(); x.moveTo(tl[0],tl[1]); x.lineTo(h[0],h[1]); x.stroke();
        x.shadowColor='#00C98F'; x.shadowBlur=16; x.fillStyle='#CFFFEF'; x.beginPath(); x.arc(h[0],h[1],3.2,0,7); x.fill(); x.shadowBlur=0;}
      else {var ph=((t*0.7*tr.speed)+tr.off)%1, q=at(tr,ph*tr.L); x.globalAlpha=Math.sin(ph*Math.PI); x.shadowColor='#00C98F'; x.shadowBlur=10; x.fillStyle='#B8FFE8'; x.beginPath(); x.arc(q[0],q[1],2.2,0,7); x.fill(); x.shadowBlur=0;
        var k=(t-tr.delay-1.1/tr.speed)/.4; if(k>0&&k<1){var e=tr.p[3]; x.globalAlpha=1-k; x.strokeStyle='#9FFFE0'; x.lineWidth=1.5; x.beginPath(); x.arc(e[0],e[1],3+k*18,0,7); x.stroke();}}
    }
    x.globalAlpha=1; raf=requestAnimationFrame(frame);
  }
  build(); addEventListener('resize',build); if(!reduce) raf=requestAnimationFrame(frame);

  // logo pulse after it forms
  setTimeout(function(){var lg=document.getElementById('sy-logo'); if(lg) lg.classList.add('sy-live')}, reduce?0:2000);

  // progress + status
  var msgs=['Initialising secure session','Opening agent workspace','Loading credit life rate card','Loading suitability rules','Preparing health declaration','Preparing consent templates','Ready'];
  var fill=document.getElementById('sy-fill'), pct=document.getElementById('sy-pct'), st=document.getElementById('sy-status'), n1=document.getElementById('sy-n1'), n2=document.getElementById('sy-n2');
  var loaded=false,failed=false,counts=null,readyAt=0;
  window.SY_LOADER={ready:function(c){counts=c||{partners:0,programs:0};readyAt=performance.now();loaded=true;},fail:function(msg){if(loaded)return;failed=true;L.classList.add('sy-fail');if(st)st.textContent=msg||'Could not load the workbook';},retry:function(){failed=false;L.classList.remove('sy-fail');t0=performance.now();shown=0;requestAnimationFrame(tick);}};
  var shown=0;
  function tick(){
    if(failed) return;
    var el=performance.now()-t0, target=Math.min(1,el/MIN); if(!loaded) target=Math.min(target,.92);
    shown+= (target-shown)*.12; if(target>=1 && 1-shown<.004) shown=1;
    var p=Math.round(shown*100);
    if(fill) fill.style.width=(shown*100)+'%';
    if(pct) pct.textContent=(p<10?'0':'')+p+'%';
    if(st) st.textContent=msgs[Math.min(msgs.length-1,Math.floor(shown*(msgs.length-1)+.0001))];
    var k=counts?ease((performance.now()-readyAt)/700):0;
    if(n1) n1.textContent=counts?Math.round(counts.partners*k):'--';
    if(n2) n2.textContent=counts?Math.round(counts.programs*k):'--';
    if(shown>=1&&k>=1){ setTimeout(done, reduce?0:280); return; }
    requestAnimationFrame(tick);
  }
  function done(){
    L.classList.add('sy-exit');
    setTimeout(function(){running=false; cancelAnimationFrame(raf); document.documentElement.style.overflow=''; L.remove(); window.SY_LOADED=true; try{window.dispatchEvent(new Event('sy:loaded'));}catch(e){}}, reduce?50:1100);
  }
  requestAnimationFrame(tick);
})();
