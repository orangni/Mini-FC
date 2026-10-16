"""Simple default controls on desktop and emulated tablet; not real iPad Safari."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=os.environ.get('MINI_FC_URL','http://127.0.0.1:4173/')
ARTIFACTS=Path(os.environ.get('MINI_FC_ARTIFACTS','playwright-results'));ARTIFACTS.mkdir(parents=True,exist_ok=True)
PREPARE="""() => {
 const m=__miniFC.match;m.kickoffWait=0;m.ai=()=>{};m.random=()=>.5;m.controlled=0;
 m.players.forEach((p,i)=>Object.assign(p,{x:i%2?20:-20,z:18+i*.2,vx:0,vz:0,cooldown:0,protected:0,stunned:0}));
 Object.assign(m.players[0],{x:0,z:-15,dx:0,dz:-1});
 Object.assign(m.players[1],{x:-10,z:-22});Object.assign(m.players[2],{x:10,z:-22});
 Object.assign(m.ball,{owner:0,x:0,z:-15.75,y:.35,vx:0,vz:0,vy:0});m.queuedAction=null;
 __miniFC.input.reset();
}"""
with sync_playwright() as p:
 options={'headless':True,'args':['--enable-unsafe-swiftshader']}
 if os.environ.get('MINI_FC_BROWSER'):options['executable_path']=os.environ['MINI_FC_BROWSER']
 browser=p.chromium.launch(**options)
 context=browser.new_context(viewport={'width':1024,'height':768},is_mobile=True,has_touch=True)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(URL+'?test=1');page.click('#play');page.click('#kickoff')
 assert page.evaluate('__miniFC.settings.controls==="simple" && __miniFC.input.simple && __miniFC.match.assisted')
 def prepare():
  page.evaluate(PREPARE);page.wait_for_function('!document.querySelector("#shoot-button").hidden')
 def visible():return page.evaluate('[...document.querySelectorAll("#touch-controls button")].filter(b=>!b.hidden).map(b=>b.id).sort()')
 prepare()
 assert visible()==['pass-button','shoot-button','sprint-button'],visible()
 page.wait_for_function('__miniFC.renderer.passRing.visible')
 for key,field in [('KeyJ','shots'),('KeyX','shots'),('Space','passes'),('KeyZ','passes')]:
  prepare();before=page.evaluate(f'__miniFC.match.stats.{field}')
  page.keyboard.down(key)
  page.wait_for_function(f'__miniFC.match.stats.{field}==={before+1}')
  assert page.evaluate('__miniFC.input.shooting===null')
  page.wait_for_timeout(250);page.keyboard.up(key)
  assert page.evaluate(f'__miniFC.match.stats.{field}')==before+1
 # Both landscape sizes keep all three buttons large, separate and on screen.
 for width,height in [(1024,768),(667,375)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
  if page.evaluate('__miniFC.mode==="pause"'):page.click('#resume')
  prepare()
  boxes=page.evaluate('[...document.querySelectorAll("#touch-controls button")].filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
  assert len(boxes)==3
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
 for selector,field in [('#pass-button','passes'),('#shoot-button','shots')]:
  prepare();before=page.evaluate(f'__miniFC.match.stats.{field}');x,y=center(selector)
  sx,sy=center('#joystick');touch('touchStart',[(1,sx,sy)]);touch('touchMove',[(1,sx+35,sy)])
  touch('touchStart',[(1,sx+35,sy),(2,x,y)])
  page.wait_for_function(f'__miniFC.match.stats.{field}==={before+1}')
  assert page.evaluate('__miniFC.input.axes.x>.5 && __miniFC.input.shooting===null')
  page.wait_for_timeout(420);touch('touchEnd',[(2,x,y)])
  assert page.evaluate('__miniFC.input.axes.x>.5')
  page.wait_for_timeout(80)
  assert page.evaluate(f'__miniFC.match.stats.{field}')==before+1
  assert page.evaluate('__miniFC.match.ball.vy<3') # a held pass never becomes a lob
  touch('touchEnd',[])
 # Hold defence approaches the exposed carrier and tackles, with no stick motion.
 prepare()
 page.evaluate('''() => { const m=__miniFC.match;m.career=true;Object.assign(m.players[0],{x:0,z:0,tackleCooldown:0});Object.assign(m.players[3],{x:0,z:-7,dx:0,dz:1});Object.assign(m.ball,{owner:3,x:0,z:-7,lastTeam:1}); }''')
 page.wait_for_function('!document.querySelector("#press-button").hidden')
 assert visible()==['press-button','sprint-button','tackle-button']
 x,y=center('#press-button');touch('touchStart',[(3,x,y)])
 page.wait_for_function('__miniFC.match.stats.tackles>0')
 assert page.evaluate('__miniFC.match.controlled===0 && __miniFC.match.players[0].z < -3')
 touch('touchCancel',[])
 assert page.evaluate('!__miniFC.input.press && __miniFC.input.buttonHolds.size===0')
 page.screenshot(path=str(ARTIFACTS/'simple-controls.png'))
 # Advanced is an explicit, persistent option; existing techniques remain available.
 page.click('#pause');page.click('#settings');page.select_option('#controls','advanced')
 assert page.evaluate('!__miniFC.input.simple && !__miniFC.match.assisted')
 page.reload();page.click('#settings');assert page.locator('#controls').input_value()=='advanced'
 page.select_option('#controls','simple');page.reload();page.click('#settings');assert page.locator('#controls').input_value()=='simple'
 assert not errors,errors
 print(json.dumps({'result':'PASS','simple':'default, instant J/X/Space/Z, no hold repeats, receiver ring, three-button layouts, simultaneous touch movement/actions, assisted defence, career lock, cancellation, persistent Advanced toggle','javascript_errors':errors}))
 browser.close()
