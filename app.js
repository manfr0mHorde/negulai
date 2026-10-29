'use strict';
const KEY='negulyai-budget-v1';
// Four starting categories; all other expenses and savings goals are user-defined.
const CATS=[
{id:'groceries',name:'Продукты для дома',icon:'🛒',kind:'limit',amount:0,core:true},
{id:'utilities',name:'Комуслуги',icon:'🏠',kind:'fixed',amount:0,core:true},
{id:'phone',name:'Тариф',icon:'📱',kind:'fixed',amount:0,core:true},
{id:'transport',name:'Проезд',icon:'🚌',kind:'limit',amount:0,core:true}
];
const BASE_IDS=new Set(CATS.map(c=>c.id));
const dateISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&dateISO(new Date(value+'T12:00:00'))===value;
function dateFromPayday(day){const now=new Date(),d=Math.max(1,Math.min(31,Number(day)||10));let target=new Date(now.getFullYear(),now.getMonth(),Math.min(d,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()),12);if(target<new Date(now.getFullYear(),now.getMonth(),now.getDate(),12))target=new Date(now.getFullYear(),now.getMonth()+1,Math.min(d,new Date(now.getFullYear(),now.getMonth()+2,0).getDate()),12);return dateISO(target)}
const DEFAULT=()=>({version:3,opening:0,paydayDate:dateFromPayday(10),planned:{salary:0,stipend:0,extra:0},categories:CATS.map(c=>({...c})),transactions:[],debts:[],loans:[],created:new Date().toISOString()});
function migrate(data){
 if(!data||![1,2,3].includes(data.version)||!Array.isArray(data.transactions)||!Array.isArray(data.categories)||!Array.isArray(data.debts))throw Error('format');
 const transactions=data.transactions.map(t=>({...t,category:t.category==='taxi'?'transport':t.category}));
 const used=new Set(transactions.map(t=>t.category).filter(Boolean));
 const existing=data.categories.map(c=>({...c,id:c.id==='taxi'?'transport':c.id}));
 const categories=CATS.map(base=>({...base,amount:Math.max(0,Number(existing.find(c=>c.id===base.id)?.amount)||0)}));
 for(const c of existing){if(!c||BASE_IDS.has(c.id)||!c.id)continue;const hasData=used.has(c.id)||Number(c.amount)>0||c.archived===true;if(data.version===1&&!hasData)continue;categories.push({id:String(c.id),name:String(c.name||'Категория'),icon:String(c.icon||'🧩'),kind:c.kind==='target'?'target':c.kind==='fixed'?'fixed':'limit',amount:Math.max(0,Number(c.amount)||0),core:false,archived:!!c.archived})}
 const preferred=validDate(data.paydayDate)?data.paydayDate:dateFromPayday(data.payday);
 return {...DEFAULT(),...data,version:3,paydayDate:preferred,transactions,categories,debts:data.debts.map(d=>({...d})),loans:Array.isArray(data.loans)?data.loans.map(d=>({...d})):[]};
}
let state=load();let toastTimer,quoteOffset=0;
function load(){try{const raw=localStorage.getItem(KEY);if(raw)return migrate(JSON.parse(raw))}catch(e){console.warn('Budget restore failed',e)}return DEFAULT()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){alert('Не удалось сохранить данные. Проверь свободное место и настройки Safari. Сделай экспорт резервной копии.')}render()}
const el=id=>document.getElementById(id), money=n=>Math.round(Number(n)||0).toLocaleString('ru-RU')+' ₸', esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), validMoney=s=>Number.isFinite(Number(s))&&Number(s)>=0&&Number(s)<=1e12;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const monthKey=d=>String(d||'').slice(0,7), currentMonth=()=>today().slice(0,7), isThisMonth=t=>monthKey(t.date)===currentMonth();
const category=id=>state.categories.find(c=>c.id===id);
const total=(a)=>a.reduce((s,x)=>s+x,0);
const txAmount=(type,filter=()=>true)=>total(state.transactions.filter(t=>t.type===type&&filter(t)).map(t=>+t.amount));
const balance=()=>state.opening+txAmount('income')+txAmount('release')+txAmount('loan_return')-txAmount('expense')-txAmount('transfer')-txAmount('debt')-txAmount('loan_out');
const monthlySpent=id=>txAmount('expense',t=>isThisMonth(t)&&t.category===id);
const monthlyTransfer=id=>txAmount('transfer',t=>isThisMonth(t)&&t.category===id)-txAmount('release',t=>isThisMonth(t)&&t.category===id);
const allocated=id=>txAmount('transfer',t=>t.category===id)-txAmount('release',t=>t.category===id);
const due=d=>Math.max(0,(+d.principal||0)-txAmount('debt',t=>t.debtId===d.id));
const debtTotal=()=>total(state.debts.map(d=>due(d)));
const loanRemaining=l=>Math.max(0,(Number(l.principal)||0)-txAmount('loan_return',t=>t.loanId===l.id));
const loansOutstanding=()=>total(state.loans.map(loanRemaining));
const loanRepaid=l=>txAmount('loan_return',t=>t.loanId===l.id);
const newId=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2);
function nextPayday(){const now=new Date(),start=new Date(state.paydayDate+'T12:00:00');now.setHours(12,0,0,0);if(start>=now)return start;const d=start.getDate(),y=now.getFullYear(),m=now.getMonth();let next=new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate()),12);if(next<now)next=new Date(y,m+1,Math.min(d,new Date(y,m+2,0).getDate()),12);return next}
function daysToPayday(){const now=new Date();now.setHours(12,0,0,0);return Math.max(0,Math.round((nextPayday()-now)/86400000))}
const QUOTES=[
{lang:'ҚАЗ',icon:'🌱',text:'Ақшаңды басқарсаң, мүмкіндігің көбейеді.',tip:'Ақылмен жұмсалған теңге — болашаққа жасалған қадам.'},
{lang:'РУС',icon:'🧠',text:'Не размер зарплаты решает всё, а то, что ты оставляешь себе.',tip:'Сначала заплати будущему себе, потом — остальным.'},
{lang:'ҚАЗ',icon:'💫',text:'Байлық көп жұмсауда емес, дұрыс таңдауда.',tip:'Бүгінгі сабыр — ертеңгі еркіндік.'},
{lang:'РУС',icon:'🎯',text:'Каждая покупка — это голос за твоё будущее.',tip:'Спроси себя: это необходимость или минутное желание?'},
{lang:'ҚАЗ',icon:'🏔️',text:'Тамшыдан теңіз, теңгеден жинақ құралады.',tip:'Аз болса да, тұрақты жинаған маңызды.'},
{lang:'РУС',icon:'🪴',text:'Финансовая свобода начинается не с миллиона, а с привычки.',tip:'Маленькие решения сегодня работают на тебя завтра.'},
{lang:'ҚАЗ',icon:'🧭',text:'Мақсаты бар ақшаның бағыты да бар.',tip:'Әр теңгеңе міндет бер: жұмсау, сақтау немесе өсіру.'},
{lang:'РУС',icon:'⚖️',text:'Лимит — не запрет на радость, а забота о завтрашнем дне.',tip:'Можно радоваться жизни и не терять контроль над деньгами.'},
{lang:'ҚАЗ',icon:'✨',text:'Арманың үлкен болса, күнделікті таңдауың саналы болсын.',tip:'Бір күнде емес, күн сайын ілгеріле.'},
{lang:'РУС',icon:'🌤️',text:'Не сравнивай свой кошелёк с чужой витриной.',tip:'Твоя финансовая цель важнее чужих покупок.'},
{lang:'ҚАЗ',icon:'🧱',text:'Қаржылық тыныштық жоспардан басталады.',tip:'Бүгінгі есеп — ертеңгі сенімділік.'},
{lang:'РУС',icon:'🔑',text:'Деньги любят не тишину, а ясность.',tip:'Когда знаешь цифры, легче принимать решения.'}
];
function dailyQuote(){const day=Math.floor(new Date(today()+'T12:00:00').getTime()/86400000);return QUOTES[((day+quoteOffset)%QUOTES.length+QUOTES.length)%QUOTES.length]}
function moneyStatus(){const over=state.categories.filter(c=>!c.archived&&c.kind==='limit'&&c.amount>0).find(c=>monthlySpent(c.id)>c.amount);if(balance()<0)return '⚠️ Баланс ниже нуля — проверь операции.';if(over)return '⚠️ '+over.name+': лимит превышен на '+money(monthlySpent(over.id)-over.amount);const days=daysToPayday();if(days>15)return '⏳ До зарплаты '+days+' дн. — не спеши тратить всё сразу.';if(days<=3)return '🎉 До зарплаты всего '+days+' дн.';return 'До зарплаты '+days+' дн. · Думай о цели, а не о скидке.'}
function render(){el('todayLabel').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'short'});el('periodLabel').textContent=new Date().toLocaleDateString('ru-RU',{month:'long',year:'numeric'});el('balanceValue').textContent=money(balance());el('balanceHint').textContent=balance()<0?'Внимание: отрицательный баланс':'Реальные средства без отложенных накоплений';el('daysValue').textContent=daysToPayday()+' дн.';el('spentValue').textContent=money(txAmount('expense',isThisMonth)+txAmount('debt',isThisMonth));const quote=dailyQuote();el('moodEmoji').textContent=quote.icon;el('moodTitle').textContent=quote.text;el('moodText').textContent=quote.tip+'  '+moneyStatus();el('quoteLang').textContent=quote.lang;el('paydayDateLabel').textContent=nextPayday().toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
const plan=total(Object.values(state.planned).map(Number));el('incomeValue').textContent=money(txAmount('income',isThisMonth));el('incomePlan').textContent='план '+money(plan);const goals=state.categories.filter(c=>c.kind==='target'&&!c.archived);el('savingsValue').textContent=money(total(goals.map(c=>allocated(c.id))));el('stocksValue').textContent=money(total(goals.map(c=>Math.max(0,c.amount-allocated(c.id)))));el('debtValue').textContent=money(debtTotal());el('debtCount').textContent=state.debts.length+' рассрочек';el('loanBalanceValue').textContent=money(loansOutstanding());el('loanCountValue').textContent=state.loans.filter(l=>loanRemaining(l)>0).length+' активных долгов';
el('categoryGrid').innerHTML=state.categories.filter(c=>!c.archived).map(c=>{const current=c.kind==='target'?allocated(c.id):monthlySpent(c.id),left=c.amount-current,pct=c.amount>0?Math.round(current/c.amount*100):0;const target=c.kind==='target';return `<button class="category ${target?'savings-category':''}" data-cat="${esc(c.id)}"><div class="category-top"><span class="category-icon">${esc(c.icon)}</span><span class="category-pct">${c.amount?Math.round(pct)+'%':target?'Цель не задана':'Без лимита'}</span></div><div class="category-name">${esc(c.name)}</div><div class="category-value">${money(current)}</div><div class="category-info">${c.amount?`${target?'До цели':'Осталось'}: ${money(Math.max(0,left))} / ${money(c.amount)}`:(target?'Укажи сумму цели':'Нажми, чтобы задать лимит')}</div>${c.amount?`<div class="progress"><div class="progress-fill ${pct>100&&!target?'over':''}" style="width:${Math.min(100,Math.max(0,pct))}%"></div></div>`:'<div class="empty-limit">＋ Настроить</div>'}</button>`}).join('')+'<button type="button" class="category create-category" id="newCategoryBtn"><span class="create-icon">＋</span><strong>Своя категория</strong><small>Расход или цель</small></button>';
el('newCategoryBtn').onclick=createCategory;
const recent=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created)).slice(0,5);el('txList').innerHTML=recent.length?recent.map(txHtml).join(''):'<div class="empty">Здесь пока тихо 👀<br>Нажми большую кнопку + и добавь первую операцию.</div>';
document.querySelectorAll('[data-cat]').forEach(btn=>btn.addEventListener('click',()=>categoryModal(btn.dataset.cat)))}
function txTitle(t){if(t.type==='income')return {salary:'Зарплата',stipend:'Стипендия',extra:'Доп. доход'}[t.category]||'Доход';if(t.type==='loan_out')return 'Выдал в долг: '+(state.loans.find(l=>l.id===t.loanId)?.person||'человек');if(t.type==='loan_return')return 'Вернули долг: '+(state.loans.find(l=>l.id===t.loanId)?.person||'человек');if(t.type==='debt')return 'Рассрочка: '+(state.debts.find(d=>d.id===t.debtId)?.name||'платёж');if(t.type==='release')return 'Возврат из конверта: '+(category(t.category)?.name||'Другое');return category(t.category)?.name||'Другое'}
function txHtml(t){const icon=t.type==='income'?'💸':t.type==='debt'?'🧾':t.type==='loan_out'?'🤝':t.type==='loan_return'?'↩️':category(t.category)?.icon||'🧩';return `<div class="tx"><div class="tx-icon">${esc(icon)}</div><div class="tx-main"><strong>${esc(t.note||txTitle(t))}</strong><small>${esc(txTitle(t))} · ${new Date(t.date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</small></div><div class="tx-amount ${['income','release','loan_return'].includes(t.type)?'positive':'negative'}">${['income','release','loan_return'].includes(t.type)?'+':'−'}${money(t.amount)}</div></div>`}
function openModal(title,html){el('modalTitle').textContent=title;el('modalContent').innerHTML=html;el('modal').classList.remove('hidden');document.body.style.overflow='hidden'}
function closeModal(){el('modal').classList.add('hidden');document.body.style.overflow=''}
function notify(s){el('toast').textContent=s;el('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('toast').classList.remove('show'),3000)}
const field=(label,id,value='',type='number',extra='')=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="0.01" inputmode="decimal"':''} ${extra}></div>`;
function openAdd(defaultCat='groceries'){let mode='expense';function body(){const option=(arr)=>arr.map(x=>`<option value="${esc(x.id)}" ${x.id===defaultCat?'selected':''}>${x.icon||''} ${esc(x.name)}</option>`).join('');const expenseCats=state.categories.filter(c=>c.kind!=='target'&&!c.archived),transferCats=state.categories.filter(c=>c.kind==='target'&&!c.archived);const catInput=mode==='debt'?`<div class="field"><label>Рассрочка</label><select id="cat">${state.debts.filter(d=>due(d)>0).map(d=>`<option value="${esc(d.id)}">${esc(d.name)} — ${money(due(d))}</option>`).join('')}</select></div>`:`<div class="field"><label>Категория</label><select id="cat">${mode==='income'?'<option value="salary">💼 Зарплата</option><option value="stipend">🎓 Стипендия</option><option value="extra">✨ Доп. доход</option>':option(mode==='transfer'||mode==='release'?transferCats:expenseCats)}</select></div>`;el('modalContent').innerHTML=`<form class="form" id="addForm"><div class="segment">${[['expense','Расход'],['income','Доход'],['transfer','Отложить'],['release','Вернуть'],['debt','Рассрочка']].map(([v,t])=>`<button type="button" class="${mode===v?'active':''}" data-mode="${v}">${t}</button>`).join('')}</div>${field('Сумма, ₸','amount','','number','required autofocus')}${catInput}${field('Дата','date',today(),'date','required')}${field('Комментарий (необязательно)','note','','text','placeholder="Например: продукты на неделю"')}<button class="btn" type="submit">${mode==='income'?'Добавить доход':mode==='transfer'?'Отложить деньги':mode==='release'?'Вернуть в баланс':'Списать с баланса'}</button><p class="hint">${mode==='transfer'?'Сбережения и акции — отдельные конверты. Деньги уходят из доступного баланса, но не считаются покупками.':mode==='release'?'Вернём деньги из накоплений в доступный баланс, не записывая доход.':mode==='debt'?'Платёж уменьшает и баланс, и остаток долга. Повторно в расходы его не добавляем.':'Баланс изменится сразу. Лимиты текущего месяца пересчитаются автоматически.'}</p></form>`;document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.mode;body()});el('addForm').onsubmit=e=>{e.preventDefault();const amount=Number(el('amount').value),cat=el('cat')?.value,date=el('date').value,note=el('note').value.trim();if(!validMoney(amount)||amount<=0)return notify('Введи сумму больше нуля');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return notify('Проверь дату');if(!validDate(date)||date>today())return notify('Проверь дату операции');if(mode==='debt'&&(!cat||amount>due(state.debts.find(d=>d.id===cat))))return notify('Платёж больше остатка долга');if(mode==='transfer'&&amount>balance())return notify('Недостаточно свободных денег');if(mode==='release'&&(!cat||amount>allocated(cat)))return notify('В конверте недостаточно денег');state.transactions.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),type:mode,amount,category:mode==='debt'?null:cat,debtId:mode==='debt'?cat:null,date,note,created:new Date().toISOString()});save();closeModal();notify(mode==='income'?'Денежки пришли! 🤑':mode==='transfer'?'Отложено, красавчик! 🐿️':mode==='release'?'Деньги вернулись в кошелёк! 🐿️':mode==='debt'?'Минус одна головная боль! 🧾':'Записано. Кошелёк всё видел 👀')}}openModal('Новое движение','');body()}
function createCategory(){openModal('Новая категория',`<form class="form" id="newCategoryForm">${field('Название категории','customName','','text','required maxlength="48" placeholder="Например: Кафе или Отпуск"')}<div class="field"><label for="customKind">Тип</label><select id="customKind"><option value="limit">Расход — месячный лимит</option><option value="target">Сбережение — общая цель</option></select></div>${field('Лимит или общая цель, ₸','customAmount',0,'number','required')}${field('Эмодзи','customIcon','🎯','text','maxlength="8"')}<button class="btn">Создать категорию</button></form>`);
el('newCategoryForm').onsubmit=e=>{e.preventDefault();const name=el('customName').value.trim(),kind=el('customKind').value,amount=Number(el('customAmount').value),icon=el('customIcon').value.trim()||'🎯';if(!name||!validMoney(amount)||name.length>48||!['limit','target'].includes(kind))return notify('Проверь данные категории');const id='custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);state.categories.push({id,name,icon,kind,amount,core:false});save();closeModal();notify('Категория создана ✨')}}
function categoryModal(id){const c=category(id);if(!c)return;const target=c.kind==='target',used=state.transactions.some(t=>t.category===id);openModal(c.icon+' '+c.name,`<div class="panel"><div class="detail-row"><span>${target?'Всего накоплено':'Потрачено за месяц'}</span><strong>${money(target?allocated(id):monthlySpent(id))}</strong></div><div class="detail-row"><span>${target?'Общая цель':'План / лимит'}</span><strong>${money(c.amount)}</strong></div><div class="detail-row"><span>${target?'Осталось накопить':'Остаток лимита'}</span><strong>${money(Math.max(0,c.amount-(target?allocated(id):monthlySpent(id))))}</strong></div></div><form class="form" id="catForm">${!c.core?field('Название','editCatName',c.name,'text','required maxlength="48"'):''}${field(target?'Общая цель накоплений, ₸':c.kind==='fixed'?'Плановая сумма, ₸':'Месячный лимит, ₸','catAmount',c.amount)}<button class="btn">Сохранить</button><button class="btn secondary" id="catAdd" type="button">${target?'Отложить деньги':'Записать расход'}</button>${target?'<button class="btn secondary" type="button" id="catRelease">↩ Вернуть в баланс</button>':''}${!c.core?'<button class="btn danger" type="button" id="catArchive">Скрыть категорию</button>':''}</form>`);
el('catForm').onsubmit=e=>{e.preventDefault();if(!validMoney(el('catAmount').value))return notify('Проверь сумму');const name=c.core?c.name:el('editCatName').value.trim();if(!name)return notify('Укажи название');c.name=name;c.amount=Number(el('catAmount').value);save();closeModal();notify('Категория обновлена')};
el('catAdd').onclick=()=>{closeModal();openAdd(id);if(target)document.querySelector('[data-mode="transfer"]').click()};
if(target)el('catRelease').onclick=()=>{closeModal();openAdd(id);document.querySelector('[data-mode="release"]').click()};
if(!c.core)el('catArchive').onclick=()=>{if(target&&allocated(id)>0)return notify('Сначала верни накопления в баланс');if(!confirm('Скрыть категорию? История операций сохранится.'))return;c.archived=true;save();closeModal();notify('Категория скрыта')}}
function settings(){openModal('Настройки бюджета',`<form class="form" id="settingsForm"><div class="notice">Стартовый баланс вводится один раз. План доходов не увеличивает реальные деньги, пока ты не запишешь поступление.</div>${field('Стартовый свободный баланс, ₸','opening',state.opening)}${field('Ближайшая дата зарплаты','paydayDate',state.paydayDate,'date','required')}<div class="panel-title">План доходов на месяц</div>${field('Зарплата, ₸','salary',state.planned.salary)}${field('Стипендия, ₸','stipend',state.planned.stipend)}${field('Дополнительные доходы, ₸','extra',state.planned.extra)}<button class="btn" type="submit">Сохранить настройки</button></form><div class="section-heading"><h2>Мои данные</h2></div><div class="stack"><button class="btn secondary" id="exportBtn">⬇ Экспорт резервной копии (JSON)</button><label class="btn secondary" style="text-align:center;cursor:pointer">⬆ Восстановить из файла<input id="importFile" type="file" accept="application/json,.json" style="display:none"></label><button class="btn danger" id="resetBtn">Сбросить всё</button></div><p class="hint" style="margin-top:14px">Данные хранятся на этом устройстве. Регулярно сохраняй резервную копию в iCloud Drive.</p>`);
el('settingsForm').onsubmit=e=>{e.preventDefault();const values=['opening','salary','stipend','extra'].map(id=>el(id).value),pd=el('paydayDate').value;if(values.some(v=>!validMoney(v))||!validDate(pd))return notify('Проверь суммы и дату зарплаты');state.opening=Number(values[0]);state.planned={salary:+values[1],stipend:+values[2],extra:+values[3]};state.paydayDate=pd;save();closeModal();notify('Настройки сохранены')};
el('exportBtn').onclick=exportData;el('importFile').onchange=importData;el('resetBtn').onclick=()=>{if(confirm('Точно удалить все операции, долги и планы? Сначала сохрани резервную копию!')){state=DEFAULT();save();closeModal();notify('Данные очищены')}}}
function debts(){openModal('Мои рассрочки',`<div class="panel"><div class="detail-row"><span>Всего осталось выплатить</span><strong>${money(debtTotal())}</strong></div></div><div class="stack">${state.debts.map(d=>`<div class="panel"><div class="detail-row"><strong>${esc(d.name)}</strong><strong>${money(due(d))}</strong></div><div class="detail-row"><span>Первоначально</span><span>${money(d.principal)}</span></div><div class="detail-row"><span>Плановый платёж / мес.</span><strong>${money(d.monthly||0)}</strong></div><div class="btn-row"><button class="btn secondary" data-pay="${esc(d.id)}">Оплатить</button><button class="btn danger" data-remove-debt="${esc(d.id)}">Удалить</button></div></div>`).join('')||'<div class="empty">Пока нет рассрочек. Отличная новость! ✨</div>'}</div><button class="btn" id="newDebt" style="width:100%;margin-top:12px">+ Добавить рассрочку</button><p class="hint" style="margin-top:12px">Здесь вводится оставшийся долг на момент начала учёта. Погашения уменьшают долг и текущий баланс.</p>`);el('newDebt').onclick=newDebt;document.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{const id=b.dataset.pay;closeModal();openAdd();document.querySelector('[data-mode="debt"]').click();el('cat').value=id});document.querySelectorAll('[data-remove-debt]').forEach(b=>b.onclick=()=>{const d=state.debts.find(x=>x.id===b.dataset.removeDebt);if(!confirm(`Удалить «${d.name}»? Связанные платежи останутся в истории и балансе.`))return;state.debts=state.debts.filter(x=>x.id!==d.id);save();debts()})}
function newDebt(){openModal('Добавить рассрочку',`<form class="form" id="debtForm">${field('Название','debtName','','text','required placeholder="Например: iPhone"')}${field('Остаток задолженности, ₸','principal','','number','required')}${field('Плановый платёж в месяц, ₸','monthly','','number')}<button class="btn">Добавить рассрочку</button></form>`);el('debtForm').onsubmit=e=>{e.preventDefault();const name=el('debtName').value.trim(),principal=Number(el('principal').value),monthly=Number(el('monthly').value||0);if(!name||!validMoney(principal)||principal<=0||!validMoney(monthly))return notify('Проверь данные рассрочки');state.debts.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,principal,monthly});save();debts();notify('Рассрочка добавлена')}}

