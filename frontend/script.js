/* ============ КОНФИГУРАЦИЯ API ============ */
// Раскомментируй, когда друг запустит бэкенд:
// const API_BASE = "http://localhost:3000/api";
const API_BASE = null; // null = используем моки

/* ============ МОКОВЫЕ ДАННЫЕ (формат друга) ============ */
const MOCK_ROOMS = [
	{ id: 1, name: "Аудитория 1", site: "Речицкая" },
	{ id: 2, name: "Аудитория 2", site: "Речицкая" },
	{ id: 3, name: "Аудитория 3", site: "Речицкая" },
	{ id: 4, name: "Аудитория 4", site: "Речицкая" },
	{ id: 5, name: "Аудитория 5", site: "Речицкая" },
	{ id: 6, name: "Аудитория 1", site: "Ледовый дворец" },
	{ id: 7, name: "Аудитория 2", site: "Ледовый дворец" },
	{ id: 8, name: "Аудитория 3", site: "Ледовый дворец" },
	{ id: 9, name: "Аудитория 1", site: "старый аэродром" },
	{ id: 10, name: "Аудитория 2", site: "старый аэродром" },
];

const MOCK_MANAGERS = [
	{ id: 1, full_name: "Ольга Белова" },
	{ id: 2, full_name: "Иван Иванов" },
];

const MOCK_BOOKINGS = [
	{
		id: 14,
		roomId: 1,
		roomName: "Аудитория 1",
		date: "2026-11-02",
		start: "10:00",
		end: "11:30",
		purpose: "Консультация",
		managerName: "Ольга Белова",
		managerId: 1,
	},
	{
		id: 15,
		roomId: 6,
		roomName: "Аудитория 1",
		date: "2026-11-02",
		start: "15:00",
		end: "16:00",
		purpose: "Совещание",
		managerName: "Иван Иванов",
		managerId: 2,
	},
];

/* ============ ТИПЫ ДАННЫХ ============ */
interface Room {
	id: number;
	name: string;
	site: string;
}

interface Manager {
	id: number;
	full_name: string;
}

interface Booking {
	id: number;
	roomId: number;
	roomName: string;
	date: string;
	start: string;
	end: string;
	purpose: string;
	managerName: string;
	managerId?: number;
}

/* ============ УТИЛИТЫ ============ */
const $ = (s: string, r: Document | Element = document) => r.querySelector(s);
const esc = (s: string) =>
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
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (m: number) => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
const iso = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = iso(new Date());

const OPEN = 8 * 60;
const CLOSE = 22 * 60;
const STEP = 30;
const SLOTS = (CLOSE - OPEN) / STEP;

const slotMin = (i: number) => OPEN + i * STEP;
const timeToSlot = (time: string): number => {
	const [h, m] = time.split(":").map(Number);
	return Math.round((h * 60 + m - OPEN) / STEP);
};
const slotToTime = (slot: number): string => fmt(OPEN + slot * STEP);

const dateRu = (s: string) =>
	new Date(s + "T12:00").toLocaleDateString("ru-RU", {
		weekday: "short",
		day: "numeric",
		month: "long",
	});

let toastT: number;
function toast(msg: string) {
	const t = $("#toast") as HTMLElement;
	t.textContent = msg;
	t.classList.add("on");
	clearTimeout(toastT);
	toastT = setTimeout(() => t.classList.remove("on"), 3000);
}

/* ============ API КЛИЕНТ ============ */
async function api<T>(path: string, options?: RequestInit): Promise<T> {
	if (!API_BASE) throw new Error("API не настроен");
	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: { "Content-Type": "application/json", ...options?.headers },
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(data.error || `Ошибка ${res.status}`);
	}
	return res.status === 204 ? (undefined as T) : data;
}

/* ============ ДАННЫЕ ПРИЛОЖЕНИЯ ============ */
const state = {
	rooms: [] as Room[],
	managers: [] as Manager[],
	bookings: [] as Booking[],
	selectedDate: today,
	s: 10 * 60,
	e: 12 * 60,
	site: "",
	manager: 0,
	q: "",
	useApi: false,
};

