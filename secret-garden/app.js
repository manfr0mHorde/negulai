const STORE_KEY = 'secret-garden-demo-v1';

const defaults = {
  settings: {
    shopName: 'Secret Garden Astana',
    subtitle: 'Цветы и доставка · Астана',
    instagram: 'https://www.instagram.com/secretgardenastana/',
    whatsappNumber: '',
    whatsappEnabled: false,
    kaspiHint: 'После подтверждения наличия и стоимости продавец отправит удалённый счёт Kaspi на указанный номер.',
    address: 'Толе би 48/1, Астана',
    hours: 'Каждый день · 09:00–00:00',
    deliveryNote: 'Доставка по Астане согласовывается после подтверждения заказа. Стоимость зависит от адреса и времени.',
    about: 'По любви. Со вкусом 🌿'
  },
  products: [
    {id:'p1', type:'ready', status:'available', name:'Цветочный микс с подсолнухами', desc:'Яркое настроение и сезонные цветы. Фото из открытого скриншота Instagram магазина; цена примерная.', price:18500, prep:'Готов сейчас · уточните наличие', qty:1, img:'./assets/ig-flower-mix.webp'},
    {id:'p2', type:'ready', status:'available', name:'Гортензии и зелень', desc:'Объёмная композиция с гортензией. Демонстрационная карточка, стоимость примерная.', price:24500, prep:'Готов сейчас · уточните наличие', qty:1, img:'./assets/ig-hydrangea.webp'},
    {id:'p3', type:'ready', status:'available', name:'Белый сад', desc:'Белые розы и хризантемы — спокойно и элегантно.', price:16000, prep:'Готов сейчас', qty:1, img:'./assets/bouquet-soft.webp'},
    {id:'p4', type:'custom', status:'available', name:'Авторский букет 20–30K', desc:'Соберём нежный букет в этом бюджете, ориентируясь на ваши пожелания.', price:20000, prep:'Подготовка от 2 часов', qty:99, img:'./assets/bouquet-green.webp'},
    {id:'p5', type:'custom', status:'available', name:'Авторский букет 30–50K', desc:'Премиальный микс с сезонными акцентами и красивой упаковкой.', price:35000, prep:'Подготовка от 3 часов', qty:99, img:'./assets/bouquet-blush.webp'},
    {id:'p6', type:'custom', status:'sold', name:'Коробка с ранункулюсами', desc:'Пример композиции под заказ в коробке.', price:42000, prep:'Под заказ', qty:0, img:'./assets/bouquet-sun.webp'}
  ],
  extras: [
    {id:'e1', name:'Открытка', price:500},
    {id:'e2', name:'Топпер', price:1500},
    {id:'e3', name:'Ваза', price:4500},
    {id:'e4', name:'Шары', price:3500},
  ],
  cart: [],
  orders: []
};

const clone = (x) => JSON.parse(JSON.stringify(x));
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}`;
const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} ₸`;
const esc = (s='') => String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const dateLabel = (d) => new Date(d).toLocaleDateString('ru-RU', {day:'2-digit', month:'short'});
const dateTimeLabel = (d) => new Date(d).toLocaleString('ru-RU', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
const $ = (id) => document.getElementById(id);

let state = load();
let ui = {filter:'all', search:'', sellerPanel:'overview'};

function load(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return clone(defaults);
    const parsed = JSON.parse(raw);
    return {
      settings: {...clone(defaults.settings), ...(parsed.settings || {})},
      products: Array.isArray(parsed.products) && parsed.products.length ? parsed.products : clone(defaults.products),
      extras: Array.isArray(parsed.extras) && parsed.extras.length ? parsed.extras : clone(defaults.extras),
      cart: Array.isArray(parsed.cart) ? parsed.cart : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : []
    };
  } catch(e){ return clone(defaults); }
}
function saveSafely(){
  try{localStorage.setItem(STORE_KEY,JSON.stringify(state));return true;}
  catch(e){toast('Не хватает памяти браузера. Уменьшите размер фото или удалите старые изображения.');return false;}
}
function save(){return saveSafely()}
async function compressPhoto(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Допустимы JPG, PNG и WebP');
  if(file.size>12*1024*1024)throw Error('Фото слишком большое (максимум 12 МБ)');
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1050/Math.max(bitmap.width,bitmap.height));
  const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(bitmap.width*scale));cv.height=Math.max(1,Math.round(bitmap.height*scale));
  cv.getContext('2d').drawImage(bitmap,0,0,cv.width,cv.height);
  bitmap.close?.();
  const result=cv.toDataURL('image/webp',.67);
  if(result.length>1.1e6)throw Error('Фото всё ещё слишком большое — попробуйте меньший размер');
  return result;
}
const statusName=status=>({draft:'Подготовлено',new:'Подготовлено',processing:'На проверке',confirmed:'Подтверждено',delivered:'Доставлено',cancelled:'Отменено'})[status]||'Подготовлено';
function applyStatsFilter(value){
  if(value==='all') {renderSeller();return;}
  const orders=state.orders.filter(o=>o.createdAt.slice(0,7)===value);
  const total=orders.reduce((a,b)=>a+b.total,0);
  document.querySelector('#overviewPanel .admin-kpi:nth-child(2) strong').textContent=orders.length;
  document.querySelector('#overviewPanel .admin-kpi:nth-child(3) strong').textContent=money(total);
  document.querySelector('#overviewPanel .stat-row:nth-child(2) strong').textContent=money(orders.length?Math.round(total/orders.length):0);
  $('statsMonth').value=value;
}
function fillDemoStats(){
  if(state.orders.length && !confirm('Добавить ещё 12 тестовых заявок в статистику?'))return;
  const products=state.products.filter(p=>p.status==='available');
  if(!products.length)return toast('Сначала добавьте хотя бы один букет');
  for(let i=0;i<12;i++){
    const d=new Date();d.setDate(2+(i%23));d.setMonth(d.getMonth()-(i%6));
    const p=products[i%products.length];
    state.orders.push({id:uid('sample'),createdAt:d.toISOString(),mode:i%3===0?'pickup':'delivery',name:'Пример заказа',items:[{id:uid('sampleItem'),product:{...p},qty:1,extrasData:[],lineTotal:p.price}],total:p.price,status:i%4===0?'confirmed':i%4===1?'delivered':'draft',source:'sample'});
  }
  state.orders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));saveSafely();renderSeller();toast('Добавлены 12 примерных заявок');
}


