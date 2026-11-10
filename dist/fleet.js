'use strict';
// Additional aircraft are registered by benchmarks.js.
const fleet=[{...trainer,id:'c172s',name:'Cessna 172S',type:'高翼單發教練機',
  geometry:[4.14,.66,5.50,.71,1,.24],gearHeight:1.38,rotation:55,approach:62,
  retract:false,jet:false,missionFuel:145}];
if(typeof module!=='undefined') globalThis.fleet=fleet;
