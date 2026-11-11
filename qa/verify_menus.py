import sys,functools,http.server,threading,json,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'browser-qa'))
from playwright.sync_api import sync_playwright,expect
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
class Server(http.server.ThreadingHTTPServer):request_queue_size=128;daemon_threads=True
server=Server(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=sys.argv[1] if len(sys.argv)>1 else f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as p:
 for mobile in ([True] if os.environ.get('MOBILE_ONLY') else [False,True]):
  browser=p.webkit.launch() if mobile else p.chromium.launch(channel='msedge')
  page=browser.new_page(**({**p.devices['iPhone 13'],'viewport':{'width':844,'height':390}} if mobile else {'viewport':{'width':1440,'height':900}}))
  page.set_default_timeout(12000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+('/iphone.html' if mobile else '/index.html'),timeout=90000)
  expect(page.locator('#startupNotice')).to_be_hidden(timeout=60000)
  page.select_option('#quality','satellite')
  def press(selector):
   print("Tap",mobile,selector,flush=True)
   a=page.locator(selector)
   if mobile:a.tap()
   else:a.click()
  for mode in ['airline','tactical','naritaCargo','free']:
   press(f'[data-plan-mode="{mode}"]');expect(page.locator(f'[data-plan-mode="{mode}"]')).to_have_attribute('aria-pressed','true')
  press('#openHangar')
  if mobile:press('#hangarControlsToggle')
  page.select_option('#hangarAircraft','b773');press('#exitInspection')
  page.select_option('#aircraft','b773');page.select_option('#departure','RCTP');page.select_option('#destination','RCKH')
  page.select_option('#startType','runway');press('#fly');expect(page.locator('#flightAircraft')).to_be_visible()
  for i in range(3):
   press('#flightBar [data-panel="nav"]');expect(page.locator('#flightNavigation')).to_be_visible()
   press('#flightBar [data-panel="more"]');expect(page.locator('#mobileExtras')).to_be_visible()
   press('#mobileExtras [data-panel="systems"]');expect(page.locator('#systems')).to_be_visible()
   press('#flightBar [data-panel="more"]');press('#touchSettings');expect(page.locator('#quickControls')).to_have_attribute('open','')
   press('#flightBar [data-panel="more"]');expect(page.locator('#quickControls')).not_to_have_attribute('open','')
   expect(page.locator('#mobileExtras')).to_be_visible()
  press('#menu');expect(page.locator('#plan')).to_be_visible()
  page.locator('#quickHighCruise').evaluate('e=>e.closest("details").open=true');press('#quickHighCruise')
  press('#flightBar [data-panel="nav"]');expect(page.locator('#taiwanOverview')).to_be_visible(timeout=30000)
  press('#taiwanOverview');expect(page.locator('body')).to_have_class(__import__('re').compile('overview-active'))
  press('#flightBar [data-panel="more"]');press('#mobileExtras [data-panel="systems"]');expect(page.locator('#systems')).to_be_visible()
  press('#systems .flight-panel-close');expect(page.locator('#systems')).to_be_hidden()
  press('#flightBar [data-panel="more"]');press('#touchSettings');press('#menu')
  expect(page.locator('#quickControls')).not_to_have_attribute('open','')
  expect(page.locator('#plan')).to_be_visible()
  press('[data-quick="duel"]');press('#flightBar [data-panel="nav"]');expect(page.locator('#tacticalPanel')).to_be_visible()
  press('#flightBar [data-panel="more"]');expect(page.locator('#mobileExtras')).to_be_visible()
  # Opening another menu must close the radar rather than leave it over buttons.
  expect(page.locator('#tacticalPanel')).to_be_hidden()
  press('#mobileExtras [data-panel="systems"]');expect(page.locator('#systems')).to_be_visible()
  press('#menu');expect(page.locator('#plan')).to_be_visible()
  if mobile:
   page.set_viewport_size({'width':390,'height':844});press('[data-quick="duel"]')
   for panel in ['nav','more']:
    press(f'#flightBar [data-panel="{panel}"]')
   press('#mobileExtras [data-panel="systems"]');expect(page.locator('#systems')).to_be_visible()
   press('#systems .flight-panel-close');press('#menu')
  assert not errors,errors
  print('Menu audit passed',mobile,flush=True);browser.close()
server.shutdown()