function toast(msg){
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.add('hidden'), 2200);
}

function applyBrand(){
  document.title = `${state.settings.shopName} — онлайн-витрина · демо`;
  document.querySelectorAll('.identity-text strong').forEach(el => el.textContent = state.settings.shopName.replace(/\s+Astana$/i, '').toUpperCase());
  document.querySelectorAll('.identity-text small').forEach(el => el.textContent = state.settings.subtitle.toUpperCase());
  document.querySelectorAll('.footer-brand').forEach(el => el.innerHTML = `${esc(state.settings.shopName.toUpperCase())} <span>✳</span>`);
}

function filteredProducts(){
  return state.products.filter(p => {
    if(ui.filter !== 'all' && p.type !== ui.filter) return false;
    if(ui.search){
      const q = ui.search.toLowerCase();
      return `${p.name} ${p.desc}`.toLowerCase().includes(q);
    }
    return true;
  });
}

function getProduct(id){ return state.products.find(p => p.id === id); }
function getExtra(id){ return state.extras.find(e => e.id === id); }
function cartExpanded(){
  return state.cart.map(item => {
    const p = getProduct(item.productId);
    if(!p) return null;
    const extras = (item.extras || []).map(getExtra).filter(Boolean);
    return {...item, product:p, extrasData:extras, lineTotal: p.price * item.qty + extras.reduce((a,b)=>a+b.price,0) * item.qty};
  }).filter(Boolean);
}
function cartTotal(){ return cartExpanded().reduce((a,b)=>a+b.lineTotal,0); }

function renderBuyer(){
  const grid = $('productGrid');
  const items = filteredProducts();
  grid.innerHTML = items.length ? items.map(p => `
    <article class="product">
      <div class="photo-box ${p.img ? '' : 'no-photo'}">
        ${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : ''}
        <span class="photo-badge ${p.type === 'custom' ? 'custom':''} ${p.status === 'sold' ? 'sold':''}">${p.status === 'sold' ? 'Продан' : p.type === 'ready' ? 'Готовый сегодня' : 'Под заказ'}</span>
        <button class="photo-action" data-product-action="${p.id}" ${p.status === 'sold' ? 'disabled' : ''}>+</button>
      </div>
      <div class="product-bottom">
        <h3 class="product-name">${esc(p.name)}</h3>
        <p class="product-desc">${esc(p.desc)}</p>
        <div class="product-price">${money(p.price)}</div>
      </div>
    </article>
  `).join('') : `<div class="empty-state"><span>✿</span>По вашему запросу пока ничего не найдено.</div>`;

  document.querySelectorAll('.filter').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === ui.filter));
  grid.querySelectorAll('[data-product-action]').forEach(btn => btn.onclick = () => openProduct(btn.dataset.productAction));
  updateCartBadge();
}

function updateCartBadge(){
  const count = state.cart.reduce((a,b)=>a+b.qty,0);
  $('cartCount').textContent = count;
  $('floatingCount').textContent = `${count} ${count === 1 ? 'букет' : count > 1 && count < 5 ? 'букета' : 'букетов'}`;
  $('floatingTotal').textContent = money(cartTotal());
  $('cartBar').classList.toggle('hidden', count === 0);
}

function openOverlay(title, html){
  $('dialogTitle').textContent = title;
  $('dialogContent').innerHTML = html;
  $('overlay').classList.remove('hidden');
  document.body.classList.add('no-scroll');
}
function closeOverlay(){ $('overlay').classList.add('hidden'); document.body.classList.remove('no-scroll'); }