function loanDashboard(){
 const active=state.loans.filter(l=>loanRemaining(l)>0).sort((a,b)=>b.issued.localeCompare(a.issued)),closed=state.loans.filter(l=>loanRemaining(l)<=0).sort((a,b)=>b.issued.localeCompare(a.issued));
 const row=l=>{
  const remain=loanRemaining(l),repaid=loanRepaid(l),complete=remain<=0,overdue=!complete&&l.dueDate&&l.dueDate<today();
  return `<article class="loan-entry ${complete?'loan-finished':''}"><div class="loan-entry-top"><div><strong>${esc(l.person)}</strong><small>Выдал: ${esc(l.issued)}${l.dueDate?' · Вернуть до '+esc(l.dueDate):''}</small></div><span class="loan-tag ${complete?'done':overdue?'overdue':''}">${complete?'Вернули':overdue?'Просрочен':'Ожидается'}</span></div><div class="loan-entry-sum"><span>${complete?'Возвращено полностью':'Осталось вернуть'}</span><strong>${money(remain)}</strong></div><div class="loan-meta">Всего: ${money(l.principal)} · Вернули: ${money(repaid)}</div>${l.note?`<p class="loan-note">${esc(l.note)}</p>`:''}<div class="loan-actions">${!complete?`<button class="btn" data-loan-return="${esc(l.id)}" type="button">↩ Вернул</button>`:''}<button class="btn secondary" data-loan-details="${esc(l.id)}" type="button">История</button><button class="loan-delete" data-loan-delete="${esc(l.id)}" type="button" aria-label="Удалить долг">Удалить</button></div></article>`
 };
 openModal('Долги мне',`<div class="loan-summary"><small>Тебе должны</small><strong>${money(loansOutstanding())}</strong><span>${active.length} активных долгов · ${closed.length} закрытых</span></div><button class="btn loan-new" id="loanNewBtn" type="button">＋ Выдать в долг</button><p class="hint loan-explainer">Выдача уменьшает доступный баланс. Возврат прибавляет деньги к балансу, но не считается доходом.</p><div class="loan-section-caption">Ожидаю возврата</div><div class="loan-list">${active.map(row).join('')||'<div class="empty">Пока никто не должен тебе денег 🎉</div>'}</div>${closed.length?'<div class="loan-section-caption">Вернули полностью</div><div class="loan-list">'+closed.map(row).join('')+'</div>':''}<div class="loan-installments"><span>Твои собственные обязательства</span><button class="btn secondary" id="showMyInstallments" type="button">🧾 Мои рассрочки · ${money(debtTotal())}</button></div>`);
 el('loanNewBtn').onclick=newLoan;
 el('showMyInstallments').onclick=debts;
 document.querySelectorAll('[data-loan-return]').forEach(b=>b.onclick=()=>returnLoan(b.dataset.loanReturn));
 document.querySelectorAll('[data-loan-details]').forEach(b=>b.onclick=()=>loanDetails(b.dataset.loanDetails));
 document.querySelectorAll('[data-loan-delete]').forEach(b=>b.onclick=()=>deleteLoan(b.dataset.loanDelete));
}