/* ============ ЗАГРУЗКА ДАННЫХ ============ */
async function loadRooms() {
	if (API_BASE) {
		try {
			state.rooms = await api<Room[]>("/rooms");
			state.useApi = true;
			console.log("✅ Комнаты загружены с API:", API_BASE);
			return;
		} catch (err) {
			console.warn("⚠️ API недоступен, используем моки:", (err as Error).message);
		}
	}
	state.rooms = MOCK_ROOMS;
	state.useApi = false;
	console.log("📦 Используются локальные данные (моки)");
}

async function loadManagers() {
	if (API_BASE && state.useApi) {
		try {
			state.managers = await api<Manager[]>("/managers");
			return;
		} catch (err) {
			console.warn("⚠️ Не удалось загрузить менеджеров");
		}
	}
	state.managers = MOCK_MANAGERS;
}

async function loadBookings(date: string) {
	if (API_BASE && state.useApi) {
		try {
			state.bookings = await api<Booking[]>(`/bookings?date=${date}`);
			return;
		} catch (err) {
			toast("Не удалось загрузить бронирования");
		}
	}
	// Фильтруем моки по дате
	state.bookings = MOCK_BOOKINGS.filter(b => b.date === date);
}

/* ============ ЗАНЯТОСТЬ ============ */
function busyMap(roomId: number, date: string): boolean[] {
	const busy = Array(SLOTS).fill(false);
	state.bookings
		.filter(b => b.roomId === roomId && b.date === date)
		.forEach(b => {
			const a = timeToSlot(b.start);
			const end = timeToSlot(b.end);
			for (let i = a; i < end; i++) busy[i] = true;
		});
	return busy;
}

function isFree(roomId: number, date: string, s: number, e: number): boolean {
	const m = busyMap(roomId, date),
		a = (s - OPEN) / STEP,
		b = (e - OPEN) / STEP;
	for (let i = a; i < b; i++) if (m[i]) return false;
	return true;
}

/* ============ ФОРМА ПОИСКА И ФИЛЬТРЫ ============ */
function initControls() {
	const opts = (from: number, to: number) => {
		let h = "";
		for (let m = from; m <= to; m += STEP) h += `<option value="${m}">${fmt(m)}</option>`;
		return h;
	};
	($("#h-s") as HTMLSelectElement).innerHTML = opts(OPEN, CLOSE - STEP);
	($("#h-e") as HTMLSelectElement).innerHTML = opts(OPEN + STEP, CLOSE);
	($("#h-date") as HTMLInputElement).value = today;
	($("#h-date") as HTMLInputElement).min = today;
	($("#h-s") as HTMLSelectElement).value = String(state.s);
	($("#h-e") as HTMLSelectElement).value = String(state.e);

	// Площадки
	const sites = [...new Set(state.rooms.map(r => r.site))];
	($("#f-site") as HTMLSelectElement).innerHTML =
		'<option value="">Все площадки</option>' +
		sites.map(s => `<option value="${s}">${s}</option>`).join("");

	// Менеджеры
	($("#f-manager") as HTMLSelectElement).innerHTML =
		'<option value="">Все менеджеры</option>' +
		state.managers.map(m => `<option value="${m.id}">${m.full_name}</option>`).join("");

	const mq = matchMedia("(min-width:761px)"),
		fl = $("#fl") as HTMLDetailsElement,
		sync = () => {
			fl.open = mq.matches;
		};
	sync();
	mq.addEventListener("change", sync);
}

function readSearch(): boolean {
	const s = +($("#h-s") as HTMLSelectElement).value,
		e = +($("#h-e") as HTMLSelectElement).value,
		err = $("#h-err") as HTMLElement;
	const bad =
		e <= s
			? "Время окончания должно быть позже начала."
			: ($("#h-date") as HTMLInputElement).value < today
				? "Выберите сегодняшнюю или будущую дату."
				: "";
	err.hidden = !bad;
	err.textContent = bad;
	if (bad) return false;
	state.selectedDate = ($("#h-date") as HTMLInputElement).value;
	state.s = s;
	state.e = e;
	return true;
}

function readFilters() {
	state.site = ($("#f-site") as HTMLSelectElement).value;
	state.manager = +($("#f-manager") as HTMLSelectElement).value;
	state.q = ($("#f-q") as HTMLInputElement).value.trim().toLowerCase();
}

