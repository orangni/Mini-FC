"""Gameplay overhaul on the production /Mini-FC/ subpath; Chromium tablet emulation."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
URL=os.environ.get('MINI_FC_URL','http://127.0.0.1:4180/Mini-FC/')
ARTIFACTS=Path(os.environ.get('MINI_FC_ARTIFACTS','playwright-results'));ARTIFACTS.mkdir(parents=True,exist_ok=True)
PREPARE="""() => {
 const m=__miniFC.match;m.kickoffWait=0;m.ai=()=>{};m.queuedAction=null;m.pendingPass=null;m.random=()=>.5;
 m.players.forEach((p,i)=>Object.assign(p,{x:p.team?20:-20,z:20+i*.4,vx:0,vz:0,cooldown:0,protected:0,stunned:0,feintTime:0,skillTime:0,skillCooldown:0,tackleCooldown:0,action:'',actionTime:0}));
 Object.assign(m.players[0],{x:0,z:-18,dx:0,dz:-1});
 Object.assign(m.players[1],{x:-12,z:-23});Object.assign(m.players[2],{x:12,z:-23});
 Object.assign(m.ball,{owner:0,followOwner:null,x:0,z:-18.75,y:.35,vx:0,vz:0,vy:0});m.controlled=0;
 if(!m.testGameplay){
  const pass=m.pass.bind(m),shoot=m.shoot.bind(m);
  m.pass=(id,type='short',requested=null,aim=null)=>{const ok=pass(id,type,requested,aim);if(ok)m.lastPass={id,receiver:m.pendingPass.receiver,type,aim};return ok};
  m.shoot=(id,user,options={})=>{const ok=shoot(id,user,options);if(ok){const b=m.ball;m.lastShot={type:options.type,speed:Math.hypot(b.vx,b.vz),projectedX:b.x+( -36-b.z)*b.vx/b.vz,moving:m.players[id].moving};}return ok};
  m.testGameplay=true;
 }
 m.lastPass=m.lastShot=null;
}"""
with sync_playwright() as p:
 options={'headless':True,'args':['--enable-unsafe-swiftshader']}
 if os.environ.get('MINI_FC_BROWSER'):options['executable_path']=os.environ['MINI_FC_BROWSER']
 browser=p.chromium.launch(**options);errors=[];failed=[]
 context=browser.new_context(viewport={'width':1180,'height':820},is_mobile=True,has_touch=True,device_scale_factor=1)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.on('response',lambda r:failed.append(f'{r.status} {r.url}') if r.status>=400 else None)
 page.goto(URL+'?test=1');page.click('#settings');page.select_option('#controls','advanced');page.select_option('#difficulty','extra-hard');assert page.locator('#difficulty option').count()==4
 page.select_option('#language','ko');expect(page.locator('#difficulty option[value="extra-hard"]')).to_have_text('엑스트라 하드')
 page.select_option('#language','en');page.reload()
 page.wait_for_selector('#settings');assert page.evaluate('__miniFC.settings.difficulty')=='extra-hard'
 page.click('#play');page.click('#kickoff');assert page.evaluate('__miniFC.match.difficulty')=='extra-hard'
 page.wait_for_function('__miniFC.match.kickoffWait<=0')
 assert page.evaluate('!document.querySelector("#announcement").classList.contains("visible")')
 page.click('#pause');page.click('#settings');page.select_option('#difficulty','easy')
 assert page.evaluate('__miniFC.match.difficulty')=='easy'
 page.select_option('#difficulty','extra-hard');assert page.evaluate('__miniFC.match.difficulty')=='extra-hard'
 page.click('#back');page.click('#resume');page.evaluate(PREPARE)
 # Real keyboard movement starts, accelerates, brakes and settles through the animation loop.
 page.keyboard.down('KeyD');page.wait_for_function('__miniFC.match.players[0].vx>5');page.keyboard.up('KeyD')
 page.wait_for_function('__miniFC.match.players[0].vx===0')
 page.evaluate(PREPARE);page.keyboard.down('KeyA');page.keyboard.press('Space');page.keyboard.up('KeyA')
 page.wait_for_function('__miniFC.match.lastPass!==null');assert page.evaluate('__miniFC.match.lastPass.receiver')==1
 # Simultaneous left-stick movement and a charged right-hand shot.
 page.evaluate(PREPARE);page.wait_for_function('!document.querySelector("#shoot-button").hidden')
 session=context.new_cdp_session(page)
 def touches(kind,points):session.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i,'x':x,'y':y} for i,x,y in points]})
 def center(selector):
  b=page.locator(selector).bounding_box();return b['x']+b['width']/2,b['y']+b['height']/2
 x,y=center('#joystick');sx,sy=center('#shoot-button')
 touches('touchStart',[(1,x,y)]);touches('touchMove',[(1,x+24,y-34)])
 touches('touchStart',[(1,x+24,y-34),(2,sx,sy)])
 page.wait_for_function('__miniFC.input.charge()>.45')
 assert page.evaluate('__miniFC.match.players[0].moving>3')
 expect(page.locator('#shot-power')).to_have_class('charging')
 assert page.evaluate('__miniFC.renderer.ring.scale.x')>1
 touches('touchEnd',[(2,sx,sy)])
 page.wait_for_function('__miniFC.match.lastShot!==null')
 shot=page.evaluate('__miniFC.match.lastShot');assert shot['type']=='power';assert shot['moving']>2;assert shot['projectedX']>1
 touches('touchEnd',[])
 # A brush across SKILL must not be interpreted as a deliberate feint.
 page.evaluate(PREPARE);kx,ky=center('#skill-button')
 touches('touchStart',[(4,kx,ky)]);touches('touchMove',[(4,kx+35,ky)])
 touches('touchEnd',[]);page.wait_for_timeout(100)
 assert page.evaluate('__miniFC.match.players[0].skillCooldown')==0
 # A cancellation on the wrong button cannot remove an actual captured hold.
 page.evaluate('__miniFC.match.ball.owner=3');page.wait_for_function('!document.querySelector("#press-button").hidden')
 px,py=center('#press-button');touches('touchStart',[(5,px,py)])
 page.evaluate('''() => {const id=[...__miniFC.input.buttonHolds.keys()][0];document.querySelector('#shoot-button').dispatchEvent(new PointerEvent('pointercancel',{pointerId:id}));}''')
 assert page.evaluate('__miniFC.input.press && __miniFC.input.buttonHolds.size===1')
 touches('touchCancel',[])
 page.evaluate(PREPARE);page.screenshot(path=str(ARTIFACTS/'overhaul-touch.png'))
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth && scrollY===0')
 # Rotation clears live touches and pauses; no held run or charged shot survives it.
 page.evaluate('window.dispatchEvent(new Event("orientationchange"))')
 assert page.evaluate('__miniFC.mode==="pause" && __miniFC.input.axes.x===0 && !__miniFC.input.shooting')
 page.click('#resume');page.evaluate('delete __miniFC.match.ai')
 before=page.evaluate('__miniFC.match.players[3].z');page.wait_for_timeout(1000)
 assert page.evaluate('__miniFC.match.players[3].z')!=before
 assert page.evaluate('__miniFC.match.players.every(p=>Number.isFinite(p.x+p.z+p.vx+p.vz))')
 assert not errors,errors;assert not failed,failed
 print(json.dumps({'result':'PASS','difficulty':'Extra Hard persists, switches languages and applies to a paused match','keyboard':'acceleration, braking, directional pass','touch':'move+charge+aim, feedback, brush rejection, pointer ownership, orientation pause','runtime':'live 6v6 AI after resuming','javascript_errors':errors,'failed_http_responses':failed}))
 browser.close()
