/* =====================================================================
   Módulos ao estilo Moloni
   Documentos de venda, transporte, liquidações, compras e stocks,
   fornecedores, vendedores, controlo de stocks, consultas e configurações.
   Depende das funções globais do index.html ($, S, esc, eur, num, uid,
   today, fdate, addDays, save, mgo, calc, vsi, pdfNew, pdfEnd, dlBlob, dl,
   qcsv, ensureClient, findClient, cname, barChart, hbars, SYNC).
   ===================================================================== */

/* ---------- tipos de documento ---------- */
var MT={
 FT:{n:"Fatura",pl:"Faturas",g:"v",e:"cli",div:1,stk:-1,fis:1},
 FS:{n:"Fatura Simplificada",pl:"Faturas Simplificadas",g:"v",e:"cli",pago:1,stk:-1,fis:1},
 FR:{n:"Fatura-Recibo",pl:"Faturas-Recibo",g:"v",e:"cli",pago:1,stk:-1,fis:1},
 ND:{n:"Nota de Débito",pl:"Notas de Débito",g:"v",e:"cli",div:1,fis:1},
 GR:{n:"Guia de Remessa",pl:"Guias de Remessa",g:"t",e:"cli",stk:-1,tr:1,fis:1},
 GT:{n:"Guia de Transporte",pl:"Guias de Transporte",g:"t",e:"cli",stk:-1,tr:1,fis:1},
 DV:{n:"Nota de Devolução de Cliente",pl:"Notas Devolução Cliente",g:"t",e:"cli",stk:1,tr:1,fis:1},
 NE:{n:"Nota de Encomenda",pl:"Notas de Encomenda",g:"o",e:"cli"},
 PF:{n:"Fatura Pró-forma",pl:"Faturas Pró-forma",g:"o",e:"cli"},
 DI:{n:"Documento Interno",pl:"Documentos Internos",g:"o",e:"cli"},
 RC:{n:"Recibo",pl:"Recibos",g:"l",e:"cli",liq:1,fis:1},
 NC:{n:"Nota de Crédito",pl:"Notas de Crédito",g:"l",e:"cli",cred:1,stk:1,fis:1},
 NEF:{n:"Nota de Encomenda a Fornecedor",pl:"Notas de Encomenda a Fornecedores",g:"f",e:"forn",c:"NEF"},
 FTF:{n:"Fatura de Fornecedor",pl:"Faturas de Fornecedores",g:"f",e:"forn",div:1,stk:1,ext:1,c:"FTF"},
 NCF:{n:"Nota de Crédito de Fornecedor",pl:"Notas de Crédito de Fornecedores",g:"f",e:"forn",cred:1,stk:-1,ext:1,c:"NCF"},
 RCF:{n:"Pagamento a Fornecedor",pl:"Pagamentos a Fornecedores",g:"f",e:"forn",liq:1,c:"PGF"},
 NQ:{n:"Nota de Quebra",pl:"Notas de Quebra",g:"s",e:"",stk:-1},
 EI:{n:"Entrada de Inventário",pl:"Entradas de Inventário",g:"s",e:"",stk:1},
 SI:{n:"Saída de Inventário",pl:"Saídas de Inventário",g:"s",e:"",stk:-1}
};
/* documentos para que cada tipo pode ser convertido (como o "Gerar" do Moloni) */
var MCONV={NE:["FT","FR","GR","PF"],PF:["FT","FR"],GR:["FT","FR"],GT:["FT"],FT:["RC","NC","GR"],ND:["RC"],FS:["NC"],FR:["NC"],NEF:["FTF"],FTF:["RCF","NCF"],DI:["FT","NE"]};
var MCRED={NC:["FT","FS","FR","ND"],NCF:["FTF"]};
var MLIQ={RC:["FT","ND"],RCF:["FTF"]};
var MSALES=["FT","FS","FR","ND","NC"],MBUY=["FTF","NCF"];

/* ---------- estado ---------- */
var MD={t:"FT",mode:"list",q:"",est:"",adv:false,de:"",ate:"",ent:"",pg:0,cur:null,ro:false,ps:""};
var MV=0,MPC=null;
var MPS=30;

function rd(n){return Math.round((+n||0)*100)/100}
function mDocs(){return S.docs||(S.docs=[])}
function mSups(){return S.sups||(S.sups=[])}
function mOkDocs(){return !(SYNC&&SYNC.ok&&SYNC.ok.documentos===false)}
function mOkSups(){return !(SYNC&&SYNC.ok&&SYNC.ok.fornecedores===false)}
var MSQL='<div class="mwarn">Para guardar estes dados falta executar uma vez o ficheiro <b>supabase-moloni.sql</b> no Supabase (SQL Editor). Até lá, nada do que criar aqui fica gravado.</div>';

function mCfg(){var c=S.cfg,m=c.mol;if(!m)m=c.mol={};
 var def={series:[{c:String(new Date().getFullYear()),a:1}],vend:[],arm:["Armazém principal"],mpag:["Numerário","Multibanco","Transferência bancária","MB WAY","Cheque"],
  prazos:[{n:"Pronto pagamento",d:0},{n:"15 dias",d:15},{n:"30 dias",d:30},{n:"60 dias",d:60}],mexp:["Entrega em mão","Transportadora","CTT","Recolha pelo cliente"],viat:[],
  un:["Un.","Hora","Metro","Kg","Caixa"],taxas:[{n:"Taxa normal",v:23},{n:"Taxa intermédia",v:13},{n:"Taxa reduzida",v:6},{n:"Isento",v:0}],isen:"M07 - Isento nos termos do artigo 9.º do CIVA",msgs:{},banco:{n:"",iban:"",swift:""}};
 Object.keys(def).forEach(function(k){if(m[k]==null)m[k]=def[k]});return m}
function mSerie(){var m=mCfg();var a=m.series.filter(function(x){return x.a})[0]||m.series[0];return a?a.c:"A"}

/* ---------- contas ---------- */
function mLn(l){var q=num(l.q),p=num(l.p),b=q*p,ds=b*Math.min(100,Math.max(0,num(l.ds)))/100;return {br:b,ds:ds,b:b-ds}}
function mTot(d){var T=MT[d.t]||{},r={br:0,ds:0,il:0,iva:0,tot:0,tx:{}};
 if(T.liq){(d.liq||[]).forEach(function(x){r.tot+=num(x.v)});r.tot=rd(r.tot);r.il=r.tot;r.br=r.tot;return r}
 var dg=Math.min(100,Math.max(0,num(d.dg)));
 (d.ln||[]).forEach(function(l){var x=mLn(l),g=x.b*dg/100,base=x.b-g,tx=num(l.iva),iv=base*tx/100,k=String(tx);r.br+=x.br;r.ds+=x.ds+g;r.il+=base;r.iva+=iv;if(!r.tx[k])r.tx[k]={b:0,v:0};r.tx[k].b+=base;r.tx[k].v+=iv});
 r.br=rd(r.br);r.ds=rd(r.ds);r.il=rd(r.il);r.iva=rd(r.iva);r.tot=rd(r.il+r.iva);return r}
function mLive(d){return d&&d.est==="F"}
function mPays(){if(MPC&&MPC.v===MV&&MPC.n===mDocs().length)return MPC.m;var m={};
 mDocs().forEach(function(x){if(!mLive(x))return;var X=MT[x.t]||{};if(X.liq)(x.liq||[]).forEach(function(l){m[l.id]=(m[l.id]||0)+num(l.v)});else if(X.cred&&x.rel)m[x.rel]=(m[x.rel]||0)+mTot(x).tot});
 MPC={v:MV,n:mDocs().length,m:m};return m}
function mPago(d){var T=MT[d.t]||{};if(T.pago)return mTot(d).tot;return rd(mPays()[d.id]||0)}
function mDiv(d){var T=MT[d.t]||{};if(!T.div||!mLive(d))return 0;return Math.max(0,rd(mTot(d).tot-mPago(d)))}
function mCode(t){return (MT[t]||{}).c||t}
function mNum(d){return mCode(d.t)+(d.s||"")+"/"+(d.n||"")}
function mNext(t,s){var m=0;mDocs().forEach(function(x){if(x.t===t&&x.s===s&&x.n)m=Math.max(m,+x.n)});return m+1}
function mSign(d){return d.t==="NC"||d.t==="NCF"?-1:1}
function mTouch(){MV++;MPC=null}
function mSave(){mTouch();save()}
function mDefIva(t){var T=MT[t]||{};return T.g==="s"?0:num(S.cfg.iva)}

function mNew(t){var m=mCfg();return {id:uid(),t:t,s:mSerie(),n:0,est:"R",data:today(),venc:"",ent:{id:"",nome:"",nif:"",mor:"",cp:"",loc:"",pais:"Portugal"},vend:"",mpag:"",prazo:"",dg:"",ln:[],liq:[],rel:"",orig:[],
 tr:{carga:"",desc:"",dt:"",mat:"",exp:""},obs:m.msgs[t]||"",ext:"",arm:m.arm[0]||"",nostk:false,cri:new Date().toISOString()}}
function mClone(o){return JSON.parse(JSON.stringify(o))}

/* ---------- navegação ---------- */
function mPhd(sec,title,desc){var p=document.querySelector("#"+sec+" .phd");if(!p)return;var t=p.querySelector(".pt"),d=p.querySelector(".pd"),c=p.querySelector(".bc .cur");if(t)t.textContent=title;if(d)d.textContent=desc;if(c)c.textContent=title;document.title=title+" · Calculadora de orçamentos"}
function docGo(t,mode){MD.t=t;MD.mode=mode==="new"?"edit":"list";MD.pg=0;MD.q="";MD.est="";MD.ent="";if(mode==="new"){MD.cur=mNew(t);MD.ro=false}mgo("mdoc",mRender)}
function mOpen(id){var d=mDocs().find(function(x){return x.id===id});if(!d)return;MD.t=d.t;MD.mode="edit";MD.cur=mClone(d);MD.ro=d.est!=="R";mgo("mdoc",mRender)}
var MSV={mforn:"",mstk:"stk",mcons:"ext",mcfg:"series"};
function mGo(sec,v){if(v!=null)MSV[sec]=v;mgo(sec,function(){MOL.show(sec)})}

