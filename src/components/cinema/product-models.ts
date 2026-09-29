import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";


type Part={mesh:T.Object3D;home:T.Vector3;away:T.Vector3;spin:number};
export function buildProduct(index:number){
  const group=new T.Group(),parts:Part[]=[];
  const metal=new T.MeshStandardMaterial({color:index===4?"#879b8b":"#b6bfca",metalness:.8,roughness:.28});
  const black=new T.MeshStandardMaterial({color:"#131a20",metalness:.5,roughness:.3});
  const board=new T.MeshStandardMaterial({color:"#164f43",metalness:.45,roughness:.5});
  const glass=new T.MeshPhysicalMaterial({color:"#173c51",metalness:.5,roughness:.12,clearcoat:1});
  const white=new T.MeshStandardMaterial({color:"#ecefea",roughness:.4,metalness:.15});
  function add(geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,away:[number,number,number]=[0,0,0],spin=0){const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);group.add(mesh);parts.push({mesh,home:mesh.position.clone(),away:new T.Vector3(...away),spin});return mesh;}
  const box=(w:number,h:number,d:number,mat:T.Material,x:number,y:number,z:number,away:[number,number,number]=[0,0,0])=>add(new RoundedBoxGeometry(w,h,d,2,Math.min(.1,d/3)),mat,x,y,z,away);
  const disk=(radius:number,depth:number,mat:T.Material,x:number,y:number,z:number,away:[number,number,number]=[0,0,0])=>{const m=add(new T.CylinderGeometry(radius,radius,depth,32),mat,x,y,z,away);m.rotation.x=Math.PI/2;return m;};
  if(index===0){
    box(5,2.2,.5,black,0,0,0,[0,0,.9]);box(4.8,2,.12,board,0,0,-.36,[0,0,-.8]);box(1.1,1.1,.14,metal,-.7,0,-.47,[-.4,0,-1.8]);
    const heatsink=new T.MeshStandardMaterial({color:"#75828e",metalness:.9,roughness:.25});
    for(let i=0;i<22;i++)box(.055,1.7,.3,heatsink,-2+i*.19,0,-.2,[0,0,-.25]);
    for(const x of [-1.35,1.35]){disk(.81,.15,metal,x,0,.35,[x*.3,0,1.8]);disk(.68,.17,black,x,0,.45,[x*.3,0,1.8]);disk(.2,.2,metal,x,0,.55,[x*.3,0,1.8]);for(let k=0;k<9;k++){const a=k*Math.PI*2/9;const blade=box(.17,.5,.035,black,x+Math.cos(a)*.37,Math.sin(a)*.37,.56,[x*.3,0,1.8]);blade.rotation.z=a;}}
    box(2.7,.16,.12,new T.MeshStandardMaterial({color:"#cda652",metalness:.8}),-.6,-1.16,-.2,[0,-.6,-.5]);
  }else if(index===1||index===4){
    box(2.1,4.2,.22,metal,0,0,0,[0,0,-1]);box(1.94,4.02,.07,glass,0,0,.17,[-.55,.1,1.3]);box(1.83,3.8,.06,board,0,0,-.02,[0,0,.25]);box(1.45,2.2,.14,black,0,-.45,.01,[.7,-.3,.65]);
    if(index===4)box(1.9,.64,.22,black,0,1.26,-.24,[0,.4,-1.7]);
    for(let i=0;i<3;i++)disk(.24,.18,black,-.55+(i%2)*.6,1.38-Math.floor(i/2)*.6,-.28,[-.4,.8,-2]);
    box(.65,.65,.1,metal,.35,.8,.04,[-.75,.7,.6]);
    for(let k=0;k<12;k++)box(.19,.23,.04,k%3?black:metal,-.7+(k%4)*.42,-1.5+Math.floor(k/4)*.48,-.08,[0,0,.25]);
  }else if(index===2){
    const cardboard=new T.MeshStandardMaterial({color:"#b98750",roughness:.94});
    box(3.5,2.4,.06,cardboard,0,0,1,[0,0,1.5]);box(3.5,2.4,.06,cardboard,0,0,-1,[0,0,-1.5]);box(.06,2.4,2,cardboard,-1.75,0,0,[-1.5,0,0]);box(.06,2.4,2,cardboard,1.75,0,0,[1.5,0,0]);box(3.5,.06,2,cardboard,0,1.2,0,[0,1.1,0]);box(3.5,.06,2,cardboard,0,-1.2,0,[0,-1.1,0]);box(1.4,.65,.02,white,.5,.45,1.05,[.3,.3,1.9]);box(1.8,1.3,1.1,white,0,0,0,[0,.25,.2]);
  }else if(index===3){
    box(3.7,1.9,.65,white,0,.2,0,[0,0,.85]);for(const x of [-1.4,1.4]){const handle=box(.9,2,.7,white,x,-.6,0,[x*.35,-.4,.8]);handle.rotation.z=x*.22;}
    box(2.7,1.4,.1,board,0,.2,-.2,[0,0,-1]);for(const [x,y]of[[-.8,.6],[.45,-.1]]){disk(.36,.3,black,x,y,.5,[x*.5,.2,1.7]);}
    for(let i=0;i<4;i++)disk(.14,.1,new T.MeshStandardMaterial({color:["#47b952","#f0cc43","#dd546b","#6099ef"][i]}),1.1+Math.cos(i*Math.PI/2)*.3,.5+Math.sin(i*Math.PI/2)*.3,.45,[.6,.4,1.6]);
    box(.65,.2,.12,black,-.9,-.25,.45,[-.5,-.3,1.4]);box(.2,.65,.12,black,-.9,-.25,.46,[-.5,-.3,1.4]);
  }else if(index===5){
    for(const x of [-1.1,1.1]){const ring=add(new T.TorusGeometry(.77,.105,10,48),black,x,0,0,[x*.35,0,.6]);ring.scale.y=.72;const lens=disk(.69,.025,glass,x,0,0,[x*.5,0,1.6]);lens.scale.y=.72;box(.13,.18,2.8,black,x*1.68,.15,-1.35,[x*.6,.4,-.8]);disk(.085,.07,metal,x*1.65,.22,.15,[x*.85,.5,1]);}box(.55,.12,.12,black,0,.15,0,[0,.3,.5]);
  }else{
    const outline=new T.Shape();outline.moveTo(-2.65,-.55);outline.quadraticCurveTo(-2.65,.05,-2.1,.12);outline.lineTo(-1.55,.24);outline.quadraticCurveTo(-.9,1.1,-.4,1.08);outline.lineTo(.7,1.02);outline.quadraticCurveTo(1.3,.9,1.7,.23);outline.quadraticCurveTo(2.65,.12,2.65,-.3);outline.lineTo(2.5,-.67);outline.lineTo(-2.4,-.67);outline.closePath();
    const body=new T.ExtrudeGeometry(outline,{depth:1.9,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.16,bevelThickness:.12,curveSegments:20});body.translate(0,0,-.95);add(body,metal,0,0,0);
    const windowShape=new T.Shape();windowShape.moveTo(-1.35,.3);windowShape.lineTo(-.6,.9);windowShape.lineTo(.65,.86);windowShape.lineTo(1.45,.3);windowShape.closePath();
    for(const z of [-1.12,1.12]){const windowMesh=add(new T.ShapeGeometry(windowShape),new T.MeshPhysicalMaterial({color:"#112937",roughness:.12,metalness:.5,side:T.DoubleSide}),0,0,z);windowMesh.rotation.y=0;}
    box(1.7,.1,1.68,glass,0,1.13,0);for(const x of [-1.65,1.65])for(const z of [-1.1,1.1]){disk(.57,.28,black,x,-.6,z);disk(.38,.3,metal,x,-.6,z);disk(.12,.32,black,x,-.6,z);for(let j=0;j<8;j++){const spoke=box(.055,.68,.025,black,x,-.6,z+(z>0?.16:-.16));spoke.rotation.z=j*Math.PI/4;}}
    for(const z of [-.72,.72])box(.08,.1,.46,white,2.64,-.05,z);

  }
  return {group,animate(explode:number){parts.forEach(({mesh,home,away,spin})=>{mesh.position.copy(home).addScaledVector(away,explode);if(spin)mesh.rotation.z=spin*explode;});}};
}
