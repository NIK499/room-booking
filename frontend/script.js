/* ============ МОКОВЫЕ ДАННЫЕ (меняйте здесь) ============ */
const DATA = {
	open: 8 * 60,
	close: 22 * 60,
	step: 30, // рабочее время в минутах и шаг слота
	eq: {
		// оборудование: название + SVG-иконка
		proj: [
			"Проектор",
			'<rect x="3" y="8" width="18" height="9" rx="2"/><circle cx="14" cy="12.5" r="2.5"/><path d="M6 20h2M16 20h2"/>',
		],
		tv: [
			"ТВ-панель",
			'<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>',
		],
		flip: ["Флипчарт", '<path d="M5 3h14v11H5zM8 21l3-7M16 21l-3-7"/>'],
		vc: [
			"Видеоконференция",
			'<rect x="3" y="7" width="12" height="10" rx="2"/><path d="m15 11 6-3v8l-6-3"/>',
		],
		ac: ["Кондиционер", '<path d="M12 3v18M4.5 7.5l15 9M4.5 16.5l15-9"/>'],
	},
	rooms: [
		// id, название, тип, этаж, вместимость, цена за час (₽), оборудование
		{
			id: 1,
			name: "Нейрон",
			kind: "Кабинет",
			floor: 1,
			cap: 4,
			price: 600,
			eq: ["tv", "ac"],
		},
		{
			id: 2,
			name: "Монолит",
			kind: "Переговорная",
			floor: 1,
			cap: 8,
			price: 1100,
			eq: ["proj", "tv", "ac", "flip"],
		},
		{
			id: 3,
			name: "Стек",
			kind: "Переговорная",
			floor: 2,
			cap: 6,
			price: 900,
			eq: ["tv", "vc", "ac"],
		},
		{
			id: 4,
			name: "Коммит",
			kind: "Кабинет",
			floor: 2,
			cap: 4,
			price: 700,
			eq: ["flip", "ac"],
		},
		{
			id: 5,
			name: "Ядро",
			kind: "Переговорная",
			floor: 3,
			cap: 12,
			price: 1800,
			eq: ["proj", "tv", "vc", "ac", "flip"],
		},
		{
			id: 6,
			name: "Билд",
			kind: "Кабинет",
			floor: 3,
			cap: 2,
			price: 450,
			eq: ["tv"],
		},
		{
			id: 7,
			name: "Деплой",
			kind: "Переговорная",
			floor: 4,
			cap: 10,
			price: 1500,
			eq: ["proj", "vc", "ac"],
		},
		{
			id: 8,
			name: "Репозиторий",
			kind: "Малый офис",
			floor: 4,
			cap: 20,
			price: 2800,
			eq: ["proj", "tv", "vc", "ac", "flip"],
		},
		{
			id: 9,
			name: "Спринт",
			kind: "Кабинет",
			floor: 5,
			cap: 6,
			price: 1000,
			eq: ["tv", "flip", "ac"],
		},
		{
			id: 10,
			name: "Хост",
			kind: "Кабинет",
			floor: 5,
			cap: 3,
			price: 550,
			eq: ["vc"],
		},
		{
			id: 11,
			name: "Кластер",
			kind: "Малый офис",
			floor: 6,
			cap: 14,
			price: 2100,
			eq: ["proj", "tv", "vc", "ac"],
		},
		{
			id: 12,
			name: "Панорама",
			kind: "Малый офис",
			floor: 6,
			cap: 30,
			price: 3800,
			eq: ["proj", "tv", "vc", "ac", "flip"],
		},
	],
	capOptions: [
		[0, "Любая"],
		[4, "от 4"],
		[8, "от 8"],
		[12, "от 12"],
		[20, "от 20"],
	],
	storageKey: "techhub-bookings-v1",
};