function newLoan(){
 openModal('Выдать в долг',`<form class="form" id="newLoanForm">${field('Кому дал деньги','loanPerson','','text','required maxlength="70" placeholder="Например: Арман"')}${field('Сумма, ₸','loanAmount','','number','required min="0.01"')}${field('Дата выдачи','loanIssued',today(),'date','required max="'+today()+'"')}${field('Когда должен вернуть (необязательно)','loanDue','','date')}${field('Комментарий (необязательно)','loanNote','','text','maxlength="180" placeholder="На что или как договорились"')}<div class="notice">Выданная сумма сразу вычитается из доступного баланса. Это не обычный расход — позже возврат восстановит баланс.</div><button class="btn" type="submit">Сохранить долг −</button></form>`);
 el('newLoanForm').onsubmit=e=>{
  e.preventDefault();
  const person=el('loanPerson').value.trim(),amount=Number(el('loanAmount').value),issued=el('loanIssued').value,dueDate=el('loanDue').value,note=el('loanNote').value.trim();
  if(!person||person.length>70||!validMoney(amount)||amount<=0||!validDate(issued)||issued>today()||dueDate&&(!validDate(dueDate)||dueDate<issued))return notify('Проверь имя, сумму и даты');
  if(amount>balance()&&!confirm('Сумма больше доступного баланса. После выдачи он может стать отрицательным. Продолжить?'))return;
  const id=newId();state.loans.push({id,person,principal:amount,issued,dueDate,note,created:new Date().toISOString()});
  state.transactions.push({id:newId(),type:'loan_out',amount,loanId:id,category:null,date:issued,note:'Выдал в долг: '+person,created:new Date().toISOString()});
  save();loanDashboard();notify('Записал: '+person+' должен '+money(amount));
 };
}

