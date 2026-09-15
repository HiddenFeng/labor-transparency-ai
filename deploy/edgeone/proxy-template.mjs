const UPSTREAM=__LTP_UPSTREAM_JSON__;
const BODY_LIMIT=96*1024;
const RESPONSE_HOP_HEADERS=['content-length','transfer-encoding','content-encoding','connection','keep-alive'];

function jsonError(status,message){
  return new Response(JSON.stringify({error:message}),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-LTP-EdgeOne-Proxy':'v1'
    }
  });
}

export default async function onRequest({request}) {
  const incoming=new URL(request.url);
  if(!incoming.pathname.startsWith('/api/'))return jsonError(404,'未找到接口');
  const target=new URL(incoming.pathname+incoming.search,UPSTREAM);
  const headers=new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('connection');
  headers.set('X-LTP-EdgeOne-Proxy','v1');

  const init={method:request.method,headers,redirect:'manual'};
  if(!['GET','HEAD'].includes(request.method)){
    const body=await request.arrayBuffer();
    if(body.byteLength>BODY_LIMIT)return jsonError(413,'请求过大');
    init.body=body;
  }

  try{
    const upstream=await fetch(target,init);
    const body=await upstream.arrayBuffer();
    const responseHeaders=new Headers(upstream.headers);
    for(const name of RESPONSE_HOP_HEADERS)responseHeaders.delete(name);
    responseHeaders.set('X-LTP-EdgeOne-Proxy','v1');
    return new Response(body,{status:upstream.status,statusText:upstream.statusText,headers:responseHeaders});
  }catch{
    return jsonError(502,'后端暂时不可达');
  }
}
