const APP='https://hilarious-haupia-6e0406.netlify.app/';
(async()=>{
  const html=await (await fetch(APP)).text();
  const endpoints=[...new Set(html.match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/g)||[])];
  if(!endpoints.length) throw new Error('endpoint not found');
  const out=[];
  for(let i=0;i<endpoints.length;i++){
    try{
      const u=new URL(endpoints[i]);
      u.searchParams.set('action','early_access_verify');
      u.searchParams.set('orderNumber','99999998');
      const r=await fetch(u,{redirect:'follow'});
      const text=await r.text();
      let data={};try{data=JSON.parse(text)}catch{}
      const email=String(data.purchase_email||data.purchaseEmail||data.email||'');
      out.push({i,status:r.status,keys:Object.keys(data).sort(),ok:data.ok,authorized:data.authorized,hasEmail:!!email,emailIsDummy:email==='preview-probe@example.com'});
    }catch(e){out.push({i,error:String(e&&e.message||e)})}
  }
  console.log('PROBE_ALL '+JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1)});