function returnLoan(id){
 const loan=state.loans.find(l=>l.id===id);if(!loan)return loanDashboard();
 const outstanding=loanRemaining(loan);if(outstanding<=0)return loanDashboard();
 openModal('Возврат от '+loan.person,`<div class="panel"><div class="detail-row"><span>Осталось вернуть</span><strong>${money(outstanding)}</strong></div><div class="detail-row"><span>Уже вернули</span><strong>${money(loanRepaid(loan))}</strong></div></div><form class="form" id="returnLoanForm">${field('Сколько вернул, ₸','loanReturnAmount',outstanding,'number','required')}${field('Дата возврата','loanReturnDate',today(),'date','required max="'+today()+'"')}<p class="hint">Если вернул только часть, укажи фактическую сумму. Остаток продолжит отображаться в разделе долгов.</p><button class="btn" type="submit">↩ Вернул — добавить к балансу</button></form>`);
 el('returnLoanForm').onsubmit=e=>{
  e.preventDefault();const amount=Number(el('loanReturnAmount').value),date=el('loanReturnDate').value,remaining=loanRemaining(loan);
  if(!validMoney(amount)||amount<=0||amount>remaining||!validDate(date)||date>today()||date<loan.issued)return notify('Проверь сумму и дату возврата');
  if(!confirm(`Подтвердить возврат ${money(amount)} от ${loan.person}? Сумма прибавится к балансу.`))return;
  state.transactions.push({id:newId(),type:'loan_return',amount,loanId:id,category:null,date,note:'Вернул долг: '+loan.person,created:new Date().toISOString()});
  save();loanDashboard();notify('На баланс вернулось '+money(amount));
 };
}

