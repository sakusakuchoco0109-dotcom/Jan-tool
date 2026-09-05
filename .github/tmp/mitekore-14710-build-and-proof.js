const fs=require('fs');
const zlib=require('zlib');
const {applyPatch}=require('diff');
(async()=>{
  const app=process.env.APP_URL;
  const r=await fetch(app,{redirect:'follow'});
  if(!r.ok)throw new Error(`live html fetch failed ${r.status}`);
  const live=await r.text();
  const parts=[0,1,2,3,4].map(i=>fs.readFileSync(`.github/tmp/mitekore-14710-clean.patch.part0${i}`,'utf8')).join('');
  const patch=zlib.gunzipSync(Buffer.from(parts,'base64')).toString('utf8');
  const cleaned=applyPatch(live,patch);
  if(cleaned===false)throw new Error('14710 clean patch did not apply to live html');
  if(!cleaned.includes('fujiyaAuthoritativePtAndLikeRC14710'))throw new Error('14710 marker missing');
  if(cleaned.includes('pt_like_bootstrap_frame')||cleaned.includes('fujiyaBootstrapLegacyLikes14708'))throw new Error('retired legacy like runtime still present');
  fs.writeFileSync('app.html',cleaned);
  require('./mitekore-14710-clean-proof.js');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});