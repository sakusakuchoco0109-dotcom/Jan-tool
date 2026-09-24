const fs=require('fs');
const ENDPOINT='https://script.google.com/macros/s/AKfycbwYj13IWQ9fjn6sWRhzoFIHXtyIdb2mXNeRF2C75-ZvdHpZ8Row1f13NGRt5iF5F72x/exec';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchJson(params,timeoutMs=70000,attempts=7){
  const url=ENDPOINT+'?'+new URLSearchParams({...params,t:String(Date.now())}).toString();
  let last;
  for(let i=1;i<=attempts;i++){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
    try{
      const res=await fetch(url,{redirect:'follow',cache:'no-store',signal:ctrl.signal,headers:{'user-agent':'mitekore-title-index-builder/1.0'}});
      const body=await res.text();
      if(!res.ok)throw new Error('HTTP '+res.status+' '+body.slice(0,300));
      const data=JSON.parse(body);
      if(data&&data.ok!==false)return data;
      throw new Error((data&& (data.message||data.error))||'GAS ok=false');
    }catch(e){last=e;console.warn('attempt',i,'failed',String(e));if(i<attempts)await sleep(Math.min(12000,1200*i));}
    finally{clearTimeout(timer);}
  }
  throw last||new Error('fetch failed');
}
function toKatakana(s){return String(s||'').replace(/[\u3041-\u3096]/g,ch=>String.fromCharCode(ch.charCodeAt(0)+0x60));}
function titleKey(v){
  let s=String(v||'');try{s=s.normalize('NFKC');}catch{}
  s=toKatakana(s).toLowerCase();
  s=s.replace(/[　\s]/g,'');
  s=s.replace(/[・･.．,，:：;；!！?？'"“”‘’\x60｀´（）()[\]【】『』「」〈〉《<>＜＞]/g,'');
  s=s.replace(/[-－ー―‐‑‒–—_＿~〜]/g,'');
  s=s.replace(/Ⅰ/g,'i').replace(/Ⅱ/g,'ii').replace(/Ⅲ/g,'iii').replace(/Ⅳ/g,'iv').replace(/Ⅴ/g,'v').replace(/Ⅵ/g,'vi');
  return s.trim();
}
function compact(r){
  const aliases=Array.isArray(r.aliases)?r.aliases.filter(Boolean):[];
  const unique=[...new Set(aliases.filter(a=>String(a)!==String(r.canonicalTitle||'')))];
  const search=[r.canonicalTitle||'',...unique].map(titleKey).filter(Boolean).join('|');
  const remarks=String(r.remarks||'').trim()==='unreviewed'?'':String(r.remarks||'').trim();
  return [String(r.sharedTitleId||''),String(r.platform||''),String(r.canonicalTitle||''),search,String(r.releaseDate||r.rawReleaseDate||''),String(r.maker||''),String(r.genre||''),remarks,unique,String(r.productCode||r.product_code||''),String(r.jan||'').replace(/\D/g,''),String(r.detailUrl||'')];
}
async function build(){
  fs.mkdirSync('artifacts',{recursive:true});
  const meta=await fetchJson({action:'title_master_meta'},70000,8);
  console.log('META',JSON.stringify(meta));
  const expected=Number(meta.count||0); if(!expected)throw new Error('invalid count');
  const version=String(meta.version||'');
  const chunkSize=Math.min(750,Number(meta.chunk_size||750)||750);
  const rows=[];
  for(let offset=0;offset<expected;offset+=chunkSize){
    const page=await fetchJson({action:'title_master_chunk',offset:String(offset),limit:String(chunkSize),version},90000,8);
    if(String(page.version_master||'')&&String(page.version_master)!==version)throw new Error('version changed '+page.version_master+' != '+version);
    const recs=Array.isArray(page.records)?page.records:[];
    console.log('CHUNK',offset,recs.length,'/',expected);
    rows.push(...recs); await sleep(120);
  }
  const byId=new Map(); for(const r of rows){if(r&&r.sharedTitleId&&r.canonicalTitle)byId.set(String(r.sharedTitleId),r);}
  const final=[...byId.values()];
  const compactRows=final.map(compact);
  const payload={v:1,sourceVersion:version,sourceRevision:Number(meta.revision||0),sourceCount:expected,count:compactRows.length,generatedAt:new Date().toISOString(),rows:compactRows};
  const json=JSON.stringify(payload); fs.writeFileSync('artifacts/title-index-14905.json',json);
  for(const q of ['スーパーマリオワールド','クロノ・トリガー']){
    const k=titleKey(q),hit=compactRows.find(r=>String(r[3]||'').split('|').some(x=>x===k));
    console.log('CHECK',q,hit?JSON.stringify(hit.slice(0,7)):'NOT_FOUND'); if(!hit)throw new Error('known title missing: '+q);
  }
  fs.writeFileSync('artifacts/title-index-build-meta.json',JSON.stringify({sourceVersion:version,sourceRevision:meta.revision,sourceCount:expected,outputCount:compactRows.length,bytes:Buffer.byteLength(json),generatedAt:payload.generatedAt},null,2));
  console.log('DONE',compactRows.length,'bytes',Buffer.byteLength(json));
}
build().catch(e=>{console.error(e.stack||e);process.exit(1);});