/* ============ УТИЛИТЫ ============ */
const $ = (s, r = document) => r.querySelector(s);
const esc = s =>
	String(s).replace(
		/[&<>"']/g,
		c =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[c],
	);
const pad = n => String(n).padStart(2, "0");
const fmt = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
const money = n => n.toLocaleString("ru-RU") + " ₽";
const iso = d =>
	d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = iso(new Date());
const SLOTS = (DATA.close - DATA.open) / DATA.step; // 28 слотов
const slotMin = i => DATA.open + i * DATA.step;
const dateRu = s =>
	new Date(s + "T12:00").toLocaleDateString("ru-RU", {
		weekday: "short",
		day: "numeric",
		month: "long",
	});
const icon = k =>
	`<svg class="ic" viewBox="0 0 24 24" role="img" aria-label="${DATA.eq[k][0]}"><title>${DATA.eq[k][0]}</title>${DATA.eq[k][1]}</svg>`;
const roomBy = id => DATA.rooms.find(r => r.id === id);
let toastT;
function toast(msg) {
	const t = $("#toast");
	t.textContent = msg;
	t.classList.add("on");
	clearTimeout(toastT);
	toastT = setTimeout(() => t.classList.remove("on"), 3000);
}

/* ============ СОСТОЯНИЕ И ХРАНИЛИЩЕ ============ */
const state = {
	date: today,
	s: 10 * 60,
	e: 12 * 60,
	people: 2,
	floor: "",
	cap: 0,
	eq: new Set(),
	q: "",
	bookings: [],
};
function load() {
	try {
		const v = JSON.parse(localStorage.getItem(DATA.storageKey) || "[]");
		state.bookings = Array.isArray(v) ? v : [];
	} catch (e) {
		state.bookings = [];
	}
}
function save() {
	try {
		localStorage.setItem(DATA.storageKey, JSON.stringify(state.bookings));
	} catch (e) {
		/* хранилище недоступно: работаем в памяти */
	}
}

/* ============ ЗАНЯТОСТЬ ============ */
// Псевдослучайные моковые брони: стабильны для пары «кабинет + дата»
function rng(seed) {
	let h = 2166136261;
	for (const c of seed) {
		h ^= c.charCodeAt(0);
		h = Math.imul(h, 16777619);
	}
	return () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507);
		h ^= h >>> 13;
		return ((h >>> 0) % 1000) / 1000;
	};
}
function busyMap(roomId, date) {
	const busy = Array(SLOTS).fill(false),
		r = rng(roomId + "|" + date);
	for (let k = 0; k < 3; k++) {
		const a = Math.floor(r() * 24),
			len = 1 + Math.floor(r() * 4);
		for (let i = a; i < Math.min(a + len, SLOTS); i++) busy[i] = true;
	}
	state.bookings
		.filter(
			b => b.roomId === roomId && b.date === date && b.status === "active",
		)
		.forEach(b => {
			for (let i = b.a; i <= b.b; i++) busy[i] = true;
		});
	return busy;
}
function isFree(roomId, date, s, e) {
	const m = busyMap(roomId, date),
		a = (s - DATA.open) / DATA.step,
		b = (e - DATA.open) / DATA.step;
	for (let i = a; i < b; i++) if (m[i]) return false;
	return true;
}