function loanDetails(id){
 const loan=state.loans.find(l=>l.id===id);if(!loan)return loanDashboard();
 const trans=state.transactions.filter(t=>t.loanId===id).sort((a,b)=>a.date.localeCompare(b.date)||a.created.localeCompare(b.created));
 openModal('История: '+loan.person,`<div class="panel"><div class="detail-row"><span>Выдано</span><strong>${money(loan.principal)}</strong></div><div class="detail-row"><span>Возвращено</span><strong class="positive">${money(loanRepaid(loan))}</strong></div><div class="detail-row"><span>Осталось</span><strong>${money(loanRemaining(loan))}</strong></div></div><div class="stack">${trans.map(t=>`<div class="history-row"><div><strong>${t.type==='loan_out'?'Выдал деньги':'Получил возврат'}</strong><small>${esc(t.date)}</small></div><strong class="${t.type==='loan_return'?'positive':'negative'}">${t.type==='loan_return'?'+':'−'}${money(t.amount)}</strong></div>`).join('')}</div><button class="btn secondary loan-back" id="backToLoans" type="button">← К списку долгов</button>`);
 el('backToLoans').onclick=loanDashboard;
}

function deleteLoan(id){
 const loan=state.loans.find(l=>l.id===id);if(!loan)return;
 if(!confirm(`Удалить долг «${loan.person}» и все связанные записи выдачи и возврата? Баланс пересчитается. Это действие нельзя отменить.`))return;
 state.loans=state.loans.filter(l=>l.id!==id);state.transactions=state.transactions.filter(t=>t.loanId!==id);
 save();loanDashboard();notify('Долг и его операции удалены');
}