/* ---------- ícones ---------- */
function mIc(p){return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'}
var MI={pdf:mIc('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/>'),dup:mIc('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
 ver:mIc('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),conv:mIc('<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),dots:mIc('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>')};

/* =====================================================================
   LISTA DE DOCUMENTOS
   ===================================================================== */
function mEntLbl(t){var e=(MT[t]||{}).e;return e==="forn"?"Fornecedor":e==="cli"?"Cliente":"Armazém"}
function mFilter(){var q=MD.q.toLowerCase().trim().split(/\s+/).filter(Boolean),L=mDocs().filter(function(d){return d.t===MD.t});
 L=L.filter(function(d){if(MD.est==="D")return mDiv(d)>0.005;if(MD.est)return d.est===MD.est;return true});
 if(MD.adv){if(MD.de)L=L.filter(function(d){return d.data>=MD.de});if(MD.ate)L=L.filter(function(d){return d.data<=MD.ate});if(MD.ent){var e=cname(MD.ent);L=L.filter(function(d){return cname(d.ent&&d.ent.nome).indexOf(e)>-1})}}
 if(q.length)L=L.filter(function(d){var h=[mNum(d),d.ent&&d.ent.nome,d.ent&&d.ent.nif,d.obs,d.ext,(d.ln||[]).map(function(l){return l.nome+" "+l.ref}).join(" ")].join(" ").toLowerCase();return q.every(function(w){return h.indexOf(w)>-1})});
 L.sort(function(a,b){if(a.est==="R"&&b.est!=="R")return -1;if(b.est==="R"&&a.est!=="R")return 1;if(a.data!==b.data)return a.data<b.data?1:-1;return (+b.n||0)-(+a.n||0)});return L}
function mBadge(d){var T=MT[d.t]||{};if(!mLive(d))return "";if(T.pago)return '<span class="mbg ok">0%</span>';if(!T.div)return "";var t=mTot(d).tot,v=mDiv(d),p=t>0?Math.round(v/t*100):0;return '<span class="mbg '+(p>=100?"bad":p>0?"mid":"ok")+'" title="Em dívida: '+eur(v)+'">'+p+'%</span>'}
function mList(){var T=MT[MD.t],L=mFilter(),pages=Math.max(1,Math.ceil(L.length/MPS));if(MD.pg>=pages)MD.pg=pages-1;var from=MD.pg*MPS,P=L.slice(from,from+MPS),tot=mDocs().filter(function(d){return d.t===MD.t}).length;
 mPhd("mdoc",T.pl,"Nesta secção pode administrar "+(/^(Faturas|Notas|Guias|Entradas|Saídas)/.test(T.pl)?"as ":"os ")+T.pl.toLowerCase()+".");
 var showDiv=T.div||T.pago,h=(mOkDocs()?"":MSQL);
 h+='<div class="mps"><span class="psh">Pesquisa simples</span><button type="button" class="btn ghost" data-a="adv">'+(MD.adv?"Fechar pesquisa avançada":"Pesquisa avançada")+'</button></div>';
 h+='<div class="cpnl msrch"><label class="pl1" for="md_q">Insira palavras para pesquisar</label><input id="md_q" type="search" autocomplete="off" placeholder="Pesquisar" value="'+esc(MD.q)+'">'+mSel("md_est",[{v:"R",l:"Rascunhos"},{v:"F",l:"Finalizados"},{v:"A",l:"Anulados"}].concat(T.div?[{v:"D",l:"Com dívida"}]:[]),MD.est,"Todos os estados",'aria-label="Estado"')+'<button type="button" class="btn" data-a="srch">Pesquisar</button></div>';
 if(MD.adv)h+='<div class="cpnl msrch madv"><div><label for="md_de">Desde</label><input id="md_de" type="date" value="'+esc(MD.de)+'"></div><div><label for="md_ate">Até</label><input id="md_ate" type="date" value="'+esc(MD.ate)+'"></div>'+(T.e?'<div style="flex:1 1 220px"><label for="md_ent">'+mEntLbl(MD.t)+'</label><input id="md_ent" list="'+(T.e==="forn"?"msupl":"clis")+'" autocomplete="off" value="'+esc(MD.ent)+'"></div>':'')+'</div>';
 h+='<div class="rrow"><span class="mreg">Registo(s) '+(L.length?from+1:0)+' a '+(from+P.length)+' de um total de '+L.length+(L.length!==tot?' (filtrados de '+tot+')':'')+'</span>'+mPager(pages)+'<span class="sp"></span><button type="button" class="btn mbl" data-a="new"'+(mOkDocs()?'':' disabled')+'>Adicionar '+esc(T.n)+'</button><button type="button" class="btn dk" data-a="csv">Exportar</button></div>';
 h+='<div class="mtw"><table class="mtb"><thead><tr><th>N.º</th><th>Data</th><th>'+(T.e?mEntLbl(MD.t):"Armazém")+'</th>'+(T.e?'<th>Contribuinte</th>':'')+'<th class="r">Ilíquido</th><th class="r">Impostos</th><th class="r">Total</th>'+(showDiv?'<th class="c">Dívida</th>':'')+'<th class="c">Ações</th><th class="c">Eliminar</th></tr></thead><tbody>';
 h+=P.map(function(d){var t=mTot(d),cv=MCONV[d.t]||[];return '<tr class="'+(d.est==="A"?"anl":d.est==="R"?"rsc":"")+'" data-id="'+d.id+'"><td class="nw"><a href="#" data-a="open">'+(d.est==="R"?'<i class="mtag">Rascunho</i>':esc(mNum(d)))+'</a>'+(d.est==="A"?' <i class="mtag bad">Anulado</i>':'')+(d.ext?'<br><small class="mu">'+esc(d.ext)+'</small>':'')+'</td><td class="nw">'+esc(fdate(d.data).replace(/\//g,"-"))+'</td><td><b>'+esc(T.e?(d.ent&&d.ent.nome||"—"):(d.arm||"—"))+'</b></td>'+(T.e?'<td>'+esc(d.ent&&d.ent.nif||"")+'</td>':'')+
  '<td class="r">'+eur(t.il)+'</td><td class="r">'+eur(t.iva)+'</td><td class="r">'+eur(t.tot)+'</td>'+(showDiv?'<td class="c">'+mBadge(d)+'</td>':'')+
  '<td class="c nw macts"><button type="button" class="btn ico" data-a="pdf" title="Descarregar PDF">'+MI.pdf+'</button><button type="button" class="btn ico" data-a="dup" title="Duplicar">'+MI.dup+'</button><button type="button" class="btn ico" data-a="open" title="'+(d.est==="R"?"Editar":"Ver")+'">'+MI.ver+'</button>'+
  ((cv.length&&mLive(d))||mLive(d)?'<details class="menu mdm"><summary class="btn ico" title="Mais ações">'+MI.dots+'</summary><div class="mpop">'+(mLive(d)?cv.map(function(x){return '<button type="button" class="btn ghost" data-a="conv" data-to="'+x+'">Gerar '+esc(MT[x].n)+'</button>'}).join("")+'<button type="button" class="btn ghost" data-a="anl">Anular documento</button>':'')+'</div></details>':'<span class="mdm0"></span>')+
  '</td><td class="c">'+(d.est==="R"?'<button type="button" class="btn ico" data-a="del" title="Eliminar rascunho">×</button>':'<span class="mu">—</span>')+'</td></tr>'}).join("");
 h+='</tbody></table></div>'+(P.length?'':'<p class="mu" style="padding:14px 4px">'+(tot?'Nenhum documento corresponde à pesquisa.':'Ainda não há '+esc(T.pl.toLowerCase())+'. Use o botão “Adicionar '+esc(T.n)+'”.')+'</p>');
 if(T.fis)h+='<p class="mu mnote">Os documentos emitidos aqui são para controlo interno e não substituem a faturação em programa certificado pela Autoridade Tributária.</p>';
 $("#mdoc_b").innerHTML=h}
function mPager(pages){if(pages<2)return "";var h='<span class="mpg">';for(var i=0;i<pages&&i<12;i++)h+='<button type="button" class="btn'+(i===MD.pg?'':' ghost')+'" data-pg="'+i+'">'+(i+1)+'</button>';if(MD.pg<pages-1)h+='<button type="button" class="btn ghost" data-pg="'+(MD.pg+1)+'">Seguinte</button>';return h+'</span>'}
function mCsvDocs(){var T=MT[MD.t],L=mFilter(),rows=[["N.º","Data","Estado",mEntLbl(MD.t),"Contribuinte","Ilíquido","Impostos","Total","Dívida"]];L.forEach(function(d){var t=mTot(d);rows.push([d.est==="R"?"Rascunho":mNum(d),d.data,d.est==="A"?"Anulado":d.est==="R"?"Rascunho":"Finalizado",d.ent&&d.ent.nome||d.arm||"",d.ent&&d.ent.nif||"",mny(t.il),mny(t.iva),mny(t.tot),mny(mDiv(d))])});
 dl(T.pl.replace(/\s+/g,"_")+"_"+today()+".csv",rows.map(function(r){return r.map(qcsv).join(";")}).join("\n"))}

/* =====================================================================
   FORMULÁRIO DO DOCUMENTO
   ===================================================================== */
function mSel(id,opts,val,ph,attr){return '<select id="'+id+'" '+(attr||'')+'>'+(ph!=null?'<option value="">'+esc(ph)+'</option>':'')+opts.map(function(o){var v=typeof o==="object"?o.v:o,l=typeof o==="object"?o.l:o;return '<option value="'+esc(v)+'"'+(String(v)===String(val)?' selected':'')+'>'+esc(l)+'</option>'}).join("")+'</select>'}
function mIvaOpts(){return mCfg().taxas.map(function(x){return {v:x.v,l:x.v+"%"}})}
function mEd(){var d=MD.cur,T=MT[d.t],m=mCfg(),ro=MD.ro,dis=ro?' disabled':'';
 mPhd("mdoc",(d.est==="R"?(d.n?"Editar ":"Criar "):"")+T.n,d.est==="R"?"Preencha os dados e guarde o documento.":"Documento finalizado: já não pode ser alterado. Pode descarregá-lo, duplicá-lo, gerar outros documentos a partir dele ou anulá-lo.");
 var h=(mOkDocs()?"":MSQL)+'<div class="mhd"><div class="mtit">'+esc(T.n)+' N.º <span class="mnum">'+esc(mCode(d.t)+(d.s||"")+"/"+(d.n||""))+'</span> '+(d.est==="R"?'<span>(Provisório)</span>':d.est==="A"?'<i class="mtag bad">Anulado</i>':'')+'</div><div class="mbtns">';
 if(!ro)h+='<button type="button" class="btn ghost" data-a="cancel">Cancelar</button><button type="button" class="btn dk" data-a="draft">Guardar rascunho</button><button type="button" class="btn mbl" data-a="fin">Guardar e finalizar documento</button>';
 else h+='<button type="button" class="btn ghost" data-a="cancel">Voltar à lista</button><button type="button" class="btn ghost" data-a="pdf1">Descarregar PDF</button><button type="button" class="btn ghost" data-a="dup1">Duplicar</button>'+(d.est==="F"?(MCONV[d.t]||[]).map(function(x){return '<button type="button" class="btn ghost" data-a="conv1" data-to="'+x+'">Gerar '+esc(MT[x].n)+'</button>'}).join("")+'<button type="button" class="btn ghost" data-a="anl1">Anular</button>':'');
 h+='</div></div><p class="mu" id="md_msg" role="status"></p>';
 h+='<div class="mgrid"><div><label for="mf_data">Data de emissão</label><input id="mf_data" type="date" value="'+esc(d.data)+'"'+dis+'></div><div><label for="mf_s">Série</label>'+mSel("mf_s",m.series.map(function(x){return x.c}),d.s,null,dis)+'</div>'+
  (T.ext?'<div><label for="mf_ext">N.º do documento do fornecedor</label><input id="mf_ext" value="'+esc(d.ext)+'"'+dis+'></div>':'')+
  (T.stk?'<div><label for="mf_arm">Armazém</label>'+mSel("mf_arm",m.arm,d.arm,null,dis)+'</div><div class="mck"><label><input type="checkbox" id="mf_stk"'+(d.nostk?'':' checked')+dis+'> Movimenta stock</label></div>':'')+'</div>';
 if(T.e){var isF=T.e==="forn",lbl=isF?"Fornecedores":"Clientes";
  h+='<div class="mbox"><div class="mbh">'+lbl+'</div><div class="mbb"><div class="mfl"><input id="mf_en" list="'+(isF?"msupl":"clis")+'" autocomplete="off" placeholder="Pesquisa de '+lbl.toLowerCase()+'" value="'+esc(d.ent.nome)+'"'+dis+'>'+(ro?'':'<button type="button" class="btn mbl" data-a="mkent">Criar '+(isF?"fornecedor":"cliente")+' ⊕</button>')+'</div>'+
  '<div class="mgrid" style="margin-top:10px"><div><label for="mf_nif">Contribuinte</label><input id="mf_nif" inputmode="numeric" value="'+esc(d.ent.nif)+'"'+dis+'></div><div class="w2"><label for="mf_mor">Morada</label><input id="mf_mor" value="'+esc(d.ent.mor)+'"'+dis+'></div><div><label for="mf_cp">Código postal</label><input id="mf_cp" value="'+esc(d.ent.cp)+'"'+dis+'></div><div><label for="mf_loc">Localidade</label><input id="mf_loc" value="'+esc(d.ent.loc)+'"'+dis+'></div><div><label for="mf_pais">País</label><input id="mf_pais" value="'+esc(d.ent.pais)+'"'+dis+'></div></div></div></div>'}
 if(T.g!=="s"&&!T.liq)h+='<details class="msec"'+((d.dg||d.mpag||d.vend||d.venc||T.pago)?' open':'')+'><summary>Dados financeiros</summary><div class="mgrid">'+
  (T.div?'<div><label for="mf_pz">Prazo de vencimento</label>'+mSel("mf_pz",m.prazos.map(function(x){return {v:x.d,l:x.n}}),d.prazo,"—",dis)+'</div><div><label for="mf_venc">Data de vencimento</label><input id="mf_venc" type="date" value="'+esc(d.venc)+'"'+dis+'></div>':'')+
  '<div><label for="mf_mp">Método de pagamento'+(T.pago?' *':'')+'</label>'+mSel("mf_mp",m.mpag,d.mpag,"—",dis)+'</div>'+(T.e==="cli"?'<div><label for="mf_vd">Vendedor</label>'+mSel("mf_vd",m.vend.map(function(x){return x.nome}),d.vend,"—",dis)+'</div>':'')+'<div><label for="mf_dg">Desconto global (%)</label><input id="mf_dg" inputmode="decimal" value="'+esc(d.dg)+'"'+dis+'></div></div></details>';
 else if(T.liq)h+='<div class="mgrid"><div><label for="mf_mp">Método de pagamento</label>'+mSel("mf_mp",m.mpag,d.mpag,"—",dis)+'</div></div>';
 /* documentos relacionados */
 if(!T.liq){var rel=(d.orig||[]).map(function(id){var x=mDocs().find(function(y){return y.id===id});return x?'<a href="#" data-a="goid" data-id="'+x.id+'">'+esc(MT[x.t].n+" "+mNum(x))+'</a>':""}).filter(Boolean);
  h+='<details class="msec"'+(rel.length||(T.cred)?' open':'')+'><summary>Documentos relacionados</summary>';
  if(T.cred){var cand=mDocs().filter(function(x){return mLive(x)&&MCRED[d.t].indexOf(x.t)>-1&&(!d.ent.nome||cname(x.ent.nome)===cname(d.ent.nome))});h+='<div class="mgrid"><div class="w2"><label for="mf_rel">Documento a creditar *</label>'+mSel("mf_rel",cand.map(function(x){return {v:x.id,l:mNum(x)+" · "+x.ent.nome+" · "+eur(mTot(x).tot)}}),d.rel,"Escolher…",dis)+'</div>'+(ro?'':'<div class="mbt"><button type="button" class="btn ghost" data-a="credcp">Copiar artigos do documento</button></div>')+'</div>'}
  if(rel.length)h+='<p>Gerado a partir de: '+rel.join(", ")+'</p>';
  if(!ro&&!T.cred){var src=mImpSrc(d);h+='<div class="mfl"><select id="mf_imp" aria-label="Importar artigos de">'+'<option value="">Importar artigos de…</option>'+src+'</select><button type="button" class="btn ghost" data-a="imp">Importar</button></div><p class="mu" style="margin:6px 0 0">Copia os artigos de um orçamento, de uma folha de obra ou de outro documento para este.</p>'}
  h+='</details>'}
 /* liquidações */
 if(T.liq){var open=mDocs().filter(function(x){return MLIQ[d.t].indexOf(x.t)>-1&&mLive(x)&&(!d.ent.nome||cname(x.ent.nome)===cname(d.ent.nome))&&(mDiv(x)>0.005||(d.liq||[]).some(function(l){return l.id===x.id}))});
  h+='<div class="mbox"><div class="mbh">Documentos a liquidar</div><div class="mbb">'+(d.ent.nome?'':'<p class="mu">Escolha primeiro o '+(T.e==="forn"?"fornecedor":"cliente")+'.</p>')+(open.length?'<table class="mtb"><thead><tr><th></th><th>Documento</th><th>Data</th><th>Vencimento</th><th class="r">Total</th><th class="r">Em dívida</th><th class="r">Valor a liquidar</th></tr></thead><tbody>'+open.map(function(x){var l=(d.liq||[]).find(function(y){return y.id===x.id}),dv=mDiv(x)+(d.est==="F"&&l?num(l.v):0);return '<tr data-lq="'+x.id+'"><td><input type="checkbox" data-lqc'+(l?' checked':'')+dis+'></td><td>'+esc(mNum(x))+'</td><td>'+esc(fdate(x.data))+'</td><td>'+esc(x.venc?fdate(x.venc):"")+'</td><td class="r">'+eur(mTot(x).tot)+'</td><td class="r">'+eur(dv)+'</td><td class="r"><input class="mnumi" data-lqv inputmode="decimal" value="'+(l?esc(mny(num(l.v))):'')+'"'+dis+'></td></tr>'}).join("")+'</tbody></table>':(d.ent.nome?'<p class="mu">Este '+(T.e==="forn"?"fornecedor":"cliente")+' não tem documentos em dívida.</p>':''))+'</div></div>'}
 /* artigos */
 if(!T.liq){h+='<div class="mbox"><div class="mbh">Artigos</div><div class="mbb">'+(ro?'':'<div class="mfl"><input id="mf_ps" type="search" autocomplete="off" placeholder="Pesquisar em artigos (nome, referência, fornecedor)" value="'+esc(MD.ps)+'"><button type="button" class="btn mbl" data-a="free">Linha livre ⊕</button></div><div id="mf_hits"></div>')+
  '<div class="mtw"><table class="mtb mln"><thead><tr><th>Ref.</th><th>Artigo / descrição</th><th class="r">Qtd.</th><th>Un.</th><th class="r">Preço un.</th><th class="r">Desc. %</th><th class="r">IVA</th><th class="r">Total</th><th></th></tr></thead><tbody>'+
  (d.ln||[]).map(function(l,i){return '<tr data-l="'+i+'"><td><input data-k="ref" value="'+esc(l.ref)+'" class="mref"'+dis+'></td><td><div class="mnm"><input data-k="nome" value="'+esc(l.nome)+'"'+dis+'>'+(ro&&!l.det?'':'<textarea data-k="det" rows="1" placeholder="Descrição (opcional)"'+dis+'>'+esc(l.det||"")+'</textarea>')+'</div></td><td><input data-k="q" class="mnumi" inputmode="decimal" value="'+esc(l.q)+'"'+dis+'></td><td>'+mSel("",m.un,l.un,null,'data-k="un"'+dis)+'</td><td><input data-k="p" class="mnumi" inputmode="decimal" value="'+esc(l.p)+'"'+dis+'></td><td><input data-k="ds" class="mnumi" inputmode="decimal" value="'+esc(l.ds)+'"'+dis+'></td><td>'+mSel("",mIvaOpts(),l.iva,null,'data-k="iva"'+dis)+'</td><td class="r nw" data-lt>'+eur(mLn(l).b)+'</td><td>'+(ro?'':'<button type="button" class="btn ico" data-a="rml" title="Remover linha">×</button>')+'</td></tr>'}).join("")+
  '</tbody></table></div>'+((d.ln||[]).length?'':'<p class="mu" style="margin:8px 0 0">Ainda sem artigos. Pesquise no catálogo ou junte uma linha livre.</p>')+'</div></div>'}
 if((T.e&&!T.liq)||T.tr)h+='<details class="msec"'+(T.tr||d.tr.carga||d.tr.desc?' open':'')+'><summary>Entrega e Transporte</summary><div class="mgrid"><div class="w2"><label for="mf_tc">Local de carga'+(T.tr?' *':'')+'</label><input id="mf_tc" value="'+esc(d.tr.carga)+'"'+dis+'></div><div class="w2"><label for="mf_td">Local de descarga'+(T.tr?' *':'')+'</label><input id="mf_td" value="'+esc(d.tr.desc)+'"'+dis+'></div><div><label for="mf_tt">Início do transporte</label><input id="mf_tt" type="datetime-local" value="'+esc(d.tr.dt)+'"'+dis+'></div><div><label for="mf_tm">Matrícula</label><input id="mf_tm" list="mviat" value="'+esc(d.tr.mat)+'"'+dis+'></div><div><label for="mf_te">Método de expedição</label>'+mSel("mf_te",m.mexp,d.tr.exp,"—",dis)+'</div></div></details>';
 h+='<details class="msec"'+(d.obs?' open':'')+'><summary>Observações</summary><textarea id="mf_obs" rows="3"'+dis+'>'+esc(d.obs)+'</textarea></details>';
 h+='<div class="mtots" id="mf_tot">'+mTotHtml(d)+'</div>';
 if(!ro)h+='<div class="mbtns mbot"><button type="button" class="btn ghost" data-a="cancel">Cancelar</button><button type="button" class="btn dk" data-a="draft">Guardar rascunho</button><button type="button" class="btn mbl" data-a="fin">Guardar e finalizar documento</button></div>';
 $("#mdoc_b").innerHTML=h;if(!ro&&MD.ps)mHits()}
function mTotHtml(d){var t=mTot(d),T=MT[d.t],h='<table>';if(!T.liq){h+='<tr><td>Valor ilíquido</td><td>'+eur(t.br)+'</td></tr>'+(t.ds>0?'<tr><td>Descontos</td><td>– '+eur(t.ds)+'</td></tr>':'')+'<tr><td>Total sem IVA</td><td>'+eur(t.il)+'</td></tr>';Object.keys(t.tx).sort(function(a,b){return b-a}).forEach(function(k){if(t.tx[k].b||t.tx[k].v)h+='<tr class="mu"><td>IVA '+k+'% (incid. '+eur(t.tx[k].b)+')</td><td>'+eur(t.tx[k].v)+'</td></tr>'})}
 h+='<tr class="tf"><td>Total ('+esc(mCode(d.t))+')</td><td>'+eur(t.tot)+'</td></tr>';if(mLive(d)&&(T.div)){h+='<tr><td>Pago / liquidado</td><td>'+eur(mPago(d))+'</td></tr><tr><td><b>Em dívida</b></td><td><b>'+eur(mDiv(d))+'</b></td></tr>'}return h+'</table>'}
function mImpSrc(d){var h="",T=MT[d.t];var qs=(S.quotes||[]).slice().sort(function(a,b){return (parseInt(b.num,10)||0)-(parseInt(a.num,10)||0)}).slice(0,80);if(T.e==="cli"&&qs.length)h+='<optgroup label="Orçamentos">'+qs.map(function(q){return '<option value="q:'+q.id+'">Orçamento '+esc(q.num||"s/ n.º")+' · '+esc(q.cli||"")+' · '+eur(num(q.tot))+'</option>'}).join("")+'</optgroup>';
 var os=(S.orders||[]).slice().sort(function(a,b){return String(b.dat||"")<String(a.dat||"")?-1:1}).slice(0,80);if(T.e==="cli"&&os.length)h+='<optgroup label="Folhas de obra">'+os.map(function(o){return '<option value="o:'+o.id+'">Folha de obra '+esc(o.num||"")+' · '+esc(o.cli||"")+'</option>'}).join("")+'</optgroup>';
 var ds=mDocs().filter(function(x){return x.id!==d.id&&x.est!=="A"&&!MT[x.t].liq&&(MT[x.t].e===T.e||!T.e)}).sort(function(a,b){return a.data<b.data?1:-1}).slice(0,120);if(ds.length)h+='<optgroup label="Documentos">'+ds.map(function(x){return '<option value="d:'+x.id+'">'+esc((x.est==="R"?"Rascunho de "+MT[x.t].n:MT[x.t].n+" "+mNum(x))+" · "+(x.ent.nome||x.arm||""))+'</option>'}).join("")+'</optgroup>';return h}
function mLineFromProd(p,t){var T=MT[t]||{},buy=T.g==="f"||T.g==="s",pr=0;if(buy)pr=num(p.cost);else{try{pr=calc({pid:p.id,qty:1}).unit}catch(e){pr=num(p.cost)}}return {pid:p.id,ref:p.ref||"",nome:p.name||"",det:"",q:1,un:mCfg().un[0]||"Un.",p:mny(rd(pr)),ds:"",iva:mDefIva(t)}}
function mHits(){var el=$("#mf_hits");if(!el)return;var q=MD.ps.toLowerCase().trim().split(/\s+/).filter(Boolean);if(!q.length){el.innerHTML="";return}var out=[];for(var i=0;i<S.products.length&&out.length<12;i++){var p=S.products[i],s=(p.name+" "+p.ref+" "+p.sup+" "+p.cat).toLowerCase();if(q.every(function(w){return s.indexOf(w)>-1}))out.push(p)}
 el.innerHTML=out.length?'<div class="mhits">'+out.map(function(p){return '<button type="button" class="mhit" data-a="addp" data-pid="'+esc(p.id)+'"><b>'+esc(p.name)+'</b> <span class="mu">'+esc([p.ref,p.sup].filter(Boolean).join(" · "))+'</span></button>'}).join("")+'</div>':'<p class="mu" style="margin:6px 0 0">Nenhum artigo encontrado. Pode juntar uma linha livre.</p>'}
function mMsg(t,bad){var e=$("#md_msg");if(e){e.textContent=t||"";e.className=bad?"err":"mu"}if(t&&bad&&e)e.scrollIntoView({block:"center"})}
function mReadForm(){var d=MD.cur;if(!d||MD.ro)return;var g=function(id){var e=$("#"+id);return e?e.value:null};
 var v;if((v=g("mf_data"))!=null)d.data=v;if((v=g("mf_s"))!=null)d.s=v;if((v=g("mf_ext"))!=null)d.ext=v;if((v=g("mf_arm"))!=null)d.arm=v;var sk=$("#mf_stk");if(sk)d.nostk=!sk.checked;
 [["mf_en","nome"],["mf_nif","nif"],["mf_mor","mor"],["mf_cp","cp"],["mf_loc","loc"],["mf_pais","pais"]].forEach(function(x){var y=g(x[0]);if(y!=null)d.ent[x[1]]=y});
 if((v=g("mf_pz"))!=null)d.prazo=v;if((v=g("mf_venc"))!=null)d.venc=v;if((v=g("mf_mp"))!=null)d.mpag=v;if((v=g("mf_vd"))!=null)d.vend=v;if((v=g("mf_dg"))!=null)d.dg=v;if((v=g("mf_rel"))!=null)d.rel=v;
 [["mf_tc","carga"],["mf_td","desc"],["mf_tt","dt"],["mf_tm","mat"],["mf_te","exp"]].forEach(function(x){var y=g(x[0]);if(y!=null)d.tr[x[1]]=y});if((v=g("mf_obs"))!=null)d.obs=v;
 document.querySelectorAll("#mdoc_b tr[data-l]").forEach(function(tr){var l=d.ln[+tr.dataset.l];if(!l)return;tr.querySelectorAll("[data-k]").forEach(function(i){l[i.dataset.k]=i.dataset.k==="iva"?num(i.value):i.value})});
 if(MT[d.t].liq){var L=[];document.querySelectorAll("#mdoc_b tr[data-lq]").forEach(function(tr){var c=tr.querySelector("[data-lqc]"),vv=tr.querySelector("[data-lqv]");if(c&&c.checked&&num(vv.value)>0)L.push({id:tr.dataset.lq,v:rd(num(vv.value))})});d.liq=L}}
function mFillEnt(nome){var d=MD.cur,T=MT[d.t];if(T.e==="cli"){var c=findClient(nome);if(c){d.ent.id=c.id;d.ent.nif=c.nif||d.ent.nif;d.ent.mor=c.notas||d.ent.mor;if(c.cp)d.ent.cp=c.cp;if(c.loc)d.ent.loc=c.loc;var vd=c.vend;if(vd&&!d.vend)d.vend=vd;return true}}
 else if(T.e==="forn"){var s=mSupFind(nome);if(s){d.ent.id=s.id;d.ent.nif=s.nif||"";d.ent.mor=s.mor||"";d.ent.cp=s.cp||"";d.ent.loc=s.loc||"";d.ent.pais=s.pais||"Portugal";return true}}return false}
function mValidate(d){var T=MT[d.t];if(!d.data)return "Indique a data de emissão.";if(!d.s)return "Escolha a série.";
 if(T.e&&!String(d.ent.nome||"").trim()){if(d.t==="FS"){d.ent.nome="Consumidor final"}else return "Escolha o "+(T.e==="forn"?"fornecedor":"cliente")+".";}
 if(d.ent.nif&&!/^\d{9}$/.test(String(d.ent.nif).replace(/\s/g,""))&&/^(portugal|pt)?$/i.test(String(d.ent.pais||"").trim()))return "O contribuinte deve ter 9 algarismos.";
 if(T.liq){if(!d.liq.length)return "Escolha pelo menos um documento a liquidar e o valor.";for(var i=0;i<d.liq.length;i++){var x=mDocs().find(function(y){return y.id===d.liq[i].id});if(x&&num(d.liq[i].v)>mDiv(x)+0.005)return "O valor a liquidar de "+mNum(x)+" é maior do que a dívida ("+eur(mDiv(x))+").";}}
 else{if(!(d.ln||[]).length)return "Junte pelo menos um artigo.";if(d.ln.some(function(l){return !String(l.nome||"").trim()}))return "Há linhas sem nome de artigo.";if(d.ln.some(function(l){return num(l.q)<=0}))return "Há linhas com quantidade 0.";}
 if(T.pago&&!d.mpag)return "Escolha o método de pagamento.";
 if(T.tr&&(!String(d.tr.carga).trim()||!String(d.tr.desc).trim()))return "Preencha os locais de carga e de descarga.";
 if(T.cred){if(!d.rel)return "Escolha o documento a creditar.";var r=mDocs().find(function(y){return y.id===d.rel});if(r&&mTot(d).tot>mTot(r).tot-(mPays()[r.id]||0)+0.005&&MT[r.t].div)return "O valor da nota de crédito é maior do que o valor em aberto de "+mNum(r)+".";}
 return ""}
function mStore(d){var a=mDocs(),i=a.findIndex(function(x){return x.id===d.id});d.upd=new Date().toISOString();if(i<0)a.push(mClone(d));else a[i]=mClone(d);mSave()}
function mFinalize(){mReadForm();var d=MD.cur,err=mValidate(d);if(err){mMsg(err,1);return}
 if(!confirm("Finalizar "+MT[d.t].n.toLowerCase()+"? Depois de finalizado o documento já não pode ser alterado (só anulado)."))return;
 if(!d.n)d.n=mNext(d.t,d.s);d.est="F";if(MT[d.t].div&&!d.venc)d.venc=d.prazo!==""&&d.prazo!=null?addDays(d.data,+d.prazo):d.data;d.fin=new Date().toISOString();
 if(MT[d.t].e==="cli"&&d.ent.nome&&d.ent.nome!=="Consumidor final"){ensureClient(d.ent.nome,"","");var c=findClient(d.ent.nome);if(c){if(!c.nif&&d.ent.nif)c.nif=d.ent.nif;if(!c.notas&&d.ent.mor)c.notas=d.ent.mor;if(!c.cp&&d.ent.cp)c.cp=d.ent.cp;if(!c.loc&&d.ent.loc)c.loc=d.ent.loc}}
 if(MT[d.t].e==="forn"&&d.ent.nome&&!mSupFind(d.ent.nome)&&mOkSups())mSups().push({id:uid(),cod:mSupCod(),nome:d.ent.nome,nif:d.ent.nif,mor:d.ent.mor,cp:d.ent.cp,loc:d.ent.loc,pais:d.ent.pais,email:"",tel:"",notas:""});
 mStore(d);MD.ro=true;mRender();mMsg("Documento "+mNum(d)+" finalizado e guardado.")}
function mDraft(){mReadForm();var d=MD.cur;if(MT[d.t].e&&!String(d.ent.nome||"").trim()&&!(d.ln||[]).length&&!(d.liq||[]).length){mMsg("O documento está vazio.",1);return}mStore(d);MD.mode="list";mRender()}
function mAnular(d){if(!confirm("Anular "+MT[d.t].n.toLowerCase()+" "+mNum(d)+"? O número fica gasto e o documento deixa de contar em dívidas, stocks e consultas."))return;var dep=mDocs().filter(function(x){return mLive(x)&&((x.liq||[]).some(function(l){return l.id===d.id})||x.rel===d.id)});if(dep.length){alert("Não é possível anular: há documentos que liquidam ou creditam este ("+dep.map(mNum).join(", ")+"). Anule-os primeiro.");return}
 var o=mDocs().find(function(x){return x.id===d.id});o.est="A";o.anl=new Date().toISOString();mSave();if(MD.mode==="edit"){MD.cur=mClone(o)}mRender()}
function mDup(d,to){var n=mNew(to||d.t);n.ent=mClone(d.ent);n.vend=d.vend;n.mpag=d.mpag;n.dg=d.dg;n.ln=mClone(d.ln||[]);n.obs=to?n.obs:d.obs;n.arm=d.arm||n.arm;if(to){n.orig=[d.id];var A=MT[d.t]||{},B=MT[to]||{};if(A.stk&&B.stk&&A.stk===B.stk)n.nostk=true;if(B.liq){n.ln=[];n.liq=[{id:d.id,v:rd(mDiv(d))}]}if(B.cred){n.rel=d.id}if(B.tr)n.tr=mClone(d.tr||n.tr);if(B.g==="f"||A.g==="f")n.ln.forEach(function(l){l.iva=num(l.iva)})}else{n.tr=mClone(d.tr||n.tr)}
 MD.t=n.t;MD.mode="edit";MD.cur=n;MD.ro=false;mRender();window.scrollTo(0,0)}
function mImport(v){var d=MD.cur,k=v.slice(0,1),id=v.slice(2),add=[],T=MT[d.t];
 if(k==="q"){var q=(S.quotes||[]).find(function(x){return x.id===id});if(!q)return;(q.lines||[]).forEach(function(l){var r;try{r=calc(JSON.parse(JSON.stringify(l)))}catch(e){return}if(!r||!r.p||r.empty)return;var det=[];if(l.color)det.push("Cor: "+l.color);try{var vv=vtxt(l,r).trim();if(vv)det.push(vv)}catch(e){}r.det.forEach(function(x){det.push(x.x.name+": "+(x.t?x.t.name:"personalização"))});add.push({pid:r.p.id,ref:r.p.ref||"",nome:r.p.name,det:det.join("\n"),q:r.q,un:mCfg().un[0],p:mny(rd(r.unit)),ds:"",iva:q.siva?0:num(S.cfg.iva)})});
  if(num(q.disc)>0){if(q.dtype==="€"){var gb=add.reduce(function(a,l){return a+num(l.q)*num(l.p)},0);if(gb>0)d.dg=mny(rd(num(q.disc)/gb*100))}else d.dg=String(num(q.disc))}
  if(!d.ent.nome&&q.cli){d.ent.nome=q.cli;mFillEnt(q.cli)}}
 else if(k==="o"){var o=(S.orders||[]).find(function(x){return x.id===id});if(!o)return;add.push({pid:"",ref:"",nome:"Folha de obra"+(o.num?" n.º "+o.num:""),det:String(o.desc||"").trim(),q:1,un:mCfg().un[0],p:mny(num(vsi(o))),ds:"",iva:o.fat==="sem"?0:num(S.cfg.iva)});if(!d.ent.nome&&o.cli){d.ent.nome=o.cli;mFillEnt(o.cli)}}
 else if(k==="d"){var x=mDocs().find(function(y){return y.id===id});if(!x)return;add=mClone(x.ln||[]);if(!d.ent.nome&&x.ent&&x.ent.nome)d.ent=mClone(x.ent);if(d.orig.indexOf(x.id)<0)d.orig.push(x.id);var A=MT[x.t]||{};if(mLive(x)&&A.stk&&T.stk&&A.stk===T.stk)d.nostk=true}
 if(T.g==="f"||T.g==="s")add.forEach(function(l){var p=l.pid&&S.products.find(function(z){return z.id===l.pid});if(p)l.p=mny(num(p.cost))});
 d.ln=(d.ln||[]).concat(add);mRender();mMsg(add.length+(add.length===1?" artigo importado.":" artigos importados."))}

/* =====================================================================
   PDF
   ===================================================================== */
function mPdf(d){var T=MT[d.t],c=S.cfg,m=mCfg(),p=pdfNew(),M=p.M,W=p.W,R=W-M,t=mTot(d);
 if(c.logo&&c.lw&&c.lh){try{p.img={bin:atob(c.logo.split(",")[1]),w:c.lw,h:c.lh}}catch(e){p.img=null}}
 var top=p.y,hh=0;if(p.img){var lh=50,lw=lh*p.img.w/p.img.h;if(lw>170){lw=170;lh=lw*p.img.h/p.img.w}p.image(M,top-lh,lw,lh);hh=lh}
 var ty=top-8;if(c.empresa){p.y=ty;p.putR(c.empresa,R,11,true);ty-=13}p.wrap(c.emp_ct,240,8,false).forEach(function(l){p.y=ty;p.putR(l,R,8,false,0.35);ty-=10});
 p.y=Math.min(top-hh,ty)-26;var tt=(T.n+" N.º "+(d.est==="R"?"(rascunho)":mNum(d))).toUpperCase();p.put(tt,M,15,true);if(d.est==="A"){p.putR("ANULADO",R,14,true,0.5)}else p.putR("Original",R,9,false,0.4);p.y-=8;p.rule(p.y,0.4);
 if(T.e){var ex=p.y,bx=M+290;p.y-=14;p.put(T.e==="forn"?"Fornecedor":"Exmo.(s) Sr.(s)",bx,8,false,0.4);p.y-=13;p.put(d.ent.nome||"",bx,10.5,true);[d.ent.mor,[d.ent.cp,d.ent.loc].filter(Boolean).join(" "),d.ent.pais&&!/^portugal$/i.test(d.ent.pais)?d.ent.pais:""].filter(Boolean).forEach(function(s){p.wrap(s,R-bx,9,false).forEach(function(w){p.y-=11;p.put(w,bx,9,false)})});p.y-=12;p.put("Contribuinte: "+(d.ent.nif||"999999990"),bx,9,false);var ey=p.y;p.y=ex}
 var info=[["Data",fdate(d.data)]];if(d.venc&&T.div)info.push(["Vencimento",fdate(d.venc)]);if(d.mpag)info.push(["Pagamento",d.mpag]);if(d.vend)info.push(["Vendedor",d.vend]);if(d.ext)info.push(["Doc. fornecedor",d.ext]);if(T.stk&&d.arm&&!T.e)info.push(["Armazém",d.arm]);if(d.rel){var rr=mDocs().find(function(x){return x.id===d.rel});if(rr)info.push(["Referente a",mNum(rr)])}
 info.forEach(function(x){p.y-=14;p.put(x[0],M,8,false,0.4);p.put(String(x[1]),M+80,9.5,false)});if(T.e&&ey<p.y)p.y=ey;p.y-=12;
 var x1=M+62,x2=M+310,x3=M+352,x4=M+400,x5=M+434,x6=M+466;
 if(T.liq){p.y-=6;p.put("Documento",M,9,true);p.put("Data",M+150,9,true);p.putR("Total",M+330,9,true);p.putR("Valor liquidado",R,9,true);p.y-=5;p.rule(p.y);
  (d.liq||[]).forEach(function(l){var x=mDocs().find(function(y){return y.id===l.id});p.y-=14;p.put(x?MT[x.t].n+" "+mNum(x):"—",M,9.5,false);p.put(x?fdate(x.data):"",M+150,9.5,false);p.putR(x?eur(mTot(x).tot):"",M+330,9.5,false);p.putR(eur(num(l.v)),R,9.5,false);p.y-=5;p.rule(p.y,0.88)})}
 else{var head=function(){p.y-=6;p.put("Ref.",M,8.5,true);p.put("Descrição",x1,8.5,true);p.putR("Qtd.",x3,8.5,true);p.putR("Preço",x4,8.5,true);p.putR("Desc.",x5,8.5,true);p.putR("IVA",x6,8.5,true);p.putR("Total",R,8.5,true);p.y-=5;p.rule(p.y)};head();
  (d.ln||[]).forEach(function(l){var nl=p.wrap(l.nome,x2-x1-30,9,false),dl=l.det?p.wrap(l.det,x2-x1-20,7.5,false):[],h=nl.length*11+dl.length*9+8;if(p.y-h<p.M+120){p.np();head()}
   p.y-=12;p.put(String(l.ref||"").slice(0,14),M,8,false,0.3);p.putR(mny(num(l.q)).replace(/,00$/,"")+" "+(l.un||""),x3,9,false);p.putR(mny(num(l.p)),x4,9,false);p.putR(num(l.ds)?mny(num(l.ds))+"%":"",x5,9,false);p.putR(num(l.iva)+"%",x6,9,false);p.putR(mny(mLn(l).b),R,9,false);
   nl.forEach(function(s,i){if(i)p.y-=11;p.put(s,x1,9,false)});dl.forEach(function(s){p.y-=9;p.put(s,x1+6,7.5,false,0.35)});p.y-=6;p.rule(p.y,0.9)})}
 if(p.y-150<p.M+24)p.np();var ystart=p.y;
 if(!T.liq){p.y-=16;p.put("Quadro resumo do IVA",M,8.5,true);p.y-=4;p.rule(p.y,0.7,M,M+250);var any0=false;Object.keys(t.tx).sort(function(a,b){return b-a}).forEach(function(k){if(!t.tx[k].b&&!t.tx[k].v)return;if(+k===0)any0=true;p.y-=12;p.put("Taxa "+k+"%",M,8.5,false);p.put("Incid. "+eur(t.tx[k].b),M+70,8.5,false);p.putR(eur(t.tx[k].v),M+250,8.5,false)});if(any0&&m.isen){p.y-=12;p.put("Isenção: "+m.isen,M,7.5,false,0.35)}}
 var yl=p.y;p.y=ystart;var xl=R-180,row=function(a,b,bold,sz){p.y-=14;p.put(a,xl,sz||9.5,bold);p.putR(b,R,sz||9.5,bold)};
 if(!T.liq){row("Valor ilíquido",eur(t.br));if(t.ds>0)row("Descontos","– "+eur(t.ds));row("Total sem IVA",eur(t.il));row("IVA",eur(t.iva))}p.y-=4;p.rule(p.y,0.5,xl,R);p.y-=4;row("TOTAL",eur(t.tot),true,12);
 p.y=Math.min(p.y,yl)-10;
 if(T.tr||d.tr.carga||d.tr.desc){p.y-=14;p.put("Transporte",M,9,true);p.y-=2;[["Carga",d.tr.carga],["Descarga",d.tr.desc],["Início",d.tr.dt?d.tr.dt.replace("T"," "):""],["Matrícula",d.tr.mat],["Expedição",d.tr.exp]].forEach(function(x){if(x[1]){p.y-=11;p.put(x[0]+": "+x[1],M,8.5,false)}})}
 if(String(d.obs||"").trim()){p.y-=16;p.put("Observações",M,9,true);p.y-=2;p.para(d.obs,8.5,11)}
 if((m.banco.iban||"").trim()&&(T.div||T.g==="o")){p.y-=16;p.put("Dados para pagamento",M,9,true);p.y-=2;p.para([m.banco.n,"IBAN: "+m.banco.iban,m.banco.swift?"BIC/SWIFT: "+m.banco.swift:""].filter(Boolean).join("   ·   "),8.5,11)}
 if(T.fis){p.y-=18;p.para("Documento para controlo interno, emitido por programa não certificado pela AT. Não serve de fatura nem de documento de transporte.",7.5,10,false,M,p.CW,0.4)}
 return pdfEnd(p,(c.empresa?c.empresa+"  ·  ":"")+T.n+" "+(d.est==="R"?"(rascunho)":mNum(d)))}
function mPdfGo(d){dlBlob(mPdf(d),pdfName(mCode(d.t),d.est==="R"?"rascunho":(d.s+"-"+d.n),d.ent&&d.ent.nome||d.arm||""))}

/* =====================================================================
   FORNECEDORES E VENDEDORES
   ===================================================================== */
function mSupFind(n){n=cname(n);if(!n)return null;return mSups().find(function(s){return cname(s.nome)===n})||null}
function mSupCod(){var m=0;mSups().forEach(function(s){var k=parseInt(s.cod,10);if(k>m)m=k});return String(m+1)}
var MFS={q:"",open:"",pg:0};
function rSups(){mPhd("mforn","Fornecedores","Nesta secção pode administrar os fornecedores da sua empresa.");var L=mSups().slice(),q=cname(MFS.q);if(q)L=L.filter(function(s){return cname([s.cod,s.nome,s.nif,s.loc,s.email,s.tel].join(" ")).indexOf(q)>-1});L.sort(function(a,b){return cname(a.nome)<cname(b.nome)?-1:1});
 var dv={};mDocs().forEach(function(d){if(MT[d.t].e==="forn"){var k=cname(d.ent.nome);dv[k]=(dv[k]||0)+mDiv(d)}});
 var cat={};(S.products||[]).forEach(function(p){var k=String(p.sup||"").trim();if(k)cat[k]=(cat[k]||0)+1});var miss=Object.keys(cat).filter(function(k){return !mSupFind(k)});
 var h=(mOkSups()?"":MSQL)+'<span class="psh">Pesquisa simples</span><div class="cpnl msrch"><label class="pl1" for="mfs_q">Insira palavras para pesquisar</label><input id="mfs_q" type="search" placeholder="Pesquisar" value="'+esc(MFS.q)+'"><button type="button" class="btn" data-a="sq">Pesquisar</button></div>';
 h+='<div class="rrow"><span class="mreg">Registo(s) '+(L.length?1:0)+' a '+L.length+' de um total de '+mSups().length+'</span><span class="sp"></span>'+(miss.length?'<button type="button" class="btn ghost" data-a="simp">Importar '+miss.length+' do catálogo</button>':'')+'<button type="button" class="btn mbl" data-a="snew"'+(mOkSups()?'':' disabled')+'>Adicionar Fornecedor</button><button type="button" class="btn dk" data-a="scsv">Exportar</button></div>';
 h+='<div class="mtw"><table class="mtb"><thead><tr><th>Código</th><th>Nome</th><th>Contactos</th><th>Contribuinte</th><th class="r">Artigos</th><th class="r">Dívida</th><th class="c">Editar</th><th class="c">Eliminar</th></tr></thead><tbody>'+
 L.map(function(s){var o=MFS.open===s.id;return '<tr data-sid="'+s.id+'"><td>'+esc(s.cod||"")+'</td><td><b>'+esc(s.nome||"(sem nome)")+'</b><br><span class="mu">'+esc([s.mor,[s.cp,s.loc].filter(Boolean).join(" "),s.pais].filter(Boolean).join(" · "))+'</span></td><td>'+esc([s.tel,s.email].filter(Boolean).join(" · "))+'</td><td>'+esc(s.nif||"")+'</td><td class="r">'+(cat[s.nome]||0)+'</td><td class="r">'+eur(dv[cname(s.nome)]||0)+'</td><td class="c"><a href="#" data-a="sed">'+(o?"Fechar":"Editar")+'</a></td><td class="c"><button type="button" class="btn ico" data-a="sdel" title="Eliminar">×</button></td></tr>'+
  (o?'<tr class="medit"><td colspan="8"><div class="mgrid">'+[["cod","Código"],["nome","Nome"],["nif","Contribuinte"],["mor","Morada",1],["cp","Código postal"],["loc","Localidade"],["pais","País"],["tel","Telefone"],["email","Email"],["web","Website"],["notas","Observações",1]].map(function(f){return '<div'+(f[2]?' class="w2"':'')+'><label>'+f[1]+'</label><input data-sf="'+f[0]+'" value="'+esc(s[f[0]]||"")+'"></div>'}).join("")+'</div><p class="mu" style="margin:8px 0 0">'+mHistEnt("forn",s.nome)+'</p></td></tr>':'')}).join("")+'</tbody></table></div>'+(L.length?'':'<p class="mu" style="padding:12px 4px">Sem fornecedores.</p>');
 $("#mforn_b").innerHTML=h}
function mHistEnt(kind,nome){var n=cname(nome),D=mDocs().filter(function(d){return mLive(d)&&MT[d.t].e===kind&&cname(d.ent.nome)===n});if(!D.length)return "Sem documentos.";var tot=0,dv=0;D.forEach(function(d){if(MSALES.indexOf(d.t)>-1||MBUY.indexOf(d.t)>-1)tot+=mSign(d)*mTot(d).tot;dv+=mDiv(d)});return D.length+" documentos · faturado "+eur(tot)+" · em dívida "+eur(dv)}
function rVend(){mPhd("mvend","Vendedores","Nesta secção pode administrar os vendedores da sua empresa.");var m=mCfg(),V=m.vend;var tot={};mDocs().forEach(function(d){if(mLive(d)&&d.vend&&MSALES.indexOf(d.t)>-1){tot[d.vend]=(tot[d.vend]||0)+mSign(d)*mTot(d).il}});
 $("#mvend_b").innerHTML='<div class="rrow"><span class="mreg">Registo(s) '+(V.length?1:0)+' a '+V.length+' de um total de '+V.length+'</span><span class="sp"></span><button type="button" class="btn mbl" data-a="vnew">Adicionar Vendedor</button></div><div class="mtw"><table class="mtb"><thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th class="r">Comissão (%)</th><th class="r">Vendas s/ IVA</th><th class="r">Comissões</th><th class="c">Eliminar</th></tr></thead><tbody>'+
 V.map(function(v,i){var t=tot[v.nome]||0;return '<tr data-vi="'+i+'"><td><input data-vf="nome" value="'+esc(v.nome)+'"></td><td><input data-vf="email" value="'+esc(v.email||"")+'"></td><td><input data-vf="tel" value="'+esc(v.tel||"")+'"></td><td><input data-vf="com" class="mnumi" inputmode="decimal" value="'+esc(v.com||"")+'"></td><td class="r">'+eur(t)+'</td><td class="r">'+eur(t*num(v.com)/100)+'</td><td class="c"><button type="button" class="btn ico" data-a="vdel">×</button></td></tr>'}).join("")+'</tbody></table></div>'+(V.length?'':'<p class="mu" style="padding:12px 4px">Sem vendedores. Os vendedores podem ser escolhidos nos documentos de venda.</p>')}

/* =====================================================================
   STOCKS
   ===================================================================== */
function mStock(){var M={};mDocs().forEach(function(d){var T=MT[d.t];if(!mLive(d)||!T.stk||d.nostk)return;(d.ln||[]).forEach(function(l){var k=l.pid?"p:"+l.pid:(l.ref?"r:"+String(l.ref).trim().toLowerCase():"");if(!k)return;var o=M[k]||(M[k]={k:k,ref:l.ref||"",nome:l.nome||"",ent:0,sai:0,mov:[]}),q=num(l.q)*T.stk;if(q>0)o.ent+=q;else o.sai-=q;o.mov.push({d:d,q:q,arm:d.arm})})});return M}
var MSK={q:"",open:"",neg:false};
function rStk(){var v=MSV.mstk;if(v==="mov")return rMov();mPhd("mstk","Controlo de stocks","Nesta secção pode consultar as existências dos artigos movimentados nos documentos.");var M=mStock(),L=Object.keys(M).map(function(k){var o=M[k];o.st=rd(o.ent-o.sai);return o}),q=cname(MSK.q);if(q)L=L.filter(function(o){return cname(o.ref+" "+o.nome).indexOf(q)>-1});if(MSK.neg)L=L.filter(function(o){return o.st<=0});L.sort(function(a,b){return cname(a.nome)<cname(b.nome)?-1:1});
 var h='<span class="psh">Pesquisa simples</span><div class="cpnl msrch"><label class="pl1" for="msk_q">Insira palavras para pesquisar</label><input id="msk_q" type="search" placeholder="Pesquisar" value="'+esc(MSK.q)+'"><label class="mck"><input type="checkbox" id="msk_n"'+(MSK.neg?' checked':'')+'> Só sem stock</label><button type="button" class="btn" data-a="kq">Pesquisar</button></div>';
 h+='<div class="rrow"><span class="mreg">'+L.length+' artigo(s) com movimentos</span><span class="sp"></span><button type="button" class="btn ghost" data-a="kei">Entrada de inventário</button><button type="button" class="btn ghost" data-a="ksi">Saída de inventário</button><button type="button" class="btn ghost" data-a="knq">Nota de quebra</button><button type="button" class="btn dk" data-a="kcsv">Exportar</button></div>';
 h+='<div class="mtw"><table class="mtb"><thead><tr><th>Referência</th><th>Artigo</th><th class="r">Entradas</th><th class="r">Saídas</th><th class="r">Stock atual</th><th class="c">Movimentos</th></tr></thead><tbody>'+L.map(function(o){var op=MSK.open===o.k;return '<tr data-k="'+esc(o.k)+'"><td>'+esc(o.ref)+'</td><td><b>'+esc(o.nome)+'</b></td><td class="r">'+mny(o.ent).replace(/,00$/,"")+'</td><td class="r">'+mny(o.sai).replace(/,00$/,"")+'</td><td class="r"><b class="'+(o.st<0?"bad":o.st===0?"mu":"")+'">'+mny(o.st).replace(/,00$/,"")+'</b></td><td class="c"><a href="#" data-a="kmv">'+(op?"Fechar":"Ver")+'</a></td></tr>'+(op?'<tr class="medit"><td colspan="6">'+mMovTable(o.mov)+'</td></tr>':'')}).join("")+'</tbody></table></div>'+(L.length?'':'<p class="mu" style="padding:12px 4px">Ainda não há movimentos de stock. Os stocks contam a partir de faturas, guias, notas de crédito, faturas de fornecedores e documentos de inventário finalizados.</p>');
 $("#mstk_b").innerHTML=h}
function mMovTable(mv){return '<table class="mtb"><thead><tr><th>Data</th><th>Documento</th><th>Entidade</th><th>Armazém</th><th class="r">Quantidade</th></tr></thead><tbody>'+mv.slice().sort(function(a,b){return a.d.data<b.d.data?1:-1}).map(function(x){return '<tr><td>'+esc(fdate(x.d.data))+'</td><td><a href="#" data-a="goid" data-id="'+x.d.id+'">'+esc(MT[x.d.t].n+" "+mNum(x.d))+'</a></td><td>'+esc(x.d.ent&&x.d.ent.nome||"")+'</td><td>'+esc(x.arm||"")+'</td><td class="r '+(x.q<0?"bad":"good")+'">'+(x.q>0?"+":"")+mny(x.q).replace(/,00$/,"")+'</td></tr>'}).join("")+'</tbody></table>'}
function rMov(){mPhd("mstk","Movimentos de stock","Lista de todos os movimentos de stock dos documentos finalizados.");var M=mStock(),all=[];Object.keys(M).forEach(function(k){M[k].mov.forEach(function(x){all.push({d:x.d,q:x.q,arm:x.arm,nome:M[k].nome,ref:M[k].ref})})});all.sort(function(a,b){return a.d.data<b.d.data?1:-1});
 $("#mstk_b").innerHTML='<div class="mtw"><table class="mtb"><thead><tr><th>Data</th><th>Documento</th><th>Artigo</th><th>Armazém</th><th class="r">Quantidade</th></tr></thead><tbody>'+all.slice(0,500).map(function(x){return '<tr><td>'+esc(fdate(x.d.data))+'</td><td><a href="#" data-a="goid" data-id="'+x.d.id+'">'+esc(MT[x.d.t].n+" "+mNum(x.d))+'</a></td><td>'+esc([x.ref,x.nome].filter(Boolean).join(" · "))+'</td><td>'+esc(x.arm||"")+'</td><td class="r '+(x.q<0?"bad":"good")+'">'+(x.q>0?"+":"")+mny(x.q).replace(/,00$/,"")+'</td></tr>'}).join("")+'</tbody></table></div>'+(all.length?'':'<p class="mu" style="padding:12px 4px">Sem movimentos.</p>')}

/* =====================================================================
   CONSULTAS
   ===================================================================== */
var MCN={ext:["Extrato de Vendas","Lista dos documentos de venda finalizados no período."],ana:["Análise de Vendas","Vendas por mês, por cliente e por artigo."],mar:["Margens de Lucro","Diferença entre o preço de venda e o custo dos artigos do catálogo."],iva:["Mapas de IVA","IVA liquidado nas vendas e IVA dedutível nas compras, por taxa."],pend:["Listagem de pendentes","Documentos com valores por receber ou por pagar."],hcli:["Histórico de Clientes","Totais de faturação e dívida por cliente."],ldoc:["Listagem de documentos","Todos os documentos, de todos os tipos."],extc:["Extrato de Compras","Lista das faturas e notas de crédito de fornecedores."],hforn:["Histórico de Fornecedores","Totais de compras e dívida por fornecedor."],hvend:["Histórico de Vendedores","Vendas e comissões por vendedor."]};
var MCF={de:"",ate:""};
function mRange(){if(!MCF.de){var d=new Date();MCF.de=d.getFullYear()+"-01-01";MCF.ate=today()}return MCF}
function mIn(d){var r=mRange();return d.data>=r.de&&d.data<=r.ate}
function mTbl(head,rows,foot,al){al=al||[];return '<div class="mtw"><table class="mtb"><thead><tr>'+head.map(function(x,i){return '<th'+(al[i]?' class="'+al[i]+'"':'')+'>'+esc(x)+'</th>'}).join("")+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(x,i){return '<td'+(al[i]?' class="'+al[i]+'"':'')+'>'+x+'</td>'}).join("")+'</tr>'}).join("")+'</tbody>'+(foot?'<tfoot><tr>'+foot.map(function(x,i){return '<td'+(al[i]?' class="'+al[i]+'"':'')+'><b>'+x+'</b></td>'}).join("")+'</tr></tfoot>':'')+'</table></div>'+(rows.length?'':'<p class="mu" style="padding:12px 4px">Sem dados no período.</p>')}
var MCX=null;
function rCons(){var v=MSV.mcons||"ext",N=MCN[v]||MCN.ext,r=mRange();mPhd("mcons",N[0],N[1]);var h='<div class="cpnl msrch"><div><label for="mc_de">Desde</label><input id="mc_de" type="date" value="'+r.de+'"></div><div><label for="mc_ate">Até</label><input id="mc_ate" type="date" value="'+r.ate+'"></div><span class="sp"></span><button type="button" class="btn dk" data-a="ccsv">Exportar</button></div>';
 var L=mDocs().filter(function(d){return mLive(d)&&mIn(d)}),body="",lnk=function(d){return '<a href="#" data-a="goid" data-id="'+d.id+'">'+esc(mNum(d))+'</a>'};MCX=null;
 var sales=L.filter(function(d){return MSALES.indexOf(d.t)>-1}),buys=L.filter(function(d){return MBUY.indexOf(d.t)>-1});
 if(v==="ext"||v==="extc"){var D=v==="ext"?sales:buys,ti=0,tv=0,tt=0;D.sort(function(a,b){return a.data<b.data?-1:1});var rows=D.map(function(d){var t=mTot(d),s=mSign(d);ti+=s*t.il;tv+=s*t.iva;tt+=s*t.tot;return [esc(fdate(d.data)),lnk(d),esc(MT[d.t].n),esc(d.ent.nome),esc(d.ent.nif||""),eur(s*t.il),eur(s*t.iva),eur(s*t.tot),eur(mDiv(d))]});
  body=mTbl(["Data","N.º","Tipo",v==="ext"?"Cliente":"Fornecedor","Contribuinte","Ilíquido","IVA","Total","Dívida"],rows,["","","","","",eur(ti),eur(tv),eur(tt),""],["","","","","","r","r","r","r"]);
  MCX=[["Data","N.º","Tipo","Entidade","Contribuinte","Ilíquido","IVA","Total","Dívida"]].concat(D.map(function(d){var t=mTot(d),s=mSign(d);return [d.data,mNum(d),MT[d.t].n,d.ent.nome,d.ent.nif||"",mny(s*t.il),mny(s*t.iva),mny(s*t.tot),mny(mDiv(d))]}))}
 else if(v==="ana"){var mo={},cl={},ar={};sales.forEach(function(d){var s=mSign(d),t=mTot(d),k=d.data.slice(0,7);mo[k]=(mo[k]||0)+s*t.il;cl[d.ent.nome]=(cl[d.ent.nome]||0)+s*t.il;var dg=num(d.dg);(d.ln||[]).forEach(function(l){var n=l.nome||"(sem nome)";ar[n]=(ar[n]||0)+s*mLn(l).b*(1-dg/100)})});
  var ks=Object.keys(mo).sort(),top=function(o){return Object.keys(o).map(function(k){return {l:k,v:rd(o[k])}}).sort(function(a,b){return b.v-a.v}).slice(0,12)};
  body='<h3 class="ph3">Vendas sem IVA por mês</h3>'+(ks.length?barChart(ks.map(function(k){return mLbl(k)}),ks.map(function(k){return rd(mo[k])}),"#79bfe8"):'<p class="mu">Sem vendas no período.</p>')+'<div class="m2c"><div><h3 class="ph3">Por cliente</h3>'+hbars(top(cl),eur,1)+'</div><div><h3 class="ph3">Por artigo</h3>'+hbars(top(ar),eur,1)+'</div></div>'}
 else if(v==="mar"){var A={};sales.forEach(function(d){var s=mSign(d),dg=num(d.dg);(d.ln||[]).forEach(function(l){var p=l.pid&&S.products.find(function(x){return x.id===l.pid}),k=l.pid||("n:"+l.nome),o=A[k]||(A[k]={n:l.nome,ref:l.ref,q:0,v:0,c:0,hc:!!p});o.q+=s*num(l.q);o.v+=s*mLn(l).b*(1-dg/100);if(p)o.c+=s*num(l.q)*num(p.cost)})});
  var R=Object.keys(A).map(function(k){return A[k]}).sort(function(a,b){return (b.v-b.c)-(a.v-a.c)}),tv2=0,tc=0;var rows2=R.map(function(o){tv2+=o.v;if(o.hc)tc+=o.c;var mg=o.v-o.c;return [esc(o.ref||""),esc(o.n),mny(o.q).replace(/,00$/,""),eur(o.v),o.hc?eur(o.c):'<span class="mu">sem custo</span>',o.hc?eur(mg):"—",o.hc&&o.v?Math.round(mg/o.v*100)+"%":"—"]});
  body=mTbl(["Ref.","Artigo","Qtd.","Vendas s/ IVA","Custo","Margem","%"],rows2,["","","",eur(tv2),eur(tc),"",""],["","","r","r","r","r","r"])+'<p class="mu">O custo vem do catálogo (preço de compra do artigo). Linhas livres e artigos sem custo não entram na margem.</p>'}
 else if(v==="iva"){var X={};function addX(d,side){var s=mSign(d),t=mTot(d);Object.keys(t.tx).forEach(function(k){var o=X[k]||(X[k]={vb:0,vi:0,cb:0,ci:0});if(side==="v"){o.vb+=s*t.tx[k].b;o.vi+=s*t.tx[k].v}else{o.cb+=s*t.tx[k].b;o.ci+=s*t.tx[k].v}})}sales.forEach(function(d){addX(d,"v")});buys.forEach(function(d){addX(d,"c")});
  var a=0,b=0,rows3=Object.keys(X).sort(function(x,y){return y-x}).map(function(k){var o=X[k];a+=o.vi;b+=o.ci;return [k+"%",eur(o.vb),eur(o.vi),eur(o.cb),eur(o.ci),eur(o.vi-o.ci)]});
  body=mTbl(["Taxa","Base (vendas)","IVA liquidado","Base (compras)","IVA dedutível","Saldo"],rows3,["Total","",eur(a),"",eur(b),eur(a-b)],["","r","r","r","r","r"])+'<p class="mu">'+(a-b>=0?"IVA a entregar ao Estado no período: <b>"+eur(a-b)+"</b>":"IVA a recuperar no período: <b>"+eur(b-a)+"</b>")+'. As despesas registadas no separador Despesas não entram aqui.</p>'}
 else if(v==="pend"){var P=mDocs().filter(function(d){return mDiv(d)>0.005}).sort(function(a,b){return (a.venc||a.data)<(b.venc||b.data)?-1:1}),td=today(),s1=0,s2=0;var rows4=P.map(function(d){var dv=mDiv(d),f=MT[d.t].e==="forn",ld=d.venc&&d.venc<td?Math.round((new Date(td)-new Date(d.venc))/864e5):0;if(f)s2+=dv;else s1+=dv;return [esc(f?"A pagar":"A receber"),lnk(d),esc(d.ent.nome),esc(fdate(d.data)),esc(d.venc?fdate(d.venc):""),ld?'<span class="bad">'+ld+' dias</span>':'<span class="mu">no prazo</span>',eur(mTot(d).tot),eur(dv)]});
  body='<p>Por receber de clientes: <b class="bad">'+eur(s1)+'</b> · Por pagar a fornecedores: <b>'+eur(s2)+'</b></p>'+mTbl(["","Documento","Entidade","Data","Vencimento","Atraso","Total","Em dívida"],rows4,null,["","","","","","","r","r"])+'<p class="mu">Esta listagem mostra todos os pendentes, sem filtro de datas. Os valores por receber das folhas de obra estão em Documentos › Cobranças.</p>';
  MCX=[["Tipo","Documento","Entidade","Data","Vencimento","Total","Em dívida"]].concat(P.map(function(d){return [MT[d.t].e==="forn"?"A pagar":"A receber",mNum(d),d.ent.nome,d.data,d.venc||"",mny(mTot(d).tot),mny(mDiv(d))]}))}
 else if(v==="hcli"||v==="hforn"){var kind=v==="hcli"?"cli":"forn",G={},src=v==="hcli"?sales:buys;src.forEach(function(d){var k=d.ent.nome||"—",o=G[k]||(G[k]={n:k,nif:d.ent.nif,c:0,il:0,t:0});o.c++;o.il+=mSign(d)*mTot(d).il;o.t+=mSign(d)*mTot(d).tot});
  var dv2={};mDocs().forEach(function(d){if(MT[d.t].e===kind){var k=d.ent.nome||"—";dv2[k]=(dv2[k]||0)+mDiv(d)}});var R2=Object.keys(G).map(function(k){return G[k]}).sort(function(a,b){return b.t-a.t});
  body=mTbl([kind==="cli"?"Cliente":"Fornecedor","Contribuinte","Documentos","Total s/ IVA","Total c/ IVA","Em dívida (hoje)"],R2.map(function(o){return [esc(o.n),esc(o.nif||""),o.c,eur(o.il),eur(o.t),eur(dv2[o.n]||0)]}),null,["","","r","r","r","r"]);
  MCX=[["Entidade","Contribuinte","Documentos","Total s/ IVA","Total c/ IVA","Em dívida"]].concat(R2.map(function(o){return [o.n,o.nif||"",o.c,mny(o.il),mny(o.t),mny(dv2[o.n]||0)]}))}
 else if(v==="hvend"){var V={},vs=mCfg().vend;sales.forEach(function(d){var k=d.vend||"(sem vendedor)",o=V[k]||(V[k]={c:0,il:0});o.c++;o.il+=mSign(d)*mTot(d).il});body=mTbl(["Vendedor","Documentos","Vendas s/ IVA","Comissão"],Object.keys(V).map(function(k){var x=vs.find(function(y){return y.nome===k});return [esc(k),V[k].c,eur(V[k].il),x&&num(x.com)?eur(V[k].il*num(x.com)/100)+' <span class="mu">('+num(x.com)+'%)</span>':"—"]}),null,["","r","r","r"])}
 else if(v==="ldoc"){var A2=mDocs().filter(function(d){return d.est!=="R"&&mIn(d)}).sort(function(a,b){return a.data<b.data?1:-1});body=mTbl(["Data","Documento","Tipo","Entidade","Estado","Total"],A2.map(function(d){return [esc(fdate(d.data)),lnk(d),esc(MT[d.t].n),esc(d.ent.nome||d.arm||""),d.est==="A"?'<span class="bad">Anulado</span>':"Finalizado",eur(mTot(d).tot)]}),null,["","","","","","r"]);
  MCX=[["Data","Documento","Tipo","Entidade","Estado","Total"]].concat(A2.map(function(d){return [d.data,mNum(d),MT[d.t].n,d.ent.nome||d.arm||"",d.est==="A"?"Anulado":"Finalizado",mny(mTot(d).tot)]}))}
 $("#mcons_b").innerHTML=h+body}

/* =====================================================================
   CONFIGURAÇÕES
   ===================================================================== */
var MCG={series:["Séries de Documentos","Séries usadas na numeração dos documentos (ex.: FT2026/1). Só uma série fica ativa para documentos novos."],msgs:["Mensagens predefinidas","Texto que aparece por omissão nas observações de cada tipo de documento."],taxas:["Impostos e taxas","Taxas de IVA disponíveis nas linhas dos documentos."],banco:["Dados Bancários","Aparecem nos PDF das faturas e documentos de venda."],prazos:["Prazos de Vencimento","Prazos disponíveis nos documentos com pagamento a prazo."],mpag:["Métodos de Pagamento","Formas de pagamento disponíveis nos documentos."],mexp:["Métodos de Expedição","Usados na secção Entrega e Transporte."],viat:["Viaturas","Matrículas sugeridas nas guias."],un:["Unidades de Medida","Unidades disponíveis nas linhas dos documentos."],arm:["Armazéns","Armazéns usados nos documentos que movimentam stock."]};
function rMcfg(){var v=MSV.mcfg||"series",m=mCfg(),N=MCG[v]||MCG.series;mPhd("mcfg",N[0],N[1]);var h="";
 if(v==="series"){h='<div class="mtw"><table class="mtb"><thead><tr><th>Série</th><th class="c">Ativa</th><th class="r">Documentos</th><th class="c">Eliminar</th></tr></thead><tbody>'+m.series.map(function(s,i){var n=mDocs().filter(function(d){return d.s===s.c}).length;return '<tr data-i="'+i+'"><td><input data-cf="c" value="'+esc(s.c)+'"'+(n?' disabled title="Já tem documentos"':'')+'></td><td class="c"><input type="radio" name="mser" data-cf="a"'+(s.a?' checked':'')+'></td><td class="r">'+n+'</td><td class="c">'+(n?'<span class="mu">—</span>':'<button type="button" class="btn ico" data-a="cdel">×</button>')+'</td></tr>'}).join("")+'</tbody></table></div><p><button type="button" class="btn mbl" data-a="cadd">Adicionar série</button></p>'}
 else if(v==="msgs"){h='<div class="mgrid">'+Object.keys(MT).map(function(t){return '<div class="w2"><label>'+esc(MT[t].n)+'</label><textarea rows="2" data-msg="'+t+'">'+esc(m.msgs[t]||"")+'</textarea></div>'}).join("")+'</div>'}
 else if(v==="taxas"){h='<div class="mtw"><table class="mtb"><thead><tr><th>Nome</th><th class="r">Taxa (%)</th><th class="c">Eliminar</th></tr></thead><tbody>'+m.taxas.map(function(x,i){return '<tr data-i="'+i+'"><td><input data-cf="n" value="'+esc(x.n)+'"></td><td><input data-cf="v" class="mnumi" inputmode="decimal" value="'+esc(x.v)+'"></td><td class="c"><button type="button" class="btn ico" data-a="cdel">×</button></td></tr>'}).join("")+'</tbody></table></div><p><button type="button" class="btn mbl" data-a="cadd">Adicionar taxa</button></p><label for="mc_isen">Motivo de isenção (para linhas com IVA 0%)</label><input id="mc_isen" value="'+esc(m.isen)+'"><p class="mu">A taxa de IVA por omissão continua a ser a que está em Configurações › Personalização e preços ('+num(S.cfg.iva)+'%).</p>'}
 else if(v==="banco"){h='<div class="mgrid"><div class="w2"><label for="mc_bn">Banco</label><input id="mc_bn" value="'+esc(m.banco.n)+'"></div><div class="w2"><label for="mc_bi">IBAN</label><input id="mc_bi" value="'+esc(m.banco.iban)+'"></div><div><label for="mc_bs">BIC / SWIFT</label><input id="mc_bs" value="'+esc(m.banco.swift)+'"></div></div>'}
 else if(v==="prazos"){h='<div class="mtw"><table class="mtb"><thead><tr><th>Nome</th><th class="r">Dias</th><th class="c">Eliminar</th></tr></thead><tbody>'+m.prazos.map(function(x,i){return '<tr data-i="'+i+'"><td><input data-cf="n" value="'+esc(x.n)+'"></td><td><input data-cf="d" class="mnumi" inputmode="numeric" value="'+esc(x.d)+'"></td><td class="c"><button type="button" class="btn ico" data-a="cdel">×</button></td></tr>'}).join("")+'</tbody></table></div><p><button type="button" class="btn mbl" data-a="cadd">Adicionar prazo</button></p>'}
 else{var A=m[v]||[];h='<div class="mtw"><table class="mtb"><thead><tr><th>Nome</th><th class="c">Eliminar</th></tr></thead><tbody>'+A.map(function(x,i){return '<tr data-i="'+i+'"><td><input data-cf="s" value="'+esc(x)+'"></td><td class="c"><button type="button" class="btn ico" data-a="cdel">×</button></td></tr>'}).join("")+'</tbody></table></div><p><button type="button" class="btn mbl" data-a="cadd">Adicionar</button></p>'}
 $("#mcfg_b").innerHTML=h+'<p class="mu" id="mc_msg"></p>'}

/* =====================================================================
   EVENTOS
   ===================================================================== */
function mRender(){if(MD.mode==="list")mList();else mEd()}
(function(){
 var b=$("#mdoc_b");
 b.addEventListener("click",function(e){var a=e.target.closest("[data-a],[data-pg]");if(!a)return;var tr=a.closest("tr[data-id]"),d=tr?mDocs().find(function(x){return x.id===tr.dataset.id}):null,act=a.dataset.a;
  if(a.dataset.pg!=null&&!act){MD.pg=+a.dataset.pg;mList();return}
  if(a.tagName==="A")e.preventDefault();
  if(act==="adv"){MD.adv=!MD.adv;mList();return}
  if(act==="srch"){mListRead();MD.pg=0;mList();return}
  if(act==="new"){MD.cur=mNew(MD.t);MD.ro=false;MD.mode="edit";MD.ps="";mRender();window.scrollTo(0,0);return}
  if(act==="csv"){mCsvDocs();return}
  if(act==="open"&&d){mOpen(d.id);return}
  if(act==="pdf"&&d){mPdfGo(d);return}
  if(act==="dup"&&d){mDup(d);return}
  if(act==="conv"&&d){mDup(d,a.dataset.to);return}
  if(act==="anl"&&d){mAnular(d);return}
  if(act==="del"&&d){if(confirm("Eliminar este rascunho?")){S.docs=mDocs().filter(function(x){return x.id!==d.id});mSave();mList()}return}
  if(act==="goid"){mOpen(a.dataset.id);return}
  /* formulário */
  var c=MD.cur;if(!c)return;
  if(act==="cancel"){if(!MD.ro&&!confirm("Sair sem guardar as alterações?"))return;MD.mode="list";mList();window.scrollTo(0,0);return}
  if(act==="draft"){mDraft();return}
  if(act==="fin"){mFinalize();return}
  if(act==="pdf1"){if(!MD.ro)mReadForm();mPdfGo(c);return}
  if(act==="dup1"){mDup(c);return}
  if(act==="conv1"){mDup(c,a.dataset.to);return}
  if(act==="anl1"){mAnular(c);return}
  if(act==="free"){mReadForm();c.ln.push({pid:"",ref:"",nome:"",det:"",q:1,un:mCfg().un[0]||"Un.",p:"",ds:"",iva:mDefIva(c.t)});mEd();var ins=document.querySelectorAll('#mdoc_b tr[data-l] [data-k="nome"]');if(ins.length)ins[ins.length-1].focus();return}
  if(act==="addp"){mReadForm();var p=S.products.find(function(x){return x.id===a.dataset.pid});if(p){c.ln.push(mLineFromProd(p,c.t));MD.ps="";mEd()}return}
  if(act==="rml"){mReadForm();c.ln.splice(+a.closest("tr[data-l]").dataset.l,1);mEd();return}
  if(act==="imp"){var v=$("#mf_imp").value;if(!v){mMsg("Escolha de onde importar.",1);return}mReadForm();mImport(v);return}
  if(act==="credcp"){mReadForm();var r=mDocs().find(function(x){return x.id===c.rel});if(!r){mMsg("Escolha o documento a creditar.",1);return}c.ln=mClone(r.ln||[]);c.dg=r.dg;if(!c.ent.nome)c.ent=mClone(r.ent);mEd();return}
  if(act==="mkent"){mReadForm();var nm=String(c.ent.nome||"").trim();if(!nm){mMsg("Escreva o nome no campo de pesquisa e carregue de novo em “Criar”.",1);return}
   if(MT[c.t].e==="cli"){if(findClient(nm)){mMsg("Esse cliente já existe.");return}if(SYNC.ok.clients===false){mMsg("Não é possível criar clientes: falta executar o supabase-atualizacao.sql.",1);return}S.clients.push({id:uid(),nome:nm,clube:"",contacto:"",nif:c.ent.nif||"",notas:c.ent.mor||"",cp:c.ent.cp||"",loc:c.ent.loc||""});save();if(typeof rClis==="function")rClis();mMsg("Cliente “"+nm+"” criado.")}
   else{if(mSupFind(nm)){mMsg("Esse fornecedor já existe.");return}mSups().push({id:uid(),cod:mSupCod(),nome:nm,nif:c.ent.nif||"",mor:c.ent.mor||"",cp:c.ent.cp||"",loc:c.ent.loc||"",pais:c.ent.pais||"Portugal",email:"",tel:"",notas:""});save();mDl();mMsg("Fornecedor “"+nm+"” criado.")}return}
 });
 b.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.id==="md_q"){mListRead();MD.pg=0;mList()}});
 b.addEventListener("input",function(e){var t=e.target,c=MD.cur;
  if(t.id==="mf_ps"){MD.ps=t.value;mHits();return}
  if(!c||MD.ro||MD.mode!=="edit")return;
  var tr=t.closest("tr[data-l]");if(tr&&t.dataset.k){var l=c.ln[+tr.dataset.l];l[t.dataset.k]=t.dataset.k==="iva"?num(t.value):t.value;var lt=tr.querySelector("[data-lt]");if(lt)lt.textContent=eur(mLn(l).b);$("#mf_tot").innerHTML=mTotHtml(c);if(t.tagName==="TEXTAREA"){t.style.height="auto";t.style.height=t.scrollHeight+"px"}return}
  if(t.id==="mf_dg"||t.matches("[data-lqv]")){mReadForm();$("#mf_tot").innerHTML=mTotHtml(c)}});
 b.addEventListener("change",function(e){var t=e.target,c=MD.cur;if(t.id==="md_est"){mListRead();MD.pg=0;mList();return}if(!c||MD.ro||MD.mode!=="edit")return;
  if(t.id==="mf_en"){mReadForm();if(mFillEnt(t.value)){mEd()}else if(MT[c.t].liq||MT[c.t].cred)mEd();return}
  if(t.id==="mf_pz"){mReadForm();if(t.value!=="")c.venc=addDays(c.data||today(),+t.value);mEd();return}
  if(t.id==="mf_data"&&c.prazo!==""&&c.prazo!=null){mReadForm();c.venc=addDays(c.data,+c.prazo);var vv=$("#mf_venc");if(vv)vv.value=c.venc;return}
  if(t.matches("[data-lqc]")){var row=t.closest("tr"),inp=row.querySelector("[data-lqv]"),x=mDocs().find(function(y){return y.id===row.dataset.lq});if(t.checked&&!num(inp.value)&&x)inp.value=mny(mDiv(x));if(!t.checked)inp.value="";mReadForm();$("#mf_tot").innerHTML=mTotHtml(c);return}
  if(t.id==="mf_rel"){mReadForm();var r=mDocs().find(function(y){return y.id===t.value});if(r&&!c.ent.nome){c.ent=mClone(r.ent);mEd()}$("#mf_tot")&&($("#mf_tot").innerHTML=mTotHtml(c));return}
  if(t.dataset.k==="un"||t.dataset.k==="iva"){mReadForm();$("#mf_tot").innerHTML=mTotHtml(c)}});
 function mListRead(){var q=$("#md_q");if(q)MD.q=q.value;var s=$("#md_est");if(s)MD.est=s.value;var a=$("#md_de");if(a)MD.de=a.value;var z=$("#md_ate");if(z)MD.ate=z.value;var en=$("#md_ent");if(en)MD.ent=en.value}
 window.mListRead=mListRead;
 /* fornecedores */
 var fb=$("#mforn_b");
 fb.addEventListener("click",function(e){var a=e.target.closest("[data-a]");if(!a)return;if(a.tagName==="A")e.preventDefault();var tr=a.closest("tr[data-sid]"),s=tr?mSups().find(function(x){return x.id===tr.dataset.sid}):null,act=a.dataset.a;
  if(act==="sq"){MFS.q=$("#mfs_q").value;rSups()}
  else if(act==="snew"){var n={id:uid(),cod:mSupCod(),nome:"",nif:"",mor:"",cp:"",loc:"",pais:"Portugal",email:"",tel:"",notas:""};mSups().unshift(n);MFS.open=n.id;MFS.q="";save();rSups();var i=document.querySelector('#mforn_b [data-sf="nome"]');if(i)i.focus()}
  else if(act==="sed"&&s){MFS.open=MFS.open===s.id?"":s.id;rSups();mDl()}
  else if(act==="sdel"&&s){if(mDocs().some(function(d){return MT[d.t].e==="forn"&&cname(d.ent.nome)===cname(s.nome)})&&!confirm("Este fornecedor tem documentos. Os documentos ficam, mas o fornecedor sai da lista. Continuar?"))return;if(!confirm("Eliminar o fornecedor “"+(s.nome||"sem nome")+"”?"))return;S.sups=mSups().filter(function(x){return x!==s});save();rSups();mDl()}
  else if(act==="simp"){var seen={};(S.products||[]).forEach(function(p){var k=String(p.sup||"").trim();if(k&&!seen[k.toLowerCase()]&&!mSupFind(k)){seen[k.toLowerCase()]=1;mSups().push({id:uid(),cod:mSupCod(),nome:k,nif:"",mor:"",cp:"",loc:"",pais:"",email:"",tel:"",notas:"Importado do catálogo"})}});save();rSups();mDl()}
  else if(act==="scsv"){dl("Fornecedores_"+today()+".csv",[["Código","Nome","Contribuinte","Morada","Código postal","Localidade","País","Telefone","Email"]].concat(mSups().map(function(s){return [s.cod,s.nome,s.nif,s.mor,s.cp,s.loc,s.pais,s.tel,s.email]})).map(function(r){return r.map(qcsv).join(";")}).join("\n"))}});
 fb.addEventListener("input",function(e){var k=e.target.dataset.sf;if(!k)return;var tr=e.target.closest("tr").previousElementSibling,s=tr&&mSups().find(function(x){return x.id===tr.dataset.sid});if(s){s[k]=e.target.value;save()}});
 fb.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.id==="mfs_q"){MFS.q=e.target.value;rSups()}});
 fb.addEventListener("focusout",function(e){if(e.target.dataset.sf==="nome")mDl()});
 /* vendedores */
 var vb=$("#mvend_b");
 vb.addEventListener("click",function(e){var a=e.target.closest("[data-a]");if(!a)return;var m=mCfg();if(a.dataset.a==="vnew"){m.vend.push({nome:"",email:"",tel:"",com:""});save();rVend();var ins=document.querySelectorAll('#mvend_b [data-vf="nome"]');if(ins.length)ins[ins.length-1].focus()}else if(a.dataset.a==="vdel"){var i=+a.closest("tr").dataset.vi;if(confirm("Eliminar este vendedor?")){m.vend.splice(i,1);save();rVend()}}});
 vb.addEventListener("input",function(e){var k=e.target.dataset.vf;if(!k)return;var v=mCfg().vend[+e.target.closest("tr").dataset.vi];if(v){v[k]=e.target.value;save()}});
 vb.addEventListener("focusout",function(e){if(e.target.dataset.vf==="com")rVend()});
 /* stocks */
 var kb=$("#mstk_b");
 kb.addEventListener("click",function(e){var a=e.target.closest("[data-a]");if(!a)return;if(a.tagName==="A")e.preventDefault();var act=a.dataset.a;
  if(act==="kq"){MSK.q=$("#msk_q").value;MSK.neg=$("#msk_n").checked;rStk()}else if(act==="kmv"){var k=a.closest("tr").dataset.k;MSK.open=MSK.open===k?"":k;rStk()}else if(act==="goid")mOpen(a.dataset.id);
  else if(act==="kei")docGo("EI","new");else if(act==="ksi")docGo("SI","new");else if(act==="knq")docGo("NQ","new");
  else if(act==="kcsv"){var M=mStock();dl("Stocks_"+today()+".csv",[["Referência","Artigo","Entradas","Saídas","Stock"]].concat(Object.keys(M).map(function(k){var o=M[k];return [o.ref,o.nome,mny(o.ent),mny(o.sai),mny(o.ent-o.sai)]})).map(function(r){return r.map(qcsv).join(";")}).join("\n"))}});
 kb.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.id==="msk_q"){MSK.q=e.target.value;rStk()}});
 /* consultas */
 var cb=$("#mcons_b");
 cb.addEventListener("change",function(e){if(e.target.id==="mc_de"||e.target.id==="mc_ate"){MCF.de=$("#mc_de").value||MCF.de;MCF.ate=$("#mc_ate").value||MCF.ate;rCons()}});
 cb.addEventListener("click",function(e){var a=e.target.closest("[data-a]");if(!a)return;if(a.tagName==="A")e.preventDefault();if(a.dataset.a==="goid")mOpen(a.dataset.id);else if(a.dataset.a==="ccsv"){var rows=MCX;if(!rows){var t=document.querySelector("#mcons_b table");if(!t)return;rows=[].map.call(t.querySelectorAll("tr"),function(r){return [].map.call(r.children,function(c){return c.textContent.trim()})})}dl(((MCN[MSV.mcons]||MCN.ext)[0]).replace(/\s+/g,"_")+"_"+today()+".csv",rows.map(function(r){return r.map(qcsv).join(";")}).join("\n"))}});
 /* configurações */
 var gb=$("#mcfg_b");
 function list(){var m=mCfg(),v=MSV.mcfg;return v==="series"?m.series:v==="taxas"?m.taxas:v==="prazos"?m.prazos:m[v]}
 gb.addEventListener("click",function(e){var a=e.target.closest("[data-a]");if(!a)return;var v=MSV.mcfg,L=list();if(a.dataset.a==="cadd"){if(v==="series")L.push({c:String(new Date().getFullYear())+"B",a:0});else if(v==="taxas")L.push({n:"",v:0});else if(v==="prazos")L.push({n:"",d:0});else L.push("");save();rMcfg();var rows=gb.querySelectorAll("tr[data-i]");if(rows.length){var f=rows[rows.length-1].querySelector("input:not([type=radio])");if(f)f.focus()}}
  else if(a.dataset.a==="cdel"){var i=+a.closest("tr").dataset.i;if(L.length<=1&&(v==="series"||v==="mpag"||v==="un"||v==="arm"||v==="taxas")){$("#mc_msg").textContent="Tem de ficar pelo menos um.";return}L.splice(i,1);if(v==="series"&&!L.some(function(s){return s.a}))L[0].a=1;save();rMcfg()}});
 gb.addEventListener("input",function(e){var t=e.target,m=mCfg(),v=MSV.mcfg;
  if(t.dataset.msg){m.msgs[t.dataset.msg]=t.value;save();return}
  if(t.id==="mc_isen"){m.isen=t.value;save();return}
  if(t.id==="mc_bn"||t.id==="mc_bi"||t.id==="mc_bs"){m.banco[{mc_bn:"n",mc_bi:"iban",mc_bs:"swift"}[t.id]]=t.value;save();return}
  var tr=t.closest("tr[data-i]");if(!tr||!t.dataset.cf)return;var L=list(),i=+tr.dataset.i,k=t.dataset.cf;
  if(k==="s")L[i]=t.value;else if(k==="a"){L.forEach(function(s,j){s.a=j===i?1:0})}else if(k==="c"){var val=t.value.replace(/[^A-Za-z0-9]/g,"").toUpperCase();if(val!==t.value)t.value=val;L[i].c=val}else if(k==="v"||k==="d")L[i][k]=num(t.value);else L[i][k]=t.value;save()});
 gb.addEventListener("change",function(e){if(e.target.dataset.cf==="a"){var L=list(),i=+e.target.closest("tr").dataset.i;L.forEach(function(s,j){s.a=j===i?1:0});save()}});
})();

