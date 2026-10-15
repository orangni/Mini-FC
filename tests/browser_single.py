"""Validate the standalone HTML with every extra resource request blocked.
Run npm run build:single first. MINI_FC_SINGLE_HTML can point to another output.
"""
import functools, os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
html=Path(os.environ.get('MINI_FC_SINGLE_HTML','standalone/Mini-FC.html')).resolve()
assert html.is_file(), 'Run npm run build:single first.'
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(html.parent)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/{html.name}'
try:
    with sync_playwright() as p:
        options={'headless':True,'args':['--enable-unsafe-swiftshader']}
        if os.environ.get('MINI_FC_BROWSER'):options['executable_path']=os.environ['MINI_FC_BROWSER']
        browser=p.chromium.launch(**options);context=browser.new_context(viewport={'width':1180,'height':820})
        extra=[];errors=[]
        def route(r):
            if r.request.url.startswith(url):r.continue_()
            else:extra.append(r.request.url);r.abort()
        context.route('**/*',route);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url+'?test=1');page.wait_for_selector('#play')
        page.click('#career');page.fill('#player-name','Standalone Captain');page.click('#create-career');page.reload()
        page.wait_for_selector('#career');page.click('#career');assert page.evaluate('__miniFC.career.name')=='Standalone Captain'
        page.click('#fixture')
        page.evaluate('''() => {const m=__miniFC.match;m.kickoffWait=0;m.players.forEach((p,i)=>{p.x=i%2?20:-20;p.z=15;p.cooldown=5;});Object.assign(m.players[0],{x:0,z:-24,dx:0,dz:-1,cooldown:0});Object.assign(m.ball,{owner:0,x:0,z:-25,y:.35,vx:0,vz:0,vy:0});}''')
        page.keyboard.press('KeyJ');page.wait_for_function('__miniFC.match.score[0]===1')
        page.evaluate('__miniFC.match.kickoffWait=0;__miniFC.match.elapsed=119.99');page.wait_for_function('__miniFC.mode==="results"')
        assert page.evaluate('__miniFC.career.xp')==180
        assert not extra,extra
        assert not errors,errors
        print('PASS: self-contained HTML renders 6v6, scores, awards XP and reloads career saves. Additional resource requests: 0. JavaScript errors: 0.')
        browser.close()
finally:
    server.shutdown();server.server_close()
