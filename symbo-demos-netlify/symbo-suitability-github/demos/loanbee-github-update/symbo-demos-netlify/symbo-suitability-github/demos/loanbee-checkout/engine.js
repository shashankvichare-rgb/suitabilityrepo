(function(root) {
  'use strict';
  const C=typeof module!=='undefined'&&module.exports?require('./config.js'):root.SymboConfig;
  const D=typeof module!=='undefined'&&module.exports?require('./source-data.js'):root.SymboSource;
  const copy=x=>JSON.parse(JSON.stringify(x));
  const paise=n=>Math.round((n+Number.EPSILON)*100);
  const money=(n,decimals=2)=>n===null?'Pending':new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(n);
  const classify=n=>n>=80?'High Fit':n>=65?'Relevant':n>=50?'Consider':'Not Recommended';
  function validate(p){
    const errors={};
    for(const [,fields] of C.fields)for(const [k,label,type,min,max] of fields){
      if(type==='number'&&(!Number.isFinite(p[k])||p[k]<min||p[k]>max||!Number.isInteger(p[k])))errors[k]=`${label}: enter a whole number from ${min} to ${max}.`;
      if(Array.isArray(type)&&!type.includes(p[k]))errors[k]=`${label}: select a listed option.`;
      if(type==='text'&&(typeof p[k]!=='string'||!p[k].trim()||p[k].length>80))errors[k]=`${label}: enter 1–80 characters.`;
    }
    if(p.children>p.dependants)errors.children='Children cannot exceed total dependants in this demo.';
    return errors;
  }
  function scores(p){return C.insuranceCatalogue.map((product,index)=>{
    const contributions=C.suitabilityRules[product.id].filter(x=>x.when(p)).map(({label,points})=>({label,points}));
    const raw=20+contributions.reduce((n,x)=>n+x.points,0),score=Math.min(100,Math.max(0,raw));
    return {...product,order:index,raw,score,classification:classify(score),contributions,reasons:contributions.filter(x=>x.points>0).map(x=>x.label)};
  }).sort((a,b)=>b.score-a.score||a.order-b.order);}
  function rateCards(id,p){
    const safe=D.records[id].filter(r=>r.months<=p.tenure&&(id!=='accident'||(r.months<=12&&r.coverDays>0&&r.coverDays<=366))&&!D.conflicts.some(c=>c.product===id&&c.months===r.months&&c.cover===r.cover));
    const months=Math.max(0,...safe.map(r=>r.months));
    const groups=new Map();
    for(const r of safe.filter(r=>r.months===months)){
      const key=`${r.cover}:${r.premium}`;
      if(!groups.has(key))groups.set(key,{...r,variants:[]});
      groups.get(key).variants.push({id:r.id,sourcePrincipal:r.sourcePrincipal,netVas:r.netVas,source:r.source});
    }
    return [...groups.values()].sort((a,b)=>a.cover-b.cover||a.premium-b.premium);
  }
  function coverage(id,p){
    const tiers=rateCards(id,p);
    let target,reason;
    switch(id){
      case 'accident':target=p.loanAmount;reason='Loan amount as the demo cover target';break;
      case 'emi':target=p.emi;reason='One monthly EMI as the demo cover target';break;
      case 'cyber':target=p.loanAmount*.2;reason='20% of loan amount as an illustrative digital-loss cover target';break;
      case 'hospi':target=p.age>=45||p.health==='High'||p.healthIndicator==='Yes'?15000:7500;reason='Age / health exposure determines the demo workbook-cover target';break;
      case 'vector':target=p.vector==='High'?10000:p.vector==='Medium'?5000:2500;reason='Illustrative vector exposure determines the demo cover target';break;
    }
    const recommended=tiers.find(r=>r.cover>=target)||tiers.at(-1)||null;
    return {tiers,recommended,target,reason,limited:recommended?recommended.cover<target:true};
  }
  function vasRanking(p,insuranceIds){
    return D.vasCatalogue.map(v=>{
      const contributions=[];
      for(const r of C.vasRules)if(r.when(p))for(const [id,points]of r.weights)if(id===v.id)contributions.push({label:r.label,points});
      for(const id of insuranceIds)for(const [vasId,points]of C.bundleRules[id]||[])if(vasId===v.id)contributions.push({label:`${C.insuranceCatalogue.find(x=>x.id===id).short} bundle`,points});
      return {...v,category:C.categories[v.id],score:contributions.reduce((n,x)=>n+x.points,0),contributions};
    }).sort((a,b)=>b.score-a.score||a.id-b.id);
  }
  function topVas(ranked,excluded=[]){
    const result=[];
    for(const v of ranked){
      if(v.score<=0||excluded.includes(v.id))continue;
      // Full-body/basic/vector blood checks overlap; keep the highest scoring one.
      if([5,11,20].includes(v.id)&&result.some(x=>[5,11,20].includes(x)))continue;
      result.push(v.id);if(result.length===4)break;
    }return result;
  }
  function recommendationEngine(p){
    const errors=validate(p);if(Object.keys(errors).length)return {errors};
    const ranked=scores(p).map(x=>({...x,coverage:coverage(x.id,p)}));
    const recommended=ranked.filter(x=>x.score>=65).slice(0,3);
    const vas=vasRanking(p,recommended.map(x=>x.id));
    return {errors:{},ranked,recommended,vas,recommendedVas:topVas(vas),ratio:p.emi/p.income*100};
  }
  function newSession(p,sequence=1,time=new Date().toISOString()){
    const result=recommendationEngine(p);
    if(Object.keys(result.errors).length)throw new Error('Cannot create a decision from invalid customer signals');
    const selectedInsurance=result.recommended.filter(x=>x.coverage.recommended).slice(0,1).map(x=>({id:x.id,rateId:x.coverage.recommended.id}));
    const selectedVas=topVas(vasRanking(p,selectedInsurance.map(x=>x.id)));
    return {profile:copy(p),sequence,id:`SYM-${time.replace(/\D/g,'').slice(0,14)}-${String(sequence).padStart(4,'0')}`,createdAt:time,result,selectedInsurance,selectedVas,removed:[],excludedVas:[],events:[{action:'Profile evaluated; primary selected; optional recommendations presented',at:time}],choice:'Pending',consentAt:null};
  }
  function selectedRates(s){return s.selectedInsurance.map(x=>s.result.ranked.find(r=>r.id===x.id).coverage.tiers.find(r=>r.id===x.rateId));}
  function vasBundleReferences(s){
    if(!s.selectedVas.length)return [];
    return selectedRates(s).map((rate,index)=>{
      const variants=rate.variants.filter(v=>Number.isFinite(v.netVas)&&v.netVas>=0);
      const fees=variants.map(v=>v.netVas);
      return {insuranceId:s.selectedInsurance[index].id,plan:rate.plan,cover:rate.cover,months:rate.months,
        minimum:fees.length?Math.min(...fees):null,maximum:fees.length?Math.max(...fees):null,
        variants:copy(variants),status:'Alternative source-row references; charged fee is identified in pricing.vasSource'};
    });
  }
  function pricing(s){
    const rates=selectedRates(s),insurancePaise=rates.reduce((n,r)=>n+paise(r.premium),0);
    // Approved demo rule: use the corresponding net VAS fee from the primary
    // insurance's exact selected source row, once, regardless of service count.
    const primary=s.result.ranked.find(r=>s.selectedInsurance.some(x=>x.id===r.id));
    const selected=primary?s.selectedInsurance.find(x=>x.id===primary.id):null;
    const rate=selected?rates.find(r=>r.id===selected.rateId):null;
    const hasFee=rate&&Number.isFinite(rate.netVas)&&rate.netVas>=0;
    const vasPaise=!s.selectedVas.length?0:hasFee?paise(rate.netVas):null;
    return {insurance:insurancePaise/100,vas:vasPaise===null?null:vasPaise/100,total:vasPaise===null?null:(insurancePaise+vasPaise)/100,
      status:vasPaise===null?'Select insurance with a corresponding VAS fee':'Primary insurance row VAS fee; charged once per package',
      vasSource:s.selectedVas.length&&hasFee?{insuranceId:primary.id,rateId:rate.id,plan:rate.plan,rawPremium:rate.premium,rawVas:rate.netVas,sourcePrincipal:rate.sourcePrincipal,source:copy(rate.source)}:null,
      rule:'primary-selected-row-once',referenceOnly:rates.length>0};
  }
  function change(s,action,payload,time=new Date().toISOString()){
    const next=copy(s);let rec;
    if(action==='removeInsurance'){
      if(!next.selectedInsurance.some(x=>x.id===payload))return s;
      next.selectedInsurance=next.selectedInsurance.filter(x=>x.id!==payload);next.removed.push({type:'insurance',id:payload,at:time});
    }else if(action==='addInsurance'){
      rec=next.result.ranked.find(x=>x.id===payload);
      if(!rec||rec.score<65||!rec.coverage.recommended||next.selectedInsurance.length>=3||next.selectedInsurance.some(x=>x.id===payload))return s;
      next.selectedInsurance.push({id:payload,rateId:rec.coverage.recommended.id});
    }else if(action==='coverage'){
      rec=next.result.ranked.find(x=>x.id===payload.id);
      if(!rec?.coverage.tiers.some(x=>x.id===payload.rateId)||!next.selectedInsurance.some(x=>x.id===payload.id))return s;
      next.selectedInsurance.find(x=>x.id===payload.id).rateId=payload.rateId;
    }else if(action==='removeVas'){
      if(!next.selectedVas.includes(payload))return s;
      next.selectedVas=next.selectedVas.filter(x=>x!==payload);next.excludedVas=[...new Set([...next.excludedVas,payload])];next.removed.push({type:'vas',id:payload,at:time});
    }else if(action==='addVas'){
      if(next.selectedVas.length>=4||next.selectedVas.includes(payload)||!vasRanking(next.profile,next.selectedInsurance.map(x=>x.id)).some(v=>v.id===payload&&v.score>0))return s;
      if([5,11,20].includes(payload)&&next.selectedVas.some(x=>[5,11,20].includes(x)))return s;
      next.selectedVas.push(payload);next.excludedVas=next.excludedVas.filter(x=>x!==payload);
    }else if(action==='skip'){
      next.removed.push(...next.selectedInsurance.map(x=>({type:'insurance',id:x.id,at:time})),...next.selectedVas.map(id=>({type:'vas',id,at:time})));
      next.selectedInsurance=[];next.selectedVas=[];next.excludedVas=D.vasCatalogue.map(x=>x.id);next.choice='Skipped';next.consentAt=time;
    }else if(action==='consent'){
      if(!next.selectedInsurance.length&&!next.selectedVas.length)return s;
      next.choice='Accepted demo selection';next.consentAt=time;
    }else return s;
    if(['removeInsurance','addInsurance'].includes(action)){
      // Re-evaluate bundle relevance without silently refilling customer-removed services.
      const ranked=vasRanking(next.profile,next.selectedInsurance.map(x=>x.id));
      next.selectedVas=ranked.filter(v=>v.score>0&&next.selectedVas.includes(v.id)).map(v=>v.id);
    }
    if(!['skip','consent'].includes(action)){next.choice='Pending';next.consentAt=null;}
    next.events.push({action,payload,at:time});return next;
  }
  function audit(s){
    const selected=selectedRates(s),vas=vasRanking(s.profile,s.selectedInsurance.map(x=>x.id));
    return {recommendationId:s.id,ruleVersion:C.version,simulated:true,simulatedTimestamp:s.createdAt,profile:copy(s.profile),signalsEvaluated:copy(s.profile),emiToIncome:s.result.ratio,
      scores:s.result.ranked.map(r=>({id:r.id,score:r.score,raw:r.raw,classification:r.classification,contributions:r.contributions})),
      recommendationsPresented:s.result.recommended.map(r=>({id:r.id,score:r.score,rationale:r.reasons,engineRecommendedCover:r.coverage.recommended,coverageReason:r.coverage.reason})),
      selectedInsurance:s.selectedInsurance.map((r,i)=>({...r,engineRecommendedCover:s.result.ranked.find(x=>x.id===r.id).coverage.recommended,customerSelectedCover:selected[i]})),
      selectedVas:vas.filter(x=>s.selectedVas.includes(x.id)),availableVasBundleFees:vasBundleReferences(s),removedRecommendations:copy(s.removed),pricing:pricing(s),customerChoice:s.choice,consentTimestamp:s.consentAt,events:copy(s.events),sourceNotes:D.notes};
  }
  const api={validate,money,paise,classify,scores,rateCards,coverage,vasRanking,topVas,recommendationEngine,newSession,selectedRates,vasBundleReferences,pricing,change,audit};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SymboEngine=api;
})(typeof window!=='undefined'?window:globalThis);
