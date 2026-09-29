import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { buildProduct } from "./product-models";
import { PRODUCTS } from "./product-catalog";

const smooth=(v:number)=>{const t=T.MathUtils.clamp(v,0,1);return t*t*(3-2*t);};
export async function createMarketWorld(canvas:HTMLCanvasElement,quotes:Record<string,LiveQuote>){
  const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;
  const scene=new T.Scene();const pmrem=new T.PMREMGenerator(renderer);const environment=new RoomEnvironment();const environmentMap=pmrem.fromScene(environment);scene.environment=environmentMap.texture;environment.dispose();pmrem.dispose();scene.background=new T.Color("#10252e");scene.fog=new T.Fog("#10252e",12,65);
  const camera=new T.PerspectiveCamera(48,1,.05,180);
  const loader=new T.TextureLoader();const [photo,collage]=await Promise.all([loader.loadAsync("/hero/exchange-closed.webp"),loader.loadAsync("/hero/company-products.webp")]);
  photo.colorSpace=collage.colorSpace=T.SRGBColorSpace;const textures:T.Texture[]=[photo,collage];
  const photoMaterial=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{map:{value:photo},open:{value:0}},vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D map;uniform float open;varying vec2 v;void main(){if(open>.001&&abs(v.x-.546)<.073&&abs(v.y-.52)<.23)discard;gl_FragColor=texture2D(map,v);\n#include <colorspace_fragment>\n}`});
  const facade=new T.Mesh(new T.PlaneGeometry(48,27),photoMaterial);scene.add(facade);
  const doors=[-1,1].map(side=>{const hinge=new T.Group();hinge.position.set(2.208+side*3.504,.54,.02);const geo=new T.PlaneGeometry(3.504,12.42);const uv=geo.getAttribute("uv");for(let i=0;i<uv.count;i++)uv.setXY(i,.473+(side<0?0:.073)+uv.getX(i)*.073,.29+uv.getY(i)*.46);const leaf=new T.Mesh(geo,new T.MeshBasicMaterial({map:photo,side:T.DoubleSide}));leaf.position.x=-side*1.752;hinge.add(leaf);scene.add(hinge);return hinge;});
  const hall=new T.Group();hall.position.set(2.208,.54,-10);scene.add(hall);
  scene.add(new T.HemisphereLight("#ddedff","#63503c",2.8));const key=new T.DirectionalLight("#ffe0a1",5);key.position.set(-5,10,12);scene.add(key);const rim=new T.DirectionalLight("#65cfff",4);rim.position.set(10,4,-12);scene.add(rim);
  const stone=new T.MeshStandardMaterial({color:"#b6a28b",roughness:.65,metalness:.15});const dark=new T.MeshStandardMaterial({color:"#15303b",metalness:.5,roughness:.28});const gold=new T.MeshStandardMaterial({color:"#b9894c",metalness:.7,roughness:.3});
  const architecture=(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);hall.add(m);return m;};
  architecture(45,.25,110,0,-3.6,-30,dark);architecture(45,.3,110,0,13,-30,stone);
  for(let i=0;i<10;i++){for(const side of [-1,1]){const col=new T.Mesh(new T.CylinderGeometry(.5,.7,16,16),stone);col.position.set(side*11,4.5,-i*8);hall.add(col);architecture(1.8,.3,1.8,side*11,-3.3,-i*8,gold);architecture(1.8,.3,1.8,side*11,12.3,-i*8,gold);architecture(4,.15,2.5,side*7,-1.5,-i*8,dark);architecture(.25,2,1,side*7,-2.5,-i*8,gold);}architecture(23,.2,.25,0,11,-i*8,gold);}
  const screenMaterials:T.MeshBasicMaterial[]=[];
  for(let i=0;i<14;i++){
    const p=PRODUCTS[i%7],c=document.createElement("canvas");c.width=512;c.height=256;const ctx=c.getContext("2d")!;ctx.fillStyle="#102b3b";ctx.fillRect(0,0,512,256);ctx.fillStyle=p.color;ctx.font="bold 62px Arial";ctx.fillText(p.symbol,28,92);ctx.font="32px monospace";ctx.fillStyle="#ffffff";ctx.fillText(quotes[p.symbol]?.price!=null?"$"+quotes[p.symbol].price!.toFixed(2):p.name,28,151);ctx.font="18px Arial";ctx.fillStyle="#91b2c5";ctx.fillText("MARKET / COMPANY RESEARCH",28,208);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;textures.push(tex);const mat=new T.MeshBasicMaterial({map:tex});screenMaterials.push(mat);architecture(4,2,.08,(i%2?1:-1)*8,1,-Math.floor(i/2)*8,mat);
  }
  const models=PRODUCTS.map((_,i)=>{const p=buildProduct(i);hall.add(p.group);return p;});
  const portraits=PRODUCTS.map((_,i)=>{const map=collage.clone();map.needsUpdate=true;textures.push(map);if(i<6){map.repeat.set(1/3,.327);map.offset.set((i%3)/3,i<3?.673:.38);}else{map.repeat.set(1,.38);map.offset.set(0,0);}const m=new T.Mesh(new T.PlaneGeometry(6,3.4),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));hall.add(m);return m;});
  const wall=new T.Group();hall.add(wall);const rubble:{mesh:T.Mesh;home:T.Vector3;velocity:T.Vector3}[]=[];
  for(let y=0;y<6;y++)for(let x=0;x<12;x++){const mesh=new T.Mesh(new T.BoxGeometry(1.95,1.9,.6),stone);mesh.position.set((x-5.5)*2,y*2-2,-19);wall.add(mesh);rubble.push({mesh,home:mesh.position.clone(),velocity:new T.Vector3((x-5.5)*2,(y-2)*1.2+3,Math.sin(x*4+y)*12)});}
  let startZ=30,mobile=false;
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;mobile=w<800;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=mobile?55:48;camera.updateProjectionMatrix();startZ=Math.min(13.5,24/camera.aspect)/Math.tan(T.MathUtils.degToRad(camera.fov/2));}
  resize();
  return {resize,render(progress:number){
    const approach=smooth(progress/.19);camera.position.set(2.208*approach,.54*approach,startZ*(1-approach)-2*approach);camera.rotation.set(0,0,0);photoMaterial.uniforms.open.value=smooth((progress-.045)/.085);facade.visible=progress<.195;doors.forEach((door,i)=>{door.visible=facade.visible;door.rotation.y=(i===0?-1:1)*photoMaterial.uniforms.open.value*1.3;});
    const journey=T.MathUtils.clamp((progress-.19)/.79,0,.999)*7,index=Math.floor(journey),local=journey-index;
    const lift=smooth(local/.32),explode=smooth((local-.3)/.45),exit=smooth((local-.85)/.15);
    models.forEach((model,i)=>{model.group.visible=progress>=.19&&i===index;portraits[i].visible=model.group.visible&&i!==6&&local<.35;if(!model.group.visible)return;const g=model.group;g.position.set((mobile?0:-1.8)+exit*-10,-.65+(mobile?-.5:0)+lift*.6,-2);g.scale.setScalar((mobile?.67:1)*(i===5?1.2:1)*(.78+.22*lift));g.rotation.set(.16,-.7+local*.28,0);model.animate(i===6?0:explode*1.15);const portrait=portraits[i];portrait.position.set(mobile?0:-1.8,-lift*2.5,-2.4);(portrait.material as T.MeshBasicMaterial).opacity=1-lift;g.scale.multiplyScalar(.65+.35*lift);
      if(i===6){g.rotation.y=Math.PI/2;g.position.set(mobile?0:-1.8,-1.8,-2-smooth((local-.18)/.82)*35);g.scale.setScalar(mobile?.8:1.2);}
    });
    wall.visible=progress>=.19&&index===6;const impact=index===6?smooth((local-.55)/.4):0;rubble.forEach(({mesh,home,velocity},i)=>{mesh.position.copy(home).addScaledVector(velocity,impact);mesh.rotation.set(impact*(i%3),impact*(i%5),impact*((i%7)-3));mesh.scale.setScalar(1-impact*.65);});
    if(index===6)camera.position.z-=smooth((local-.6)/.4)*8;
    renderer.render(scene,camera);
  },dispose(){scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});textures.forEach(t=>t.dispose());environmentMap.dispose();renderer.dispose();}};
}
