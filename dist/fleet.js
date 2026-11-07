'use strict';
const fleet=[
  {id:'sb172',name:'SB-172 Meridian',type:'四座單發活塞',mass:1040,wingArea:16.2,power:119000,inertia:[1650,2450,2850],cgOffset:.045,gearHeight:1.75,stallAngle:.28,rotation:51,approach:59,geometry:[4.8,.85,6,.75,1,0]},
  {id:'sb152',name:'SB-152 Lark',type:'雙座單發活塞',mass:730,wingArea:14.9,power:82000,inertia:[1100,1750,1900],cgOffset:.034,gearHeight:1.52,stallAngle:.27,rotation:47,approach:55,geometry:[3.65,.71,5.1,.65,1,0]},
  {id:'sb40',name:'SB-40 Swift',type:'單桿功率活塞',mass:1200,wingArea:13.5,power:126000,inertia:[2080,2540,3000],cgOffset:.03,gearHeight:1.49,stallAngle:.29,rotation:57,approach:67,glass:true,geometry:[4.15,.68,6.05,-.3,1,.38]},
  {id:'sb42',name:'SB-42 Twin',type:'雙發活塞',mass:1650,wingArea:16.3,power:252000,inertia:[3400,3750,4800],cgOffset:.045,gearHeight:1.62,stallAngle:.28,rotation:63,approach:75,glass:true,retract:true,geometry:[4.45,.81,6.72,-.3,2,.5]},
  {id:'sb930',name:'SB-930 Stratus',type:'單發渦槳',mass:2950,wingArea:18,power:620000,inertia:[7200,9000,10200],cgOffset:.052,gearHeight:1.95,stallAngle:.28,rotation:79,approach:89,glass:true,retract:true,reverse:true,geometry:[5.4,.93,6.35,-.3,1,.8]},
  {id:'sb4',name:'SB-4 Vector',type:'雙發渦扇',mass:6500,wingArea:30,power:1450000,inertia:[18500,24900,28000],cgOffset:.065,gearHeight:2.16,stallAngle:.27,rotation:95,approach:105,glass:true,retract:true,jet:true,geometry:[7.9,1.18,7.75,-.4,2,2.7]}
].map(model=>({...model,flapLift:[0,.17,.33],flapDrag:[0,.022,.057],
  brakeForce:model.mass*5.67,rollingResistance:model.mass*.1635}));
if(typeof module!=='undefined') globalThis.fleet=fleet;