/* Qalta Analytics v5: computed locally from recorded transactions, no third-party services. */
function shiftMonth(key,step){const [year,month]=key.split('-').map(Number);const date=new Date(year,month-1+step,1,12);return dateISO(date).slice(0,7)}
function reportMonths(){const out=new Set();for(let i=0;i<12;i++)out.add(shiftMonth(currentMonth(),-i));for(const t of state.transactions){if(typeof t.date==='string'&&/^\d{4}-\d{2}/.test(t.date)&&t.date.slice(0,7)<=currentMonth())out.add(t.date.slice(0,7))}return [...out].sort().reverse()}
function reportMonthName(key){const [y,m]=key.split('-').map(Number);return new Date(y,m-1,1,12).toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}
function reportData(month){
  const transactions=state.transactions.filter(t=>monthKey(t.date)===month);
  const sumType=type=>total(transactions.filter(t=>t.type===type).map(t=>Number(t.amount)||0));
  const income=sumType('income'),expenses=sumType('expense'),debts=sumType('debt'),saved=sumType('transfer')-sumType('release'),lent=sumType('loan_out'),repaid=sumType('loan_return');
  const categories=new Map();
  for(const t of transactions){if(t.type!=='expense')continue;const id=t.category||'other';const old=categories.get(id)||0;categories.set(id,old+(Number(t.amount)||0))}
  return {month,income,expenses,debts,saved,lent,repaid,spent:expenses+debts,free:income-expenses-debts-saved-lent+repaid,transactions:transactions.length,categories:[...categories].map(([id,amount])=>({id,amount,name:category(id)?.name||'Неизвестная категория',icon:category(id)?.icon||'🧩'})).sort((a,b)=>b.amount-a.amount)};
}
function reportAdvice(period,rec){
  const advice=[];
  if(rec.transactions===0)return [{icon:'📭',title:'Пока нет операций',message:'Добавь доходы и расходы — тогда Qalta сможет показать закономерности.'}];
  const current=period===currentMonth();
  if(rec.income>0&&rec.spent>rec.income)advice.push({icon:'🚨',title:'Расходов больше, чем доходов',message:'Разница '+money(rec.spent-rec.income)+'. Проверь крупные покупки и обязательные платежи.'});
  if(current){
    for(const c of state.categories.filter(c=>!c.archived&&c.kind==='limit'&&c.amount>0)){
      const spent=rec.categories.find(x=>x.id===c.id)?.amount||0,percentage=spent/c.amount;
      if(percentage>1)advice.push({icon:'🛑',title:'Перерасход: '+c.name,message:'Потрачено '+money(spent)+' при лимите '+money(c.amount)+'. Превышение '+money(spent-c.amount)+'.'});
      else if(percentage>=.8)advice.push({icon:'⚠️',title:'Лимит почти исчерпан: '+c.name,message:'Использовано '+Math.round(percentage*100)+'% лимита. До конца месяца осталось '+money(c.amount-spent)+'.'});
    }
  }
  if(rec.categories.length&&rec.expenses>0){
    const top=rec.categories[0],share=Math.round(top.amount/rec.expenses*100);
    advice.push({icon:'🔎',title:'Самая крупная статья расходов',message:top.name+' — '+money(top.amount)+' ('+share+'% обычных покупок). Проверь, можно ли уменьшить именно её.'});
  }
  if(rec.income>0&&rec.saved>0)advice.push({icon:'🌱',title:'Хорошо откладываешь',message:'На цели направлено '+Math.round(rec.saved/rec.income*100)+'% месячного дохода. Это чистая сумма после возвратов из конвертов.'});
  if(rec.debts>0)advice.push({icon:'🧾',title:'Платежи по рассрочкам',message:'В этом месяце выплачено '+money(rec.debts)+'. Рассрочки учитываются отдельно от покупок, чтобы не считать их дважды.'});
  if(rec.income===0)advice.push({icon:'💸',title:'Доходы не записаны',message:'В этом месяце нет внесённых поступлений. Без них нельзя корректно оценить долю расходов в доходе.'});
  if(!current)advice.push({icon:'📅',title:'Исторические данные',message:'Для прошлых месяцев Qalta не сравнивает траты с нынешними лимитами: старые значения лимитов не сохранялись по месяцам.'});
  else advice.push({icon:'🧭',title:'Месяц ещё идёт',message:'Итоги текущего месяца предварительные. Не сравнивай неполный месяц с полным без поправки на дни.'});
  return advice.slice(0,6);
}
function showAnalytics(month=currentMonth()){
  const months=reportMonths();if(!months.includes(month))month=months[0]||currentMonth();
  const data=reportData(month),prev=reportData(shiftMonth(month,-1));
  const option=months.map(m=>'<option value="'+m+'"'+(m===month?' selected':'')+'>'+esc(reportMonthName(m))+'</option>').join('');
  const six=Array.from({length:6},(_,i)=>shiftMonth(month,i-5)).map(reportData);
  const max=Math.max(1,...six.flatMap(v=>[v.income,v.spent]));
  const bars=six.map(v=>{
    const inc=Math.max(0,Math.min(100,v.income/max*100)),out=Math.max(0,Math.min(100,v.spent/max*100));
    const label=new Date(Number(v.month.slice(0,4)),Number(v.month.slice(5,7))-1,1,12).toLocaleDateString('ru-RU',{month:'short'});
    const caption=reportMonthName(v.month)+': доход '+money(v.income)+', расход '+money(v.spent);
    return '<div class="report-bar-column" title="'+esc(caption)+'"><div class="report-bar-track"><div class="report-bar report-bar-income" style="height:'+inc+'%"></div><div class="report-bar report-bar-expense" style="height:'+out+'%"></div></div><span>'+esc(label)+'</span></div>'
  }).join('');
  const rows=data.categories.map(c=>{
    const part=data.expenses>0?c.amount/data.expenses*100:0;
    return '<div class="report-category"><div class="report-category-line"><span>'+esc(c.icon)+' '+esc(c.name)+'</span><strong>'+money(c.amount)+'</strong></div><div class="report-progress"><span style="width:'+Math.max(0,Math.min(100,part))+'%"></span></div><small>'+Math.round(part)+'% расходов на покупки</small></div>'
  }).join('');
  const tips=reportAdvice(month,data).map(a=>'<article class="report-tip"><span>'+esc(a.icon)+'</span><div><strong>'+esc(a.title)+'</strong><p>'+esc(a.message)+'</p></div></article>').join('');
  const difference=data.spent-prev.spent;
  const comparison=data.month===currentMonth()?'В этом месяце данные ещё неполные.':prev.spent===0?'В предыдущем месяце расходов не записано.':'По сравнению с прошлым месяцем: '+(difference>0?'больше на ':difference<0?'меньше на ':'без изменений · ')+money(Math.abs(difference))+'.';
  openModal('Статистика Qalta','<div class="report-content"><div class="field"><label for="reportMonth">Месяц</label><select id="reportMonth">'+option+'</select></div><div class="report-summary">'+
    '<div class="report-stat"><small>↗ Доходы</small><strong class="positive">'+money(data.income)+'</strong></div>'+
    '<div class="report-stat"><small>↘ Расходы</small><strong>'+money(data.spent)+'</strong></div>'+
    '<div class="report-stat"><small>🐿️ Отложено (чистыми)</small><strong>'+money(data.saved)+'</strong></div>'+
    '<div class="report-stat"><small>⚖️ Денежный поток</small><strong class="'+(data.free>=0?'positive':'negative')+'">'+money(data.free)+'</strong></div></div>'+
    '<p class="report-note">Денежный поток = доходы − покупки − рассрочки − накопления − выданные займы + возвраты займов. Стартовый баланс не считается доходом.</p>'+ '<div class="report-loan-flow"><span>🤝 Выдал в долг: <b>'+money(data.lent)+'</b></span><span>↩ Вернули долг: <b>'+money(data.repaid)+'</b></span></div>'+
    '<div class="report-section-head"><h3>Последние 6 месяцев</h3></div>'+
    '<div class="report-chart-key"><span><i class="income-dot"></i>Доходы</span><span><i class="expense-dot"></i>Расходы, включая рассрочки</span></div>'+
    '<div class="report-chart" role="img" aria-label="График доходов и расходов за шесть месяцев">'+bars+'</div>'+
    '<p class="report-note">'+esc(comparison)+'</p>'+
    '<div class="report-section-head"><h3>На что ушли деньги</h3></div>'+
    '<div class="report-split"><span>Покупки: <b>'+money(data.expenses)+'</b></span><span>Рассрочки: <b>'+money(data.debts)+'</b></span></div>'+
    '<div class="report-category-list">'+(rows||'<div class="empty">В этом месяце пока нет расходов по категориям.</div>')+'</div>'+
    '<div class="report-section-head"><h3>💡 Qalta Insights</h3><small>Локальные подсказки</small></div>'+
    '<div class="report-tips">'+tips+'</div>'+
    '<p class="report-note">Это автоматический анализ по правилам, а не облачный ИИ. Данные остаются на устройстве и не отправляются сторонним сервисам.</p>'+
    '<button class="btn secondary" id="reportHistory" type="button">Посмотреть всю историю операций</button></div>');
  el('reportMonth').onchange=e=>showAnalytics(e.target.value);
  el('reportHistory').onclick=history;
}

