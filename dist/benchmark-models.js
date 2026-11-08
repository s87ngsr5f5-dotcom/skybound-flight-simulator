'use strict';
function buildBenchmarkAirframe(profile,scene){
  const group=new THREE.Group(), gear=new THREE.Group(), cabin=new THREE.Group();
  const [half,radius,span,wingY,engineCount,sweep]=profile.geometry;
  const fighter=profile.role==='fighter', freight=profile.role==='cargo';
  const detailed=profile.role==='passenger'&&engineCount===2;
  const color=fighter?0x778798:freight?0xd9e2e4:0xf2f5f7;
  const surface=new THREE.MeshStandardMaterial({color,roughness:detailed?.39:.57,metalness:fighter?.19:.08});
  const stockColor=profile.trimColor??(freight?0x173d5d:0x146a80);
  const paint=new THREE.MeshStandardMaterial({color:stockColor,roughness:.48});
  const rubber=new THREE.MeshStandardMaterial({color:0x151a1e,roughness:.94});
  const metal=new THREE.MeshStandardMaterial({color:0x667886,roughness:.33,metalness:.59});
  const dark=new THREE.MeshStandardMaterial({color:0x14212b,roughness:.66});
  const glazing=new THREE.MeshPhysicalMaterial({color:0x193944,roughness:.19,metalness:.3,clearcoat:.8});
  const light=new THREE.MeshBasicMaterial({color:0xe4f9ff});
  const green=new THREE.MeshBasicMaterial({color:0x6ee8b3});
  function mesh(parent,geometry,material,x=0,y=0,z=0){
    const part=new THREE.Mesh(geometry,material);
    part.position.set(x,y,z);parent.add(part);return part;
  }
  function block(parent,material,w,h,d,x,y,z){
    return mesh(parent,new THREE.BoxGeometry(w,h,d),material,x,y,z);
  }
  function hull(parent,stations,material,vertical=1){
    const profile=[];
    // Smooth radius transitions without changing the station dimensions.
    for(let i=0;i<stations.length-1;i++){
      const a=stations[i],b=stations[i+1];
      for(let j=0;j<5;j++){
        const t=j/5,e=t*t*(3-2*t);
        profile.push(new THREE.Vector2(a[1]+(b[1]-a[1])*e,a[0]+(b[0]-a[0])*t));
      }
    }
    profile.push(new THREE.Vector2(stations.at(-1)[1],stations.at(-1)[0]));
    const geo=new THREE.LatheGeometry(profile,48);
    geo.rotateX(Math.PI/2);geo.scale(1,vertical,1);
    return mesh(parent,geo,material);
  }
  const noseDoor=new THREE.Group(), sideDoor=new THREE.Group();
  group.add(gear,noseDoor,sideDoor);
  const body=[[-half,.018],[-half*.91,radius*.46],[-half*.77,radius*.89],
    [-half*.63,radius],[half*.52,radius],[half*.70,radius*.85],[half*.91,radius*.37],[half,.04]];
  if(fighter){
    hull(group,[[-half,.02],[-half*.73,radius*.39],[-half*.30,radius*.82],
      [half*.20,radius],[half*.72,radius*.78],[half,radius*.64]],surface,.86);
    const canopy=mesh(group,new THREE.SphereGeometry(1,36,20),glazing,0,.69,-half*.33);
    canopy.scale.set(.67,.57,1.86);
    block(group,metal,.12,.14,1.8,0,1.15,-half*.28);
    if(profile.sideIntakes){
      for(const side of [-1,1]){
        const nacelle=hull(group,[[-half*.32,.33],[-half*.21,.44],[half*.65,.39],[half*.92,.30]],surface,.8);
        nacelle.position.set(side*.60,-.22,0);
        const opening=mesh(group,new THREE.CircleGeometry(.30,22),dark,side*.60,-.22,-half*.32-.01);
        opening.rotation.y=Math.PI;opening.scale.y=.82;
        hull(group,[[half*.84,.34],[half*.96,.32],[half*1.01,.28]],metal).position.set(side*.38,-.12,0);
        mesh(group,new THREE.CircleGeometry(.24,24),dark,side*.38,-.12,half*1.01+.02);
      }
    }else{
    const intake=hull(group,[[-2.3,.62],[-2.05,.67],[1.35,.59],[1.77,.12]],surface,.65);
    intake.position.y=-.61;
    const opening=mesh(group,new THREE.CircleGeometry(.57,32),dark,0,-.64,-2.32);
    opening.scale.y=.66;opening.rotation.y=Math.PI;
    hull(group,[[half-.7,.63],[half-.55,.68],[half-.1,.57],[half,.54]],metal,.89);
    mesh(group,new THREE.CircleGeometry(.46,24),dark,0,0,half+.013);
    }
  }else{
    if(freight&&!profile.sideCargo){
      hull(group,body.slice(2),surface,.96);
      noseDoor.position.set(0,radius*.60,-half*.77);
      const nose=hull(noseDoor,body.slice(0,3).map(([z,r])=>[z+half*.77,r]),surface,.96);
      nose.position.y=-radius*.60;
      sideDoor.position.set(-radius*.99,radius*.64,half*.31);
      block(sideDoor,metal,.12,2.58,3.45,0,-1.29,0);
      block(sideDoor,paint,.15,2.36,3.26,-.08,-1.29,0);
      const hump=mesh(group,new THREE.SphereGeometry(1,36,20),surface,0,radius*.66,-half*.58);
      hump.scale.set(radius*.72,radius*.61,half*.29);
    }else{
      hull(group,body,surface,1.18);
      const lower=hull(group,body.map(([z,r])=>[z,r*.91]),paint,1.06);
      lower.position.y=-radius*.31;
      if(profile.sideCargo){
        sideDoor.position.set(-radius*.96,radius*.49,-half*.49);
        block(sideDoor,metal,.12,2.58,3.45,0,-1.29,0);
        block(sideDoor,paint,.14,2.38,3.25,-.06,-1.29,0);
      }
    }
    if(detailed){
      function skinPoint(z,angle,offset){
        const next=body.findIndex(station=>station[0]>=z);
        const a=body[Math.max(0,next-1)],b=body[Math.max(1,next)];
        const t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0])));
        const r=a[1]+(b[1]-a[1])*t*t*(3-2*t)+offset;
        return [r*Math.sin(angle),r*1.18*Math.cos(angle),z];
      }
      function skinPanel(corners,mat,offset){
        const vertices=[], indices=[];
        const steps=6;
        for(let i=0;i<=steps;i++){
          const t=i/steps;
          for(let j=0;j<=steps;j++){
            const u=j/steps;
            const lo=corners[0].map((n,k)=>n+(corners[1][k]-n)*u);
            const hi=corners[3].map((n,k)=>n+(corners[2][k]-n)*u);
            vertices.push(...skinPoint(lo[0]+(hi[0]-lo[0])*t,lo[1]+(hi[1]-lo[1])*t,offset));
            if(i&&j){
              const a=i*(steps+1)+j,b=a-steps-1;
              indices.push(a,b,a-1,b,b-1,a-1);
            }
          }
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        mesh(group,geometry,mat);
      }
      const windowFrame=new THREE.MeshStandardMaterial({color:0x35434b,roughness:.41,side:THREE.DoubleSide});
      const windshield=glazing.clone();windshield.side=THREE.DoubleSide;
      const seam=new THREE.LineBasicMaterial({color:0x8c989d,transparent:true,opacity:.82});
      const doorZ=[-.65,-.29,.34,.58].map(v=>v*half);
      const windowShape=new THREE.Shape();
      windowShape.moveTo(-.12,-.14);windowShape.lineTo(.12,-.14);
      windowShape.quadraticCurveTo(.20,-.14,.20,-.05);windowShape.lineTo(.20,.05);
      windowShape.quadraticCurveTo(.20,.14,.12,.14);windowShape.lineTo(-.12,.14);
      windowShape.quadraticCurveTo(-.20,.14,-.20,.05);windowShape.lineTo(-.20,-.05);
      windowShape.quadraticCurveTo(-.20,-.14,-.12,-.14);
      const windowGeo=new THREE.ShapeGeometry(windowShape,4);
      const windowPositions=[];
      for(let z=-half*.63;z<half*.65;z+=.83){
        if(doorZ.every(door=>Math.abs(z-door)>.72)) windowPositions.push(z);
      }
      for(const side of [-1,1]){
        for(const [left,right] of [[.08,.44],[.49,.80],[.85,1.12]]){
          const z0=-half*.909+(left-.08)*half*.078;
          const z1=z0+half*.049;
          const outline=[[z0,left*side],[z1,(left-.055)*side],[z1+half*.008,right*side],[z0+half*.014,right*side]];
          skinPanel(outline,windowFrame,.032);
          const center=outline.reduce((mean,p)=>[mean[0]+p[0]/4,mean[1]+p[1]/4],[0,0]);
          skinPanel(outline.map(p=>p.map((value,k)=>center[k]+(value-center[k])*.86)),windshield,.053);
        }
        const windows=new THREE.InstancedMesh(windowGeo,windshield,windowPositions.length);
        const transform=new THREE.Object3D();
        for(const [index,z] of windowPositions.entries()){
          transform.position.set(...skinPoint(z,side*1.38,.03));
          transform.rotation.y=side*Math.PI/2;
          transform.updateMatrix();
          windows.setMatrixAt(index,transform.matrix);
        }
        group.add(windows);
        for(const z of doorZ){
          const corners=[[-.48,1.19],[.48,1.19],[.48,1.19+1.72/(radius*1.18)],[-.48,1.19+1.72/(radius*1.18)],[-.48,1.19]];
          const points=[];
          for(let edge=1;edge<corners.length;edge++){
            for(let i=0;i<8;i++){
              const t=i/8,a=corners[edge-1],b=corners[edge];
              points.push(new THREE.Vector3(...skinPoint(z+a[0]+(b[0]-a[0])*t,side*(a[1]+(b[1]-a[1])*t),.055)));
            }
          }
          points.push(points[0].clone());
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),seam));
        }
      }
      const radome=[];
      for(let i=0;i<=48;i++) radome.push(new THREE.Vector3(...skinPoint(-half*.928,i*Math.PI/24,.024)));
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(radome),seam));
    }else{
      const windshield=mesh(group,new THREE.SphereGeometry(1,28,16),glazing,0,radius*(freight?1.04:.75),-half*.79);
      windshield.scale.set(radius*.68,radius*.17,half*.062);
      for(const side of [-1,1]){
        if(!freight){
          const glassBank=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.27,.48),glazing,engineCount===4?110:55);
          const transform=new THREE.Object3D();
          for(let i=0;i<glassBank.count;i++){
            const y=i<55?radius*.22:radius*.63;
            transform.position.set(side*(radius*(i<55?.98:.86)),y,-half*.64+(i%55)*half*.0225);
            transform.updateMatrix();glassBank.setMatrixAt(i,transform.matrix);
          }
          group.add(glassBank);
        }
        for(const z of [-half*.57,-half*.16,half*.25,half*.55]){
          block(group,metal,.045,1.7,1.06,side*radius*.97,radius*.26,z);
          block(group,surface,.058,1.53,.91,side*radius*.981,radius*.26,z);
        }
      }
    }
  }
  function foil(parent,points,material,depth=.13){
    const shape=new THREE.Shape();
    points.forEach(([x,z],i)=>i===0?shape.moveTo(x,-z):shape.lineTo(x,-z));
    shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);
    return mesh(parent,geometry,material);
  }
  const surfaces=[], flaps=[], lamps=[], fans=[];
  for(const side of [-1,1]){
    const chord=fighter?(profile.sideIntakes?2.85:4.4):half*.51;
    const root=-half*(fighter?.29:.24);
    const tip=root+sweep;
    const wingVertices=[],wingIndices=[],sections=12,slices=24;
    for(let k=0;k<=sections;k++){
      const v=k/sections,rake=profile.rakedTip?Math.max(0,(v-.88)/.12):0;
      const c=chord*(1-.78*v)*(1-rake*.86),lead=root+sweep*v+rake*2.2;
      for(let j=0;j<=slices;j++){
        const angle=j/slices*Math.PI*2,t=(1-Math.cos(angle))/2;
        const thick=5*.10*c*(.2969*Math.sqrt(t)-.126*t-.3516*t*t+.2843*t*t*t-.1036*t*t*t*t);
        const y=(j<=slices/2?1:-1)*thick+.014*c*Math.sin(t*Math.PI)+v*v*.65;
        wingVertices.push(side*span*v,wingY+y,lead+c*t);
      }
    }
    for(let k=0;k<sections;k++)for(let j=0;j<slices;j++){
      const a=k*(slices+1)+j,b=a+slices+1;
      if(side>0)wingIndices.push(a,a+1,b,a+1,b+1,b);else wingIndices.push(a,b,a+1,a+1,b,b+1);
    }
    const wingGeo=new THREE.BufferGeometry();wingGeo.setAttribute('position',new THREE.Float32BufferAttribute(wingVertices,3));wingGeo.setIndex(wingIndices);wingGeo.computeVertexNormals();
    const wingMat=surface.clone();wingMat.side=THREE.DoubleSide;mesh(group,wingGeo,wingMat);
    if(!profile.noWinglet&&!profile.rakedTip){
      const tipFence=block(group,paint,.11,fighter?.28:1.2,.73,side*span,wingY+.42,tip+.3);
      tipFence.rotation.z=-side*.17;
      if(profile.splitWinglet){
        const lower=block(group,paint,.10,.72,.55,side*(span-.16),wingY+.06,tip+.39);
        lower.rotation.z=side*.45;
      }
    }
    foil(group,[[0,half*.57],[side*span*.33,half*.72],[side*span*.33,half*.83],[0,half*.83]],surface).position.y=radius*.08;
    const aileron=new THREE.Group();
    aileron.position.set(side*span*.66,wingY,tip+chord*.23);
    block(aileron,paint,span*.29,.15,chord*.13,0,0,chord*.065);
    group.add(aileron);surfaces.push(aileron);
    const flap=new THREE.Group();
    flap.position.set(side*span*.28,wingY,root+chord*.82);
    block(flap,metal,span*.32,.14,chord*.17,0,0,chord*.085);
    group.add(flap);flaps.push(flap);
    const lamp=mesh(group,new THREE.SphereGeometry(fighter?.085:.19,12,8),
      new THREE.MeshBasicMaterial({color:side===-1?0xed4f49:0x65ffd4}),side*span,wingY+.62,tip+(profile.rakedTip?2.2:0));
    lamps.push(lamp);
    if(!fighter&&engineCount>=2){
      for(const factor of engineCount===4?[.33,.65]:[.38]){
        const engine=new THREE.Group();
        const size=profile.nacelleRadius??(freight?1.43:1.78);
        const length=profile.rakedTip?1.35:1;
        hull(engine,[[-2.8,size*.89],[-2.52,size],[.82,size*.94],[1.8,size*.71]],surface);
        const fan=mesh(engine,new THREE.CircleGeometry(size*.82,32),dark,0,0,-2.68);
        fan.rotation.y=Math.PI;
        const fanGroup=new THREE.Group();engine.add(fanGroup);fans.push(fanGroup);
        const lip=mesh(engine,new THREE.TorusGeometry(size*.91,size*.065,10,40),metal,0,0,-2.72);
        const spinner=mesh(fanGroup,new THREE.ConeGeometry(size*.22,size*.52,24),metal,0,0,-2.70);spinner.rotation.x=-Math.PI/2;
        const exhaust=mesh(engine,new THREE.CircleGeometry(size*.60,32),dark,0,0,1.81);
        for(let v=0;v<20;v++){
          const blade=block(fanGroup,metal,size*.07,size*.70,.08,Math.sin(v*Math.PI/10)*size*.48,Math.cos(v*Math.PI/10)*size*.48,-2.71);
          blade.rotation.z=-v*Math.PI/10-.42;
        }
        if(detailed){
          hull(engine,[[-2.73,size*.91],[-2.55,size*.84],[-2.20,size*.82]],metal);
          hull(engine,[[1.15,size*.72],[1.78,size*.66],[2.18,size*.49],[2.36,size*.43]],metal);
          mesh(engine,new THREE.ConeGeometry(size*.25,.92,28),metal,0,0,2.22).rotation.x=Math.PI/2;
          const pylon=block(engine,surface,size*.47,1.42,2.7,0,1.18,.18);
          pylon.rotation.x=.14;
        }else block(engine,metal,size*.40,1.48,2.3,0,1.06,.14);
        engine.scale.z=length;
        engine.position.set(side*span*factor,wingY-size*.55-.40,root+sweep*factor-1.5);
        group.add(engine);
      }
    }
  }
  const fin=new THREE.Shape();
  fin.moveTo(0,0);fin.lineTo(half*.34,0);fin.lineTo(half*.34,half*(fighter?.41:.36));fin.lineTo(half*.22,half*(fighter?.45:.36));fin.closePath();
  const vertical=mesh(group,new THREE.ExtrudeGeometry(fin,{depth:.17,bevelEnabled:false}),paint,0,radius*.61,half*.51);
  vertical.rotation.y=-Math.PI/2;
  block(group,metal,.11,.48,.32,0,radius,half*.12);
  block(group,metal,.09,.29,.23,0,-radius*.87,half*.16);

  const wheels=[];
  const bogies=fighter?[[0,-half*.54,1],[-1.12,1.3,1],[1.12,1.3,1]]:engineCount===2?[[0,-half*.71,1],[-span*.128,2,profile.mainAxles??2],[span*.128,2,profile.mainAxles??2]]:
    [[0,-half*.71,1],[-span*.128,2,2],[span*.128,2,2],[-radius*.82,7.8,3],[radius*.82,7.8,3]];
  for(const [x,z,axles] of bogies){
    const size=fighter?.32:.58;
    block(gear,metal,.23,profile.gearHeight*.69,.30,x,-profile.gearHeight*.43,z);
    if(detailed){
      mesh(gear,new THREE.CylinderGeometry(.21,.26,profile.gearHeight*.52,12),metal,x,-profile.gearHeight*.35,z);
      mesh(gear,new THREE.CylinderGeometry(.145,.145,profile.gearHeight*.27,12),metal,x,-profile.gearHeight*.65,z);
      block(gear,metal,.28,.20,axles>1?(axles-1)*1.12+.58:.72,x,-profile.gearHeight+size,z);
      const brace=block(gear,metal,.11,profile.gearHeight*.54,.13,x+.33,-profile.gearHeight*.32,z+.21);
      brace.rotation.z=.28;
      const door=block(gear,surface,.09,profile.gearHeight*.39,.91,x+(x<0?-.41:.41),-profile.gearHeight*.29,z);
      door.rotation.z=x<0?-.13:.13;
    }
    for(let a=0;a<axles;a++){
      for(const offset of fighter?[0]:[-.29,.29]){
        const wheel=mesh(gear,new THREE.CylinderGeometry(size,size,fighter?.21:.34,20),rubber,x+offset,-profile.gearHeight+size,z+(a-(axles-1)/2)*1.12);
        wheel.rotation.z=Math.PI/2;wheels.push(wheel);
        for(const sign of [-1,1]){
          const hub=mesh(wheel,new THREE.CylinderGeometry(size*.52,size*.52,.025,16),metal,0,sign*(fighter?.115:.18),0);
          const cap=mesh(wheel,new THREE.CylinderGeometry(size*.21,size*.21,.04,12),dark,0,sign*(fighter?.13:.20),0);
        }
      }
    }
  }

  const panel=new THREE.Group();
  const cabinFloor=new THREE.MeshStandardMaterial({color:0x364352,roughness:.83});
  const seat=new THREE.MeshStandardMaterial({color:freight?0x574c42:0x1c526d,roughness:.88});
  const cabinY=fighter?.2:radius*.17;
  block(panel,dark,fighter?1.37:3.15,.42,.57,0,0,-.84);
  block(panel,metal,fighter?1.32:3.05,.055,.69,0,.25,-.81);
  for(let i=0;i<(fighter?2:5);i++){
    const x=(i-(fighter?.5:2))*(fighter?.59:.58);
    block(panel,green,.42,.18,.035,x,.03,-.522);
    block(panel,dark,.39,.15,.038,x,.03,-.498);
  }
  const stick=fighter?.54:0;
  block(panel,metal,.07,.27,.075,stick,-.27,-.35);
  block(panel,rubber,.12,.09,.14,stick,-.125,-.35);
  panel.position.set(0,cabinY+.13,-half*.56-.63);
  cabin.add(panel);

  const passengerCabin=profile.role==='passenger'?buildPassengerCabin(profile,cabin,group):null;
  const palletMeshes=[];
  if(!fighter){
    block(cabin,cabinFloor,radius*1.63,.15,half*1.35,0,-.78,0);
    for(let i=0;i<8;i++){
      for(const side of [-1,1]){
        block(cabin,light,.15,.07,1.7,side*radius*.52,radius*.71,-half*.54+i*half*.14);

      }
    }
    if(freight){
      for(let i=-13;i<14;i++) block(cabin,metal,3.4,.035,.07,0,-.68,i*1.43);
      for(const slot of palletStations) palletMeshes.push(block(cabin,seat,3.35,1.35,3.8,0,-.01,slot.arm));
    }
  }
  cabin.visible=false;
  scene.add(group,cabin);
  group.userData={gear,blades:fans,surfaces,flaps,navLights:lamps,noseDoor,sideDoor,wheels,cabin,palletMeshes,passengerCabin,half,radius,setLivery:owned=>paint.color.setHex(owned?0x1f9991:stockColor)};
  return group;
}



