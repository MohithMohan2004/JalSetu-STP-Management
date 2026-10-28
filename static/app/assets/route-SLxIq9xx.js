import{c as p,r as f}from"./index-BAxtjWpx.js";/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["path",{d:"M8 3 4 7l4 4",key:"9rb6wj"}],["path",{d:"M4 7h16",key:"6tx8e3"}],["path",{d:"m16 21 4-4-4-4",key:"siv7j2"}],["path",{d:"M20 17H4",key:"h6l3hr"}]],_=p("arrow-left-right",w);/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],v=p("check",$),k=28,g=t=>!!t&&Number.isFinite(t[0])&&Number.isFinite(t[1])&&!(t[0]===0&&t[1]===0);function E(t,s){const[c,h]=f.useState(null),[y,m]=f.useState(!1),M=g(t)&&g(s)?`${t.join()}|${s.join()}`:"";return f.useEffect(()=>{if(h(null),!M)return;const[o,n]=[t,s],a=new AbortController;return m(!0),fetch(`https://router.project-osrm.org/route/v1/driving/${o[1]},${o[0]};${n[1]},${n[0]}?overview=full&geometries=geojson`,{signal:a.signal}).then(i=>i.json()).then(i=>{var u;const r=(u=i.routes)==null?void 0:u[0];if(!r)throw new Error("no route");const e=r.distance/1e3;h({km:e,mins:e/k*60,coords:r.geometry.coordinates.map(([l,d])=>[d,l])})}).catch(i=>{if(a.signal.aborted)return;const r=6371,e=j=>j*Math.PI/180,u=e(n[0]-o[0]),l=e(n[1]-o[1]),d=Math.sin(u/2)**2+Math.cos(e(o[0]))*Math.cos(e(n[0]))*Math.sin(l/2)**2,b=2*r*Math.asin(Math.sqrt(d));h({km:b,mins:b/k*60,coords:[o,n]})}).finally(()=>!a.signal.aborted&&m(!1)),()=>a.abort()},[M]),{route:c,loading:y}}const L=(t,s)=>{const c=[Number(t),Number(s)];return t!==""&&t!=null&&g(c)?c:null};export{_ as A,v as C,L as t,E as u};
