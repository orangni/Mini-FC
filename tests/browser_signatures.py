"""Career signatures, animated techniques, roster and touch controls in Chromium."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('MINI_FC_URL','http://127.0.0.1:4173/')
ARTIFACTS=Path(os.environ.get('MINI_FC_ARTIFACTS','playwright-results'));ARTIFACTS.mkdir(parents=True,exist_ok=True)
SKILLS=['body-feint','step-over','roulette','double-touch','heel-burst','drag-back','elastico','reverse-elastico','la-croqueta','ball-roll','heel-chop','mcgeady-spin','drag-push','stop-go','scoop-turn','v-drag']
PREPARE="""() => {
 const m=__miniFC.match;m.ai=()=>{};m.kickoffWait=0;m.queuedAction=null;m.random=()=>.5;
 m.players.forEach((p,i)=>Object.assign(p,{x:p.team?20:-20,z:20+i*.5,protected:0,cooldown:0,stunned:0,vx:0,vz:0,skillCooldown:0,skillTime:0,feintTime:0,recovery:0,slideTime:0,stamina:1}));
 Object.assign(m.players[0],{x:0,z:-15,dx:0,dz:-1});Object.assign(m.ball,{owner:0,x:0,z:-15.75,y:.35,vx:0,vz:0,vy:0,followOwner:null});
 __miniFC.input.reset();
 if(!m.signatureSpy){const fn=m.skill.bind(m);m.skill=(id,side)=>{const ok=fn(id,side);if(ok)m.signatureUses.push(m.players[id].skillId);return ok};m.signatureSpy=true;}
 m.signatureUses=[];m.signaturePose=null;
 const renderer=__miniFC.renderer;
 if(!renderer.signatureSpy){
  const draw=renderer.draw.bind(renderer);
  renderer.draw=(match,...args)=>{
   draw(match,...args);
   const p=match.players[0],t=1-p.skillTime/p.skillDuration;
   if(p.skillTime>0 && t>.3 && t<.85 && match.signaturePose===null){
    const model=renderer.models[0];
    match.signaturePose=[model.body.rotation.x,model.body.rotation.y,model.body.rotation.z,model.legs[0].rotation.x,model.legs[0].rotation.z];
   }
  };
  renderer.signatureSpy=true;
 }
}"""
with sync_playwright() as p:
 options={'headless':True,'args':['--enable-unsafe-swiftshader']}
 if os.environ.get('MINI_FC_BROWSER'):options['executable_path']=os.environ['MINI_FC_BROWSER']
 browser=p.chromium.launch(**options)
 context=browser.new_context(viewport={'width':1024,'height':768},is_mobile=True,has_touch=True)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(URL+'?test=1');page.click('#career');page.fill('#player-name','Spin Captain')
 assert page.locator('#signature-skill option').count()==16
 for skill in SKILLS:
  page.select_option('#signature-skill',skill)
  assert page.locator('#skill-preview b').inner_text()
  assert 'PC: C' in page.locator('#skill-preview').inner_text()
 page.select_option('#signature-skill','roulette');page.screenshot(path=str(ARTIFACTS/'choose-signature.png'))
 page.click('#create-career');assert page.evaluate('__miniFC.career.skillId')=='roulette'
 expect(page.locator('.career-signature')).to_contain_text('Roulette')
 page.reload();page.click('#career');assert page.evaluate('__miniFC.career.skillId')=='roulette'
 page.click('#fixture');assert page.evaluate('__miniFC.match.players[0].skillId')=='roulette'
 def prepare():
  page.evaluate(PREPARE);page.wait_for_function('!document.querySelector("#skill-button").hidden')
 # The same C key dispatches all sixteen profiles; rendered body/foot poses differ.
 poses=[]
 for skill in SKILLS:
  prepare();page.evaluate('(id)=>__miniFC.match.players[0].skillId=id',skill);page.keyboard.press('KeyC')
  page.wait_for_function('__miniFC.match.signatureUses.length===1 && __miniFC.match.players[0].skillTime>0')
  assert page.evaluate('__miniFC.match.signatureUses[0]')==skill
  assert page.evaluate('__miniFC.match.controlled')==0
  page.wait_for_function('__miniFC.match.signaturePose!==null')
  pose=page.evaluate('__miniFC.match.signaturePose')
  poses.append(pose)
  expect(page.locator('#skill-button')).to_have_class('cooling')
  expect(page.locator('#skill-button small')).to_contain_text('SKILL')
  page.keyboard.press('KeyC');page.wait_for_timeout(70)
  assert page.evaluate('__miniFC.match.signatureUses.length')==1
 assert len({tuple(round(n,2) for n in pose) for pose in poses})==16,poses
 # Native simultaneous touches: hold shielding during cooldown still works.
 cdp=context.new_cdp_session(page)
 def touch(kind,points):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i,'x':x,'y':y} for i,x,y in points]})
 def center(selector):
  b=page.locator(selector).bounding_box();return b['x']+b['width']/2,b['y']+b['height']/2
 prepare();page.evaluate('__miniFC.match.players[0].skillId="double-touch"')
 page.tap('#skill-button');page.wait_for_function('__miniFC.match.signatureUses.length===1')
 page.wait_for_function('__miniFC.match.players[0].skillTime===0')
 sx,sy=center('#joystick');x,y=center('#skill-button')
 touch('touchStart',[(1,sx,sy)]);touch('touchMove',[(1,sx+25,sy-20)])
 touch('touchStart',[(1,sx+25,sy-20),(2,x,y)])
 page.wait_for_function('__miniFC.match.players[0].shield && __miniFC.input.axes.x>.3')
 page.wait_for_timeout(360);touch('touchEnd',[(2,x,y)]);touch('touchEnd',[])
 page.wait_for_function('!__miniFC.match.players[0].shield')
 assert page.evaluate('__miniFC.match.signatureUses.length')==1
 prepare();touch('touchStart',[(3,x,y)]);touch('touchCancel',[]);page.wait_for_timeout(100)
 assert page.evaluate('__miniFC.match.signatureUses.length===0 && !__miniFC.input.shield')
 # The roster pauses simulation, exposes all twelve signatures, and resumes safely.
 page.click('#pause');page.click('#player-skills')
 assert page.locator('[data-player-skill]').count()==12
 stopped=page.evaluate('__miniFC.match.elapsed');page.wait_for_timeout(250);assert page.evaluate('__miniFC.match.elapsed')==stopped
 page.screenshot(path=str(ARTIFACTS/'player-signatures.png'))
 page.click('#back');page.click('#restart');assert page.evaluate('__miniFC.match.players[0].skillId')=='roulette'
 # Older saves gain the default without losing XP or attributes.
 page.evaluate('''() => {const key='mini-fc-career-v1';const c=JSON.parse(localStorage.getItem(key));delete c.skillId;c.xp=300;c.points=2;c.attributes.pace=66;localStorage.setItem(key,JSON.stringify(c));}''')
 page.reload();page.click('#career')
 assert page.evaluate('__miniFC.career.skillId==="body-feint" && __miniFC.career.xp===300 && __miniFC.career.points===2 && __miniFC.career.attributes.pace===66')
 # Desktop charge help uses keys; the old mobile swipe hint is absent on PC.
 desktop=browser.new_context(viewport={'width':1180,'height':820});pc=desktop.new_page();pc.on('pageerror',lambda e:errors.append(str(e)))
 pc.goto(URL+'?test=1');pc.click('#play');pc.click('#kickoff');pc.evaluate(PREPARE);pc.keyboard.down('KeyJ')
 pc.wait_for_function('__miniFC.input.charge()>.2')
 assert 'K CHIP / F FINESSE' in pc.locator('#shot-power small').inner_text()
 assert 'SWIPE' not in pc.locator('#shot-power small').inner_text()
 pc.keyboard.up('KeyJ')
 assert not errors,errors
 print(json.dumps({'result':'PASS','signature':'sixteen choices/previews, creation/reload/restart, C profile dispatch, sixteen rendered poses, cooldowns, multitouch shielding/cancel, twelve-player paused roster, old-save XP/attributes, desktop key help','javascript_errors':errors}))
 browser.close()