function history(){const list=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created));openModal('История операций',`<div class="notice" style="margin-bottom:14px">Удаление записи пересчитает баланс, бюджет и долг. Для исправления ошибочной операции удали её и добавь заново.</div><div class="stack">${list.map(t=>`<div class="history-row"><div><strong>${esc(t.note||txTitle(t))}</strong><small>${esc(t.date)} · ${esc(txTitle(t))}</small></div><div style="text-align:right"><strong class="${['income','release','loan_return'].includes(t.type)?'positive':'negative'}">${['income','release','loan_return'].includes(t.type)?'+':'−'}${money(t.amount)}</strong><br><button class="text-btn" data-del-tx="${esc(t.id)}">Удалить</button></div></div>`).join('')||'<div class="empty">Операций пока нет</div>'}</div>`);document.querySelectorAll('[data-del-tx]').forEach(b=>b.onclick=()=>{const tx=state.transactions.find(t=>t.id===b.dataset.delTx);if(!tx)return;if(tx.type==='loan_out'){notify('Выданный долг удаляется в разделе «Долги мне», вместе со связанными возвратами.');return}if(!confirm(tx.type==='loan_return'?'Удалить запись возврата? Долг снова увеличится, а баланс уменьшится.':'Удалить эту операцию?'))return;state.transactions=state.transactions.filter(t=>t.id!==b.dataset.delTx);save();history();notify('Операция удалена')})}
function exportData(){const content=JSON.stringify(state,null,2),blob=new Blob([content],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ne-gulyai-backup-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Сохрани копию в «Файлы» ✅')}
function normalizeBackup(p){const d=migrate(p);if(!validMoney(d.opening)||!validDate(d.paydayDate)||!d.planned||['salary','stipend','extra'].some(k=>!validMoney(d.planned[k])))throw Error('settings');for(const c of d.categories){if(!c.id||!c.name||!validMoney(c.amount)||!['limit','fixed','target'].includes(c.kind))throw Error('category')}for(const t of d.transactions){if(!t.id||!['income','expense','transfer','release','debt','loan_out','loan_return'].includes(t.type)||!validMoney(t.amount)||Number(t.amount)<=0||!validDate(t.date))throw Error('transaction')}for(const debt of d.debts){if(!debt.id||!debt.name||!validMoney(debt.principal)||!validMoney(debt.monthly))throw Error('debt')}for(const loan of d.loans){if(!loan.id||!loan.person||!validMoney(loan.principal)||loan.principal<=0||!validDate(loan.issued)||loan.dueDate&&!validDate(loan.dueDate))throw Error('loan')}for(const t of d.transactions.filter(t=>t.type==='loan_out'||t.type==='loan_return')){if(!t.loanId||!d.loans.some(l=>l.id===t.loanId))throw Error('loan-transaction')}for(const loan of d.loans){const outward=d.transactions.filter(t=>t.type==='loan_out'&&t.loanId===loan.id);const inward=d.transactions.filter(t=>t.type==='loan_return'&&t.loanId===loan.id);if(outward.length!==1||Math.abs(outward[0].amount-loan.principal)>.001||total(inward.map(t=>+t.amount))>loan.principal+.001)throw Error('loan-balance')}return d}
async function importData(event){const file=event.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw Error('size');const parsed=normalizeBackup(JSON.parse(await file.text()));if(!confirm('Заменить все текущие данные содержимым резервной копии?'))return;localStorage.setItem(KEY,JSON.stringify(parsed));state=parsed;render();closeModal();notify('Резервная копия восстановлена')}catch(e){notify('Не удалось восстановить копию: проверь файл и свободное место')}}
el('addBtn').onclick=()=>openAdd();el('settingsBtn').onclick=settings;el('quoteNextBtn').onclick=()=>{quoteOffset++;render()};el('allTransactions').onclick=history;el('loanHomeBtn').onclick=loanDashboard;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='analytics')showAnalytics();else if(b.dataset.tab==='history')history();else if(b.dataset.tab==='debts')loanDashboard();else if(b.dataset.tab==='settings')settings();else{closeModal();window.scrollTo({top:0,behavior:'smooth'})}});el('modal').addEventListener('click',e=>{if(e.target.dataset.close)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});render();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
