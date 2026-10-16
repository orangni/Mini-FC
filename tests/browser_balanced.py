"""Full techniques in the assisted default; Chromium touch emulation, not Safari."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=os.environ.get('MINI_FC_URL','http://127.0.0.1:4173/')
ARTIFACTS=Path(os.environ.get('MINI_FC_ARTIFACTS','playwright-results'));ARTIFACTS.mkdir(parents=True,exist_ok=True)
PREPARE="""() => {
 const m=__miniFC.match;m.kickoffWait=0;m.ai=()=>{};m.random=()=>.5;m.controlled=0;
 m.players.forEach((p,i)=>Object.assign(p,{x:i%2?20:-20,z:18+i*.2,vx:0,vz:0,cooldown:0,protected:0,stunned:0,skillCooldown:0,skillTime:0,tackleCooldown:0,feintTime:0,action:'',actionTime:0}));
 Object.assign(m.players[0],{x:0,z:-15,dx:0,dz:-1});
 Object.assign(m.players[1],{x:-10,z:-22});Object.assign(m.players[2],{x:10,z:-22});
 Object.assign(m.ball,{owner:0,followOwner:null,x:0,z:-15.75,y:.35,vx:0,vz:0,vy:0});m.queuedAction=m.pendingPass=null;
 __miniFC.input.reset();
 if(!m.testBalanced){
  const shoot=m.shoot.bind(m),pass=m.pass.bind(m);
  m.shoot=(id,user,options={})=>{const ok=shoot(id,user,options);if(ok)m.lastShot={type:options.type||'normal',curve:m.ball.curve,vy:m.ball.vy};return ok;};
  m.pass=(id,type='short',requested=null,aim=null)=>{const ok=pass(id,type,requested,aim);if(ok)m.lastPass={type};return ok;};
  m.testBalanced=true;
 }
 m.lastShot=m.lastPass=null;
}"""
with sync_playwright() as p:
 options={'headless':True,'args':['--enable-unsafe-swiftshader']}
 if os.environ.get('MINI_FC_BROWSER'):options['executable_path']=os.environ['MINI_FC_BROWSER']
 browser=p.chromium.launch(**options)
 context=browser.new_context(viewport={'width':1024,'height':768},is_mobile=True,has_touch=True)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(URL+'?test=1');assert page.evaluate('__miniFC.settings.controls')=='balanced'
 # A previously saved Simple choice must migrate without losing other preferences.
 page.evaluate('localStorage.setItem("mini-fc-settings",JSON.stringify({controls:"simple",touchSize:110,difficulty:"normal"}))')
 page.reload();assert page.evaluate('__miniFC.settings.controls==="balanced" && __miniFC.settings.touchSize===110')
 page.click('#play');page.click('#kickoff')
 assert page.evaluate('__miniFC.input.assisted && __miniFC.match.assisted')
 def prepare():
  page.evaluate(PREPARE);page.wait_for_function('!document.querySelector("#shoot-button").hidden')
 def visible():return page.evaluate('[...document.querySelectorAll("#touch-controls button")].filter(b=>!b.hidden).map(b=>b.id).sort()')
 prepare();assert visible()==['chip-button','pass-button','shoot-button','skill-button','sprint-button','through-button'],visible()
 page.wait_for_function('__miniFC.renderer.passRing.visible')
 for key,technique,kind in [('Space','short','Pass'),('KeyZ','short','Pass'),('KeyE','through','Pass'),('KeyL','lob','Pass'),('KeyJ','normal','Shot'),('KeyK','chip','Shot'),('KeyF','finesse','Shot')]:
  prepare();page.keyboard.press(key)
  page.wait_for_function(f'__miniFC.match.last{kind}?.type==="{technique}"')
 prepare();shots=page.evaluate('__miniFC.match.stats.shots');page.keyboard.down('KeyJ')
 page.wait_for_function('__miniFC.input.charge()>.3')
 assert page.evaluate('__miniFC.match.stats.shots')==shots
 page.keyboard.up('KeyJ');page.wait_for_function('__miniFC.match.lastShot?.type==="power"')
 page.wait_for_timeout(100);assert page.evaluate('__miniFC.match.stats.shots')==shots+1
 prepare();page.keyboard.press('KeyC');page.wait_for_function('__miniFC.match.players[0].skillCooldown>0')
 prepare();page.keyboard.down('KeyV');page.wait_for_function('__miniFC.match.players[0].shield');page.keyboard.up('KeyV');page.wait_for_function('!__miniFC.match.players[0].shield')
 # Restoring every technique must retain large non-overlapping buttons on both screen sizes.
 for width,height in [(1024,768),(667,375)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
  if page.evaluate('__miniFC.mode==="pause"'):page.click('#resume')
  prepare()
  boxes=page.evaluate('[...document.querySelectorAll("#touch-controls button")].filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
  assert len(boxes)==6
  for b in boxes:
   assert b['w']>=(63 if height<500 else 103) and b['h']>=(63 if height<500 else 103),b
   assert b['x']>=0 and b['x']+b['w']<=width+1 and b['y']>=0 and b['y']+b['h']<=height+1,b
   for q in boxes:
    if q is not b:assert min(b['x']+b['w'],q['x']+q['w'])<=max(b['x'],q['x']) or min(b['y']+b['h'],q['y']+q['h'])<=max(b['y'],q['y'])
 page.set_viewport_size({'width':1024,'height':768});page.wait_for_timeout(100)
 if page.evaluate('__miniFC.mode==="pause"'):page.click('#resume')
 cdp=context.new_cdp_session(page)
 def touch(kind,points):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i,'x':x,'y':y} for i,x,y in points]})
 def center(selector):
  b=page.locator(selector).bounding_box();return b['x']+b['width']/2,b['y']+b['height']/2
 prepare();shots=page.evaluate('__miniFC.match.stats.shots')
 sx,sy=center('#joystick');x,y=center('#shoot-button')
 touch('touchStart',[(1,sx,sy)]);touch('touchMove',[(1,sx+30,sy-20)])
 touch('touchStart',[(1,sx+30,sy-20),(2,x,y)])
 page.wait_for_function('__miniFC.input.charge()>.25 && __miniFC.match.players[0].moving>3')
 assert page.evaluate('__miniFC.match.stats.shots')==shots
 touch('touchMove',[(1,sx+30,sy-20),(2,x-40,y)])
 touch('touchEnd',[(2,x-40,y)])
 page.wait_for_function('__miniFC.match.lastShot?.type==="finesse"')
 assert page.evaluate('__miniFC.match.lastShot.curve!==0 && __miniFC.input.axes.x>.4')
 touch('touchCancel',[]);assert page.evaluate('__miniFC.input.axes.x===0 && !__miniFC.input.shooting')
 prepare();page.screenshot(path=str(ARTIFACTS/'balanced-techniques.png'))
 # Hold defence approaches and tackles while career remains locked; slide still has its own key.
 page.click('#pause');page.click('#quit');page.click('#career');page.fill('#player-name','Balanced Captain');page.click('#create-career');page.click('#fixture')
 prepare();page.evaluate('''() => { const m=__miniFC.match;Object.assign(m.players[0],{x:0,z:0});Object.assign(m.players[3],{x:0,z:-7,dx:0,dz:1});Object.assign(m.ball,{owner:3,x:0,z:-7,lastTeam:1}); }''')
 page.wait_for_function('!document.querySelector("#press-button").hidden')
 assert visible()==['press-button','slide-button','sprint-button','tackle-button']
 tackles=page.evaluate('__miniFC.match.stats.tackles');page.keyboard.down('KeyP')
 page.wait_for_function(f'__miniFC.match.stats.tackles>{tackles}')
 assert page.evaluate('__miniFC.match.controlled===0 && __miniFC.match.players[0].z < -3')
 page.keyboard.up('KeyP')
 prepare();page.evaluate('''() => {const m=__miniFC.match;Object.assign(m.players[3],{x:0,z:-17,dx:0,dz:1});Object.assign(m.ball,{owner:3,x:0,z:-17,lastTeam:1});}''')
 page.wait_for_function('!document.querySelector("#slide-button").hidden');page.keyboard.press('KeyX')
 page.wait_for_function('__miniFC.match.players[0].recovery>0 && __miniFC.match.players[0].action==="slide"')
 page.click('#pause');page.click('#settings');page.select_option('#controls','advanced')
 assert page.evaluate('!__miniFC.input.assisted && !__miniFC.match.assisted')
 page.reload();page.click('#settings');assert page.locator('#controls').input_value()=='advanced'
 page.select_option('#controls','balanced');page.reload();page.click('#settings');assert page.locator('#controls').input_value()=='balanced'
 assert not errors,errors
 print(json.dumps({'result':'PASS','balanced':'default/migration, full keyboard techniques, charge/release, shielding, six-button layouts, simultaneous movement/finesse, press and slide, career lock, persistent Manual option','javascript_errors':errors}))
 browser.close()
