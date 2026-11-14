import json,pathlib
root=pathlib.Path('dist')
# Each row is a distinct subtype and rounded modelling envelope, NOT certified performance data.
rows='''trainer|p2006t|Tecnam P2006T|8.70|11.40|.62|2|1100|80|high
trainer|c152|Cessna 152|7.34|10.16|.58|1|800|70|high
trainer|pa28|Piper PA-28 Archer|7.32|10.8|.64|1|1050|75|low
trainer|da40|Diamond DA40 NG|8.06|11.94|.62|1|1200|75|low
trainer|da42|Diamond DA42|8.56|13.42|.65|2|1700|90|low
trainer|g58|Beechcraft Baron G58|9.09|11.53|.72|2|2200|100|low
trainer|sr22|Cirrus SR22|7.92|11.68|.70|1|1400|85|low
trainer|c182|Cessna 182T|8.84|10.97|.70|1|1250|75|high
trainer|c206|Cessna 206H|8.61|10.97|.74|1|1450|80|high
trainer|bonanza|Beechcraft Bonanza G36|8.38|10.21|.70|1|1450|90|low
trainer|da20|Diamond DA20|7.16|10.87|.54|1|700|65|low
trainer|extra330|Extra 330SC|6.88|7.50|.55|1|850|85|low
trainer|pc21|Pilatus PC-21|11.23|9.11|.68|1|2800|110|low
prop|tbm930|Daher TBM 930|10.74|12.83|.90|1|3100|100|low
prop|pc12|Pilatus PC-12 NGX|14.40|16.28|1.10|1|4200|105|low
prop|king350|Beechcraft King Air 350|14.22|17.65|.95|2|5400|105|low
prop|atr72|ATR 72-600|27.17|27.05|1.43|2|19000|115|high
prop|atr42|ATR 42-600|22.67|24.57|1.43|2|15000|110|high
prop|q400|De Havilland Dash 8-400|32.84|28.42|1.35|2|24000|125|high
prop|twotter|DHC-6 Twin Otter|15.77|19.81|.95|2|4800|85|high
prop|dornier228|Dornier 228|16.56|16.97|.90|2|4800|90|high
prop|saab340|Saab 340B|19.73|21.44|1.10|2|11000|115|low
prop|c208|Cessna 208B Grand Caravan|12.67|15.88|.85|1|3200|90|high
business|cj4|Cessna Citation CJ4|16.26|15.49|.85|2|6500|110|rear
business|phenom300|Embraer Phenom 300E|15.90|16.20|.90|2|6500|110|rear
business|g650|Gulfstream G650ER|30.41|30.36|1.20|2|35000|140|rear
business|g700|Gulfstream G700|33.48|31.39|1.20|2|39000|145|rear
business|global7500|Bombardier Global 7500|33.80|31.70|1.25|2|39000|140|rear
business|challenger350|Bombardier Challenger 350|20.90|21.00|1.10|2|14000|125|rear
business|falcon7x|Dassault Falcon 7X|23.38|26.21|1.17|3|22000|125|rear
business|falcon8x|Dassault Falcon 8X|24.46|26.29|1.17|3|24000|125|rear
business|hondajet|HondaJet Elite II|12.99|12.12|.76|2|4200|105|overwing
business|lear75|Learjet 75|17.68|15.51|.83|2|8000|125|rear
airliner|a318|Airbus A318-100|31.44|34.10|1.98|2|55000|130|jet
airliner|a319|Airbus A319-100|33.84|34.10|1.98|2|60000|135|jet
airliner|a321neo|Airbus A321neo|44.51|35.80|1.98|2|80000|145|jet
airliner|a333|Airbus A330-300|63.66|60.30|2.82|2|185000|145|jet
airliner|a339|Airbus A330-900|63.66|64.00|2.82|2|195000|145|jet
airliner|a343|Airbus A340-300|63.69|60.30|2.82|4|210000|150|jet
airliner|a346|Airbus A340-600|75.36|63.45|2.82|4|290000|155|jet
airliner|a359|Airbus A350-900|66.80|64.75|2.98|2|230000|145|jet
airliner|a35k|Airbus A350-1000|73.79|64.75|2.98|2|270000|150|jet
airliner|b738|Boeing 737-800|39.47|35.80|1.88|2|67000|140|jet
airliner|b739|Boeing 737-900ER|42.11|35.80|1.88|2|72000|145|jet
airliner|b752|Boeing 757-200|47.32|38.05|1.88|2|90000|145|jet
airliner|b772|Boeing 777-200ER|63.73|60.93|3.10|2|235000|145|jet
airliner|b788|Boeing 787-8|56.72|60.12|2.88|2|195000|140|jet
airliner|b789|Boeing 787-9|62.81|60.12|2.88|2|220000|145|jet
airliner|b78x|Boeing 787-10|68.28|60.12|2.88|2|235000|150|jet
airliner|e190e2|Embraer E190-E2|36.24|33.72|1.50|2|45000|125|jet
airliner|e195e2|Embraer E195-E2|41.60|35.12|1.50|2|52000|130|jet
cargo|b77f|Boeing 777F|63.73|64.80|3.10|2|240000|150|side
cargo|b738bcf|Boeing 737-800BCF|39.47|35.80|1.88|2|65000|140|side
cargo|b752f|Boeing 757-200PF|47.32|38.05|1.88|2|95000|145|side
cargo|a306f|Airbus A300-600F|54.08|44.84|2.82|2|130000|145|side
cargo|a332f|Airbus A330-200F|58.82|60.30|2.82|2|180000|145|side
cargo|md11f|McDonnell Douglas MD-11F|61.21|51.66|3.01|3|210000|155|trijet
cargo|dc10f|McDonnell Douglas DC-10-30F|55.55|50.40|3.01|3|185000|150|trijet
cargo|c130j|Lockheed Martin C-130J|29.79|40.41|1.60|4|50000|105|turboprop
cargo|a400m|Airbus A400M|45.10|42.40|2.10|4|95000|120|turboprop
cargo|c17|Boeing C-17 Globemaster III|53.04|51.75|3.43|4|180000|135|high
fighter|f15c|F-15C Eagle|19.43|13.05|1.10|2|18000|150|twin
fighter|fa18c|F/A-18C Hornet|17.07|11.43|.95|2|14000|140|twin
fighter|f14b|F-14B Tomcat|19.10|19.55|1.10|2|24000|145|twin
fighter|f22a|F-22A Raptor|18.90|13.56|1.10|2|25000|150|twin
fighter|f35a|F-35A Lightning II|15.67|10.70|1.00|1|18000|150|twinfin
fighter|rafalec|Dassault Rafale C|15.30|10.90|.88|2|14000|140|canard
fighter|typhoon|Eurofighter Typhoon|15.96|10.95|.88|2|14000|140|canard
fighter|su27|Sukhoi Su-27|21.94|14.70|1.08|2|22000|150|twin
fighter|mig29|Mikoyan MiG-29|17.32|11.36|.90|2|14000|145|twin
fighter|f104g|F-104G Starfighter|16.66|6.68|.72|1|9500|165|single
fighter|gripenc|Saab JAS 39C Gripen|14.10|8.40|.75|1|10000|135|canard
fighter|t50|KAI T-50 Golden Eagle|13.14|9.45|.72|1|8500|130|single
fighter|hawk|BAE Hawk T2|12.43|9.94|.72|1|6500|120|single
fighter|at3|AIDC AT-3 自強號|12.90|10.46|.75|2|5500|115|single
helicopter|r44|Robinson R44 Raven II|11.66|10.06|.80|1|950|45|rotor
helicopter|bell206|Bell 206B JetRanger|11.82|10.16|.80|1|1300|45|rotor
helicopter|h145|Airbus H145|13.54|10.80|1.00|2|2900|50|rotor
helicopter|s92|Sikorsky S-92A|20.88|17.17|1.45|2|9500|55|rotor'''
data=[]
for line in rows.splitlines():
 c,id,name,L,W,r,n,m,v,layout=line.split('|');L,W,r,m,v=map(float,(L,W,r,m,v));n=int(n)
 prop=c in ('trainer','prop') or layout=='turboprop';jet=not prop and c!='helicopter';h=c=='helicopter';fighter=c=='fighter'
 area=round(W*W/(4.4 if fighter else 9),2)
 p=dict(id=id,name=name,category=c,type={'trainer':'教練／通用','prop':'渦槳／通勤','business':'商務噴射','airliner':'民航客機','cargo':'貨運／運輸','fighter':'戰鬥／訓練','helicopter':'直升機'}[c],mass=m,wingArea=area,inertia=[round(m*W*W*.04),round(m*L*L*.055),round(m*(W*W+L*L)*.04)],cgOffset=.025,geometry=[L/2,r,W/2,r*.75 if layout in ('high','turboprop') else -r*.3,n,0.4 if prop else W*.14],gearHeight=round(max(1.05,r*1.45),2),rotation=v,approach=v,jet=jet,glass=True,retract=c not in ('trainer','helicopter'),reverse=c not in ('trainer','fighter'),flapLift=[0,.25,.49],flapDrag=[0,.035,.085],brakeForce=m*4.8,rollingResistance=m*.15,stallAngle=.35 if fighter else .28,missionFuel=round(m*.18),modelStatus='程序模型 · 待逐型精修',performanceStatus='近似遊戲設定 · 未完成實測校準',layout=layout,noWinglet=True)
 if c not in ('trainer','prop','helicopter'):p['role']='passenger' if c in ('business','airliner') else c
 if h:p.update(helicopter=True,helicopterEngines=n)
 if prop or h:p['power']=round(m*(170 if c=='trainer' else 230))
 if jet:p.update(thrust=round(m*(6 if fighter else 3.4)),cruiseMach=.8 if not fighter else .85,maxMach=2 if fighter else .86,cleanDrag=.024,fuelIdle=m*.0000014,fuelPower=m*.000014,nacelleRadius=round(r*(.59 if layout=='rear' else .53),2))
 if c=='business':p.update(rearEngines=layout=='rear',overwingEngines=layout=='overwing',tTail=layout=='rear',passengers=max(4,round(L*.55)))
 if c=='airliner':p['passengers']=round(L*(4 if r<2 else 5.4));p['rakedTip']=id.startswith(('b78','a35'))
 if c=='cargo':p.update(cargoLimit=round(m*.3),cargoSlotLimit=round(m*.16),sideCargo=layout not in ('turboprop','high'),tailCargo=layout in ('turboprop','high'),tTail=layout in ('turboprop','high'),trijet=layout=='trijet',turboprop=layout=='turboprop')
 if fighter:p.update(sideIntakes=True,twinTail=layout in ('twin','twinfin'),canard=layout=='canard',delta=layout=='canard',noWinglet=True)
 data.append(p)