function openProduct(id){
  const p = getProduct(id); if(!p) return;
  const extras = state.extras.map(e => `<label class="check-line"><input type="checkbox" value="${e.id}"> <span>${esc(e.name)} · ${money(e.price)}</span></label>`).join('');
  openOverlay(p.name, `
    <img class="product-detail-img" src="${esc(p.img)}" alt="${esc(p.name)}">
    <div class="detail-tag">${p.type === 'ready' ? 'Готовый букет' : 'Букет под заказ'}</div>
    <div class="detail-price">${money(p.price)}</div>
    <p class="detail-description">${esc(p.desc)}</p>
    <div class="small-note">${p.prep}. Наличие подтверждает флорист в WhatsApp перед оплатой.</div>
    <div class="form-field"><label>Количество</label><div class="qty-control"><button id="qtyMinus">−</button><span id="qtyValue">1</span><button id="qtyPlus">+</button></div></div>
    <div class="form-field"><label>Дополнительно</label>${extras || '<p class="text-muted">Пока нет дополнительных опций.</p>'}</div>
    <button id="addCurrentToCart" class="btn btn-dark wide">Добавить в заказ ↗</button>
  `);
  let qty = 1;
  const sync = () => $('qtyValue').textContent = qty;
  $('qtyMinus').onclick = () => { qty = Math.max(1, qty - 1); sync(); };
  $('qtyPlus').onclick = () => { qty += 1; sync(); };
  $('addCurrentToCart').onclick = () => {
    const extraIds = [...$('dialogContent').querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value);
    state.cart.push({id:uid('cart'), productId:id, qty, extras:extraIds});
    save(); renderBuyer(); closeOverlay(); openCart(); toast('Букет добавлен в заказ');
  };
}

function openCart(){
  const items = cartExpanded();
  if(!items.length){
    openOverlay('Ваш заказ', `<div class="confirmation"><div class="symbol">✿</div><h3>Корзина пока пуста</h3><p>Добавьте букет из каталога, чтобы перейти к оформлению заказа.</p></div>`);
    return;
  }
  openOverlay('Ваш заказ', `
    <div class="steps"><span class="active"></span><span></span><span></span></div>
    ${items.map(item => `
      <div class="cart-item">
        <img src="${esc(item.product.img)}" alt="${esc(item.product.name)}">
        <div class="cart-item-main">
          <strong>${esc(item.product.name)}</strong>
          <small>${item.product.type === 'ready' ? 'Готовый букет' : 'Под заказ'} · ${esc(item.product.prep)}</small>
          ${item.extrasData.length ? `<div class="cart-extras">${item.extrasData.map(x => esc(x.name)).join(' · ')}</div>` : ''}
          <div class="summary-row"><span>${item.qty} шт.</span><strong>${money(item.lineTotal)}</strong></div>
        </div>
        <button class="small-button warn" data-remove-cart="${item.id}">Удалить</button>
      </div>
    `).join('')}
    <div class="summary-row total"><span>Итого товары</span><strong>${money(cartTotal())}</strong></div>
    <p class="small-note">Стоимость доставки подтверждается отдельно. Оплата проходит удалённым счётом Kaspi после подтверждения заказа.</p>
    <button id="goCheckout" class="btn btn-dark wide">Продолжить оформление ↗</button>
  `);
  $('dialogContent').querySelectorAll('[data-remove-cart]').forEach(btn => btn.onclick = () => {
    state.cart = state.cart.filter(x => x.id !== btn.dataset.removeCart); save(); renderBuyer(); openCart();
  });
  $('goCheckout').onclick = openCheckout;
}

function openCheckout(prefill = {}){
  openOverlay('Оформление заказа', `
    <div class="steps"><span class="active"></span><span class="active"></span><span></span></div>
    <div class="form-field"><label>Ваше имя</label><input id="orderName" value="${esc(prefill.name||'')}" placeholder="Например, Айгерим"></div>
    <div class="two-fields">
      <div class="form-field"><label>Ваш WhatsApp / телефон</label><input id="orderPhone" value="${esc(prefill.phone||'')}" placeholder="+7 7xx xxx xx xx"></div>
      <div class="form-field"><label>Номер для счёта Kaspi</label><input id="orderKaspiPhone" value="${esc(prefill.kaspiPhone||'')}" placeholder="На этот номер отправить счёт"></div>
    </div>
    <div class="two-fields">
      <div class="form-field"><label>Способ получения</label><select id="orderMode"><option value="delivery">Доставка</option><option value="pickup">Самовывоз</option></select></div>
      <div class="form-field"><label>Дата</label><input id="orderDate" type="date" min="${new Date().toISOString().slice(0,10)}" value="${esc(prefill.date||new Date().toISOString().slice(0,10))}"></div>
    </div>
    <div class="two-fields">
      <div class="form-field"><label>Временной интервал</label><input id="orderTime" value="${esc(prefill.time||'')}" placeholder="Например, 18:00–20:00"></div>
      <div class="form-field"><label>Имя получателя</label><input id="orderRecipient" value="${esc(prefill.recipient||'')}" placeholder="Если это подарок"></div>
    </div>
    <div class="form-field" id="addressField"><label>Адрес доставки</label><textarea id="orderAddress" placeholder="Улица, дом, квартира, комментарий курьеру">${esc(prefill.address||'')}</textarea></div>
    <div class="form-field"><label>Текст открытки / комментарий</label><textarea id="orderComment" placeholder="Например: Вложить открытку 'С днем рождения'">${esc(prefill.comment||'')}</textarea></div>
    <label class="check-line"><input type="checkbox" id="orderAnon"> <span>Не говорить получателю, от кого букет</span></label>
    <p class="small-note">${esc(state.settings.kaspiHint)} В демо эти поля не отправляются на сервер и не сохраняются в журнале.</p>
    <button id="prepareWhatsApp" class="btn btn-dark wide">Подготовить заказ ↗</button>
  `);
  const mode = $('orderMode');
  const sync = () => $('addressField').style.display = mode.value === 'delivery' ? '' : 'none';
  mode.onchange = sync; sync();
  $('prepareWhatsApp').onclick = () => {
    const data = {
      name: $('orderName').value.trim(),
      phone: $('orderPhone').value.trim(),
      kaspiPhone: $('orderKaspiPhone').value.trim(),
      mode: $('orderMode').value,
      date: $('orderDate').value,
      time: $('orderTime').value.trim(),
      recipient: $('orderRecipient').value.trim(),
      address: $('orderAddress').value.trim(),
      comment: $('orderComment').value.trim(),
      anonymous: $('orderAnon').checked
    };
    const digits = str => str.replace(/\D/g,'');
    const phoneOk = str => /^7\d{10}$/.test(digits(str));
    if(!phoneOk(data.phone) || !phoneOk(data.kaspiPhone)) return toast('Укажите корректные номера +7XXXXXXXXXX');
    if(!data.date || data.date < new Date().toISOString().slice(0,10)) return toast('Выберите актуальную дату');
    if(data.mode === 'delivery' && !data.address) return toast('Укажите адрес доставки');
    openConfirm(data);
  };
}

