const APP='https://hilarious-haupia-6e0406.netlify.app/';
(async()=>{
  const html=await (await fetch(APP)).text();
  const m=html.match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/);
  if(!m) throw new Error('endpoint not found');
  const u=new URL(m[0]);
  u.searchParams.set('action','early_access_verify');
  u.searchParams.set('orderNumber','99999998');
  const r=await fetch(u,{redirect:'follow'});
  const text=await r.text();
  let data={};try{data=JSON.parse(text)}catch{}
  const email=String(data.purchase_email||data.purchaseEmail||data.email||'');
  console.log(JSON.stringify({status:r.status,keys:Object.keys(data).sort(),ok:data.ok,authorized:data.authorized,hasEmail:!!email}));
})().catch(e=>{console.error(e);process.exit(1)});
