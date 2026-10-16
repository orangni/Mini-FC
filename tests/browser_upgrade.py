"""Additional 6v6/touch/club/save production checks. Same env options as browser_smoke.py."""
import base64, json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
URL=os.environ.get('MINI_FC_URL','http://127.0.0.1:4173/')
ARTIFACTS=Path(os.environ.get('MINI_FC_ARTIFACTS','playwright-results'));ARTIFACTS.mkdir(parents=True,exist_ok=True)
SHOT="""() => { const m=__miniFC.match;m.kickoffWait=0;m.players.forEach((p,i)=>{p.x=i%2?20:-20;p.z=15;p.cooldown=5;});Object.assign(m.players[0],{x:0,z:-16,dx:0,dz:-1,cooldown:0});Object.assign(m.ball,{x:0,z:-17,y:.35,owner:0,vx:0,vz:0,vy:0});m.controlled=0; }"""
with sync_playwright() as p:
 options={'headless':True,'args':['--enable-unsafe-swiftshader']}
 if os.environ.get('MINI_FC_BROWSER'):options['executable_path']=os.environ['MINI_FC_BROWSER']
 browser=p.chromium.launch(**options)
 context=browser.new_context(viewport={'width':1180,'height':820},device_scale_factor=1,is_mobile=True,has_touch=True)
 page=context.new_page();errors=[];failed=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.on('response',lambda r:failed.append(f'{r.status} {r.url}') if r.status>=400 else None)
 page.goto(URL+'?test=1');page.click('#settings');page.select_option('#controls','advanced');page.click('#back');page.click('#play')
 page.select_option('#league-filter','BL');assert page.locator('[data-club]').count()==9
 page.select_option('#league-filter','PL');page.fill('#club-search','coventry');assert page.locator('[data-club]').count()==1
 page.click('[data-club="coventry"]');page.fill('#club-search','arsenal');page.click('[data-club="arsenal"]')
 page.click('#choose-home');page.click('[data-club="arsenal"]')
 page.screenshot(path=str(ARTIFACTS/'clubs.png'))
 page.click('#kickoff');page.wait_for_function('__miniFC.mode==="playing"')
 assert page.evaluate('__miniFC.match.players.length')==12
 assert page.evaluate('__miniFC.renderer.selectedKits.awayAlternate') is True
 # Freeze only the test fixture's AI so a charge cannot be stolen before release.
 def prepare():
  page.evaluate(SHOT)
  page.evaluate("""() => {
    const m=__miniFC.match;m.ai=()=>{};m.random=()=>.5;m.testLastShot=null;m.testLastPass=null;
    m.players[0].skillCooldown=0;m.players[0].stunned=0;
    if(!m.testSpies){
      const shoot=m.shoot.bind(m),pass=m.pass.bind(m);
      m.shoot=(id,user,options={})=>{const ok=shoot(id,user,options);if(ok)m.testLastShot={type:options.type||'normal',vy:m.ball.vy,curve:m.ball.curve,speed:Math.hypot(m.ball.vx,m.ball.vz)};return ok;};
      m.pass=(id,type='short',requested=null)=>{const ok=pass(id,type,requested);if(ok)m.testLastPass={type,vy:m.ball.vy};return ok;};
      m.testSpies=true;
    }
  }""")
  page.wait_for_function('!document.querySelector("#shoot-button").hidden')
 def hold(button,milliseconds=350):
  b=page.locator(button).bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2
  session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':2}]})
  page.wait_for_timeout(milliseconds)
  session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 session=context.new_cdp_session(page)
 prepare();hold('#shoot-button',650)
 page.wait_for_function('__miniFC.match.stats.shots===1')
 event=page.evaluate('__miniFC.match.events.find(e=>e.type==="shot")')
 assert page.evaluate('__miniFC.match.ball.lastPlayer')==0
 assert page.evaluate('__miniFC.match.testLastShot.speed')>33;assert page.evaluate('__miniFC.match.testLastShot.type')=='power'
 prepare();page.tap('#chip-button');page.wait_for_function('__miniFC.match.testLastShot?.type==="chip"');assert page.evaluate('__miniFC.match.testLastShot.vy')>5
 prepare();page.tap('#through-button');page.wait_for_function('__miniFC.match.testLastPass?.type==="through"');assert page.evaluate('__miniFC.match.stats.passes')>=1
 prepare();hold('#pass-button',420);page.wait_for_function('__miniFC.match.testLastPass?.type==="lob"');assert page.evaluate('__miniFC.match.testLastPass.vy')>3
 prepare();page.tap('#skill-button');page.wait_for_function('__miniFC.match.players[0].skillCooldown>0');page.wait_for_function('Math.abs(__miniFC.match.players[0].x)>.8')
 prepare();hold('#skill-button',400);assert page.evaluate('__miniFC.input.shield') is False
 # Swipe SHOOT sideways into a curved shot.
 prepare();b=page.locator('#shoot-button').bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2
 session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':2}]})
 session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+45,'y':y,'id':2}]})
 session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 page.wait_for_function('__miniFC.match.testLastShot?.type==="finesse"');assert page.evaluate('__miniFC.match.testLastShot.curve')!=0
 # Floating stick starts under a touch in a new location; second touch keeps sprint active.
 prepare();zone=page.locator('#joystick-zone').bounding_box();zx=zone['x']+zone['width']*.65;zy=zone['y']+zone['height']*.5
 sprint=page.locator('#sprint-button').bounding_box();sx=sprint['x']+sprint['width']/2;sy=sprint['y']+sprint['height']/2
 session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':zx,'y':zy,'id':1}]})
 session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':zx+35,'y':zy-25,'id':1}]})
 session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':zx+35,'y':zy-25,'id':1},{'x':sx,'y':sy,'id':2}]})
 assert page.evaluate('__miniFC.input.axes.x')>.3;assert page.evaluate('__miniFC.input.sprint')
 session.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
 assert page.evaluate('__miniFC.input.axes.x===0 && !__miniFC.input.sprint')
 # Contextual defence and real standing tackle.
 page.evaluate('''() => {const m=__miniFC.match;m.kickoffWait=0;Object.assign(m.players[0],{x:0,z:0,dx:0,dz:-1,tackleCooldown:0,stunned:0});Object.assign(m.players[3],{x:0,z:-2,cooldown:0,protected:0});Object.assign(m.ball,{owner:3,x:0,z:-2,lastTeam:1});}''')
 expect(page.locator('#tackle-button')).to_be_visible();expect(page.locator('#shoot-button')).to_be_hidden()
 page.tap('#tackle-button');page.wait_for_function('__miniFC.match.stats.tackles>0')
 page.screenshot(path=str(ARTIFACTS/'touch-6v6.png'))
 page.click('#pause');page.click('#settings');page.click('#touch-layout')
 stopped=page.evaluate('__miniFC.match.elapsed');page.wait_for_timeout(400);assert page.evaluate('__miniFC.match.elapsed')==stopped
 for key,value in [('touchSize','120'),('touchOpacity','65'),('touchInset','40')]:
  page.locator('#'+key).fill(value);page.locator('#'+key).dispatch_event('input')
 assert page.evaluate('__miniFC.settings.touchSize')==120
 page.click('#back');page.click('#back');page.click('#quit');page.reload()
 assert page.evaluate('__miniFC.settings.touchOpacity')==65
 # Local licensed images are read through file input, without network uploads.
 page.click('#settings');page.click('#local-assets');page.select_option('#asset-club','arsenal')
 png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
 for kind in ['crest','kit']:
  page.locator('#asset-'+kind).set_input_files({'name':'licensed-test.png','mimeType':'image/png','buffer':png})
  page.wait_for_function(f'__miniFC.renderer.localAssets.get("arsenal")?.{kind} !== undefined')
 page.click('#back');page.click('#back');page.click('#play');page.fill('#club-search','arsenal');assert page.locator('.local-crest').count()>0
 # Create an Arsenal career; control remains locked and switch is absent.
 page.click('#back');page.click('#career');page.fill('#player-name','Academy');page.select_option('#starting-club','arsenal');page.select_option('#position','Defender');page.click('#create-career')
 assert page.evaluate('__miniFC.career.clubId')=='arsenal'
 page.click('#fixture');assert page.evaluate('__miniFC.match.career')
 page.evaluate('__miniFC.match.kickoffWait=0;__miniFC.match.ball.owner=3;__miniFC.match.players[3].cooldown=5')
 expect(page.locator('#press-button')).to_be_visible();expect(page.locator('#switch-button')).to_be_hidden()
 page.keyboard.press('KeyQ');assert page.evaluate('__miniFC.match.controlled')==0
 page.evaluate('__miniFC.match.ball.owner=1');page.wait_for_timeout(120);assert page.evaluate('__miniFC.match.controlled')==0
 # The close ball camera stays zoomed in even when the locked captain is far away.
 page.evaluate("__miniFC.match.ai=()=>{};__miniFC.match.players[0].x=0;__miniFC.match.players[0].z=24;__miniFC.match.players[1].x=0;__miniFC.match.players[1].z=-28;__miniFC.match.players[1].cooldown=5;__miniFC.match.ball.owner=1")
 page.wait_for_function("(()=>{const r=__miniFC.renderer,v=r.ball.position.clone().project(r.camera);return Math.abs(r.marker.position.z-24)<.1 && Math.abs(v.y)<.06 && Math.abs(v.x)<.06 && r.camera.position.y<35})()")
 assert not errors,errors
 assert not failed,failed
 print(json.dumps({'result':'PASS','clubs':'search, filters, same-club alternate kits, local image import','touch':'charge, chip, through, lob, skill, finesse swipe, floating stick with sprint, cancel, contextual tackle','career':'club selection, role, captain lock, hidden switch','settings':'size, opacity, edge position persist','javascript_errors':errors,'failed_responses':failed}))
 browser.close()
