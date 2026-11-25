const ORIGIN="https://bastorociopa-alt.github.io";
const headers=o=>({"Access-Control-Allow-Origin":o===ORIGIN||o==="http://localhost:5500"?o:ORIGIN,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"});
const reply=(d,s,o)=>new Response(JSON.stringify(d),{status:s,headers:{...headers(o),"Content-Type":"application/json","Cache-Control":"no-store"}});
const valid=n=>/^[\p{L}\p{M}][\p{L}\p{M} '\u2019-]{1,31}$/u.test(n);
function type(b){if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)return"image/png";if(b[0]===255&&b[1]===216&&b[2]===255)return"image/jpeg";if(String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP")return"image/webp";return null;}
export default {async fetch(req,env){
const o=req.headers.get("Origin")||"",u=new URL(req.url);
try{
if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(o)});
if(!env.DB||!env.AVATARS)return reply({error:"Faltan las conexiones D1 y R2."},503,o);
if(u.pathname==="/api/members"&&req.method==="GET"){
const q=await env.DB.prepare("SELECT nickname,avatar_key,joined_at FROM members ORDER BY joined_at DESC LIMIT 200").all();
const base=(env.PUBLIC_AVATAR_BASE||"").replace(/\/$/,"");
return reply({members:(q.results||[]).map(x=>({nickname:x.nickname,joinedAt:x.joined_at,avatarUrl:x.avatar_key&&base?base+"/"+x.avatar_key:null}))},200,o);
}
if(u.pathname==="/api/register"&&req.method==="POST"){
if(Number(req.headers.get("Content-Length")||0)>2800000)return reply({error:"Solicitud demasiado grande."},413,o);
let f;try{f=await req.formData()}catch{return reply({error:"Formulario no válido."},400,o)}
const n=String(f.get("nickname")||"").trim();if(!valid(n))return reply({error:"Nombre no válido (2-32 letras)."},400,o);
const norm=n.normalize("NFKC").toLocaleLowerCase("es");
if(await env.DB.prepare("SELECT 1 FROM members WHERE nickname_normalized=?").bind(norm).first())return reply({error:"Ese nombre ya está registrado."},409,o);
let key=null;const file=f.get("avatar");
if(file&&file.size){if(file.size>2097152)return reply({error:"Imagen superior a 2 MB."},413,o);const b=new Uint8Array(await file.arrayBuffer()),t=type(b);if(!t)return reply({error:"Imagen JPG, PNG o WEBP no válida."},400,o);key="avatars/"+crypto.randomUUID();await env.AVATARS.put(key,b,{httpMetadata:{contentType:t,cacheControl:"public, max-age=31536000, immutable"}});}
const date=new Date().toISOString();
try{await env.DB.prepare("INSERT INTO members(nickname,nickname_normalized,avatar_key,joined_at) VALUES(?,?,?,?)").bind(n,norm,key,date).run();}
catch(e){if(key)await env.AVATARS.delete(key);if(String(e).includes("UNIQUE"))return reply({error:"Ese nombre ya está registrado."},409,o);throw e;}
return reply({ok:true,joinedAt:date},201,o);
}
return reply({error:"Ruta no encontrada."},404,o);
}catch(e){return reply({error:"Error interno del servidor."},500,o);}
}};