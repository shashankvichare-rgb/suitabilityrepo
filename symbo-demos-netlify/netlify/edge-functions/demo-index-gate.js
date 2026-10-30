const challenge = () => new Response('Password required for the Symbo demo index.', {
  status: 401,
  headers: {
    'WWW-Authenticate': 'Basic realm="Symbo demo index", charset="UTF-8"',
    'Cache-Control': 'private, no-store',
    'Content-Type': 'text/plain; charset=utf-8'
  }
});

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function equalBytes(a,b){
  if(a.length!==b.length)return false;
  let mismatch=0;
  for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];
  return mismatch===0;
}

function credentials(request){
  const match=/^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(request.headers.get('authorization')||'');
  if(!match)return '';
  try{
    const bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }catch{return '';}
}

export default async function gate(request,context){
  const password=Netlify.env.get('DEMO_INDEX_PASSWORD');
  if(!password)return new Response('Demo index is awaiting its Netlify password configuration.',{
    status:503,headers:{'Cache-Control':'private, no-store','Content-Type':'text/plain; charset=utf-8'}
  });
  const expected=await digest(`symbo:${password}`);
  const provided=await digest(credentials(request));
  if(!equalBytes(expected,provided))return challenge();
  const response=await context.next();
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','private, no-store');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
