"""Focused production-browser checks for the user-supplied Spanish clubs and kits."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=os.environ.get('MINI_FC_URL','http://127.0.0.1:4173/')
ARTIFACTS=Path(os.environ.get('MINI_FC_ARTIFACTS','playwright-results'));ARTIFACTS.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    options={'headless':True,'args':['--enable-unsafe-swiftshader']}
    if os.environ.get('MINI_FC_BROWSER'):options['executable_path']=os.environ['MINI_FC_BROWSER']
    browser=p.chromium.launch(**options)
    page=browser.new_page(viewport={'width':1180,'height':820},has_touch=True,is_mobile=True)
    errors=[];failed=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('response',lambda r:failed.append(f'{r.status} {r.url}') if r.status>=400 else None)
    page.goto(URL+'?test=1');page.click('#play');page.select_option('#league-filter','LL')
    assert page.locator('[data-club]').count()==20
    page.fill('#club-search','바르셀로나');page.click('[data-club="barcelona"]')
    page.fill('#club-search','레알 마드리드');page.click('[data-club="real-madrid"]')
    page.click('#kickoff');page.wait_for_function('__miniFC.renderer.currentKits.startsWith("barcelona:real-madrid")')
    assert page.evaluate('__miniFC.match.teams.map(c=>c.league)')==['LL','LL']
    assert page.evaluate('__miniFC.renderer.selectedKits.home.pattern')=='stripes'
    assert page.evaluate('__miniFC.renderer.selectedKits.away.shirt')=='#ffffff'
    assert page.evaluate('__miniFC.renderer.models[0].shorts.material.color.getHexString()')=='004d98'
    pixels=page.evaluate('''() => {const ctx=__miniFC.renderer.models[0].jersey.material.map.image.getContext('2d');return [Array.from(ctx.getImageData(4,32,1,1).data).slice(0,3),Array.from(ctx.getImageData(12,32,1,1).data).slice(0,3)];}''')
    assert pixels==[[165,0,68],[0,77,152]],pixels
    page.screenshot(path=str(ARTIFACTS/'barcelona-real-madrid.png'))
    page.click('#pause');page.click('#quit');page.click('#play');page.click('#choose-away')
    page.select_option('#league-filter','LL');page.fill('#club-search','바르셀로나');page.click('[data-club="barcelona"]');page.click('#kickoff')
    page.wait_for_function('__miniFC.renderer.currentKits.startsWith("barcelona:barcelona")')
    assert page.evaluate('__miniFC.renderer.selectedKits.awayAlternate')
    assert page.evaluate('__miniFC.renderer.selectedKits.away.pattern')=='pinstripes'
    assert page.evaluate('__miniFC.renderer.models[3].shorts.material.color.getHexString()')=='e7c76a'
    assert page.evaluate('__miniFC.renderer.models[3].socks[0].material.color.getHexString()')=='e7c76a'
    assert page.evaluate('''() => Array.from(__miniFC.renderer.models[3].jersey.material.map.image.getContext('2d').getImageData(8,32,1,1).data).slice(0,3)''')==[231,199,106]
    page.click('#pause');page.click('#quit');page.click('#career');page.fill('#player-name','La Liga Captain')
    page.select_option('#starting-club','elche');page.select_option('#position','Midfielder');page.click('#create-career')
    assert page.evaluate('__miniFC.career.clubId')=='elche'
    page.click('#fixture');page.wait_for_function('__miniFC.renderer.currentKits.startsWith("elche:")')
    assert page.evaluate('__miniFC.match.teams.every(c=>c.league==="LL")')
    assert page.evaluate('__miniFC.renderer.selectedKits.home.pattern')=='hoop'
    band=page.evaluate('''() => Array.from(__miniFC.renderer.models[0].jersey.material.map.image.getContext('2d').getImageData(32,30,1,1).data).slice(0,3)''')
    assert band==[20,119,75],band
    page.evaluate('''() => {const m=__miniFC.match;m.kickoffWait=0;m.random=()=>.5;m.players.forEach((p,i)=>{p.x=i%2?20:-20;p.z=15;p.cooldown=5;});Object.assign(m.players[0],{x:0,z:-24,dx:0,dz:-1,cooldown:0});Object.assign(m.ball,{owner:0,x:0,z:-25,y:.35,vx:0,vz:0,vy:0});}''')
    page.keyboard.press('KeyJ');page.wait_for_function('__miniFC.match.score[0]===1')
    page.evaluate('__miniFC.match.kickoffWait=0;__miniFC.match.elapsed=119.99');page.wait_for_function('__miniFC.mode==="results"')
    assert page.evaluate('__miniFC.career.xp')==180
    page.reload();page.wait_for_selector('#career');page.click('#career')
    assert page.evaluate('__miniFC.career.clubId')=='elche'
    assert page.evaluate('__miniFC.career.seasonMatch')==1
    assert page.evaluate('__miniFC.career.xp')==180
    assert not errors,errors
    assert not failed,failed
    print(json.dumps({'result':'PASS','La Liga':'20 clubs, Korean search, Barcelona v Madrid selection','kits':'rendered stripes, white Madrid kit, alternate gold kit and matching shorts/socks, Elche chest band','career':'Spanish opponents, real goal, XP, saved club and refresh persistence','javascript_errors':errors,'failed_responses':failed}))
    browser.close()
