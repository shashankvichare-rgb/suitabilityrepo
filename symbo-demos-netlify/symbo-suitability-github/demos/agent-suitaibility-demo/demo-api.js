import {initialMasters, questions, assess, makeQuote, validateApplication} from './catalogue.js';

// This intentionally models the supplied server journey only inside one browser.
// No email, OTP, payment, policy issuance, or external record is created.
const KEY='symbo-agent-suitability-demo-v1';
const SESSION='symbo-agent-suitability-session';
const BASE='/demos/agent-suitaibility-demo/';
const now=()=>new Date().toISOString();
const copy=value=>structuredClone(value);
const id=()=>crypto.randomUUID().replaceAll('-','');

function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved && saved.masters && saved.proposals && saved.events)return saved;
  }catch{}
  return {masters:copy(initialMasters),proposals:{},events:{}};
}
function save(db){localStorage.setItem(KEY,JSON.stringify(db));}
function addEvent(db,proposalId,kind,data={}){
  (db.events[proposalId]??=[]).push({at:now(),kind,data:copy(data)});
}
function publicProposal(p){
  const {token,challenge,...visible}=p;
  return copy(visible);
}
function get(db,proposalId){
  const p=db.proposals[proposalId];
  if(!p)throw Error('Demo proposal not found in this browser');
  return p;
}
function getCustomer(db,proposalId,token){
  const p=get(db,proposalId);
  if(!token || p.token!==token)throw Error('Open the customer preview link created in this browser');
  return p;
}
function mustEdit(p){if(p.verifiedAt)throw Error('This demo proposal is already confirmed');}
function pathFor(p){return `${BASE}?customer=${encodeURIComponent(p.id)}#${p.token}`;}

