(() => {
const api=((window.GPT_REBELLION_CONFIG||{}).API_BASE||"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
const list=$("memberList"), count=$("memberCount"), status=$("memberStatus"), form=$("joinForm"), msg=$("formMessage"), file=$("avatar");
const ready=api.startsWith("https://")&&!api.includes("PON_AQUI");
function note(t,bad=false){msg.textContent=t;msg.classList.toggle("error",bad);}
function render(rows){
count.textContent=String(rows.length).padStart(2,"0");list.replaceChildren();
if(!rows.length){list.innerHTML='<div class="empty-state">Todavía no hay rebeldes registrados. ¡Puedes ser el primero!</div>';return;}
rows.forEach(m=>{
const card=document.createElement("article");card.className="member-card";
const av=document.createElement("div");av.className="avatar";
if(m.avatarUrl){const im=document.createElement("img");im.src=m.avatarUrl;im.alt="";im.loading="lazy";av.append(im);}
else av.textContent=(m.nickname||"?").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const info=document.createElement("div");info.className="member-info";
const name=document.createElement("strong");name.textContent=m.nickname;
const date=document.createElement("small");date.textContent="DESDE "+new Date(m.joinedAt).toLocaleDateString("es-ES");
info.append(name,date);card.append(av,info);list.append(card);
});
}
async function load(){
if(!ready){count.textContent="—";status.textContent="API PENDIENTE DE CONFIGURAR";list.innerHTML='<div class="empty-state">La página está montada. Falta conectar el Worker de Cloudflare.</div>';return;}
try{const r=await fetch(api+"/api/members");if(!r.ok)throw Error();const d=await r.json();render(d.members||[]);status.textContent="SISTEMA EN LÍNEA";}
catch{status.textContent="CONEXIÓN NO DISPONIBLE";list.innerHTML='<div class="empty-state">No se pudo conectar con el registro.</div>';}
}
file.addEventListener("change",()=>{$("fileName").textContent=file.files[0]?.name||"PNG, JPG o WEBP. Evita fotos de otras personas sin su permiso.";});
form.addEventListener("submit",async e=>{
e.preventDefault();if(!ready){note("El registro se activará al conectar el Worker.",true);return;}
const n=$("nickname").value.trim(), f=file.files[0];
if(!/^[\p{L}\p{M}][\p{L}\p{M} '\u2019-]{1,31}$/u.test(n)){note("Usa entre 2 y 32 letras.",true);return;}
if(f&&(!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>2097152)){note("La imagen debe ser JPG, PNG o WEBP y pesar 2 MB como máximo.",true);return;}
const body=new FormData();body.append("nickname",n);if(f)body.append("avatar",f);
$("submitText").textContent="REGISTRANDO...";form.querySelector("button").disabled=true;
try{const r=await fetch(api+"/api/register",{method:"POST",body});const d=await r.json();if(!r.ok)throw Error(d.error||"Error de registro.");form.reset();note("¡YA FORMAS PARTE DE GPT REBELLION!");await load();}
catch(err){note(err.message,true);}
finally{$("submitText").textContent="CONFIRMAR MI REBELIÓN";form.querySelector("button").disabled=false;}
});
load();
})();