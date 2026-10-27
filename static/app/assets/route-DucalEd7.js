import{c as g,r as m}from"./index-CpN2PMXF.js";/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=[["path",{d:"M8 3 4 7l4 4",key:"9rb6wj"}],["path",{d:"M4 7h16",key:"6tx8e3"}],["path",{d:"m16 21 4-4-4-4",key:"siv7j2"}],["path",{d:"M20 17H4",key:"h6l3hr"}]],N=g("arrow-left-right",$);/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],x=g("check",j);/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["polyline",{points:"22 12 16 12 14 15 10 15 8 12 2 12",key:"o97t9d"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}]],A=g("inbox",v),p=28,f=t=>!!t&&Number.isFinite(t[0])&&Number.isFinite(t[1])&&!(t[0]===0&&t[1]===0);function E(t,s){const[a,h]=m.useState(null),[y,M]=m.useState(!1),b=f(t)&&f(s)?`${t.join()}|${s.join()}`:"";return m.useEffect(()=>{if(h(null),!b)return;const[e,n]=[t,s],c=new AbortController;return M(!0),fetch(`https://router.project-osrm.org/route/v1/driving/${e[1]},${e[0]};${n[1]},${n[0]}?overview=full&geometries=geojson`,{signal:c.signal}).then(i=>i.json()).then(i=>{var u;const r=(u=i.routes)==null?void 0:u[0];if(!r)throw new Error("no route");const o=r.distance/1e3;h({km:o,mins:o/p*60,coords:r.geometry.coordinates.map(([l,d])=>[d,l])})}).catch(i=>{if(c.signal.aborted)return;const r=6371,o=_=>_*Math.PI/180,u=o(n[0]-e[0]),l=o(n[1]-e[1]),d=Math.sin(u/2)**2+Math.cos(o(e[0]))*Math.cos(o(n[0]))*Math.sin(l/2)**2,k=2*r*Math.asin(Math.sqrt(d));h({km:k,mins:k/p*60,coords:[e,n]})}).finally(()=>!c.signal.aborted&&M(!1)),()=>c.abort()},[b]),{route:a,loading:y}}const L=(t,s)=>{const a=[Number(t),Number(s)];return t!==""&&t!=null&&f(a)?a:null};export{N as A,x as C,A as I,L as t,E as u};