/* datalists de fornecedores e viaturas */
function mDl(){var e=$("#msupl");if(!e){e=document.createElement("datalist");e.id="msupl";document.body.appendChild(e)}e.innerHTML=mSups().map(function(s){return '<option value="'+esc(s.nome)+'"'+(s.nif?' label="'+esc(s.nome+" — "+s.nif)+'"':'')+'>'}).join("");
 var v=$("#mviat");if(!v){v=document.createElement("datalist");v.id="mviat";document.body.appendChild(v)}v.innerHTML=mCfg().viat.map(function(x){return '<option value="'+esc(x)+'">'}).join("")}

/* ---------- ligação ao resto da app ---------- */
var MOL={
 show:function(t){if(t==="mdoc")mRender();else if(t==="mforn"){mDl();rSups()}else if(t==="mvend")rVend();else if(t==="mstk")rStk();else if(t==="mcons")rCons();else if(t==="mcfg")rMcfg()},
 refresh:function(){mTouch();mDl();var cur=document.querySelector('#tabs button[aria-pressed="true"]'),t=cur&&cur.dataset.t;if(!t)return;var sec=$("#"+t);var a=document.activeElement;if(sec&&a&&a!==document.body&&sec.contains(a))return;if(t==="mdoc"){if(MD.mode==="list")mList()}else if(["mforn","mvend","mstk","mcons","mcfg"].indexOf(t)>-1)MOL.show(t)}
};

