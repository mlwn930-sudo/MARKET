import * as THREE from "three";
import type { LiveQuote } from "@/lib/use-live-ticks";

export async function createMarketWorld(canvas:HTMLCanvasElement,quotes:Record<string,LiveQuote>) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  const scene=new THREE.Scene();
  scene.background=new THREE.Color("#061630");
  scene.fog=new THREE.Fog("#061630",18,65);
  const camera=new THREE.PerspectiveCamera(50,1,.05,150);
  const texture=await new THREE.TextureLoader().loadAsync("/hero/wall-street.webp");
  texture.colorSpace=THREE.SRGBColorSpace;
  // The aperture is anchored to the photographed exchange entrance, not the image centre.
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{uMap:{value:texture},uOpen:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D uMap;uniform float uOpen;varying vec2 vUv;void main(){vec2 d=abs(vUv-vec2(.657,.165));if(d.x<.029*uOpen&&d.y<.055*uOpen)discard;gl_FragColor=texture2D(uMap,vUv);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
  const facade=new THREE.Mesh(new THREE.PlaneGeometry(48,32),material);scene.add(facade);
  const world=new THREE.Group();world.position.set(7.536,-10.72,0);scene.add(world);
  const floor=new THREE.GridHelper(120,50,"#2b8cad","#103558");floor.position.set(0,-5,-38);world.add(floor);
  const textures:THREE.Texture[]=[texture];
  const companyEntries=["NVDA","AAPL","MSFT","AMZN","GOOGL","META","TSLA"];
  const logos=await Promise.all(companyEntries.map(symbol=>new Promise<HTMLImageElement|null>(resolve=>{const img=new Image(128,128);img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=`/companies/${symbol}.svg`;})));
  companyEntries.forEach((symbol,i)=>{
    const surface=document.createElement("canvas");surface.width=1024;surface.height=400;
    const ctx=surface.getContext("2d")!;
    ctx.fillStyle="#edf4fa";ctx.fillRect(20,25,130,130);if(logos[i])ctx.drawImage(logos[i]!,38,43,94,94);
    ctx.font="700 100px Arial";ctx.fillStyle=["#b5f678","#ffffff","#75d0ff","#ffb652"][i%4];ctx.fillText(symbol,185,135);
    const quote=quotes[symbol];ctx.font="55px monospace";ctx.fillStyle="#ffffff";ctx.fillText(quote?.price!=null?"$"+quote.price.toFixed(2):"RESEARCH",20,225);
    ctx.font="26px monospace";ctx.fillStyle="#92b5d4";ctx.fillText("MARKET / COMPANY INTELLIGENCE",20,290);
    const map=new THREE.CanvasTexture(surface);map.colorSpace=THREE.SRGBColorSpace;textures.push(map);
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(9,3.5),new THREE.MeshBasicMaterial({map,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
    plane.position.set(i%2===0?-7:6, i%3===0?1:0,-11-i*8);plane.rotation.y=i%2===0?.2:-.2;world.add(plane);
    // Each vertical marker corresponds to one company; height is not a financial magnitude.
    const line=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(plane.position.x,-5,plane.position.z),new THREE.Vector3(plane.position.x,-2,plane.position.z)]);
    world.add(new THREE.Line(line,new THREE.LineBasicMaterial({color:"#2a92ae",transparent:true,opacity:.7})));
  });
  let startZ=30;
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();startZ=Math.min(16,24/camera.aspect)/Math.tan(THREE.MathUtils.degToRad(25));}
  resize();
  const smooth=(v:number)=>{const t=THREE.MathUtils.clamp(v,0,1);return t*t*(3-2*t);};
  return {resize,render(progress:number){
    const approach=smooth(progress/.52),travel=smooth((progress-.52)/.48);
    camera.position.set(7.536*approach,-10.72*approach,startZ*(1-approach)-2*approach-38*travel);
    camera.rotation.set(0,0,0);material.uniforms.uOpen.value=smooth((progress-.2)/.25);
    facade.visible=progress<.58;renderer.render(scene,camera);
  },dispose(){scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){object.geometry.dispose();const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(m=>m.dispose());}});textures.forEach(t=>t.dispose());renderer.dispose();}};
}
