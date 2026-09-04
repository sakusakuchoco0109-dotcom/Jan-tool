(async()=>{
  const sheetId='1HQ0q6rb81rdtVZ8v5mklnGNDm3Yu-zecZGOyCRaaLXA';
  const orders=['8966389162','0230927381'];
  const results=[];
  for(const order of orders){
    const cb='probeCb'+order.slice(-4);
    const tq=`select A,B,C,G,H,I,J where A = '${order}' limit 1`;
    const p=new URLSearchParams({sheet:'early_access_orders',tq,tqx:`out:json;responseHandler:${cb}`,headers:'1',t:String(Date.now())});
    const r=await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${p}`,{redirect:'follow'});
    const text=await r.text();
    const start=text.indexOf(cb+'('),end=text.lastIndexOf(');');
    if(start<0||end<0)throw new Error('callback wrapper not found');
    const data=JSON.parse(text.slice(start+cb.length+1,end));
    const row=data?.table?.rows?.[0]?.c||[];
    const cell=i=>String(row?.[i]?.v ?? row?.[i]?.f ?? '');
    results.push({status:r.status,gvizStatus:data?.status,orderMatches:cell(0)===order,active:cell(1)==='有効',hasMaskedHint:cell(3).includes('•'),saltLength:cell(4).length,verifierLength:cell(5).length,iterations:Number(cell(6)||0)});
  }
  console.log('PROBE_GVIZ_FINAL '+JSON.stringify(results));
  if(!results.every(x=>x.status===200&&x.gvizStatus==='ok'&&x.orderMatches&&x.active&&x.hasMaskedHint&&x.saltLength>=16&&x.verifierLength>=40&&x.iterations>=100000))process.exit(2);
})().catch(e=>{console.error(e);process.exit(1)});