/* Painel Principal: passa a usar os documentos de venda quando existirem */
(function(){var oldP=pData;
 pData=function(){var D=mDocs().filter(function(d){return mLive(d)&&MSALES.indexOf(d.t)>-1});if(!D.length)return oldP();var ks=mMonths(7),ix={},F=[],R=[];ks.forEach(function(k,i){ix[k]=i;F.push(0);R.push(0)});
  D.forEach(function(d){var k=d.data.slice(0,7),s=mSign(d);if(k in ix){F[ix[k]]+=s*mTot(d).tot;if(MT[d.t].pago)R[ix[k]]+=s*mTot(d).tot}});
  mDocs().forEach(function(x){if(!mLive(x)||x.t!=="RC")return;var k=x.data.slice(0,7);if(k in ix)R[ix[k]]+=mTot(x).tot});return {ks:ks,F:F,R:R}};
 var oldR=rPainel;rPainel=function(){oldR();var el=$("#painel_b");if(!el)return;var ul=el.querySelector(".pl");if(ul&&!ul.querySelector('[data-g="mdocs"]')){ul.insertAdjacentHTML("afterbegin",'<li><a href="#" data-g="mdocs">Documentos</a><span>'+mDocs().filter(function(d){return d.est!=="R"}).length.toLocaleString("pt-PT")+'</span></li>');ul.insertAdjacentHTML("beforeend",'<li><a href="#" data-g="mforn">Fornecedores</a><span>'+mSups().length.toLocaleString("pt-PT")+'</span></li>')}
  var D=mDocs().filter(function(d){return mLive(d)&&MSALES.indexOf(d.t)>-1});if(D.length){var p=el.querySelector(".pbody p.mu");if(p&&PT==="teso")p.innerHTML='Valores recebidos e total faturado nos documentos de venda (com IVA). <span class="rng">'+fdate(mMonths(7)[0]+"-01")+" a "+fdate(today())+'</span>';
   var dv=0;mDocs().forEach(function(d){if(MT[d.t].e==="cli")dv+=mDiv(d)});var box=el.querySelectorAll(".p3>div")[2];if(box&&!box.querySelector(".mdv"))box.insertAdjacentHTML("beforeend",'<p class="mdv"><b>Documentos de venda</b><br><span class="mu">Por receber:</span> <b class="'+(dv>0.005?"bad":"good")+'">'+eur(dv)+'</b></p>')}};
 $("#painel").addEventListener("click",function(e){var a=e.target.closest('a[data-g="mdocs"],a[data-g="mforn"]');if(!a)return;e.preventDefault();e.stopPropagation();if(a.dataset.g==="mdocs")docGo("FT");else mGo("mforn")},true)})();

