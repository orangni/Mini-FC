"""Separated English/Korean UI, stable form values, career saves and live controls."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('MINI_FC_URL','http://127.0.0.1:4173/')
ARTIFACTS=Path(os.environ.get('MINI_FC_ARTIFACTS','playwright-results'));ARTIFACTS.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 options={'headless':True,'args':['--enable-unsafe-swiftshader']}
 if os.environ.get('MINI_FC_BROWSER'):options['executable_path']=os.environ['MINI_FC_BROWSER']
 browser=p.chromium.launch(**options);context=browser.new_context(viewport={'width':1024,'height':768},is_mobile=True,has_touch=True)
 page=context.new_page();errors=[];untranslated=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 def audit(name):
  leaked=page.evaluate('''() => {const out=[],w=document.createTreeWalker(document.querySelector('#screen'),NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;if(n.parentElement.closest('[data-raw],.player-card h2,[data-club] b,#choose-home b,#choose-away b,.result-score b,.shirt-club,#language option,#asset-club option,#starting-club option'))continue;const s=n.textContent.trim();if(!/[가-힣]/.test(s)&&/[A-Za-z]{3,}[ .,/]+[A-Za-z]{3,}[ .,/]+[A-Za-z]{3,}/.test(s)&&!s.startsWith('MINI FC'))out.push(s);}return out;}''')
  untranslated.extend([[name,s] for s in leaked])
 page.goto(URL+'?test=1');page.click('#settings');assert page.locator('#language').input_value()=='en'
 page.select_option('#language','ko');expect(page.locator('h1')).to_have_text('설정.')
 assert page.evaluate('document.documentElement.lang')=='ko';audit('settings')
 page.click('#touch-layout');expect(page.locator('label').first).to_contain_text('버튼 크기');audit('touch-layout');page.click('#back');page.click('#back')
 expect(page.locator('#play')).to_contain_text('플레이');audit('main')
 page.screenshot(path=str(ARTIFACTS/'korean-main.png'))
 page.click('#play');expect(page.locator('#club-search')).to_have_attribute('placeholder','구단 검색…');audit('clubs')
 page.fill('#club-search','arsenal');page.click('[data-club="arsenal"]');expect(page.locator('#choose-home small')).to_have_text('우리 팀')
 page.click('#assets');audit('assets');page.click('#back');page.click('#back')
 page.click('#career');audit('create')
 assert page.locator('#signature-skill option').count()==16
 page.fill('#player-name','PASS');page.select_option('#position','Midfielder');page.select_option('#signature-skill','elastico')
 expect(page.locator('#skill-preview b')).to_have_text('엘라스티코')
 assert 'outside' not in page.locator('#skill-preview p').inner_text()
 page.click('#create-career');expect(page.locator('.player-card h2')).to_have_text('PASS')
 assert page.evaluate('__miniFC.career.position')=='Midfielder';audit('career')
 page.evaluate('__miniFC.career.trust=90;__miniFC.career.sharpness=90;__miniFC.career.fitness=100;__miniFC.career.injuryMatches=0');page.click('#fixture');page.evaluate('__miniFC.match.ai=()=>{};__miniFC.match.kickoffWait=0')
 expect(page.locator('#pass-button')).to_contain_text('패스');expect(page.locator('#sprint-button')).to_have_text('질주')
 expect(page.locator('#signature-status')).to_contain_text('엘라스티코')
 page.click('#pause');page.click('#player-skills');audit('roster-ko');assert page.locator('[data-player-skill]').count()==12
 page.click('#back');page.click('#settings');stopped=page.evaluate('__miniFC.match.elapsed');page.select_option('#language','en')
 page.wait_for_timeout(200);assert page.evaluate('__miniFC.match.elapsed')==stopped
 expect(page.locator('h1')).to_have_text('Settings.')
 assert not page.evaluate('/[가-힣]/.test(document.querySelector(".control-guide").textContent)')
 page.click('#back');page.click('#player-skills')
 assert not page.evaluate('/[가-힣]/.test(document.querySelector(".skill-roster").textContent)')
 page.screenshot(path=str(ARTIFACTS/'english-roster.png'))
 page.click('#back');page.click('#settings');page.select_option('#language','ko');page.click('#back');page.click('#resume')
 page.evaluate('__miniFC.match.score=[1,0];__miniFC.match.careerMinutes=90;__miniFC.match.elapsed=119.99');page.wait_for_function('__miniFC.mode==="results"');audit('results')
 expect(page.locator('#next')).to_contain_text('커리어로');page.click('#next');page.click('#upgrades');audit('upgrades');page.click('[data-upgrade="pace"]')
 assert 60.4 <= page.evaluate('__miniFC.career.attributes.pace') < 61
 page.reload();assert page.evaluate('__miniFC.settings.language')=='ko';page.click('#career')
 assert page.evaluate('__miniFC.career.skillId==="elastico" && __miniFC.career.attributes.pace>=60.4 && __miniFC.career.attributes.pace<61 && __miniFC.career.played===1')
 page.click('#back');page.click('#settings');page.select_option('#language','en');page.reload();assert page.evaluate('__miniFC.settings.language')=='en'
 page.click('#career');expect(page.locator('.career-signature b')).to_have_text('Elastico');assert not page.evaluate('/[가-힣]/.test(document.querySelector("#screen").textContent)')
 assert not untranslated,untranslated
 assert not errors,errors
 print(json.dumps({'result':'PASS','languages':'menus, sixteen skill choices, descriptions, HUD, roster, results, upgrades, reload; canonical position values and player name preserved; paused switch keeps timer and save','javascript_errors':errors,'untranslated_sentences':untranslated}))
 browser.close()
