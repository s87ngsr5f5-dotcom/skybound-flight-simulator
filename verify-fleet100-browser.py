from pathlib import Path
import sys,json
sys.path.insert(0,str(Path.cwd().parent/'browser-qa'))
from playwright.sync_api import sync_playwright
out=Path('work-qa-fleet100');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',args=['--autoplay-policy=no-user-gesture-required'])
 page=b.new_page(viewport={'width':1280,'height':800})
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 def hook(route):
  s=Path('dist/flight.js').read_text(encoding='utf-8').replace('  const buildingGeo = new THREE.BoxGeometry();','window.fleetQA={aircraftModel,get models(){return models},scene,renderer,get flight(){return flight}};const buildingGeo = new THREE.BoxGeometry();')
  route.fulfill(status=200,content_type="application/javascript",body=s)
 page.route('**/flight.js*',hook)
 page.goto('http://127.0.0.1:8803',timeout=120000)
 page.wait_for_function('window.fleetQA || !document.querySelector("#startupNotice").hidden',timeout=120000)
 page.wait_for_timeout(6000)
 print('errors',errors,flush=True)
 print('startup',page.locator('#startupNotice').inner_text(),flush=True)
 page.screenshot(path=str(out/'startup.png'))
 if not page.evaluate('!!window.fleetQA'):raise RuntimeError('startup failed')
 print(page.evaluate('({n:fleet.length,options:document.querySelector("#aircraft").options.length})'),flush=True)
 # Exercise all models using actual geometry builders; release test-only model data between each build.
 reports=[]
 for i in (range(100) if "--ui" not in sys.argv else []):
  result=page.evaluate('''i=>{let p=fleet[i],m=fleetQA.aircraftModel(p);m.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(m),bad=0,mesh=0,vertices=0,names=[];m.traverse(o=>{if(o.name)names.push(o.name);if(o.isMesh){mesh++;const a=o.geometry?.attributes.position?.array;if(a){vertices+=a.length/3;for(const v of a)if(!Number.isFinite(v))bad++;}}});return {id:p.id,category:p.category,bad,mesh,vertices,size:box.getSize(new THREE.Vector3()).toArray(),names:names.filter(n=>/fin|engine|canard/i.test(n))}}''',i)
  assert result['bad']==0 and all(0<x<200 for x in result['size']),result
  reports.append(result)
  page.evaluate('''id=>{const m=fleetQA.models.get(id);for(const r of [m,m.userData.cabin]){if(!r)continue;r.removeFromParent();r.traverse(o=>{o.geometry?.dispose();if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();});}fleetQA.models.delete(id)}''',result['id'])
  if i%10==0:print('models',i,result['id'],flush=True)
 (out/('model-report.json' if reports else 'ui-model-report.json')).write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
 page.reload(wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.fleetQA',timeout=120000);page.wait_for_timeout(2500)
 page.locator('[data-hub-tab=freeflight]').click();page.locator('#hubOpenHangarBtn').click()
 page.locator('#hangarFilter').select_option('special')
 page.locator('#hangarAircraft').select_option('f22a')
 assert page.locator('#hangarFly').is_disabled()
 page.screenshot(path=str(out/'special-locked.png'))
 # Existing save data grants unlock, refresh renders it; unrelated special remains locked.
 page.evaluate("localStorage.setItem('skybound.campaignProgress.v1',JSON.stringify({6:{stars:1}}));document.querySelector('#hangarAircraft').dispatchEvent(new Event('change'))")
 assert not page.locator('#hangarFly').is_disabled()
 page.locator('#hangarFly').click()
 page.locator('#lesson').select_option('free')
 page.locator('#fly').click(force=True)
 page.wait_for_timeout(2000)
 assert page.evaluate('window.fleetQA.flight?.aircraft.id')=='f22a'
 page.screenshot(path=str(out/'f22-flight.png'))
 print('final errors',errors,flush=True)
 (out/'browser-errors.json').write_text(json.dumps(errors),encoding='utf-8')
 assert not errors,errors
 b.close()