/* ============ ФОРМА ПОИСКА И ФИЛЬТРЫ ============ */
function initControls() {
	const opts = (from, to) => {
		let h = "";
		for (let m = from; m <= to; m += DATA.step)
			h += `<option value="${m}">${fmt(m)}</option>`;
		return h;
	};
	$("#h-s").innerHTML = opts(DATA.open, DATA.close - DATA.step);
	$("#h-e").innerHTML = opts(DATA.open + DATA.step, DATA.close);
	$("#h-date").value = today;
	$("#h-date").min = today;
	$("#h-s").value = state.s;
	$("#h-e").value = state.e;
	$("#f-floor").innerHTML =
		'<option value="">Все этажи</option>' +
		[...new Set(DATA.rooms.map(r => r.floor))]
			.map(f => `<option value="${f}">${f} этаж</option>`)
			.join("");
	$("#f-cap").innerHTML = DATA.capOptions
		.map(([v, t]) => `<option value="${v}">${t}</option>`)
		.join("");
	$("#f-eq").innerHTML = Object.keys(DATA.eq)
		.map(
			k =>
				`<label class="chip"><input type="checkbox" value="${k}"><span><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${DATA.eq[k][1]}</svg>${DATA.eq[k][0]}</span></label>`,
		)
		.join("");
	// Фильтры раскрыты на десктопе и свёрнуты на мобильных
	const mq = matchMedia("(min-width:761px)"),
		fl = $("#fl"),
		sync = () => {
			fl.open = mq.matches;
		};
	sync();
	mq.addEventListener("change", sync);
}
function readSearch(showErr) {
	const s = +$("#h-s").value,
		e = +$("#h-e").value,
		err = $("#h-err");
	const bad =
		e <= s
			? "Время окончания должно быть позже начала."
			: $("#h-date").value < today
				? "Выберите сегодняшнюю или будущую дату."
				: +$("#h-n").value < 1
					? "Укажите число человек от 1."
					: "";
	err.hidden = !bad;
	err.textContent = bad;
	if (bad) return false;
	Object.assign(state, {
		date: $("#h-date").value,
		s,
		e,
		people: +$("#h-n").value,
	});
	return true;
}
function readFilters() {
	state.floor = $("#f-floor").value;
	state.cap = +$("#f-cap").value;
	state.q = $("#f-q").value.trim().toLowerCase();
	state.eq = new Set(
		[...document.querySelectorAll("#f-eq input:checked")].map(i => i.value),
	);
	if (state.floor) planFloor = +state.floor; // план показывает выбранный в фильтре этаж
}

