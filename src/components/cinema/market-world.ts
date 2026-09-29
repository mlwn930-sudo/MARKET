import * as T from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { buildProduct } from "./product-models";
import { PRODUCTS } from "./product-catalog";
import { createTradingHall } from "./trading-hall";
import { hasAsset, loadProduct } from "./product-assets";

/* The finale, in the room's own coordinates.
   CAR_START is the threshold, CAR_WALL the face of the sign at hall-local
   z −20, and CAR_IMPACT the point in the last stop's scroll where the two
   meet. Named because all three have to agree: the wall must break at the
   frame the bonnet arrives, not a beat before or after. */
const CAR_START=7, CAR_WALL=-19.4, CAR_IMPACT=.62;
/* Which way the model faces down the hall. Flip by PI if it reverses. */
const CAR_HEADING=Math.PI;
const smooth=(v:number)=>{const t=T.MathUtils.clamp(v,0,1);return t*t*(3-2*t);};
export async function createMarketWorld(canvas:HTMLCanvasElement,quotes:Record<string,LiveQuote>){
  const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();
  /* Lighting from a photographed room rather than a synthesised one.
     RoomEnvironment is three's stand-in — a box of coloured planes — and
     it is why every metal surface here reflected nothing recognisable.
     This is a real studio, captured in high dynamic range, so a chrome
     edge picks up a window and a rough surface picks up its warmth. It is
     the single largest difference between "lit" and "photographed", and
     it costs one 1.6 MB file. */
  const pmrem=new T.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
  const hdr=await new RGBELoader().loadAsync("/hdri/studio.hdr");
  const environmentMap=pmrem.fromEquirectangular(hdr);
  scene.environment=environmentMap.texture;scene.environmentIntensity=0.85;
  hdr.dispose();pmrem.dispose();
  scene.background=new T.Color("#0a1420");scene.fog=new T.Fog("#12202e",34,105);
  const camera=new T.PerspectiveCamera(48,1,.05,180);
  /* Only the facade is photographed. The product sheet used to be loaded
     here for the portrait planes; those are gone, and with them a 270 KB
     download the sequence no longer has any use for. */
  const loader=new T.TextureLoader();const photo=await loader.loadAsync("/hero/exchange-closed.webp");
  photo.colorSpace=T.SRGBColorSpace;const textures:T.Texture[]=[photo];
  const photoMaterial=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{map:{value:photo},open:{value:0}},vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D map;uniform float open;varying vec2 v;void main(){if(open>.001&&abs(v.x-.546)<.073&&abs(v.y-.52)<.23)discard;gl_FragColor=texture2D(map,v);\n#include <colorspace_fragment>\n}`});
  const facade=new T.Mesh(new T.PlaneGeometry(48,27),photoMaterial);scene.add(facade);
  const doors=[-1,1].map(side=>{const hinge=new T.Group();hinge.position.set(2.208+side*3.504,.54,.02);const geo=new T.PlaneGeometry(3.504,12.42);const uv=geo.getAttribute("uv");for(let i=0;i<uv.count;i++)uv.setXY(i,.473+(side<0?0:.073)+uv.getX(i)*.073,.29+uv.getY(i)*.46);const leaf=new T.Mesh(geo,new T.MeshBasicMaterial({map:photo,side:T.DoubleSide}));leaf.position.x=-side*1.752;hinge.add(leaf);scene.add(hinge);return hinge;});
  const hall=new T.Group();hall.position.set(2.208,.54,-10);scene.add(hall);
  /* The room, built to match the doorway it sits behind. Everything that
     used to stand in for it — ten cylinders, two slabs and fourteen flat
     panels — is in trading-hall.ts now, with the stone, the dome, the
     colonnade and the curved wall of boards it needed all along. */
  const tradingHall=createTradingHall();
  tradingHall.setQuotes(PRODUCTS.map(p=>({symbol:p.symbol,price:quotes[p.symbol]?.price??null,change:quotes[p.symbol]?.changePercent??null})));
  hall.add(tradingHall.group);
  /* The hand-built shapes go up first so the sequence is never waiting on
     a download, then each one is replaced the moment a real model for it
     finishes arriving. A stop with no CC0 model of the actual product
     keeps the drawn one rather than borrowing a generic stand-in. */
  const models:{group:T.Group;animate(explode:number):void;dispose?():void}[]=
    PRODUCTS.map((_,i)=>{const p=buildProduct(i);hall.add(p.group);return p;});
  PRODUCTS.forEach((_,i)=>{
    if(!hasAsset(i))return;
    /* A car is not a hand-held object: the common longest-edge scale that
       makes six products read as one set would shrink it to a toy. */
    void loadProduct(i,i===6?9.5:3.4).then(real=>{
      if(!real)return;
      const drawn=models[i];
      real.group.visible=drawn.group.visible;
      hall.remove(drawn.group);
      drawn.dispose?.();
      hall.add(real.group);
      models[i]=real;
    });
  });
  /* No product photographs anywhere in the room. A picture of a phone
     standing next to a model of a phone tells the eye the model is the
     stand-in, which is the one thing it must never say. */

  /* The sign the Tesla drives into. Built as real blocks rather than a
     plane, because the car has to go through it and a plane has no
     other side. The brand is painted across the face so the break starts
     inside the letters. */
  const signCanvas=document.createElement("canvas");signCanvas.width=2048;signCanvas.height=1024;
  {
    const ctx=signCanvas.getContext("2d")!;
    const back=ctx.createLinearGradient(0,0,0,1024);back.addColorStop(0,"#16233d");back.addColorStop(1,"#0a1526");
    ctx.fillStyle=back;ctx.fillRect(0,0,2048,1024);
    ctx.textAlign="center";
    ctx.fillStyle="rgba(255,255,255,.82)";ctx.font="500 108px Arial";ctx.fillText("WELCOME",1024,430);
    const brand=ctx.createLinearGradient(430,0,1618,0);brand.addColorStop(0,"#2855F5");brand.addColorStop(1,"#00B8E6");
    ctx.fillStyle=brand;ctx.font="700 208px Arial";ctx.fillText("CAPITAL MARKET",1024,650);
    ctx.fillStyle="rgba(255,255,255,.4)";ctx.font="400 44px Arial";ctx.fillText("MARKET INTEL",1024,760);
  }
  const signTexture=new T.CanvasTexture(signCanvas);signTexture.colorSpace=T.SRGBColorSpace;textures.push(signTexture);
  const signBack=new T.MeshStandardMaterial({color:"#2a3345",roughness:.8,metalness:.1});
  const wall=new T.Group();wall.position.set(0,3,-20);hall.add(wall);
  const rubble:{mesh:T.Mesh;home:T.Vector3;velocity:T.Vector3;spin:T.Vector3}[]=[];
  const COLS=14,ROWS=8,BW=2.4,BH=2.1;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const geo=new T.BoxGeometry(BW*.98,BH*.98,.9);
    /* Each block samples its own patch of the sign, so the painted brand
       stays continuous across the wall and then travels with the pieces. */
    const uv=geo.getAttribute("uv");
    for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i))/COLS,(y+uv.getY(i))/ROWS);
    const face=new T.MeshStandardMaterial({map:signTexture,roughness:.62,metalness:.08});
    const mesh=new T.Mesh(geo,[signBack,signBack,signBack,signBack,face,signBack]);
    mesh.position.set((x-(COLS-1)/2)*BW,(y-(ROWS-1)/2)*BH,0);
    wall.add(mesh);
    const r=Math.sin(x*12.9+y*78.2)*43758.5453;const n=r-Math.floor(r);
    rubble.push({mesh,home:mesh.position.clone(),
      velocity:new T.Vector3((x-(COLS-1)/2)*.9,(y-(ROWS-1)/2)*.7+2.4,6+n*14),
      spin:new T.Vector3(n*5-2,(n*7)%4-2,(n*11)%5-2)});
  }
  let startZ=30,mobile=false;
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;mobile=w<800;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=mobile?55:48;camera.updateProjectionMatrix();startZ=Math.min(13.5,24/camera.aspect)/Math.tan(T.MathUtils.degToRad(camera.fov/2));}
  resize();
  return {resize,render(progress:number){
    const approach=smooth(progress/.19);camera.position.set(2.208*approach,.54*approach,startZ*(1-approach)-2*approach);camera.rotation.set(0,0,0);photoMaterial.uniforms.open.value=smooth((progress-.045)/.085);facade.visible=progress<.195;doors.forEach((door,i)=>{door.visible=facade.visible;door.rotation.y=(i===0?-1:1)*photoMaterial.uniforms.open.value*1.3;});
    const journey=T.MathUtils.clamp((progress-.19)/.79,0,.999)*7,index=Math.floor(journey),local=journey-index;
    /* Once through the doorway the camera keeps moving. Standing still on
       the threshold for six scenes is what made the room read as a
       backdrop rather than somewhere the visitor had arrived. */
    /* The camera drifts down the colonnade for the six presented stops and
       then STOPS. It used to keep pushing through the finale at 22 units
       while the car covered 14, and two bodies travelling together read as
       two bodies standing still — which is exactly what the car looked
       like. Nothing moves relative to nothing. So the vantage parks, the
       car alone crosses the room, and the camera only moves again once the
       wall is already open. */
    const PARKED=-2-(6/7)*2.6;
    if(progress>=.19)camera.position.z=index<6?-2-(journey/7)*2.6:PARKED;

    const lift=smooth(local/.30),explode=smooth((local-.34)/.44),exit=smooth((local-.86)/.14);
    models.forEach((model,i)=>{
      model.group.visible=progress>=.19&&i===index;
      if(!model.group.visible)return;
      const g=model.group,base=camera.position.z;
      if(i===6){
        /* Driving, in the room's own coordinates rather than the camera's.
           From the threshold to the face of the sign at local z −20, on an
           accelerating curve — a car that covers equal ground per pixel of
           scroll reads as a tow, not a run. It keeps going after impact. */
        const run=local/CAR_IMPACT;
        const eased=run<1?run*run*(3-run)/2:1+(run-1)*1.6;
        g.rotation.set(0,CAR_HEADING,0);
        g.position.set(mobile?0:-1.4,-2.35,CAR_START-eased*(CAR_START-CAR_WALL));
        g.scale.setScalar(mobile?.85:1.25);
        model.animate(0);
        return;
      }
      /* Presented: it rises into the light, turns, then comes apart. */
      g.position.set((mobile?0:-1.6)+exit*-9,-.5+(mobile?-.4:0)+lift*.75,base-5.4);
      g.scale.setScalar((mobile?.72:1.08)*(i===5?1.2:1)*(.82+.18*lift));
      g.rotation.set(.14-lift*.05,-.75+local*.62,0);
      model.animate(explode*1.15);
    });

    /* The wall gives way when the car arrives, not on a clock of its own.
       The break starts the instant the bonnet reaches the face and is over
       fast — masonry does not ease out. */
    wall.visible=progress>=.19&&index===6;
    const impact=index===6?smooth((local-CAR_IMPACT)/.16):0;
    rubble.forEach(({mesh,home,velocity,spin})=>{
      mesh.position.copy(home).addScaledVector(velocity,impact);
      mesh.position.y-=impact*impact*6;
      mesh.rotation.set(spin.x*impact,spin.y*impact,spin.z*impact);
      mesh.scale.setScalar(1-impact*.35);
    });

    /* Only now does the vantage move — through the hole the car made, and
       on into the page. Moving it any earlier is what flattened the run. */
    if(index===6)camera.position.z=PARKED-smooth((local-CAR_IMPACT)/(1-CAR_IMPACT))*30;

    renderer.render(scene,camera);
  },dispose(){tradingHall.dispose();scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});textures.forEach(t=>t.dispose());environmentMap.dispose();renderer.dispose();}};
}
