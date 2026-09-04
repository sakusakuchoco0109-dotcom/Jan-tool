(async()=>{
  const sheetId='1HQ0q6rb81rdtVZ8v5mklnGNDm3Yu-zecZGOyCRaaLXA';
  const order='8966389162';
  const cb='probeCb';
  const tq=`select A,B,C,G,H,I,J where A = '${order}' limit 1`;
  const p=new URLSearchParams({sheet:'early_access_orders',tq,tqx:`out:json;responseHandler:${cb}`,t:String(Date.now())});
  const u=`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${p}`;
  const r=await fetch(u,{redirect:'follow'});
  const text=await r.text();
  const m=text.match(/^\s*probeCb\((.*)\)\s*;?\s*$/s);
  if(!m) throw new Error('JSONP response not parseable');
  const data=JSON.parse(m[1]);
  const row=data?.table?.rows?.[0]?.c||[];
  const cell=i=>String(row?.[i]?.v ?? row?.[i]?.f ?? '');
  const out={status:r.status,gvizStatus:data?.status,orderMatches:cell(0)===order,active:cell(1)==='有効',campaignPresent:!!cell(2),hasMaskedHint:cell(3).includes('•'),saltLength:cell(4).length,verifierLength:cell(5).length,iterations:Number(cell(6)||0)};
  console.log('PROBE_MASKED_VERIFIER '+JSON.stringify(out));
  if(!(out.status===200&&out.gvizStatus==='ok'&&out.orderMatches&&out.active&&out.hasMaskedHint&&out.saltLength>=16&&out.verifierLength>=40&&out.iterations>=100000)) process.exit(2);
})().catch(e=>{console.error(e);process.exit(1)});