assert len(data)==79,len(data)
text="'use strict';\n// Rounded reference envelopes; original parametric geometry, not imported OEM assets.\nconst expansionFleet="+json.dumps(data,ensure_ascii=False,indent=2)+";\nfleet.push(...expansionFleet);\n"
text+='''
const fleetCategories={all:'所有機型',trainer:'教練／通用',prop:'渦槳／通勤',business:'商務噴射',airliner:'民航客機',cargo:'貨運／運輸',fighter:'戰鬥／訓練',helicopter:'直升機',special:'任務解鎖'};
const specialAircraft={f14b:{chapter:4,label:'EP.04 海上航艦'},f22a:{chapter:6,label:'EP.06 領空捍衛'},rafalec:{chapter:2,label:'EP.02 城市挑戰'},a35k:{chapter:8,label:'WP.08 跨國遠征'},g700:{chapter:1,label:'EP.01 晨曦首航'},a400m:{chapter:3,label:'EP.03 颱風任務'}};
for(const plane of fleet){
 plane.category ||= plane.helicopter?'helicopter':plane.role==='passenger'?'airliner':plane.role||'trainer';
 plane.modelStatus ||= '既有模型 · 共用幾何修正';
 plane.performanceStatus ||= '既有飛行設定 · 待逐型量測';
 plane.unlock=specialAircraft[plane.id]||null;
}
function aircraftUnlocked(plane){
 if(!plane?.unlock)return true;
 try { const p=JSON.parse(localStorage.getItem('skybound.campaignProgress.v1')||'{}');return Number(p?.[plane.unlock.chapter]?.stars)>=1; }catch{return false;}
}
function fleetMatches(plane,category){return category==='all'||(category==='special'?Boolean(plane.unlock):plane.category===category);}
function aircraftLockText(plane){return aircraftUnlocked(plane)?'已開放':'完成 '+plane.unlock.label+' 解鎖';}
if(typeof module!=='undefined')Object.assign(globalThis,{fleetCategories,expansionFleet,aircraftUnlocked,fleetMatches});
'''
text+="\nObject.assign(fleet.find(p=>p.id==='sa380'),{fullDoubleDeck:true});\nObject.assign(fleet.find(p=>p.id==='sf15'),{sideIntakes:true,twinTail:true});\n"
text+="\nconst fighterShapes={\n f15c:{wingRootChord:4.9,finHeight:2.8,stabilatorSpan:.48},\n fa18c:{wingRootChord:3.8,finHeight:2.2,stabilatorSpan:.50},\n f14b:{wingRootChord:5.0,finHeight:2.5,stabilatorSpan:.55},\n f22a:{wingRootChord:5.6,wingTipRatio:.30,finHeight:2.0,bodyHeight:.69,stabilatorSpan:.55,rectangularNozzle:true,finCant:.36},\n f35a:{wingRootChord:4.1,wingTipRatio:.36,finHeight:2.1,stabilatorSpan:.51,finCant:.32},\n su27:{wingRootChord:5.7,finHeight:2.9,stabilatorSpan:.56},\n mig29:{wingRootChord:4.3,finHeight:2.4,stabilatorSpan:.52},\n f104g:{wingRootChord:2.1,finHeight:2.1,stabilatorSpan:.58,tTail:true},\n rafalec:{wingRootChord:6.5,finHeight:2.2},typhoon:{wingRootChord:6.4,finHeight:2.5},gripenc:{wingRootChord:5.3,finHeight:2.1}\n};\nfor(const p of fleet)Object.assign(p,fighterShapes[p.id]||{});\nfor(const p of fleet.filter(p=>p.category==='prop'&&p.geometry[0]>8)){\n p.role='passenger';p.turboprop=true;p.passengers=Math.max(12,Math.round(p.geometry[0]*5));\n p.nacelleRadius=p.geometry[1]*.4;\n}\n"
(root/'fleet-expansion.js').write_text(text,encoding='utf-8')
print('Added',len(data),'profiles')
