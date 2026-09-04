const fs=require('fs');
(async()=>{
  const endpoints=fs.readFileSync('mitekore-auth-endpoints.txt','utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const out=[];
  for(let i=0;i<endpoints.length;i++){
    try{
      const cb='probeCb';
      const u=new URL(endpoints[i]);
      u.searchParams.set('action','early_access_verify');
      u.searchParams.set('orderNumber','99999998');
      u.searchParams.set('callback',cb);
      u.searchParams.set('t',String(Date.now()));
      const r=await fetch(u,{redirect:'follow'});
      const text=await r.text();
      let data={};
      const m=text.match(/^\s*probeCb\((.*)\)\s*;?\s*$/s);
      try{ data=m?JSON.parse(m[1]):JSON.parse(text); }catch{}
      const email=String(data.purchase_email||data.purchaseEmail||data.email||'');
      out.push({i,status:r.status,keys:Object.keys(data).sort(),action:data.action,ok:data.ok,authorized:data.authorized,hasEmail:!!email,emailIsDummy:email==='preview-probe@example.com'});
    }catch(e){out.push({i,error:String(e&&e.message||e)})}
  }
  console.log('PROBE_JSONP '+JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1)});
