import * as THREE from "three";

/** A single textured draw call; every triangle carries its own impact trajectory. */
export async function createFractureWorld(canvas:HTMLCanvasElement) {
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(45,1,.1,100);
  camera.position.z=5;
  const texture=await new THREE.TextureLoader().loadAsync("/hero/rockstar-jason-lucia.webp");
  texture.colorSpace=THREE.SRGBColorSpace;
  const aspect=texture.image.width/texture.image.height;
  const width=8,height=width/aspect,columns=22,rows=14;
  const positions:number[]=[],uvs:number[]=[],centers:number[]=[],velocities:number[]=[],spins:number[]=[];
  const impacts=[[-1.9,.7],[1.7,-.1],[.1,-1.1]];
  const vertex=(x:number,y:number)=>new THREE.Vector3((x/columns-.5)*width,(y/rows-.5)*height,0);
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const a=vertex(x,y),b=vertex(x+1,y),c=vertex(x,y+1),d=vertex(x+1,y+1);
    const triangles=(x+y)%2?[[a,b,c],[b,d,c]]:[[a,b,d],[a,d,c]];
    triangles.forEach((triangle,i)=>{
      const center=triangle.reduce((v,p)=>v.add(p),new THREE.Vector3()).divideScalar(3);
      const hit=impacts.reduce((best,p)=>Math.hypot(center.x-p[0],center.y-p[1])<Math.hypot(center.x-best[0],center.y-best[1])?p:best);
      const random=(Math.sin(x*127.1+y*311.7+i*78.3)*43758.5453)%1;
      const velocity=new THREE.Vector3((center.x-hit[0])*1.5,(center.y-hit[1])*1.5,1.2+Math.abs(random)*4.5);
      triangle.forEach(p=>{positions.push(p.x,p.y,p.z);uvs.push(p.x/width+.5,p.y/height+.5);centers.push(center.x,center.y,0);velocities.push(velocity.x,velocity.y,velocity.z);spins.push(random*4);});
    });
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute("aCenter",new THREE.Float32BufferAttribute(centers,3));
  geometry.setAttribute("aVelocity",new THREE.Float32BufferAttribute(velocities,3));
  geometry.setAttribute("aSpin",new THREE.Float32BufferAttribute(spins,1));
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{uMap:{value:texture},uScatter:{value:0}},vertexShader:`attribute vec3 aCenter;attribute vec3 aVelocity;attribute float aSpin;uniform float uScatter;varying vec2 vUv;void main(){vUv=uv;vec3 p=position-aCenter;float a=aSpin*uScatter;mat3 rz=mat3(cos(a),sin(a),0.,-sin(a),cos(a),0.,0.,0.,1.);p=rz*p+aCenter+aVelocity*uScatter;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform sampler2D uMap;varying vec2 vUv;void main(){gl_FragColor=texture2D(uMap,vUv);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(";#include",";\n#include")});
  const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();const visibleHeight=2*Math.tan(THREE.MathUtils.degToRad(22.5))*5;const scale=Math.max(visibleHeight/height,visibleHeight*camera.aspect/width);mesh.scale.setScalar(scale);}
  resize();
  return {resize,render(scatter:number){material.uniforms.uScatter.value=scatter;renderer.render(scene,camera);},dispose(){geometry.dispose();material.dispose();texture.dispose();renderer.dispose();}};
}