function buildWhatsAppText(order){
  const items = order.items.map(item => {
    const extras = item.extrasData.length ? ` (+ ${item.extrasData.map(x=>x.name).join(', ')})` : '';
    return `• ${item.product.name} × ${item.qty}${extras} — ${money(item.lineTotal)}`;
  }).join('\n');
  return `🌿 Новый заказ из онлайн-витрины ${state.settings.shopName}\n\n${items}\n\nИтого товары: ${money(order.total)}\nПолучение: ${order.mode === 'delivery' ? 'Доставка' : 'Самовывоз'}\nДата: ${order.date || '-'}\nВремя: ${order.time || '-'}\nИмя покупателя: ${order.name || '-'}\nТелефон покупателя: ${order.phone || '-'}\nНомер для удалённого счёта Kaspi: ${order.kaspiPhone || '-'}\nПолучатель: ${order.recipient || '-'}\nАдрес: ${order.mode === 'delivery' ? (order.address || '-') : 'Самовывоз'}\nКомментарий: ${order.comment || '-'}\nАнонимная доставка: ${order.anonymous ? 'Да' : 'Нет'}\n\nПожалуйста, подтвердите наличие, итоговую стоимость и время доставки.`;
}

function openConfirm(data){
  const items = cartExpanded();
  const order = {...data, id:uid('order'), createdAt:new Date().toISOString(), items, total:cartTotal(), status:'new'};
  const text = buildWhatsAppText(order);
  const wa = `https://wa.me/${state.settings.whatsappNumber}?text=${encodeURIComponent(text)}`;
  openOverlay('Подтверждение заказа', `
    <div class="steps"><span class="active"></span><span class="active"></span><span class="active"></span></div>
    <div class="summary-row"><span>Товары</span><strong>${money(order.total)}</strong></div>
    <div class="summary-row"><span>Получение</span><strong>${order.mode === 'delivery' ? 'Доставка' : 'Самовывоз'}</strong></div>
    <div class="summary-row"><span>Номер магазина</span><strong>${esc(order.kaspiPhone)}</strong></div>
    <div class="small-note">Демо не отправляет сообщения магазину. Для подключения WhatsApp владелец должен включить отправку и указать свой номер в настройках. В статистике сохраняются только примерные суммы и товары, без адресов и телефонов.</div>
    <div class="outcome-msg">${esc(text)}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:15px"><button id="sendToWA" class="btn btn-dark">${state.settings.whatsappEnabled && /^7\d{10}$/.test(state.settings.whatsappNumber) ? 'Открыть WhatsApp ↗' : 'Сохранить демо-заявку'}</button><button id="backToEdit" class="btn btn-outline">Назад</button></div>
  `);
  $('backToEdit').onclick = () => openCheckout(data);
  $('sendToWA').onclick = () => {
    // Demo storage contains only a transaction summary, never personal recipient/payment details.
    state.orders.unshift({
      id: order.id, createdAt:order.createdAt, mode:order.mode,
      name:'Тестовая заявка', items:order.items, total:order.total,
      status:'draft', source:'demo'
    });
    state.cart = [];
    save();
    renderBuyer();
    renderSeller();
    if(state.settings.whatsappEnabled && /^7\d{10}$/.test(state.settings.whatsappNumber)) {
      window.open(wa, '_blank', 'noopener,noreferrer');
    } else {
      navigator.clipboard?.writeText(text).catch(()=>{});
    }
    openOverlay('Заказ подготовлен', `
      <div class="confirmation"><div class="symbol">✿</div><h3>Демо-заявка подготовлена</h3><p>${state.settings.whatsappEnabled && /^7\d{10}$/.test(state.settings.whatsappNumber) ? 'WhatsApp открыт с подготовленным текстом. Отправку подтверждает пользователь.' : 'Заявка сохранена в статистике браузера. Для демонстрации текст скопирован; реальные сообщения магазину не отправляются.'}</p><button id="closeDone" class="btn btn-dark">Готово</button></div>
    `);
    $('closeDone').onclick = closeOverlay;
  };
}