/* Orçamento: gerar documentos a partir do orçamento aberto */
(function(){var mp=document.querySelector("#mmore .mpop");if(!mp)return;[["FT","Criar fatura deste orçamento"],["PF","Criar fatura pró-forma"],["NE","Criar nota de encomenda"]].forEach(function(x){var bt=document.createElement("button");bt.className="btn ghost";bt.type="button";bt.textContent=x[1];bt.onclick=function(){if(!S.lines.length)return;if(typeof noQty==="function"&&noQty())return;var tmpId="__cur";var q={id:tmpId,num:S.cur.num,cli:S.cur.cli,disc:S.cur.disc,dtype:S.cur.dtype,siva:S.cur.siva,lines:JSON.parse(JSON.stringify(S.lines))};S.quotes.push(q);MD.cur=mNew(x[0]);MD.ro=false;MD.t=x[0];MD.mode="edit";try{mImport("q:"+tmpId)}finally{S.quotes=S.quotes.filter(function(z){return z.id!==tmpId})}if(S.cur.id)MD.cur.obs=(MD.cur.obs?MD.cur.obs+"\n":"")+"Referente ao orçamento n.º "+(S.cur.num||"");document.getElementById("mmore").open=false;mgo("mdoc",mEd)};mp.appendChild(bt)})})();