function buildPassengerCabin(profile,cabin,airframe){
  const [half,radius]=profile.geometry;
  const count=profile.passengers??320;
  const [leftSeats,rightSeats]=profile.seatColumns??(radius>2.4?[4,4]:[3,3]);
  const centerSeats=profile.centerSeats??0;
  const rowSeats=leftSeats+centerSeats+rightSeats;
  const rows=Math.ceil(count/rowSeats);
  const firstZ=-half*.46,lastZ=half*.63;
  const gap=Math.min(.94,(lastZ-firstZ)/Math.max(1,rows-1));
  const seatWidth=centerSeats?.45:Math.min(.47,(radius-.63)/Math.max(leftSeats,rightSeats));
  const seats=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),
    new THREE.MeshStandardMaterial({color:profile.trimColor??0x235774,roughness:.9}),count*2);
  const head=new THREE.InstancedMesh(new THREE.SphereGeometry(.105,10,8),
    new THREE.MeshStandardMaterial({color:0xd9a785,roughness:.94}),count);
  const body=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.145,.24,4,8),
    new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95}),count);
  const matrix=new THREE.Object3D(),colors=[0x477ca9,0x8d424a,0x65816b,0xd3b485,0x624575];
  const slots=[];
  const shell=new THREE.MeshStandardMaterial({color:0xd6dfe3,side:THREE.DoubleSide,roughness:.88});
  const trim=new THREE.MeshStandardMaterial({color:0x516474,roughness:.86});
  const ceiling=new THREE.MeshStandardMaterial({color:0xe4eef2,emissive:0x91c3de,emissiveIntensity:.4});
  const cabinLength=lastZ-firstZ+4;
  const mid=(firstZ+lastZ)/2;
  function block(mat,x,y,z,width,height,length){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,length),mat);
    mesh.position.set(x,y,z);cabin.add(mesh);return mesh;
  }
  block(trim,0,-.72,mid,radius*1.90,.10,cabinLength);
  block(shell,0,1.52,mid,radius*1.87,.13,cabinLength);
  block(ceiling,0,1.43,mid,.22,.045,cabinLength-.7);
  const windows=Math.ceil(cabinLength/1.05);
  for(const side of [-1,1]){
    const x=side*radius*.92;
    block(shell,x,-.23,mid,.07,1.04,cabinLength);
    block(shell,x,1.18,mid,.07,.52,cabinLength);
    for(let n=0;n<windows;n++){
      block(shell,x,.61,mid-cabinLength/2+n*cabinLength/windows,.07,.64,.55);
    }
  }
  const door=new THREE.Group();
  door.position.set(-radius*.94,-.35,-half*.58-.47);
  const doorPanel=new THREE.Mesh(new THREE.BoxGeometry(.09,1.7,.94),
    new THREE.MeshStandardMaterial({color:0xe9f4f9,roughness:.55,metalness:.18}));
  doorPanel.position.set(0,.47,.47);door.add(doorPanel);airframe.add(door);
  for(let i=0;i<count;i++){
    const row=Math.floor(i/rowSeats);
    const column=i%rowSeats;
    const side=column<leftSeats?-1:1;
    const offset=side<0?column:column-leftSeats-centerSeats;
    const inCenter=column>=leftSeats&&column<leftSeats+centerSeats;
    const x=inCenter?(column-leftSeats-(centerSeats-1)/2)*seatWidth:
      side*((centerSeats?1.33:.54)+offset*seatWidth);
    const z=firstZ+row*gap;
    slots.push({x,z});
    matrix.position.set(x,-.46,z);matrix.scale.set(seatWidth*.94,.18,.51);matrix.updateMatrix();seats.setMatrixAt(i*2,matrix.matrix);
    matrix.position.set(x,-.13,z+.26);matrix.scale.set(seatWidth*.94,.76,.13);matrix.updateMatrix();seats.setMatrixAt(i*2+1,matrix.matrix);
    body.setColorAt(i,new THREE.Color(colors[i%colors.length]));
  }
  head.count=body.count=0;
  head.frustumCulled=body.frustumCulled=false;
  cabin.add(seats,head,body);
  let previous=-1;
  function update(f,dt){
    const service=f?.service;
    const boarded=service?.boarded??0;
    door.rotation.y+=(Number(Boolean(service?.door))*1.55-door.rotation.y)*Math.min(1,dt*4);
    ceiling.emissiveIntensity=service?.cabinLights===false?0:.55;
    if(previous===boarded) return;
    previous=boarded;
    head.count=body.count=boarded;
    matrix.scale.set(1,1,1);
    for(let i=0;i<boarded;i++){
      const {x,z}=slots[i];
      matrix.position.set(x,.31,z+.10);matrix.updateMatrix();head.setMatrixAt(i,matrix.matrix);
      matrix.position.set(x,-.05,z+.11);matrix.updateMatrix();body.setMatrixAt(i,matrix.matrix);
    }
    head.instanceMatrix.needsUpdate=body.instanceMatrix.needsUpdate=true;
  }
  return {update,door};
}