function customRequest(){
  const text = `Здравствуйте! Хочу заказать индивидуальный букет в ${state.settings.shopName}. Подскажите, пожалуйста, какие варианты можно собрать по бюджету?`;
  if(state.settings.whatsappEnabled && /^7\d{10}$/.test(state.settings.whatsappNumber)){
    window.open(`https://wa.me/${state.settings.whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  } else {
    openOverlay('Индивидуальный букет', '<p class="detail-description">В коммерческой версии эта кнопка открывает переписку с флористом. В публичной демонстрации сообщения не отправляются.</p><p class="small-note">Пример сообщения: '+esc(text)+'</p><button class="btn btn-dark wide" id="copyCustom">Скопировать пример запроса</button>');
    $('copyCustom').onclick=()=>{navigator.clipboard?.writeText(text).then(()=>toast('Текст скопирован')).catch(()=>toast('Скопируйте текст вручную'));};
  }
}

function renderSeller(){
  renderOverview();
  renderProductsPanel();
  renderOrdersPanel();
  renderSettingsPanel();
}

function renderOverview(){
  const totalOrders = state.orders.length;
  const totalRevenue = state.orders.reduce((a,b)=>a+b.total,0);
  const readyCount = state.products.filter(p=>p.type==='ready' && p.status==='available').length;
  const customCount = state.products.filter(p=>p.type==='custom' && p.status==='available').length;
  const lastMonths = Array.from({length:6}, (_,i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5-i));
    const key = `${d.getFullYear()}-${d.getMonth()+1}`;
    const total = state.orders.filter(o => {
      const x = new Date(o.createdAt); return `${x.getFullYear()}-${x.getMonth()+1}` === key;
    }).reduce((a,b)=>a+b.total,0);
    return {label: d.toLocaleDateString('ru-RU', {month:'short'}), total};
  });
  const max = Math.max(1, ...lastMonths.map(x=>x.total));
  const recent = state.orders.slice(0,4);
  $('overviewPanel').innerHTML = `
    <div class="admin-cards">
      <div class="admin-kpi"><small>Активные букеты</small><strong>${state.products.filter(p=>p.status==='available').length}</strong><em>${readyCount} готовых · ${customCount} под заказ</em></div>
      <div class="admin-kpi"><small>Демо-заявок подготовлено</small><strong>${totalOrders}</strong><em>Локально в этом браузере</em></div>
      <div class="admin-kpi"><small>Потенциал заказов</small><strong>${money(totalRevenue)}</strong><em>Без доставки</em></div>
      <div class="admin-kpi"><small>Номер магазина</small><strong>${state.settings.whatsappNumber.slice(-4)}</strong><em>WhatsApp магазина</em></div>
    </div>
    <div class="stat-filter"><label>Показать месяц: <select id="statsMonth"><option value="all">Все месяцы</option>${Array.from({length:6}, (_,i) => {const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;return `<option value="${key}">${d.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</option>`}).join('')}</select></label> <button class="small-button" id="fillDemoStats">✧ Создать тестовые заявки</button></div>
    <div class="admin-layout">
      <div class="admin-card">
        <div class="admin-section-head"><div><h3>Статистика заказов</h3><small>Только тестовые заявки этого браузера</small></div></div>
        <div class="chart-wrap"><div class="chart">${lastMonths.map(m=>`<div class="chart-bar"><i style="height:${Math.max(4,Math.round(m.total / max * 100))}%"></i><span>${esc(m.label)}</span></div>`).join('')}</div></div>
        <div class="stat-title">Что показывает демо-статистика</div>
        <div class="stat-row"><span>Средняя сумма заявки</span><strong>${money(totalOrders ? Math.round(totalRevenue/totalOrders) : 0)}</strong></div>
        <div class="stat-row"><span>Последняя демо-заявка</span><strong>${recent[0] ? dateTimeLabel(recent[0].createdAt) : '—'}</strong></div>
      </div>
      <div class="admin-card">
        <h3>Последние заявки</h3>
        <p>Демо-заявки, не подтверждённые покупки.</p>
        <div class="admin-rows">${recent.length ? recent.map(o=>`<div class="admin-row"><div class="admin-row-main"><strong>${esc(o.name || 'Без имени')}</strong><small>${dateTimeLabel(o.createdAt)} · ${o.mode==='delivery'?'Доставка':'Самовывоз'}</small><div class="order-actions"><span class="pill ${o.status==='new'?'ready':'custom'}">${statusName(o.status)}</span></div></div><div class="admin-row-actions"><strong>${money(o.total)}</strong><button class="small-button" data-open-order="${o.id}">Открыть</button></div></div>`).join('') : '<div class="admin-empty">Пока нет заявок. Оформите заказ в режиме покупателя, и статистика оживёт.</div>'}</div>
      </div>
    </div>
  `;
  $('statsMonth').onchange=e=>applyStatsFilter(e.target.value);
  $('fillDemoStats').onclick=fillDemoStats;
  $('overviewPanel').querySelectorAll('[data-open-order]').forEach(btn => btn.onclick = () => {
    ui.sellerPanel = 'orders'; switchSellerPanel(); highlightOrder(btn.dataset.openOrder);
  });
}

function renderProductsPanel(){
  $('productsPanel').innerHTML = `
    <div class="admin-card">
      <div class="admin-section-head"><div><h3>Каталог букетов</h3><small>Быстро меняйте доступность, цену и описание</small></div></div>
      <div class="warning-box">В демо товары сохраняются только на этом устройстве. Для реальной витрины с общим каталогом необходима облачная база. Готовый букет можно быстро отметить как «Продан».</div>
      <form class="admin-form" id="productForm">
        <div class="two-fields">
          <div class="form-field"><label>Название</label><input name="name" placeholder="Например, Пудровое утро" required></div>
          <div class="form-field"><label>Цена, ₸</label><input name="price" type="number" min="0" placeholder="18500" required></div>
        </div>
        <div class="two-fields">
          <div class="form-field"><label>Тип</label><select name="type"><option value="ready">Готовый сегодня</option><option value="custom">Под заказ</option></select></div>
          <div class="form-field"><label>Статус</label><select name="status"><option value="available">В наличии</option><option value="sold">Продан</option></select></div>
        </div>
        <div class="form-field"><label>Описание</label><textarea name="desc" placeholder="Кратко опишите состав и настроение букета"></textarea></div>
        <div class="two-fields">
          <div class="form-field"><label>Время подготовки</label><input name="prep" placeholder="Готов сейчас / от 2 часов"></div>
          <div class="form-field"><label>Ссылка на фото (необязательно)</label><input name="img" placeholder="https://..."></div>
        </div>
        <div class="photo-local"><label>Или выбрать фото с телефона</label><input name="photoFile" type="file" accept="image/png,image/jpeg,image/webp"/><small class="text-muted">Файл оптимизируется и остаётся в памяти браузера — для демо.</small></div>
        <button class="btn btn-dark" type="submit">Добавить букет ↗</button>
      </form>
    </div>
    <div class="admin-card" style="margin-top:18px">
      <div class="admin-section-head"><div><h3>Текущие позиции</h3><small>${state.products.length} в каталоге</small></div></div>
      <div class="admin-rows">${state.products.map(p => `
        <div class="admin-row">
          <img src="${esc(p.img)}" alt="${esc(p.name)}">
          <div class="admin-row-main"><strong>${esc(p.name)}</strong><small>${p.type === 'ready' ? 'Готовый сегодня' : 'Под заказ'} · ${esc(p.prep || '')}</small><div class="order-actions"><span class="pill ${p.status === 'sold' ? 'sold' : p.type === 'ready' ? 'ready' : 'custom'}">${p.status === 'sold' ? 'Продан' : p.type === 'ready' ? 'В наличии' : 'Под заказ'}</span></div></div>
          <div class="admin-row-actions"><strong>${money(p.price)}</strong><button class="small-button" data-edit-product="${p.id}">Изменить</button><button class="small-button" data-clone-product="${p.id}">Копия</button><button class="small-button sold-btn" data-toggle-sold="${p.id}">${p.status === 'sold' ? 'Вернуть' : 'Продан'}</button><button class="small-button warn" data-delete-product="${p.id}">Удалить</button></div>
        </div>
      `).join('')}</div>
    </div>
  `;
  $('productForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const photoFile=e.target.querySelector('[name="photoFile"]').files[0];
    let newImg=fd.get('img').trim() || './assets/ig-floral-detail.webp';
    if(photoFile){try{newImg=await compressPhoto(photoFile)}catch(e){return toast(e.message)}}
    state.products.unshift({
      id: uid('prod'),
      name: fd.get('name').trim(),
      price: Number(fd.get('price') || 0),
      type: fd.get('type'),
      status: fd.get('status'),
      desc: fd.get('desc').trim(),
      prep: fd.get('prep').trim() || (fd.get('type') === 'ready' ? 'Готов сейчас' : 'Под заказ'),
      qty: fd.get('status') === 'sold' ? 0 : 1,
      img: newImg
    });
    if(!saveSafely()) {state.products.shift();return;} renderBuyer(); renderSeller(); toast('Букет добавлен в каталог');
  };
  $('productsPanel').querySelectorAll('[data-edit-product]').forEach(btn=>btn.onclick=()=>editProduct(btn.dataset.editProduct));
  $('productsPanel').querySelectorAll('[data-clone-product]').forEach(btn=>btn.onclick=()=>{
    const p=getProduct(btn.dataset.cloneProduct);if(!p)return;
    state.products.unshift({...clone(p),id:uid('prod'),name:p.name+' · копия',status:'sold',qty:0});
    if(!saveSafely()){state.products.shift();return;}
    renderBuyer();renderSeller();toast('Копия создана и скрыта');
  });
  $('productsPanel').querySelectorAll('[data-toggle-sold]').forEach(btn => btn.onclick = () => {
    const p = getProduct(btn.dataset.toggleSold); if(!p) return;
    p.status = p.status === 'sold' ? 'available' : 'sold'; p.qty = p.status === 'sold' ? 0 : 1;
    save(); renderBuyer(); renderSeller();
  });
  $('productsPanel').querySelectorAll('[data-delete-product]').forEach(btn => btn.onclick = () => {
    if(!confirm('Удалить этот букет из демо-каталога?')) return;
    state.products = state.products.filter(p => p.id !== btn.dataset.deleteProduct);
    save(); renderBuyer(); renderSeller();
  });
}

function editProduct(id){
  const p=getProduct(id);if(!p)return;
  openOverlay('Редактировать букет', `
    <form id="editProductForm" class="admin-form">
      <div class="preview-upload"><img src="${esc(p.img)}" alt=""><div><strong>${esc(p.name)}</strong><div class="text-muted">Редактирование с телефона — фото и цена</div></div></div>
      <div class="form-field"><label>Название</label><input name="name" required maxlength="80" value="${esc(p.name)}"></div>
      <div class="form-field"><label>Цена, ₸</label><input name="price" type="number" min="0" required value="${p.price}"></div>
      <div class="two-fields"><div class="form-field"><label>Тип</label><select name="type"><option value="ready" ${p.type==='ready'?'selected':''}>Готов сегодня</option><option value="custom" ${p.type==='custom'?'selected':''}>Под заказ</option></select></div><div class="form-field"><label>Доступность</label><select name="status"><option value="available" ${p.status==='available'?'selected':''}>Доступен</option><option value="sold" ${p.status==='sold'?'selected':''}>Продан / скрыт</option></select></div></div>
      <div class="form-field"><label>Описание</label><textarea name="desc">${esc(p.desc)}</textarea></div>
      <div class="form-field"><label>Время подготовки</label><input name="prep" value="${esc(p.prep||'')}"></div>
      <div class="form-field"><label>Ссылка на фото</label><input name="img" value="${p.img?.startsWith('data:')?'':esc(p.img)}" placeholder="https://..."></div>
      <div class="photo-local"><label>Новое фото с телефона</label><input name="photoFile" type="file" accept="image/png,image/jpeg,image/webp"></div>
      <button class="btn btn-dark wide" type="submit">Сохранить изменения</button>
    </form>
  `);
  $('editProductForm').onsubmit=async(e)=>{
    e.preventDefault();const f=new FormData(e.target);const before=clone(p);
    const newPrice=Number(f.get('price'));
    if(!f.get('name').trim()||!Number.isFinite(newPrice)||newPrice<0)return toast('Проверьте название и цену');
    p.name=String(f.get('name')).trim();p.price=newPrice;p.type=f.get('type');p.status=f.get('status');p.desc=String(f.get('desc')||'').trim();p.prep=String(f.get('prep')||'').trim();p.qty=p.status==='sold'?0:(p.qty||1);
    const imgUrl=String(f.get('img')||'').trim();if(imgUrl)p.img=imgUrl;
    const file=e.target.querySelector('[name="photoFile"]').files[0];if(file){try{p.img=await compressPhoto(file)}catch(err){Object.assign(p,before);return toast(err.message)}}
    if(!saveSafely()){Object.assign(p,before);return;}
    closeOverlay();renderBuyer();renderSeller();toast('Букет обновлён');
  }
}

function renderOrdersPanel(){
  $('ordersPanel').innerHTML = `
    <div class="admin-card">
      <div class="admin-section-head"><div><h3>Заявки покупателей</h3><small>Демо-заявки сохраняются локально без персональных данных</small></div></div>
      <div class="admin-rows">${state.orders.length ? state.orders.map(o => `
        <div class="admin-row" id="order_${o.id}">
          <img src="${esc(o.items[0]?.product?.img || o.items[0]?.product?.img || state.products[0]?.img || '')}" alt="order">
          <div class="admin-row-main"><strong>${esc(o.name || 'Покупатель')}</strong><small>${dateTimeLabel(o.createdAt)} · ${o.mode === 'delivery' ? 'Доставка' : 'Самовывоз'} · без персональных данных</small><div class="order-money">${money(o.total)}</div><div class="order-actions"><span class="pill ${o.status==='new' ? 'ready' : 'custom'}">${statusName(o.status)}</span><button class="small-button" data-order-details="${o.id}">Подробно</button><select class="order-status" data-order-status="${o.id}">${['draft','confirmed','delivered','cancelled'].map(status=>`<option value="${status}" ${o.status===status?'selected':''}>${statusName(status)}</option>`).join('')}</select></div></div>
        </div>
      `).join('') : '<div class="admin-empty">Пока нет заявок. Оформите заказ со стороны покупателя, чтобы показать бизнесу, как работает сценарий.</div>'}</div>
    </div>
  `;
  $('ordersPanel').querySelectorAll('[data-order-status]').forEach(input=>input.onchange=()=>{
    const order=state.orders.find(x=>x.id===input.dataset.orderStatus);if(!order)return;
    order.status=input.value;saveSafely();renderSeller();
  });
  $('ordersPanel').querySelectorAll('[data-order-details]').forEach(btn => btn.onclick = () => openOrderDetails(btn.dataset.orderDetails));
}

function openOrderDetails(id){
  const o = state.orders.find(x => x.id === id); if(!o) return;
  const text = `Демо-заявка: ${o.items.map(x=>x.product?.name||'Букет').join(', ')}. Потенциальная сумма: ${money(o.total)}. Статус: ${statusName(o.status)}. Личные данные не сохраняются.`;
  openOverlay(`Заявка от ${o.name || 'покупателя'}`, `
    <div class="summary-row"><span>Дата</span><strong>${dateTimeLabel(o.createdAt)}</strong></div>
    <div class="summary-row"><span>Сумма</span><strong>${money(o.total)}</strong></div>
    <div class="small-note">Контактные данные покупателя в публичной демонстрации не сохраняются.</div>
    <div class="outcome-msg">${esc(text)}</div>
    <button id="copyOrderText" class="btn btn-dark wide">Скопировать текст заявки</button>
  `);
  $('copyOrderText').onclick = async () => {
    try { await navigator.clipboard.writeText(text); toast('Текст заявки скопирован'); } catch(e) { toast('Не удалось скопировать'); }
  };
}
function highlightOrder(id){
  setTimeout(() => {
    const el = document.getElementById(`order_${id}`);
    if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); el.style.boxShadow='0 0 0 2px #6c8b68 inset'; setTimeout(()=>el.style.boxShadow='', 1800); }
  }, 50);
}

function renderSettingsPanel(){
  $('settingsPanel').innerHTML = `
    <div class="settings-layout">
      <div class="admin-card">
        <div class="admin-section-head"><div><h3>Настройки магазина</h3><small>То, что увидит покупатель</small></div></div>
        <form id="settingsForm" class="admin-form">
          <div class="two-fields">
            <div class="form-field"><label>Название магазина</label><input name="shopName" value="${esc(state.settings.shopName)}"></div>
            <div class="form-field"><label>Подзаголовок</label><input name="subtitle" value="${esc(state.settings.subtitle)}"></div>
          </div>
          <div class="two-fields">
            <div class="form-field"><label>WhatsApp для настоящих заказов</label><input name="whatsappNumber" value="${esc(state.settings.whatsappNumber)}" placeholder="7XXXXXXXXXX"></div>
            <div class="form-field"><label>Instagram URL</label><input name="instagram" value="${esc(state.settings.instagram)}"></div>
          </div>
          <div class="form-field"><label>Короткое описание</label><textarea name="about">${esc(state.settings.about)}</textarea></div>
          <div class="form-field"><label>Подсказка про Kaspi</label><textarea name="kaspiHint">${esc(state.settings.kaspiHint)}</textarea></div>
          <div class="form-field"><label>Примечание о доставке</label><textarea name="deliveryNote">${esc(state.settings.deliveryNote)}</textarea></div>
          <label class="check-line"><input name="whatsappEnabled" type="checkbox" ${state.settings.whatsappEnabled?'checked':''}><span>Разрешить открывать WhatsApp с этим номером (включать только с разрешения магазина)</span></label>
          <div class="danger-note">Публичное неофициальное демо: номер магазина намеренно не подключён. Все изменения и статистика хранятся в браузере и НЕ синхронизируются между устройствами.</div>
          <button class="btn btn-dark" type="submit">Сохранить настройки ↗</button>
        </form>
      </div>
      <div class="admin-card">
        <img class="preview-image" src="./assets/secret-garden-logo.png" alt="logo">
        <div class="stat-title">Что ещё можно показать бизнесу</div>
        <div class="stat-row"><span>Актуальные букеты на сегодня</span><strong>Да</strong></div>
        <div class="stat-row"><span>Номер для удалённого счёта Kaspi</span><strong>Да</strong></div>
        <div class="stat-row"><span>Статистика заявок</span><strong>Да</strong></div>
        <div class="stat-row"><span>Без сервера и БД в демо</span><strong>Да</strong></div>
        <p class="small-note">Изменения в одном браузере не появляются у других покупателей. Для коммерческой версии нужны авторизация, облачное хранилище и проверяемые статусы оплаты.</p>
        <button class="btn btn-outline wide" id="exportCatalog">Скачать каталог JSON ↗</button>
      </div>
    </div>
  `;
  $('exportCatalog').onclick=()=>{
    const blob=new Blob([JSON.stringify({settings:state.settings,products:state.products,extras:state.extras},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='secret-garden-demo-catalog.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  $('settingsForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    for(const [k,v] of fd.entries()) if(k!=='whatsappEnabled')state.settings[k]=String(v).trim();
    state.settings.whatsappEnabled=fd.get('whatsappEnabled')==='on';
    if(state.settings.whatsappEnabled && !/^7\d{10}$/.test(state.settings.whatsappNumber))return toast('Для WhatsApp введите номер 7XXXXXXXXXX');
    saveSafely(); applyBrand(); renderBuyer(); renderSeller(); toast('Настройки сохранены');
  };
}

function switchMainView(mode){
  const buyer = mode !== 'seller';
  $('buyerView').classList.toggle('hidden', !buyer);
  $('sellerView').classList.toggle('hidden', buyer);
  $('buyerTab').classList.toggle('selected', buyer);
  $('sellerTab').classList.toggle('selected', !buyer);
  $('cartNav').classList.toggle('hidden', !buyer);
  $('cartBar').classList.toggle('hidden', !buyer || state.cart.length === 0);
}
function switchSellerPanel(){
  ['overview','products','orders','settings'].forEach(name => {
    const active = ui.sellerPanel === name;
    document.querySelector(`[data-panel="${name}"]`).classList.toggle('selected', active);
    $(`${name}Panel`).classList.toggle('hidden', !active);
  });
}

function wire(){
  $('buyerTab').onclick = () => switchMainView('buyer');
  $('sellerTab').onclick = () => { switchMainView('seller'); switchSellerPanel(); };
  $('cartNav').onclick = openCart;
  $('floatingCart').onclick = openCart;
  $('customRequest').onclick = customRequest;
  $('closeOverlay').onclick = closeOverlay;
  $('overlay').querySelectorAll('[data-close]').forEach(el => el.onclick = closeOverlay);
  $('searchInput').oninput = (e) => { ui.search = e.target.value.trim(); renderBuyer(); };
  document.querySelectorAll('.filter').forEach(btn => btn.onclick = () => { ui.filter = btn.dataset.filter; renderBuyer(); });
  document.querySelectorAll('.seller-tab').forEach(btn => btn.onclick = () => { ui.sellerPanel = btn.dataset.panel; switchSellerPanel(); });
  $('resetDemo').onclick = () => {
    if(!confirm('Сбросить каталог, заказы и настройки этого демо?')) return;
    localStorage.removeItem(STORE_KEY);
    state = load(); applyBrand(); renderBuyer(); renderSeller(); switchMainView('buyer'); toast('Демо сброшено');
  };
}

applyBrand();
wire();
renderBuyer();
renderSeller();
switchMainView('buyer');
switchSellerPanel();