/* estilos */
(function(){var st=document.createElement("style");st.id="moloni3";st.textContent=[
 ".mtw{overflow-x:auto}.mtb{width:100%;border-collapse:collapse;font-size:.86rem}.mtb th{font-weight:600;text-align:left;padding:9px 8px;border-bottom:1px solid var(--bd);white-space:nowrap}.mtb td{padding:8px;border-bottom:1px solid var(--bd);vertical-align:top}.mtb .r{text-align:right}.mtb .c{text-align:center}.mtb .nw,.nw{white-space:nowrap}.mtb tfoot td{border-top:2px solid var(--bd)}",
 ".mtb tr.anl td{opacity:.55}.mtb tr.anl td:first-child a{text-decoration:line-through}.mtb input,.mtb select,.mtb textarea{min-width:0;width:100%}.mtb .mnumi{text-align:right;max-width:96px}.mtb .mref{max-width:110px}.mtb textarea{margin-top:4px;font-size:.8rem;resize:vertical;min-height:28px}",
 ".mln td{vertical-align:top}.mln td:nth-child(2){min-width:240px;width:40%}.mln td:nth-child(4) select{min-width:78px}.mln td:nth-child(7) select{min-width:74px}.mnm{display:flex;flex-direction:column;gap:4px}.mnm textarea{position:static!important;display:block;width:100%!important;margin:0}",
 ".mtag{font-style:normal;font-size:.72rem;border:1px solid var(--bd);border-radius:3px;padding:1px 6px;color:var(--mu)}.mtag.bad{color:#c0392b;border-color:#e8b4ad}",
 ".mbg{display:inline-block;min-width:44px;padding:3px 6px;border-radius:2px;color:#fff;font-size:.76rem;font-weight:600;text-align:center}.mbg.bad{background:#f2542d}.mbg.mid{background:#f5a524}.mbg.ok{background:#22b07d}",
 ".mps{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:4px 0 8px}.msrch{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.msrch input[type=search]{flex:1 1 220px}.msrch select{flex:0 1 190px}.madv{margin-top:8px}.madv>div{flex:0 1 180px}",
 ".rrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0 8px}.rrow .sp,.msrch .sp{flex:1}.mreg{font-size:.85rem}.mpg{display:inline-flex;gap:4px;flex-wrap:wrap}.mpg .btn{padding:3px 9px;min-width:0}",
 ".macts{display:flex;gap:2px;justify-content:center;align-items:center}.macts .btn.ico{display:inline-flex}.mdm{position:relative;display:inline-block}.mdm>summary{list-style:none}.mdm>summary::-webkit-details-marker{display:none}.mdm .mpop{right:0;left:auto;min-width:230px}.mdm0{display:inline-block;width:29px}",
 ".mhd{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 10px}.mtit{font-size:1.1rem;font-weight:600}.mnum{color:#0b83e6}.mbtns{display:flex;gap:8px;flex-wrap:wrap}.mbot{justify-content:flex-end;margin-top:18px}",
 ".mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 14px;align-items:end}.mgrid .w2{grid-column:span 2}.mck{display:flex;align-items:center;gap:6px;font-size:.88rem}.mck input{width:auto}.mbt{display:flex;align-items:end}",
 ".mbox{border:1px solid var(--bd);margin:16px 0 0;background:var(--card)}.mbh{background:#eef0f3;padding:9px 14px;font-weight:600;color:#232b38}.mbb{padding:12px 14px}.mfl{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mfl>input,.mfl>select{flex:1 1 240px}",
 ".msec{border-bottom:1px solid var(--bd);padding:4px 0 12px;margin:12px 0 0}.msec>summary{cursor:pointer;font-weight:600;padding:8px 0;list-style:none}.msec>summary::before{content:'›';display:inline-block;margin-right:10px;transform:rotate(90deg);transition:transform .15s}.msec:not([open])>summary::before{transform:rotate(0)}.msec>summary::-webkit-details-marker{display:none}.msec textarea{width:100%}",
 ".mhits{display:flex;flex-direction:column;border:1px solid var(--bd);margin-top:6px;max-height:320px;overflow:auto}.mhit{text-align:left;border:0;border-bottom:1px solid var(--bd);background:var(--card);padding:8px 10px;cursor:pointer;font:inherit;color:inherit}.mhit:hover{background:#e8f2fb}",
 ".mtots{display:flex;justify-content:flex-end;margin-top:14px}.mtots table{min-width:300px;border-collapse:collapse;font-size:.92rem}.mtots td{padding:4px 8px}.mtots td:last-child{text-align:right;white-space:nowrap}.mtots tr.tf td{border-top:2px solid var(--tx);font-weight:700;font-size:1.05rem;padding-top:8px}",
 ".mwarn{border-left:4px solid #c0392b;background:#fdf0ee;padding:10px 14px;margin:0 0 12px;font-size:.9rem}.mnote{font-size:.78rem;margin-top:14px}.medit td{background:#f7fafc}.m2c{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:18px}.bad{color:#c0392b}.good{color:#22a46d}",
 "html[data-aspeto=moloni] .btn.mbl{background:#0b83e6!important;border-color:#0b83e6!important;color:#fff!important;border-radius:3px!important}html[data-aspeto=moloni] .mtb th{color:#232b38;border-bottom-color:#dfe5ec}html[data-aspeto=moloni] .mtb td{border-bottom-color:#e6ebf1}html[data-aspeto=moloni] .mtb tbody tr:nth-child(even):not(.medit){background:#eef4f8}html[data-aspeto=moloni] .mtb a{color:#0b83e6;text-decoration:none}",
 "html[data-aspeto=moloni] .psh{display:block}html[data-aspeto=moloni] .mps .psh{margin:0}html[data-aspeto=moloni] .msec>summary{color:#232b38;font-weight:500}html[data-aspeto=moloni] .mbox{border-color:#dfe5ec}",
 "@media(max-width:700px){.mgrid .w2{grid-column:auto}.m2c{grid-template-columns:1fr}.mtots table{min-width:0;width:100%}.mhd{align-items:flex-start}}"
 ].join("\n");document.head.appendChild(st)})();