/* ============ КАТАЛОГ ============ */
function filtered() {
	return DATA.rooms.filter(
		r =>
			(!state.floor || r.floor === +state.floor) &&
			r.cap >= Math.max(state.cap, state.people) &&
			[...state.eq].every(k => r.eq.includes(k)) &&
			r.name.toLowerCase().includes(state.q),
	);
}
function renderGrid() {
	const list = filtered(),
		g = $("#grid");
	renderPlan(list);
	$("#count").textContent =
		`Найдено: ${list.length} из ${DATA.rooms.length}. ${dateRu(state.date)}, ${fmt(state.s)}–${fmt(state.e)}`;
	if (!list.length) {
		g.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Ничего не найдено</h3><p class="muted">Попробуйте изменить фильтры или число человек.</p><button class="btn primary" type="button" id="reset2">Сбросить фильтры</button></div>`;
		$("#reset2").onclick = resetFilters;
		return;
	}
	g.innerHTML = list
		.map(r => {
			const free = isFree(r.id, state.date, state.s, state.e);
			return `<article class="card"><div class="cover" style="--t:${6 + r.floor * 2}%"><b aria-hidden="true">${r.floor}</b></div><div class="cbody">
      <h3><button type="button" data-open="${r.id}" aria-label="${esc(r.name)}: открыть расписание">${esc(r.name)}</button></h3>
      <div class="meta"><span>${r.kind}, ${r.floor} этаж</span><span>до ${r.cap} чел.</span></div>
      <div class="eq">${r.eq.map(icon).join("")}</div>
      <div class="foot"><span class="price">${money(r.price)}/ч</span><span class="st ${free ? "free" : "busy"}">${free ? "Свободен" : "Занят"}</span></div></div></article>`;
		})
		.join("");
}
function resetFilters() {
	$("#f-q").value = "";
	$("#f-floor").value = "";
	$("#f-cap").value = "0";
	$("#h-n").value = 1;
	document.querySelectorAll("#f-eq input").forEach(i => (i.checked = false));
	readFilters();
	readSearch();
	renderGrid();
}

/* ============ ПЛАН ЭТАЖА ============ */
let view = matchMedia("(min-width:761px)").matches ? "map" : "list",
	planFloor = 1;
function setView(v) {
	view = v;
	$("#grid").hidden = v !== "list";
	$("#plan").hidden = v !== "map";
	$("#v-list").setAttribute("aria-pressed", v === "list");
	$("#v-map").setAttribute("aria-pressed", v === "map");
}
function renderPlan(list) {
	const ids = new Set(list.map(r => r.id)),
		floors = [...new Set(DATA.rooms.map(r => r.floor))];
	$("#floors").innerHTML = floors
		.map(f => {
			const n = DATA.rooms.filter(
				r =>
					r.floor === f &&
					ids.has(r.id) &&
					isFree(r.id, state.date, state.s, state.e),
			).length;
			return `<button type="button" class="ftab" data-floor="${f}" aria-pressed="${f === planFloor}">${f} этаж<small>свободно: ${n}</small></button>`;
		})
		.join("");
	const block = (x, y, w, h, t) =>
		`<g aria-hidden="true"><rect class="blk" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><text class="blk-t" x="${x + w / 2}" y="${y + h / 2 + 4}">${t}</text></g>`;
	let xt = 110,
		xb = 110;
	const rooms = DATA.rooms
		.filter(r => r.floor === planFloor)
		.map((r, i) => {
			const w = 150 + r.cap * 9,
				top = i % 2 === 0,
				x = top ? xt : xb,
				y = top ? 20 : 180;
			if (top) xt += w + 10;
			else xb += w + 10;
			const free = isFree(r.id, state.date, state.s, state.e),
				on = ids.has(r.id);
			return `<g class="pr ${free ? "free" : "busy"}${on ? "" : " dim"}" data-info="${r.id}" ${on ? `data-open="${r.id}" tabindex="0" role="button"` : 'aria-hidden="true"'} aria-label="${esc(r.name)}, до ${r.cap} чел., ${free ? "свободен" : "занят"}, открыть расписание">
      <rect x="${x}" y="${y}" width="${w}" height="100" rx="8"/><text class="t1" x="${x + 14}" y="${y + 34}">${esc(r.name)}</text>
      <text class="t2" x="${x + 14}" y="${y + 58}">до ${r.cap} чел., ${money(r.price)}/ч</text><text class="t3" x="${x + 14}" y="${y + 82}">${free ? "Свободен" : "Занят"}, ${fmt(state.s)}–${fmt(state.e)}</text></g>`;
		})
		.join("");
	$("#plan-svg").innerHTML =
		`<svg viewBox="0 0 800 300" role="group" aria-label="План ${planFloor} этажа">
    <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" style="fill:var(--surface)"/><line x1="0" y1="0" x2="0" y2="8" style="stroke:var(--busy);stroke-opacity:.35;stroke-width:3"/></pattern></defs>
    <rect class="corr" x="100" y="125" width="680" height="50" rx="6"/><text class="blk-t" x="440" y="154" aria-hidden="true">Коридор</text>
    ${block(20, 100, 70, 100, "Лифты")}${block(700, 20, 80, 100, "Санузел")}${block(700, 180, 80, 100, "Кухня")}${rooms}</svg>`;
}
function showInfo(e) {
	const g = e.target.closest && e.target.closest("[data-info]");
	if (!g) return;
	const r = roomBy(+g.dataset.info);
	$("#plan-info").textContent =
		`${r.name}: ${r.kind.toLowerCase()}, до ${r.cap} чел., ${money(r.price)}/ч. ${r.eq.map(k => DATA.eq[k][0]).join(", ")}.`;
}

/* ============ ДИАЛОГ БРОНИРОВАНИЯ ============ */
const rd = $("#rd");
const sel = { room: null, date: today, a: null, b: null };
let lastFocus = null;
const FIELDS = {
	// правила валидации
	name: v => (v.trim().length < 2 ? "Введите имя (не короче 2 символов)." : ""),
	email: v =>
		/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
			? ""
			: "Введите email в формате name@company.ru.",
	phone: v => {
		const d = v.replace(/\D/g, "");
		return d.length >= 10 && d.length <= 12
			? ""
			: "Введите телефон, например +7 900 123-45-67.";
	},
};
function openRoom(id) {
	const r = roomBy(id);
	lastFocus = document.activeElement;
	Object.assign(sel, { room: r, date: state.date, a: null, b: null });
	if (isFree(id, state.date, state.s, state.e)) {
		sel.a = (state.s - DATA.open) / DATA.step;
		sel.b = (state.e - DATA.open) / DATA.step - 1;
	} // предвыбор из поиска
	rd.innerHTML = `<div class="dh"><div><h2 id="rd-t">${esc(r.name)}</h2><p class="muted" style="margin:2px 0 0">${r.kind}, ${r.floor} этаж, до ${r.cap} чел., ${money(r.price)}/ч</p></div>
    <button class="x" type="button" id="rd-x" aria-label="Закрыть"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
   <div id="rd-main" class="dbody">
    <div><label for="r-date">Дата</label><input type="date" id="r-date" min="${today}" value="${sel.date}" style="max-width:220px">
     <div class="legend"><span><i></i>Свободно</span><span><i style="background:repeating-linear-gradient(135deg,transparent 0 3px,var(--line) 3px 4px)"></i>Занято</span><span><i style="background:var(--accent);border-color:var(--accent)"></i>Выбрано</span></div>
     <div class="slots" id="slots" role="group" aria-label="Слоты по 30 минут"></div>
     <p class="muted" style="font-size:13px">Нажмите на начальный слот, затем на конечный, чтобы выбрать диапазон.</p>
     <div class="sum" id="sum" aria-live="polite"></div></div>
    <form id="bf" novalidate aria-label="Данные для бронирования">
     <div class="row"><label for="f-name">Имя</label><input id="f-name" name="name" autocomplete="name" required aria-describedby="e-name"><p class="err" id="e-name"></p></div>
     <div class="row"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required aria-describedby="e-email"><p class="err" id="e-email"></p></div>
     <div class="row"><label for="f-phone">Телефон</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" placeholder="+7 900 123-45-67" required aria-describedby="e-phone"><p class="err" id="e-phone"></p></div>
     <div class="row"><label for="f-comment">Комментарий (необязательно)</label><textarea id="f-comment" name="comment"></textarea></div>
     <button class="btn primary" type="submit" style="width:100%">Забронировать</button>
    </form></div>`;
	$("#rd-x").onclick = () => rd.close();
	$("#r-date").onchange = e => {
		if (!e.target.value || e.target.value < today) {
			e.target.value = sel.date;
			return;
		}
		sel.date = e.target.value;
		sel.a = sel.b = null;
		renderSlots();
	};
	$("#bf").addEventListener("focusout", e => {
		if (e.target.name in FIELDS) checkField(e.target.name);
	});
	$("#bf").addEventListener("input", e => {
		if (e.target.getAttribute("aria-invalid") === "true")
			checkField(e.target.name);
	});
	$("#bf").addEventListener("submit", submitBooking);
	renderSlots();
	rd.showModal();
}
function checkField(n) {
	const el = $("#f-" + n),
		msg = FIELDS[n](el.value);
	el.setAttribute("aria-invalid", msg ? "true" : "false");
	$("#e-" + n).textContent = msg;
	return !msg;
}
function renderSlots(focusI) {
	const busy = busyMap(sel.room.id, sel.date);
	$("#slots").innerHTML = busy
		.map((b, i) => {
			const on = sel.a !== null && i >= sel.a && i <= sel.b;
			return `<button type="button" class="slot" data-i="${i}" aria-pressed="${on}" ${b ? "disabled" : ""} aria-label="${fmt(slotMin(i))}–${fmt(slotMin(i + 1))}, ${b ? "занято" : on ? "выбрано" : "свободно"}">${fmt(slotMin(i))}</button>`;
		})
		.join("");
	const sum = $("#sum");
	if (sel.a === null) sum.textContent = "Выберите время на расписании.";
	else {
		const n = sel.b - sel.a + 1,
			h = n / 2;
		sum.textContent = `${dateRu(sel.date)}, ${fmt(slotMin(sel.a))}–${fmt(slotMin(sel.b + 1))} (${h.toLocaleString("ru-RU")} ч). Итого: ${money(sel.room.price * h)}`;
	}
	if (focusI != null) {
		const b = $(`.slot[data-i="${focusI}"]`);
		if (b) b.focus();
	}
}
function pickSlot(i) {
	const busy = busyMap(sel.room.id, sel.date);
	if (sel.a !== null && sel.a === sel.b && i !== sel.a) {
		// второй клик: тянем диапазон
		const lo = Math.min(i, sel.a),
			hi = Math.max(i, sel.a);
		if (busy.slice(lo, hi + 1).some(Boolean)) {
			renderSlots(i);
			$("#sum").textContent =
				"В этот диапазон попадают занятые слоты. Выберите время без пересечений.";
			return;
		}
		sel.a = lo;
		sel.b = hi;
	} else if (sel.a === sel.b && sel.a === i)
		sel.a = sel.b = null; // повторный клик снимает выбор
	else sel.a = sel.b = i; // новый выбор
	renderSlots(i);
}
function submitBooking(e) {
	e.preventDefault();
	const ok = Object.keys(FIELDS).map(checkField).every(Boolean);
	if (sel.a === null) {
		$("#sum").textContent = "Сначала выберите время на расписании.";
		$("#slots").querySelector(".slot:not(:disabled)")?.focus();
		return;
	}
	if (!ok) {
		$("#bf [aria-invalid=true]")?.focus();
		return;
	}
	const f = Object.fromEntries(new FormData(e.target));
	const h = (sel.b - sel.a + 1) / 2;
	const bk = {
		id: "TH-" + String(Math.floor(10000 + Math.random() * 90000)),
		roomId: sel.room.id,
		date: sel.date,
		a: sel.a,
		b: sel.b,
		total: sel.room.price * h,
		name: f.name.trim(),
		email: f.email.trim(),
		phone: f.phone.trim(),
		comment: (f.comment || "").trim(),
		status: "active",
		created: Date.now(),
	};
	state.bookings.push(bk);
	save();
	renderBookings();
	renderGrid();
	$("#rd-main").outerHTML =
		`<div class="ok-box"><svg class="ic" viewBox="0 0 24 24" style="width:44px;height:44px;color:var(--ok)"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>
    <h2 id="ok-t" tabindex="-1">Бронь подтверждена</h2><div class="num">${bk.id}</div>
    <p>${esc(sel.room.name)}, ${dateRu(bk.date)}, ${fmt(slotMin(bk.a))}–${fmt(slotMin(bk.b + 1))}<br>Итого: ${money(bk.total)}</p>
    <p class="muted">Подтверждение придёт на ${esc(bk.email)}.</p>
    <div class="acts"><button class="btn primary" type="button" id="go-b">Перейти в «Мои брони»</button><button class="btn" type="button" id="ok-x">Закрыть</button></div></div>`;
	$("#ok-t").focus();
	$("#ok-x").onclick = () => rd.close();
	$("#go-b").onclick = () => {
		rd.close();
		$("#bookings").scrollIntoView();
	};
}

/* ============ МОИ БРОНИ ============ */
function renderBookings() {
	const l = $("#blist"),
		arr = [...state.bookings].sort((a, b) => b.created - a.created);
	if (!arr.length) {
		l.innerHTML = `<li class="empty"><h3>Броней пока нет</h3><p class="muted">Выберите кабинет в каталоге: бронь появится здесь.</p><a class="btn primary" href="#rooms">К кабинетам</a></li>`;
		return;
	}
	l.innerHTML = arr
		.map(b => {
			const r = roomBy(b.roomId),
				act = b.status === "active";
			return `<li class="bk"><div>
    <h3>${esc(r.name)} <span class="badge ${act ? "a" : "c"}">${act ? "Подтверждена" : "Отменена"}</span></h3>
    <p class="muted" style="margin:4px 0 0">${b.id}, ${dateRu(b.date)}, ${fmt(slotMin(b.a))}–${fmt(slotMin(b.b + 1))}, ${money(b.total)}</p></div>
    ${act ? `<button class="btn danger" type="button" data-cancel="${b.id}">Отменить</button>` : ""}</li>`;
		})
		.join("");
}
const cd = $("#cd");
let cancelId = null;
function askCancel(id) {
	cancelId = id;
	const b = state.bookings.find(x => x.id === id);
	lastFocus = document.activeElement;
	$("#cd-p").textContent =
		`Бронь ${id}: ${roomBy(b.roomId).name}, ${dateRu(b.date)}, ${fmt(slotMin(b.a))}–${fmt(slotMin(b.b + 1))}. Слоты снова станут свободными.`;
	cd.showModal();
	$("#cd-no").focus();
}

/* ============ СОБЫТИЯ ============ */
document.addEventListener("click", e => {
	const o = e.target.closest("[data-open]");
	if (o) openRoom(+o.dataset.open);
	const s = e.target.closest(".slot");
	if (s && !s.disabled) pickSlot(+s.dataset.i);
	const c = e.target.closest("[data-cancel]");
	if (c) askCancel(c.dataset.cancel);
	const t = e.target.closest("[data-floor]");
	if (t) {
		planFloor = +t.dataset.floor;
		renderGrid();
		$(`[data-floor="${planFloor}"]`).focus();
	}
});
[rd, cd].forEach(d => {
	// клик по фону закрывает; фокус возвращается на вызвавший элемент
	d.addEventListener("click", e => {
		if (e.target === d) d.close();
	});
	d.addEventListener("close", () => {
		if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
	});
});
$("#cd-no").onclick = () => cd.close();
$("#cd-yes").onclick = () => {
	const b = state.bookings.find(x => x.id === cancelId);
	if (b) b.status = "cancelled";
	save();
	renderBookings();
	renderGrid();
	cd.close();
	toast("Бронь " + cancelId + " отменена");
};
document.addEventListener("keydown", e => {
	// Enter/Пробел на кабинете плана
	if (
		(e.key === "Enter" || e.key === " ") &&
		e.target.matches &&
		e.target.matches(".pr[data-open]")
	) {
		e.preventDefault();
		openRoom(+e.target.dataset.open);
	}
});
$("#plan").addEventListener("mouseover", showInfo);
$("#plan").addEventListener("focusin", showInfo);
$("#v-list").onclick = () => setView("list");
$("#v-map").onclick = () => setView("map");
$("#login").onclick = () => toast("Вход недоступен в прототипе");
$("#search").addEventListener("submit", e => {
	e.preventDefault();
	if (readSearch()) {
		renderGrid();
		$("#rooms").scrollIntoView();
	}
});
$("#search").addEventListener("change", () => {
	if (readSearch()) renderGrid();
});
$("#fl").addEventListener("input", () => {
	readFilters();
	renderGrid();
});
$("#reset").onclick = resetFilters;

/* ============ СТАРТ ============ */
load();
initControls();
renderBookings();
setView(view);
$("#grid").innerHTML = Array(6)
	.fill('<div class="sk" aria-hidden="true"></div>')
	.join(""); // скелетоны на время «загрузки»
setTimeout(() => {
	readSearch();
	readFilters();
	renderGrid();
}, 450);