/* ============ КАТАЛОГ ============ */
function filtered(): Room[] {
	return state.rooms.filter(r => {
		if (state.site && r.site !== state.site) return false;
		if (state.q && !r.name.toLowerCase().includes(state.q)) return false;
		return true;
	});
}

function renderGrid() {
	const list = filtered(),
		g = $("#grid") as HTMLElement;
	renderPlan(list);
	($("#count") as HTMLElement).textContent =
		`Найдено: ${list.length} из ${state.rooms.length}. ${dateRu(state.selectedDate)}, ${fmt(state.s)}–${fmt(state.e)}`;
	if (!list.length) {
		g.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Ничего не найдено</h3><p class="muted">Попробуйте изменить фильтры.</p><button class="btn primary" type="button" id="reset2">Сбросить фильтры</button></div>`;
		($("#reset2") as HTMLButtonElement).onclick = resetFilters;
		return;
	}
	g.innerHTML = list
		.map(r => {
			const free = isFree(r.id, state.selectedDate, state.s, state.e);
			return `<article class="card"><div class="cover" style="--t:${30 + r.id * 5}%; background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 20%, var(--surface)), color-mix(in srgb, var(--accent) 8%, var(--surface)))"><b aria-hidden="true">${r.id}</b></div><div class="cbody">
      <h3><button type="button" data-open="${r.id}" aria-label="${esc(r.name)}: открыть расписание">${esc(r.name)}</button></h3>
      <div class="meta"><span>${r.site}</span></div>
      <div class="foot"><span class="st ${free ? "free" : "busy"}">${free ? "Свободен" : "Занят"}</span></div></div></article>`;
		})
		.join("");
}

function resetFilters() {
	($("#f-q") as HTMLInputElement).value = "";
	($("#f-site") as HTMLSelectElement).value = "";
	($("#f-manager") as HTMLSelectElement).value = "";
	readFilters();
	readSearch();
	renderGrid();
}

/* ============ ПЛАН ПЛОЩАДКИ ============ */
let view = matchMedia("(min-width:761px)").matches ? "map" : "list",
	selectedSite = state.rooms[0]?.site || "";

function setView(v: string) {
	view = v;
	($("#grid") as HTMLElement).hidden = v !== "list";
	($("#plan") as HTMLElement).hidden = v !== "map";
	($("#v-list") as HTMLButtonElement).setAttribute("aria-pressed", v === "list");
	($("#v-map") as HTMLButtonElement).setAttribute("aria-pressed", v === "map");
}

function renderPlan(list: Room[]) {
	const sites = [...new Set(state.rooms.map(r => r.site))];
	selectedSite = selectedSite || sites[0] || "";

	($("#sites") as HTMLElement).innerHTML = sites
		.map(s => {
			const n = state.rooms.filter(r => r.site === s && list.some(l => l.id === r.id) && isFree(r.id, state.selectedDate, state.s, state.e)).length;
			return `<button type="button" class="ftab" data-site="${s}" aria-pressed="${s === selectedSite}">${s}<small>свободно: ${n}</small></button>`;
		})
		.join("");

	const block = (x: number, y: number, w: number, h: number, t: string) =>
		`<g aria-hidden="true"><rect class="blk" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><text class="blk-t" x="${x + w / 2}" y="${y + h / 2 + 4}">${t}</text></g>`;

	const rooms = state.rooms
		.filter(r => r.site === selectedSite)
		.map((r, i) => {
			const w = 140;
			const x = 20 + (i % 3) * (w + 15);
			const y = 20 + Math.floor(i / 3) * 120;
			const free = isFree(r.id, state.selectedDate, state.s, state.e);
			const on = list.some(l => l.id === r.id);
			return `<g class="pr ${free ? "free" : "busy"}${on ? "" : " dim"}" data-info="${r.id}" ${on ? `data-open="${r.id}" tabindex="0" role="button"` : 'aria-hidden="true"'} aria-label="${esc(r.name)}, ${free ? "свободен" : "занят"}, открыть расписание">
      <rect x="${x}" y="${y}" width="${w}" height="100" rx="8"/><text class="t1" x="${x + 14}" y="${y + 34}">${esc(r.name)}</text>
      <text class="t3" x="${x + 14}" y="${y + 82}">${free ? "Свободен" : "Занят"}, ${fmt(state.s)}–${fmt(state.e)}</text></g>`;
		})
		.join("");

	($("#plan-svg") as HTMLElement).innerHTML =
		`<svg viewBox="0 0 500 400" role="group" aria-label="План ${selectedSite}">
    <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" style="fill:var(--surface)"/><line x1="0" y1="0" x2="0" y2="8" style="stroke:var(--busy);stroke-opacity:.35;stroke-width:3"/></pattern></defs>
    ${rooms}</svg>`;
}

function showInfo(e: Event) {
	const g = (e.target as Element).closest && (e.target as Element).closest("[data-info]");
	if (!g) return;
	const roomId = +(g as Element).getAttribute("data-info")!;
	const r = state.rooms.find(r => r.id === roomId);
	if (!r) return;
	($("#plan-info") as HTMLElement).textContent = `${r.name}, ${r.site}`;
}

/* ============ ДИАЛОГ БРОНИРОВАНИЯ ============ */
const rd = $("#rd") as HTMLDialogElement;
const sel = { room: null as Room | null, date: today, a: null as number | null, b: null as number | null };
let lastFocus: Element | null = null;

function openRoom(id: number) {
	const r = state.rooms.find(r => r.id === id);
	if (!r) return;
	lastFocus = document.activeElement;
	Object.assign(sel, { room: r, date: state.selectedDate, a: null, b: null });
	if (isFree(id, state.selectedDate, state.s, state.e)) {
		sel.a = (state.s - OPEN) / STEP;
		sel.b = (state.e - OPEN) / STEP - 1;
	}

	rd.innerHTML = `<div class="dh"><div><h2 id="rd-t">${esc(r.name)}</h2><p class="muted" style="margin:2px 0 0">${r.site}</p></div>
    <button class="x" type="button" id="rd-x" aria-label="Закрыть"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
   <div id="rd-main" class="dbody">
    <div><label for="r-date">Дата</label><input type="date" id="r-date" min="${today}" value="${sel.date}" style="max-width:220px">
     <div class="legend"><span><i></i>Свободно</span><span><i style="background:repeating-linear-gradient(135deg,transparent 0 3px,var(--line) 3px 4px)"></i>Занято</span><span><i style="background:var(--accent);border-color:var(--accent)"></i>Выбрано</span></div>
     <div class="slots" id="slots" role="group" aria-label="Слоты по 30 минут"></div>
     <p class="muted" style="font-size:13px">Нажмите на начальный слот, затем на конечный, чтобы выбрать диапазон.</p>
     <div class="sum" id="sum" aria-live="polite"></div></div>
    <form id="bf" novalidate aria-label="Данные для бронирования">
     <div class="row"><label for="f-manager">Менеджер</label><select id="f-manager" required></select><p class="err" id="e-manager"></p></div>
     <div class="row"><label for="f-purpose">Цель</label><input id="f-purpose" name="purpose" placeholder="Например: Консультация" required><p class="err" id="e-purpose"></p></div>
     <button class="btn primary" type="submit" style="width:100%">Забронировать</button>
    </form></div>`;

	// Заполняем менеджеров
	($("#f-manager") as HTMLSelectElement).innerHTML =
		'<option value="">Выберите менеджера</option>' +
		state.managers.map(m => `<option value="${m.id}">${m.full_name}</option>`).join("");

	($("#rd-x") as HTMLButtonElement).onclick = () => rd.close();
	($("#r-date") as HTMLInputElement).onchange = e => {
		if (!(e.target as HTMLInputElement).value || (e.target as HTMLInputElement).value < today) {
			(e.target as HTMLInputElement).value = sel.date;
			return;
		}
		sel.date = (e.target as HTMLInputElement).value;
		sel.a = sel.b = null;
		renderSlots();
	};
	($("#bf") as HTMLFormElement).addEventListener("submit", submitBooking);
	renderSlots();
	rd.showModal();
}

function renderSlots(focusI?: number) {
	const busy = busyMap(sel.room!.id, sel.date);
	($("#slots") as HTMLElement).innerHTML = busy
		.map((b, i) => {
			const on = sel.a !== null && i >= sel.a && i <= sel.b;
			return `<button type="button" class="slot" data-i="${i}" aria-pressed="${on}" ${b ? "disabled" : ""} aria-label="${fmt(slotMin(i))}–${fmt(slotMin(i + 1))}, ${b ? "занято" : on ? "выбрано" : "свободно"}">${fmt(slotMin(i))}</button>`;
		})
		.join("");
	const sum = $("#sum") as HTMLElement;
	if (sel.a === null) sum.textContent = "Выберите время на расписании.";
	else {
		const n = sel.b! - sel.a! + 1,
			h = n / 2;
		sum.textContent = `${dateRu(sel.date)}, ${fmt(slotMin(sel.a!))}–${fmt(slotMin(sel.b! + 1))} (${h.toLocaleString("ru-RU")} ч)`;
	}
	if (focusI != null) {
		const b = $(`.slot[data-i="${focusI}"]`) as HTMLButtonElement;
		if (b) b.focus();
	}
}

function pickSlot(i: number) {
	const busy = busyMap(sel.room!.id, sel.date);
	if (sel.a !== null && sel.a === sel.b && i !== sel.a) {
		const lo = Math.min(i, sel.a),
			hi = Math.max(i, sel.a);
		if (busy.slice(lo, hi + 1).some(Boolean)) {
			renderSlots(i);
			($("#sum") as HTMLElement).textContent = "В этот диапазон попадают занятые слоты.";
			return;
		}
		sel.a = lo;
		sel.b = hi;
	} else if (sel.a === sel.b && sel.a === i) sel.a = sel.b = null;
	else sel.a = sel.b = i;
	renderSlots(i);
}

async function submitBooking(e: Event) {
	e.preventDefault();

	const managerId = ($("#f-manager") as HTMLSelectElement).value;
	const purpose = ($("#f-purpose") as HTMLInputElement).value.trim();

	if (!managerId) {
		toast("Выберите менеджера");
		return;
	}
	if (!purpose) {
		toast("Укажите цель бронирования");
		return;
	}
	if (sel.a === null) {
		($("#sum") as HTMLElement).textContent = "Сначала выберите время.";
		return;
	}

	const booking = {
		roomId: sel.room!.id,
		managerId: Number(managerId),
		date: sel.date,
		start: slotToTime(sel.a!),
		end: slotToTime(sel.b! + 1),
		purpose,
	};

	try {
		if (state.useApi) {
			const result = await api<{ id: number }>("/bookings", {
				method: "POST",
				body: JSON.stringify(booking),
			});
			showSuccess(result.id, booking);
		} else {
			// Мок
			const mockBooking: Booking = {
				id: Math.floor(10000 + Math.random() * 90000),
				...booking,
				roomName: sel.room!.name,
				managerName: state.managers.find(m => m.id === Number(managerId))?.full_name || "",
			};
			state.bookings.push(mockBooking);
			showSuccess(mockBooking.id, booking);
		}
	} catch (err) {
		toast((err as Error).message);
	}
}

function showSuccess(id: number, booking: any) {
	renderBookings();
	renderGrid();
	($("#rd-main") as HTMLElement).outerHTML =
		`<div class="ok-box"><svg class="ic" viewBox="0 0 24 24" style="width:44px;height:44px;color:var(--ok)"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>
    <h2 id="ok-t" tabindex="-1">Бронь подтверждена</h2><div class="num">${id}</div>
    <p>${esc(sel.room!.name)}, ${dateRu(booking.date)}, ${booking.start}–${booking.end}</p>
    <p class="muted">Цель: ${esc(booking.purpose)}</p>
    <div class="acts"><button class="btn primary" type="button" id="go-b">Перейти в «Мои брони»</button><button class="btn" type="button" id="ok-x">Закрыть</button></div></div>`;
	($("#ok-t") as HTMLElement).focus();
	($("#ok-x") as HTMLButtonElement).onclick = () => rd.close();
	($("#go-b") as HTMLButtonElement).onclick = () => {
		rd.close();
		($("#bookings") as HTMLElement).scrollIntoView();
	};
}

/* ============ МОИ БРОНИ ============ */
function renderBookings() {
	const l = $("#blist") as HTMLElement;
	if (!state.bookings.length) {
		l.innerHTML = `<li class="empty"><h3>Броней пока нет</h3><p class="muted">Выберите аудиторию: бронь появится здесь.</p><a class="btn primary" href="#rooms">К аудиториям</a></li>`;
		return;
	}
	l.innerHTML = state.bookings
		.map(b => `<li class="bk"><div class="binfo"><div class="bhead"><span class="num">${b.id}</span><span class="muted">${b.roomName}</span></div>
      <p>${dateRu(b.date)}, ${b.start}–${b.end}</p><p class="muted">Цель: ${b.purpose}, менеджер: ${b.managerName}</p></div>
      <button class="btn danger" type="button" data-cancel="${b.id}">Отменить</button></li>`)
		.join("");
}

const cd = $("#cd") as HTMLDialogElement;
let cancelId: number | null = null;

function askCancel(id: number) {
	cancelId = id;
	const b = state.bookings.find(x => x.id === id);
	if (!b) return;
	lastFocus = document.activeElement;
	($("#cd-p") as HTMLElement).textContent = `Бронь ${id}: ${b.roomName}, ${dateRu(b.date)}, ${b.start}–${b.end}. Слоты снова станут свободными.`;
	cd.showModal();
	($("#cd-no") as HTMLButtonElement).focus();
}

/* ============ СОБЫТИЯ ============ */
document.addEventListener("click", e => {
	const o = (e.target as Element).closest("[data-open]");
	if (o) openRoom(+(o as Element).getAttribute("data-open")!);
	const s = (e.target as Element).closest(".slot");
	if (s && !(s as HTMLButtonElement).disabled) pickSlot(+(s as Element).getAttribute("data-i")!);
	const c = (e.target as Element).closest("[data-cancel]");
	if (c) askCancel(+(c as Element).getAttribute("data-cancel")!);
	const t = (e.target as Element).closest("[data-site]");
	if (t) {
		selectedSite = (t as Element).getAttribute("data-site")!;
		renderGrid();
		($(`[data-site="${selectedSite}"]`) as HTMLButtonElement)?.focus();
	}
});

[rd, cd].forEach(d => {
	d.addEventListener("click", e => {
		if (e.target === d) d.close();
	});
	d.addEventListener("close", () => {
		if (lastFocus && document.contains(lastFocus)) (lastFocus as HTMLElement).focus();
	});
});

($("#cd-no") as HTMLButtonElement).onclick = () => cd.close();

($("#cd-yes") as HTMLButtonElement).onclick = async () => {
	if (!cancelId) return;
	try {
		if (state.useApi) {
			await api(`/bookings/${cancelId}`, { method: "DELETE" });
		}
		state.bookings = state.bookings.filter(b => b.id !== cancelId);
		renderBookings();
		renderGrid();
		cd.close();
		toast("Бронь " + cancelId + " отменена");
	} catch (err) {
		toast((err as Error).message);
	}
};

document.addEventListener("keydown", e => {
	if ((e.key === "Enter" || e.key === " ") && (e.target as Element).matches && (e.target as Element).matches(".pr[data-open]")) {
		e.preventDefault();
		openRoom(+(e.target as Element).getAttribute("data-open")!);
	}
});

($("#plan") as HTMLElement).addEventListener("mouseover", showInfo);
($("#plan") as HTMLElement).addEventListener("focusin", showInfo);
($("#v-list") as HTMLButtonElement).onclick = () => setView("list");
($("#v-map") as HTMLButtonElement).onclick = () => setView("map");
($("#login") as HTMLButtonElement).onclick = () => toast("Вход недоступен в прототипе");

($("#search") as HTMLFormElement).addEventListener("submit", async e => {
	e.preventDefault();
	if (readSearch()) {
		await loadBookings(state.selectedDate);
		renderGrid();
		($("#rooms") as HTMLElement).scrollIntoView();
	}
});

($("#fl") as HTMLElement).addEventListener("input", () => {
	readFilters();
	renderGrid();
});

($("#reset") as HTMLButtonElement).onclick = resetFilters;

/* ============ СТАРТ ============ */
(async () => {
	($("#grid") as HTMLElement).innerHTML = Array(6).fill('<div class="sk" aria-hidden="true"></div>').join("");
	await loadRooms();
	await loadManagers();
	await loadBookings(today);
	initControls();
	renderBookings();
	setView(view);
	readSearch();
	readFilters();
	renderGrid();
})();