export async function demoApi(path,body,customerToken=''){
  const db=load();
  if(path==='/login'){
    const role=body?.role,code=String(body?.code??'').trim();
    if(!['dealer','agent'].includes(role)||code.length<3||code.length>40)throw Error('Enter a demo agent name');
    const session={role,code};sessionStorage.setItem(SESSION,JSON.stringify(session));
    return session;
  }
  if(path==='/logout'){
    sessionStorage.removeItem(SESSION);
    return {ok:true};
  }
  const customer=path.match(/^\/customer\/([^/]+)(?:\/(.*))?$/);
  if(customer){
    const [,proposalId,action='']=customer,p=getCustomer(db,proposalId,customerToken);
    if(!action)return {proposal:publicProposal(p),events:copy(db.events[proposalId]??[])};
    mustEdit(p);
    if(action==='choices'){
      const choices=body?.choices;
      if(!Array.isArray(choices)||choices.length!==p.quote.items.length||new Set(choices.map(c=>c.id)).size!==choices.length)throw Error('Choose accept or decline for every product');
      for(const item of p.quote.items){
        const c=choices.find(x=>x.id===item.id);
        if(!c||!['accept','decline'].includes(c.decision))throw Error('Choose accept or decline for every product');
        if(c.decision==='accept'&&(c.termsRead!==true||c.consent!==true))throw Error('Read terms and give individual consent for accepted products');
      }
      const accepted=p.quote.items.filter(item=>choices.some(c=>c.id===item.id&&c.decision==='accept'));
      if(accepted.length&&!['loan','separate'].includes(body.paymentMode))throw Error('Choose how to pay for accepted products');
      p.choices=choices.map(c=>({id:c.id,decision:c.decision,termsRead:c.termsRead===true,consent:c.decision==='accept'&&c.consent===true,at:now()}));
      p.paymentMode=accepted.length?body.paymentMode:'none';
      p.acceptedTotal=Math.round(accepted.reduce((n,item)=>n+item.price,0)*100)/100;
      p.challenge=null;p.status='awaiting_otp';p.choiceVersion=(p.choiceVersion??0)+1;
      addEvent(db,p.id,'choices_saved',{choices:p.choices,paymentMode:p.paymentMode,total:p.acceptedTotal,choiceVersion:p.choiceVersion});
      save(db);return {proposal:publicProposal(p)};
    }
    if(action==='otp'){
      if(!p.choices)throw Error('Save your choices first');
      const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000);
      p.challenge={code,expiresAt:Date.now()+5*60*1000,attempts:0,choiceVersion:p.choiceVersion,id:id()};
      addEvent(db,p.id,'otp_requested',{channel:'on_screen_demo',challengeId:p.challenge.id,choiceVersion:p.choiceVersion});
      save(db);return {ok:true,demoCode:code,expiresAt:new Date(p.challenge.expiresAt).toISOString()};
    }
    if(action==='verify'){
      const c=p.challenge;
      if(!c||Date.now()>c.expiresAt||c.choiceVersion!==p.choiceVersion)throw Error('Demo code expired. Generate a new one');
      if(c.attempts>=5)throw Error('Too many attempts. Generate a new demo code');
      c.attempts++;
      if(String(body?.otp)!==c.code){addEvent(db,p.id,'otp_attempt_failed',{attempt:c.attempts});save(db);throw Error('Incorrect demo verification code');}
      p.verifiedAt=now();p.verification={channel:'on_screen_demo',challengeId:c.id,choiceVersion:c.choiceVersion,verifiedAt:p.verifiedAt};
      p.challenge=null;p.status=p.paymentMode==='separate'?'payment_pending':'ready';
      addEvent(db,p.id,'consent_verified',p.verification);save(db);
      return {proposal:publicProposal(p)};
    }
    throw Error('Unknown customer action');
  }
  const session=JSON.parse(sessionStorage.getItem(SESSION)||'null');
  if(!session)throw Error('Enter the demo workspace');
  if(path==='/bootstrap'){
    const proposals=Object.values(db.proposals).filter(p=>!p.archived).reverse().map(p=>({id:p.id,reference:p.reference,name:p.application.name,status:p.status,total:p.acceptedTotal??p.quote.total,createdAt:p.createdAt}));
    return {session,masters:copy(db.masters),questions:copy(questions),emailConfigured:false,publicUrl:location.origin+BASE,proposals};
  }
  if(path==='/assess')return {products:assess(body.application,db.masters),masterVersion:db.masters.version};
  if(path==='/quote')return makeQuote(body.application,db.masters,body.selections);
  if(path==='/proposals'){
    validateApplication(body.application);
    const quote=makeQuote(body.application,db.masters,body.selections);
    const proposalId=id();
    const p={id:proposalId,reference:`SYM-DEMO-${proposalId.slice(0,6).toUpperCase()}`,createdAt:now(),agent:session.code,role:session.role,portfolio:'consumer_durable',application:copy(body.application),quote,assessment:assess(body.application,db.masters),token:id()+id(),status:'proposal_created',verifiedAt:null};
    db.proposals[p.id]=p;addEvent(db,p.id,'proposal_created',{masterVersion:db.masters.version,agent:session.code,role:session.role,total:quote.total,mode:'browser_demo'});
    save(db);return {proposal:publicProposal(p),customerPath:pathFor(p)};
  }
  const proposal=path.match(/^\/proposals\/([^/]+)(?:\/(.*))?$/);
  if(proposal){
    const [,proposalId,action='']=proposal,p=get(db,proposalId);
    if(!action)return {proposal:publicProposal(p),events:copy(db.events[proposalId]??[])};
    if(action==='send'){
      mustEdit(p);p.lastSentAt=now();p.status=p.choices?'awaiting_otp':'sent';
      addEvent(db,p.id,'proposal_email_simulated',{channel:'on_screen_demo',status:'simulated'});
      save(db);return {proposal:publicProposal(p),customerPath:pathFor(p)};
    }
    if(action==='preview-link'){
      addEvent(db,p.id,'customer_view_opened',{mode:'same_browser'});save(db);
      return {customerPath:pathFor(p)};
    }
  }
  if(path==='/masters'){
    if(session.role!=='agent')throw Error('Use Agent mode to edit demo masters');
    if(body.expectedVersion!==db.masters.version)throw Error('Demo masters changed. Reload before saving');
    const m=copy(body.masters);
    if(!Array.isArray(m.assets)||!Array.isArray(m.products)||m.products.length!==6)throw Error('Invalid demo master');
    if(!['strict','flexible'].includes(m.recommendationMode))throw Error('Invalid recommendation mode');
    if(!Number.isFinite(m.ewTaxPercent)||m.ewTaxPercent<0||m.ewTaxPercent>50)throw Error('Invalid tax setting');
    m.version=db.masters.version+1;m.updatedAt=now();m.updatedBy=session.code;
    db.masters=m;addEvent(db,'masters','masters_updated',{version:m.version,by:session.code});save(db);
    return {masters:copy(m)};
  }
  throw Error('Unknown demo action');
}
