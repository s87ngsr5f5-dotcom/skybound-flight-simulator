'use strict';
function buildBenchmarkAirframe(profile,scene){
  const group=new THREE.Group(), gear=new THREE.Group(), cabin=new THREE.Group();
  const closeDetails=new THREE.Group();
  group.add(closeDetails);
  const [half,radius,span,wingY,engineCount,sweep]=profile.geometry;
  const fighter=profile.role==='fighter', freight=profile.role==='cargo';
  const f16=fighter&&(profile.id==='sf16'||profile.f16Family);
  const antonov=Boolean(profile.antonov), upperDeck=profile.upperDeck;
  const noseLoader=freight&&!profile.sideCargo&&!profile.tailCargo;
  const fuselageHeight=antonov?1.12:noseLoader?1.06:1.18;
  const detailed=profile.role==='passenger'&&engineCount===2;
  const color=fighter?0x778798:freight?0xd9e2e4:0xf2f5f7;
  const panelBump=typeof AeroCraft!=='undefined'?AeroCraft.getPanelBumpTexture(THREE):null;
  const surface=new THREE.MeshPhysicalMaterial({color,roughness:detailed?.30:.44,metalness:fighter?.30:.12,clearcoat:.85,clearcoatRoughness:.12,bumpMap:panelBump,bumpScale:.014});
  const stockColor=profile.trimColor??(fighter?0x556571:freight?0x173d5d:0x146a80);
  const paint=new THREE.MeshPhysicalMaterial({color:stockColor,roughness:.32,clearcoat:.85,clearcoatRoughness:.12,bumpMap:panelBump,bumpScale:.012});
  const rubber=new THREE.MeshStandardMaterial({color:0x151a1e,roughness:.94});
  const metal=new THREE.MeshStandardMaterial({color:0x667886,roughness:.28,metalness:.68});
  const dark=new THREE.MeshStandardMaterial({color:0x14212b,roughness:.66});
  const glazing=new THREE.MeshPhysicalMaterial({color:0x152932,roughness:.06,metalness:.85,clearcoat:1.0,clearcoatRoughness:.05,transparent:true,opacity:.88});
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
      for(let j=0;j<8;j++){
        const t=j/8,e=t*t*(3-2*t);
        profile.push(new THREE.Vector2(a[1]+(b[1]-a[1])*e,a[0]+(b[0]-a[0])*t));
      }
    }
    profile.push(new THREE.Vector2(stations.at(-1)[1],stations.at(-1)[0]));
    const geo=new THREE.LatheGeometry(profile,80);
    geo.rotateX(Math.PI/2);geo.scale(1,vertical,1);
    return mesh(parent,geo,material);
  }
  const noseDoor=new THREE.Group(), sideDoor=new THREE.Group();
  let cargoRamp=null;
  group.add(gear,noseDoor,sideDoor);
  const body=[[-half,.018],[-half*.91,radius*(antonov?.66:upperDeck?.55:.46)],[-half*.77,radius*(antonov?.97:.89)],
    [-half*.63,radius],[half*(antonov?.56:.52),radius],[half*.70,radius*.85],[half*.91,radius*.37],[half,.04]];
  function bodyRadius(z){
    const next=body.findIndex(station=>station[0]>=z);
    const a=body[Math.max(0,next-1)],b=body[Math.max(1,next)];
    const t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0])));
    return a[1]+(b[1]-a[1])*t*t*(3-2*t);
  }
  const cockpitGlassMats=[glazing];
  if(fighter){
    const radome=surface.clone();
    radome.color.setHex(0x54616b);
    hull(group,[[-half,.014],[-half*.91,radius*.17],[-half*.73,radius*.39]],radome,.86);
    if(!f16&&typeof AeroCraft!=='undefined'){
      const wide=profile.twinTail||engineCount===2,flat=profile.rectangularNozzle;
      const w=wide?1.45:1;
      const fighterHull=AeroCraft.buildFuselageLoft([
        {z:-half*.73,rx:radius*.39,ryTop:radius*.34,ryBot:radius*.31,y:0,power:2},
        {z:-half*.43,rx:radius*.68,ryTop:radius*.58,ryBot:radius*.48,y:0,power:flat?2.7:2},
        {z:-half*.13,rx:radius*w,ryTop:radius*(flat?.46:.72),ryBot:radius*.52,y:0,power:flat?3.1:2.4},
        {z:half*.35,rx:radius*w,ryTop:radius*(flat?.43:.74),ryBot:radius*.49,y:0,power:flat?3.1:2.4},
        {z:half*.74,rx:radius*(wide?1.06:.76),ryTop:radius*.45,ryBot:radius*.38,y:0,power:2.5},
        {z:half,rx:radius*(wide?.85:.57),ryTop:radius*.38,ryBot:radius*.34,y:0,power:2.5}
      ],32);
      mesh(group,fighterHull,surface).name=profile.id+' blended fighter fuselage';
    }else{
      hull(group,[[-half*.73,radius*.39],[-half*.30,radius*.82],[half*.20,radius],
        [half*.72,radius*.78],[half,radius*.64]],surface,profile.bodyHeight??.86);
    }
    const canopyZ=-half*(f16?.41:profile.sideIntakes?.39:.36),canopyY=radius*(f16?.53:.45);
    const canopyLength=half*(f16?.24:profile.sideIntakes?.20:.21);
    const canopyWidth=radius*(profile.sideIntakes?.46:.43);
    const canopyHeight=radius*(f16?.33:.24);
    const canopyBase=mesh(group,new THREE.SphereGeometry(1,32,14),paint,0,canopyY-.015,canopyZ);
    canopyBase.scale.set(canopyWidth+.018,.055,canopyLength+.055);
    const canopyGeo=typeof AeroCraft!=='undefined'
      ?AeroCraft.buildCanopyGeometry(canopyLength*2.05,canopyWidth*2,canopyHeight,18,24,{streamlined:true})
      :new THREE.SphereGeometry(1,40,18,0,Math.PI*2,0,Math.PI/2);
    const canopy=mesh(group,canopyGeo,glazing,0,canopyY,canopyZ);
    if(typeof AeroCraft==='undefined') canopy.scale.set(canopyWidth,canopyHeight,canopyLength);
    canopy.rotation.x=-.055;
    canopy.name=f16?'F16 bubble canopy':'Fighter canopy';
    if(typeof AeroCraft!=='undefined'){
      mesh(group,AeroCraft.buildCanoeGeometry(half*.30,canopyWidth*.84,canopyHeight*.52),surface,0,canopyY-.01,canopyZ+canopyLength*.92);
    }
    const seam=[];
    for(let i=0;i<=40;i++){
      const t=i*Math.PI/20;
      seam.push(new THREE.Vector3(Math.cos(t)*(canopyWidth+.012),canopyY+.008,canopyZ+Math.sin(t)*(canopyLength+.012)));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(seam),new THREE.LineBasicMaterial({color:0x3d4c56})));
    const probe=mesh(group,new THREE.CylinderGeometry(.014,.032,.30,10),metal,0,0,-half-.13);
    probe.rotation.x=Math.PI/2;
    if(profile.id==='sf16'||profile.f16Family){
      for(const side of [-1,1]){
        const strake=foil(group,[[side*.45,-half*.55],[side*1.44,-half*.13],
          [side*1.26,half*.09],[side*.55,half*.12]],surface,.078);
        strake.position.y=-.10;
        const ventral=foil(group,[[0,half*.52],[-.50,half*.82],[-.45,half*.91],[0,half*.92]],paint,.05);
        ventral.rotation.z=Math.PI/2-side*.23;
        ventral.position.set(side*.49,-.50,0);
      }
    }
    if(profile.sideIntakes){
      for(const side of [-1,1]){
        const intakeZ=-half*(profile.delta?.42:.32),intakeSide=side*(profile.wideIntakes?.78:.60);
        const nacelle=hull(group,[[intakeZ,.33],[intakeZ+.72,.44],[half*.65,.39],[half*.92,.30]],surface,.8);
        nacelle.position.set(intakeSide,-.22,0);
        const opening=mesh(group,new THREE.CircleGeometry(.30,22),dark,intakeSide,-.22,intakeZ-.01);
        opening.rotation.y=Math.PI;opening.scale.y=.82;
        if(profile.delta){
          const spike=mesh(group,new THREE.ConeGeometry(.21,.6,18),metal,intakeSide-side*.10,-.22,intakeZ-.14);
          spike.rotation.x=-Math.PI/2;
        }else if(engineCount===2){
          const exhaust=side*(profile.wideIntakes?.46:.38);
          hull(group,[[half*.84,.34],[half*.96,.32],[half*1.01,.28]],metal).position.set(exhaust,-.12,0);
          mesh(group,new THREE.CircleGeometry(.24,24),dark,exhaust,-.12,half*1.01+.02);
        }
      }
      if(profile.delta||engineCount===1){
        hull(group,[[half-.75,.59],[half-.23,.60],[half,.51]],metal,.92);
        mesh(group,new THREE.CircleGeometry(.45,32),dark,0,0,half+.014);
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
    let upperSkin=null;
    if(noseLoader){
      hull(group,body.slice(2),surface,fuselageHeight);
      noseDoor.position.set(0,radius*.60,-half*.77);
      const nose=hull(noseDoor,body.slice(0,3).map(([z,r])=>[z+half*.77,r]),surface,fuselageHeight);
      nose.position.y=-radius*.60;
      if(!antonov){
        sideDoor.position.set(-radius*.99,radius*.64,half*.31);
        block(sideDoor,metal,.12,2.58,3.45,0,-1.29,0);
        block(sideDoor,paint,.15,2.36,3.26,-.08,-1.29,0);
      }
      const openingZ=-half*.77+.045;
      block(group,dark,radius*1.39,radius*1.13,.11,0,-radius*.14,openingZ);
      if(antonov){
        cargoRamp=new THREE.Group();
        cargoRamp.position.set(0,-radius*.62,openingZ-.13);
        const width=radius*1.43,length=12.7;
        block(cargoRamp,metal,width,.23,length,0,-.10,-length/2);
        for(const side of [-1,1]) block(cargoRamp,paint,.12,.15,length,side*(width/2-.11),.06,-length/2);
        for(let i=1;i<=16;i++) block(cargoRamp,dark,width-.20,.035,.074,0,.039,-i*length/17);
        cargoRamp.visible=false;
        cargoRamp.rotation.x=1.45;
        group.add(cargoRamp);
      }
    }else{
      hull(group,body,surface,fuselageHeight);
      if(profile.sideCargo){
        sideDoor.position.set(-radius*.96,radius*.49,-half*.49);
        block(sideDoor,metal,.12,2.58,3.45,0,-1.29,0);
        block(sideDoor,paint,.14,2.38,3.25,-.06,-1.29,0);
      }
    }
    if(upperDeck){
      const long=upperDeck==='long';
      const front=-half*.896,back=-half*(long?.11:.35);
      upperSkin=(z,angle,offset=0)=>{
        const t=(z-front)/(back-front);
        const section=THREE.MathUtils.smoothstep(t,0,.26)*(1-THREE.MathUtils.smoothstep(t,long?.66:.54,1));
        return [Math.sin(angle)*(radius*.73*section+offset),
          bodyRadius(z)*fuselageHeight-.65+Math.cos(angle)*(radius*.77*section+offset),z];
      };
      const coordinates=[],faces=[],rings=40,slices=48;
      for(let row=0;row<=rings;row++){
        const z=front+(back-front)*row/rings;
        for(let index=0;index<=slices;index++){
          coordinates.push(...upperSkin(z,index*Math.PI*2/slices));
          if(row&&index){
            const a=row*(slices+1)+index,b=a-slices-1;
            faces.push(a-1,b,b-1,a-1,a,b);
          }
        }
      }
      const upperGeometry=new THREE.BufferGeometry();
      upperGeometry.setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));
      upperGeometry.setIndex(faces);
      upperGeometry.computeVertexNormals();
      mesh(group,upperGeometry,surface).name='747 raised upper deck';
    }
    if(antonov){
      for(const side of [-1,1]){
        const fairing=mesh(group,new THREE.SphereGeometry(1,40,22),surface,side*radius*.80,-radius*.53,half*.085);
        fairing.scale.set(radius*.35,radius*.32,half*.42);
      }
    }
    {
      function skinPoint(z,angle,offset,onUpperDeck=false){
        if(onUpperDeck&&upperSkin) return upperSkin(z,angle,offset);
        const r=bodyRadius(z)+offset;
        return [r*Math.sin(angle),r*fuselageHeight*Math.cos(angle),z];
      }
      function skinPanel(corners,mat,offset,onUpperDeck=true){
        const vertices=[], indices=[];
        const steps=6;
        for(let i=0;i<=steps;i++){
          const t=i/steps;
          for(let j=0;j<=steps;j++){
            const u=j/steps;
            const lo=corners[0].map((n,k)=>n+(corners[1][k]-n)*u);
            const hi=corners[3].map((n,k)=>n+(corners[2][k]-n)*u);
            vertices.push(...skinPoint(lo[0]+(hi[0]-lo[0])*t,lo[1]+(hi[1]-lo[1])*t,offset,onUpperDeck));
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
      cockpitGlassMats.push(windshield);
      if(noseLoader){
        const stripe=paint.clone();stripe.side=THREE.DoubleSide;
        for(const side of [-1,1]) for(const [start,end] of [[-.70,-.47],[-.47,.43],[.43,.72]]){
          const a=half*start,b=half*end;
          skinPanel([[a,side*1.68],[b,side*1.68],[b,side*1.78],[a,side*1.78]],stripe,.039,false);
        }
      }
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
      for(let z=-half*.63;!freight&&z<half*.65;z+=.83){
        if(doorZ.every(door=>Math.abs(z-door)>.72)) windowPositions.push(z);
      }
      for(const side of [-1,1]){
        const panePairs=profile.fullDoubleDeck?[[.32,.66],[.70,.98],[1.02,1.26]]:[[.08,.44],[.49,.80],[.85,1.12]];
        for(const [left,right] of panePairs){
          const z0=half*(upperSkin?-.82:profile.fullDoubleDeck?-.885:antonov?-.768:-.909)+(left-panePairs[0][0])*half*.05;
          const z1=z0+Math.min(1.18,half*.042);
          const outline=[[z0,left*side],[z1,(left-.048)*side],[z1+half*.007,right*side],[z0+half*.012,right*side]];
          skinPanel(outline,windowFrame,.016);
          const center=outline.reduce((mean,p)=>[mean[0]+p[0]/4,mean[1]+p[1]/4],[0,0]);
          skinPanel(outline.map(p=>p.map((value,k)=>center[k]+(value-center[k])*.86)),windshield,.026);
        }
        const rows=freight?[]:profile.fullDoubleDeck?[1.44,.91]:[1.38];
        const upperWindows=upperSkin?Array.from({length:upperDeck==='long'?19:4},(_,i)=>-half*.70+i*.70):[];
        if(freight&&!upperWindows.length) continue;
        const windows=new THREE.InstancedMesh(windowGeo,windshield,windowPositions.length*rows.length+upperWindows.length);
        const transform=new THREE.Object3D();
        let index=0;
        for(const angle of rows){
          for(const z of windowPositions){
            transform.position.set(...skinPoint(z,side*angle,.035));
            transform.rotation.set(-side*(Math.PI/2-angle),side*Math.PI/2,0,'YXZ');
            transform.updateMatrix();
            windows.setMatrixAt(index++,transform.matrix);
          }
        }
        for(const z of upperWindows){
          transform.position.set(...skinPoint(z,side*1.34,.038,true));
          transform.rotation.set(-side*.23,side*Math.PI/2,0,'YXZ');
          transform.updateMatrix();
          windows.setMatrixAt(index++,transform.matrix);
        }
        group.add(windows);
        if(freight) continue;
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
      if(!upperSkin&&!noseLoader){
        const radome=[];
        for(let i=0;i<=48;i++) radome.push(new THREE.Vector3(...skinPoint(-half*.928,i*Math.PI/24,.024)));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(radome),seam));
      }
      if(freight&&!upperSkin) windowGeo.dispose();
      const panels=[];
      const bandPositions=noseLoader?[-.77,.25,.56,.75]:[-.76,-.41,.12,.54,.73];
      for(const ratio of bandPositions){
        for(let i=0;i<40;i++){
          for(const index of [i,i+1]) panels.push(...skinPoint(half*ratio,index*Math.PI/20,.019));
        }
      }
      for(const side of [-1,1]){
        for(const ratio of [-.54,-.24,.20,.45]){
          const z=half*ratio;
          const corners=[[z-.40,1.88],[z+.40,1.88],[z+.40,1.88+.46/radius],[z-.40,1.88+.46/radius]];
          for(let i=0;i<4;i++) for(const [u,angle] of [corners[i],corners[(i+1)%4]]){
            panels.push(...skinPoint(u,angle*side,.036));
          }
        }
      }
      const panelGeometry=new THREE.BufferGeometry();
      panelGeometry.setAttribute('position',new THREE.Float32BufferAttribute(panels,3));
      const panelLines=new THREE.LineSegments(panelGeometry,new THREE.LineBasicMaterial({color:0x77838b,transparent:true,opacity:.35}));
      panelLines.name='Fuselage service panels';
      closeDetails.add(panelLines);
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
  const surfaces=[], flaps=[], lamps=[], fans=[], airBrakes=[], exhaustPlumes=[], strobes=[], beacons=[];
  if(fighter){
    const twin=engineCount===2;
    const nozzleZ=half*(twin?1.01:1)+.035;
    for(const x of twin?[-1,1].map(side=>side*(profile.wideIntakes?.46:.38)):[0]){
      const plume=new THREE.Group();
      plume.position.set(x,twin?-.12:0,nozzleZ);
      const nozzle=twin?.25:.43;
      const layers=[
        [nozzle,3.8,0xff3122,.54],
        [nozzle*.67,2.8,0xff7025,.79],
        [nozzle*.37,1.35,0xffd28c,.92]
      ];
      for(const [width,length,color,opacity] of layers){
        const fire=new THREE.Mesh(new THREE.ConeGeometry(width,length,22,true),new THREE.MeshBasicMaterial({
          color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,toneMapped:false
        }));
        fire.rotation.x=Math.PI/2;
        fire.position.z=length/2;
        plume.add(fire);
      }
      for(let d=1;d<=4;d++){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(nozzle*.32*(1-d*.12),.028,8,20),new THREE.MeshBasicMaterial({
          color:0xa5f3fc,transparent:true,opacity:.88,toneMapped:false
        }));
        ring.position.z=d*.55;
        plume.add(ring);
      }
      plume.visible=false;
      group.add(plume);
      exhaustPlumes.push(plume);
    }
  }
  for(const side of [-1,1]){
    const chord=profile.wingRootChord??(profile.delta?half*.88:fighter?(profile.wideIntakes?3.65:profile.sideIntakes?2.85:4.4):half*.51);
    // F-16's clipped swept wing must not inherit the shallow generic wing sweep.
    const wingSweep=f16?3.10:profile.delta?half*.77:sweep;
    const root=-half*(profile.delta?.39:f16?.265:fighter?.29:.24);
    const tip=root+wingSweep;
    const tipRatio=profile.wingTipRatio??.24;
    const wingV=f=>Math.max(0,Math.min(1,(span*f-radius*.68)/Math.max(.5,span-radius*.68)));
    const wingRake=v=>profile.rakedTip?Math.max(0,(v-.88)/.12):0;
    const wingChordAt=v=>{const r=wingRake(v),yehudi=(!fighter&&v<.32)?Math.sin(v/.32*Math.PI*.5)*.14*chord:0;return chord*(1-(1-tipRatio)*v)*(1-r*.84)+yehudi;};
    const wingLeadAt=v=>root+wingSweep*v+wingRake(v)*2.1;
    const wingDihedralY=v=>wingY+v*v*(antonov?-1.15:fighter?-.05:.72);
    if(typeof AeroCraft!=='undefined'){
      // True multi-station cambered supercritical NACA airfoil loft with Yehudi trailing-edge kink, dihedral & washout
      const wingStations=[];
      const sections=18;
      for(let k=0;k<=sections;k++){
        const v=k/sections;
        wingStations.push({
          x:radius*.68+v*(span-radius*.68),
          leadZ:wingLeadAt(v),
          chord:wingChordAt(v),
          y:wingDihedralY(v),
          thick:fighter?(.065-.02*v):(.135-.045*v),
          camber:fighter?.010:(.026-.010*v),
          twist:fighter?(-.02*v):(.025-.055*v),
          tipCurlY:profile.rakedTip?.18:0
        });
      }
      const wingGeo=AeroCraft.buildWingLoft(wingStations,{slices:32,capTip:true,mirror:side<0});
      const wingMat=surface.clone();wingMat.side=THREE.DoubleSide;
      const mainWing=mesh(group,wingGeo,wingMat);
      mainWing.name=(f16?'F16':profile.id)+(side<0?' port main wing':' starboard main wing');
      // Karman blended wing-body root fairing
      if(!fighter){
        const kGeo=AeroCraft.buildCanoeGeometry(chord*1.42,radius*.44,radius*.30);
        mesh(group,kGeo,surface,side*radius*.78,wingY+.05,root+chord*.45);
      }
      // Sculpted underwing flap-track canoe fairings tucked strictly inside trailing edge
      if(!fighter&&engineCount>=2){
        for(const cf of [.24,.48,.68]){
          const cv=wingV(cf),c=wingChordAt(cv),podLen=Math.min(c*.52,chord*.36);
          const pod=mesh(group,AeroCraft.buildCanoeGeometry(podLen,Math.min(radius*.055,.14),Math.min(radius*.048,.12)),surface,
            side*span*cf,wingDihedralY(cv)-c*.045-radius*.045,wingLeadAt(cv)+c*.58);
          pod.rotation.x=-.04;
        }
      }
      // Curved blended winglet (airliners) or streamlined wingtip missile launch rail (fighters)
      const tipWy=wingDihedralY(1.0),tipC=wingChordAt(1.0),tipLz=wingLeadAt(1.0);
      if(f16||(!profile.noWinglet&&!profile.rakedTip)){
        if(fighter){
          mesh(group,AeroCraft.buildCanoeGeometry(Math.min(2.35,tipC*1.9),.055,.055),paint,side*span,tipWy-.01,tipLz+tipC*.45);
          // F-16 tactical stores are owned by the live loadout, not baked into its mesh.
          if(!f16){
            const tipMsl=AeroCraft.buildAeroMissile(Math.min(2.55,tipC*2.0),.062,surface,paint,dark);
            tipMsl.position.set(side*(span+(side>0?.07:-.07)),tipWy-.03,tipLz+tipC*.42);
            group.add(tipMsl);
          }
        }else{
          const wHeight=Math.min(span*.09,upperDeck==='long'?2.65:2.15);
          const wChord=Math.max(.35,Math.min(chord*.24,tipC*1.05));
          const wlGeo=AeroCraft.buildBlendedWinglet(wChord,wHeight,wHeight*.65,.34,side<0);
          mesh(group,wlGeo,paint,side*(span-.05),tipWy-.02,tipLz+tipC*.04);
          if(profile.splitWinglet){
            const lowerWl=AeroCraft.buildBlendedWinglet(wChord*.82,wHeight*.44,wHeight*.28,.48,side<0);
            const lwMesh=mesh(group,lowerWl,paint,side*(span-.09),tipWy-.04,tipLz+tipC*.08);
            lwMesh.scale.y=-1;
          }
        }
      }
      // Contoured swept NACA horizontal stabilizer (zero flat slabs)
      if(!profile.delta){
        const hRootZ=half*.54,hTipZ=half*.73,hSpan=span*(profile.stabilatorSpan??(f16?.55:fighter?.36:.33)),hY=profile.tTail?radius*.62+half*.34:radius*(fighter?-.02:.10);
        const hGeo=AeroCraft.buildWingLoft([
          {x:radius*.34,leadZ:hRootZ,chord:half*(f16?.26:.19),y:hY,thick:.09,camber:0,twist:0},
          {x:hSpan,leadZ:hTipZ,chord:half*.085,y:hY+(fighter?-.06:.18),thick:.075,camber:0,twist:-.02}
        ],{slices:20,capTip:true,mirror:side<0});
        const stabilator=mesh(group,hGeo,wingMat);
        stabilator.name=(f16?'F16':profile.id)+(side<0?' port stabilator':' starboard stabilator');
      }
    }else{
      const wingVertices=[],wingIndices=[],sections=20,slices=32;
      for(let k=0;k<=sections;k++){
        const v=k/sections,rake=profile.rakedTip?Math.max(0,(v-.88)/.12):0;
        const c=chord*(1-.78*v)*(1-rake*.86),lead=root+sweep*v+rake*2.2;
        for(let j=0;j<=slices;j++){
          const angle=j/slices*Math.PI*2,t=(1-Math.cos(angle))/2;
          const thick=5*.10*c*(.2969*Math.sqrt(t)-.126*t-.3516*t*t+.2843*t*t*t-.1036*t*t*t*t);
          const y=(j<=slices/2?1:-1)*thick+.014*c*Math.sin(t*Math.PI)+v*v*(antonov?-1.15:.65);
          wingVertices.push(side*span*v,wingY+y,lead+c*t);
        }
      }
      for(let k=0;k<sections;k++)for(let j=0;j<slices;j++){
        const a=k*(slices+1)+j,b=a+slices+1;
        if(side>0)wingIndices.push(a,a+1,b,a+1,b+1,b);else wingIndices.push(a,b,a+1,a+1,b,b+1);
      }
      const wingGeo=new THREE.BufferGeometry();wingGeo.setAttribute('position',new THREE.Float32BufferAttribute(wingVertices,3));wingGeo.setIndex(wingIndices);wingGeo.computeVertexNormals();
      const wingMat=surface.clone();wingMat.side=THREE.DoubleSide;mesh(group,wingGeo,wingMat);
    }
    if(profile.canard){
      const canard=mesh(group,AeroCraft.buildWingLoft([
        {x:radius*.65,leadZ:-half*.52,chord:half*.20,y:radius*.12,thick:.07,camber:0},
        {x:span*.39,leadZ:-half*.37,chord:half*.07,y:radius*.14,thick:.06,camber:0}
      ],{slices:16,mirror:side<0}),surface);
      canard.name=profile.id+' canard';
    }
    const aV0=wingV(.54),aV1=wingV(.82),aC0=wingChordAt(aV0),aC1=wingChordAt(aV1);
    const aTE0=wingLeadAt(aV0)+aC0*.84,aTE1=wingLeadAt(aV1)+aC1*.84;
    const aileron=new THREE.Group();
    aileron.position.set(side*span*.54,wingDihedralY(aV0),aTE0);
    if(typeof AeroCraft!=='undefined'){
      const aGeo=AeroCraft.buildWingLoft([
        {x:0,leadZ:0,chord:aC0*.18,y:0,thick:.09,camber:.01},
        {x:span*.28,leadZ:aTE1-aTE0,chord:aC1*.18,y:wingDihedralY(aV1)-wingDihedralY(aV0),thick:.08,camber:.01}
      ],{slices:12,capTip:false,mirror:side<0});
      aileron.add(new THREE.Mesh(aGeo,paint));
    }else{
      block(aileron,paint,span*.28,.15,aC0*.16,side*span*.14,0,aC0*.08);
    }
    group.add(aileron);surfaces.push(aileron);
    const fV0=wingV(.22),fV1=wingV(.48),fC0=wingChordAt(fV0),fC1=wingChordAt(fV1);
    const fTE0=wingLeadAt(fV0)+fC0*.82,fTE1=wingLeadAt(fV1)+fC1*.82;
    const flap=new THREE.Group();
    flap.position.set(side*span*.22,wingDihedralY(fV0)-.02,fTE0);
    if(typeof AeroCraft!=='undefined'){
      const fGeo=AeroCraft.buildWingLoft([
        {x:0,leadZ:0,chord:fC0*.20,y:0,thick:.10,camber:.025},
        {x:span*.26,leadZ:fTE1-fTE0,chord:fC1*.20,y:wingDihedralY(fV1)-wingDihedralY(fV0),thick:.09,camber:.025}
      ],{slices:12,capTip:false,mirror:side<0});
      flap.add(new THREE.Mesh(fGeo,metal));
    }else{
      block(flap,metal,span*.26,.14,fC0*.18,side*span*.13,0,fC0*.09);
    }
    group.add(flap);flaps.push(flap);
    if(profile.delta){
      const brake=new THREE.Group();
      brake.position.set(side*span*.34,wingDihedralY(wingV(.34))+.04,.45);
      block(brake,metal,.84,.045,.73,0,0,.365);
      block(brake,surface,.81,.035,.69,0,.036,.365);
      group.add(brake);airBrakes.push(brake);
    }
    const tipY=wingDihedralY(1.0)+(fighter?0:profile.rakedTip?.18:.02),tipZ=wingLeadAt(1.0)+wingChordAt(1.0)*.25;
    const lamp=mesh(group,new THREE.SphereGeometry(fighter?.085:.19,12,8),
      new THREE.MeshBasicMaterial({color:side===-1?0xed4f49:0x65ffd4}),side*span,tipY,tipZ);
    const strobe=mesh(group,new THREE.SphereGeometry(fighter?.095:.21,12,8),
      new THREE.MeshBasicMaterial({color:0xffffff}),side*span,tipY,tipZ+.15);
    lamps.push(lamp);strobes.push(strobe);
    if(!fighter&&engineCount>=2&&!profile.rearEngines){
      for(const factor of engineCount===4?[.33,.65]:[.38]){
        const size=profile.nacelleRadius??(freight?1.43:1.78);
        const length=profile.rakedTip?1.35:1;
        const ev=wingV(factor),ewY=wingDihedralY(ev),elZ=wingLeadAt(ev);
        if(profile.turboprop){
          const x=side*span*factor,y=ewY-radius*.08,z=elZ+wingChordAt(ev)*.18;
          const nac=hull(group,[[z-radius*1.8,radius*.29],[z-radius,radius*.36],[z+radius*1.8,radius*.26],[z+radius*2.1,.06]],surface);
          nac.position.set(x,y,0);nac.name=profile.id+' turboprop engine';
          const prop=new THREE.Group();prop.position.set(x,y,z-radius*1.85);group.add(prop);fans.push(prop);
          const pr=Math.min(span*.20,radius*1.42,Math.max(radius*.85,y+profile.gearHeight-.26)),blades=profile.id==='a400m'?8:6;
          for(let b=0;b<blades;b++){
            const blade=mesh(prop,AeroCraft.buildTwistedBlade(pr,radius*.15,radius*.07,.38),dark);blade.rotation.z=b*Math.PI*2/blades;blade.rotation.x=.22;
          }
          const hub=mesh(prop,new THREE.ConeGeometry(radius*.23,radius*.5,18),metal);hub.rotation.x=-Math.PI/2;
        }else if(typeof AeroCraft!=='undefined'){
          const minSafeY=-profile.gearHeight+Math.max(.26,size*.22)+size*1.02;
          const idealY=ewY-size*.62-.16;
          const nacY=profile.overwingEngines?ewY+size+.32:Math.max(idealY,minSafeY);
          const pylonH=profile.overwingEngines?Math.max(.22,nacY-size*.78-ewY+.03):Math.max(.18,ewY-nacY-size*.72+.03);
          const nac=AeroCraft.buildTurbofanNacelle(THREE,size,length,{surface,metal,dark},{
            chevron:detailed||freight||engineCount===2,
            pylonHeight:pylonH,
            pylonBaseY:size*.72,
            overwing:Boolean(profile.overwingEngines)
          });
          fans.push(nac.fanGroup);
          nac.group.position.set(side*span*factor,nacY,elZ-size*.18);
          nac.group.name=profile.id+' wing engine';
          group.add(nac.group);
        }else{
          const engine=new THREE.Group();
          hull(engine,[[-2.8,size*.89],[-2.52,size],[.82,size*.94],[1.8,size*.71]],surface);
          const fanGroup=new THREE.Group();engine.add(fanGroup);fans.push(fanGroup);
          engine.scale.z=length;engine.position.set(side*span*factor,Math.max(ewY-size*.55-.32,-profile.gearHeight+size*1.25),elZ-size*.3);
          group.add(engine);
        }
      }
    }
  }
  const tailHeight=profile.finHeight??half*(fighter?.41:antonov?.40:.36);
  if(typeof AeroCraft!=='undefined'){
    const finGeo=AeroCraft.buildVerticalFoilLoft([
      {y:radius*.42,leadZ:half*.24,chord:half*.56,thick:.085},
      {y:radius*.72+tailHeight*.22,leadZ:half*.48,chord:half*.34,thick:.09},
      {y:radius*.62+tailHeight*(fighter?1.08:1.0),leadZ:half*(fighter?.72:.70),chord:half*(fighter?.13:.16),thick:.08}
    ],{slices:22,capTip:true});
    const vertical=mesh(group,finGeo,paint,profile.twinTail?-span*.23:0,0,0);
    vertical.name=profile.id+' vertical fin';
    if(profile.twinTail){
      vertical.rotation.z=profile.finCant??.18;
      const second=mesh(group,finGeo,paint,span*.23,0,0);second.rotation.z=-(profile.finCant??.18);second.name=profile.id+' second vertical fin';
    }
    // Streamlined dorsal SATCOM radome & swept VHF blade antennas
    mesh(group,AeroCraft.buildCanoeGeometry(half*.14,radius*.22,radius*.16),surface,0,radius*1.02,half*.02);
    mesh(group,AeroCraft.buildAeroPylonGeometry(.45,.42,.20,.14,.18),metal,0,radius*.96,half*.12);
    mesh(group,AeroCraft.buildAeroPylonGeometry(.28,.28,.12,.14,.12),metal,0,-radius*.96,half*.16).rotation.x=Math.PI;
    void vertical;
  }else{
    const fin=new THREE.Shape();fin.moveTo(0,0);fin.lineTo(half*.34,0);fin.lineTo(half*.34,tailHeight);fin.lineTo(half*.22,tailHeight*(fighter?1.10:1));fin.closePath();
    const vertical=mesh(group,new THREE.ExtrudeGeometry(fin,{depth:.17,bevelEnabled:false}),paint,0,radius*.61,half*.51);
    vertical.rotation.y=-Math.PI/2;
    block(group,metal,.11,.48,.32,0,radius,half*.12);
    block(group,metal,.09,.29,.23,0,-radius*.87,half*.16);
  }

  if(profile.rearEngines||profile.trijet){
    const engineXs=profile.rearEngines?[-radius*1.35,radius*1.35]:[];
    for(const x of engineXs){
      const nac=AeroCraft.buildTurbofanNacelle(THREE,profile.nacelleRadius||radius*.52,.9,{surface,metal,dark},{chevron:false});
      nac.group.position.set(x,radius*.25,half*.52);nac.group.name=profile.id+' rear engine';group.add(nac.group);fans.push(nac.fanGroup);
      block(group,surface,Math.abs(x),.11,.45,x/2,radius*.25,half*.56);
    }
    if(engineCount===3){
      const nac=AeroCraft.buildTurbofanNacelle(THREE,profile.nacelleRadius||radius*.52,.9,{surface,metal,dark},{chevron:false});
      nac.group.position.set(0,radius*1.5,half*.58);nac.group.name=profile.id+' centre engine';group.add(nac.group);fans.push(nac.fanGroup);
    }
  }
  if(profile.rectangularNozzle){
    for(const side of [-1,1]){
      const x=side*radius*.57,z=half*1.012;
      block(group,metal,.94,.58,.36,x,-.08,z);
      block(group,dark,.78,.40,.03,x,-.08,z+.19);
    }
  }
  const wheels=[];
  const bodyAxles=upperDeck?2:3;
  const bogies=antonov?[[0,-half*.65,2],...[-1,1].flatMap(side=>
    Array.from({length:5},(_,i)=>[side*radius*.98,-3.8+i*2.18,1]))]:
    fighter?[[0,-half*.54,1],[-1.12,1.3,1],[1.12,1.3,1]]:
    !upperDeck&&engineCount<=3?[[0,-half*.71,1],[-span*.128,2,profile.mainAxles??2],[span*.128,2,profile.mainAxles??2]]:
    [[0,-half*.71,1],[-span*.128,2,2],[span*.128,2,2],[-radius*.82,7.8,bodyAxles],[radius*.82,7.8,bodyAxles]];
  const tireShapes=new Map();
  for(const [x,z,axles] of bogies){
    const size=fighter?.32:antonov?.61:radius>2.9?.64:radius<1.5?Math.max(.24,Math.min(.44,profile.gearHeight*.24)):.55;
    const width=fighter?.21:radius<1.5?.22:.34;
    if(!tireShapes.has(size)){
      const shoulder=[
        [.53,-.50],[.82,-.50],[.93,-.44],[.99,-.31],[1,-.17],[1,.17],[.99,.31],
        [.93,.44],[.82,.50],[.53,.50]
      ].map(([r,y])=>new THREE.Vector2(r*size,y*width));
      tireShapes.set(size,new THREE.LatheGeometry(shoulder,28));
    }
    const strut=size*(x===0?.27:.36),height=profile.gearHeight;
    mesh(gear,new THREE.CylinderGeometry(strut,strut*1.16,height*.59,12),metal,x,-height*.32,z);
    mesh(gear,new THREE.CylinderGeometry(strut*.64,strut*.64,height*.40,12),metal,x,-height*.69,z);
    const beamLen=axles>1?(axles-1)*1.12+size:.64;
    mesh(gear,new THREE.CylinderGeometry(strut*.75,strut*.75,beamLen,10),metal,x,-height+size,z).rotation.x=Math.PI/2;
    const brace=mesh(gear,new THREE.CylinderGeometry(strut*.32,strut*.36,height*.52,8),metal,x+strut*1.6,-height*.36,z+.16);
    brace.rotation.z=-.29;
    const doorGeo=new THREE.CylinderGeometry(size*.9,.9*size,.06,10,1,false,0,Math.PI);
    const door=mesh(gear,doorGeo,surface,x+(x<0?-1:1)*size*.69,-height*.28,z);
    door.rotation.z=x<0?-.13:.13;
    for(let a=0;a<axles;a++){
      for(const offset of fighter?[0]:[-.29,.29]){
        const wheel=mesh(gear,tireShapes.get(size),rubber,x+offset,-profile.gearHeight+size,z+(a-(axles-1)/2)*1.12);
        wheel.userData.radius=size;
        wheel.rotation.z=Math.PI/2;wheels.push(wheel);
        for(const sign of [-1,1]){
          mesh(wheel,new THREE.CylinderGeometry(size*.56,size*.56,.029,20),metal,0,sign*width*.48,0);
          mesh(wheel,new THREE.CylinderGeometry(size*.21,size*.21,.04,12),dark,0,sign*(fighter?.13:.20),0);
        }
      }
    }
  }

  if(profile.tailCargo){
    noseDoor.position.set(0,-radius*.52,half*.64);
    const rampLength=Math.min(half*.44,8);
    const ramp=block(noseDoor,metal,radius*1.55,.16,rampLength,0,0,rampLength*.5);
    ramp.name=profile.id+' rear loading ramp';
    for(const side of [-1,1])block(noseDoor,paint,.10,.16,rampLength,side*radius*.75,.10,rampLength*.5);
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
    const deckBulkhead=-half*.49;
    const deckBack=half*.66;
    block(cabin,cabinFloor,radius*1.63,.14,Math.max(2,deckBack-deckBulkhead),0,-.78,(deckBulkhead+deckBack)/2);
    for(let i=0;i<8;i++){
      for(const side of [-1,1]){
        block(cabin,light,.15,.07,1.5,side*radius*.52,radius*.71,-half*.44+i*half*.13);

      }
    }
    if(freight){
      const trackLength=half*1.34;
      const tracks=[-1.35,-.68,.68,1.35];
      const rollersPerTrack=Math.floor((trackLength-.8)/.52)+1;
      const rollerGeometry=new THREE.CylinderGeometry(.035,.035,.19,8);
      rollerGeometry.rotateZ(Math.PI/2);
      const rollers=new THREE.InstancedMesh(rollerGeometry,metal,tracks.length*rollersPerTrack);
      const transform=new THREE.Matrix4();
      let instance=0;
      for(const x of tracks){
        block(cabin,dark,.24,.04,trackLength,x,-.686,0);
        for(let i=0;i<rollersPerTrack;i++){
          transform.makeTranslation(x,-.653,(i-(rollersPerTrack-1)/2)*.52);
          rollers.setMatrixAt(instance++,transform);
        }
      }
      rollers.name='Main deck roller tracks';
      cabin.add(rollers);
      for(const slot of palletStations) palletMeshes.push(block(cabin,seat,3.35,1.35,3.8,0,-.01,slot.arm));
    }
  }
  const beaconTop=mesh(group,new THREE.SphereGeometry(fighter?.09:.22,12,8),new THREE.MeshBasicMaterial({color:0xff2222}),0,radius*(antonov?1.15:upperDeck?1.12:1.06)+.12,-half*.05);
  const beaconBottom=mesh(group,new THREE.SphereGeometry(fighter?.09:.22,12,8),new THREE.MeshBasicMaterial({color:0xff2222}),0,-radius*1.04-.12,-half*.05);
  const tailLight=mesh(group,new THREE.SphereGeometry(fighter?.07:.15,12,8),new THREE.MeshBasicMaterial({color:0xffffff}),0,tailHeight*.25+radius*.4,half*.98);
  beacons.push(beaconTop,beaconBottom);
  lamps.push(tailLight);
  cabin.visible=false;
  scene.add(group,cabin);
  group.userData={profileId:profile.id,tailCargo:profile.tailCargo,modelStatus:profile.modelStatus,gear,blades:fans,surfaces,flaps,navLights:lamps,strobes,beacons,noseDoor,sideDoor,cargoRamp,wheels,cabin,palletMeshes,passengerCabin,closeDetails,airBrakes,exhaustPlumes,cockpitGlassMats,half,radius,setLivery:owned=>paint.color.setHex(owned?0x1f9991:stockColor)};
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
  const cabinStart=Math.max(firstZ-0.35,-half*.49);
  const cabinLength=Math.max(2,lastZ+1.6-cabinStart);
  const mid=(cabinStart+lastZ+1.6)/2;
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
