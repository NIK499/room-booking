import { createServer, IncomingMessage, ServerResponse } from "node:http";

// ===== Типы данных =====

interface Room {
  id: number;
  name: string;
  kind: string;   // "Кабинет", "Переговорная", "Малый офис"
  floor: number;
  cap: number;    // вместимость
  price: number;  // цена за час (₽)
  eq: string[];   // оборудование: ["proj", "tv", "vc", "ac", "flip"]
}

interface Equipment {
  [key: string]: [string, string]; // ключ -> [название, SVG-иконка]
}

interface NewBooking {
  roomId: number;
  date: string;   // "2026-11-03"
  start: string;  // "10:00"
  end: string;    // "11:30"
  name: string;   // кто бронирует
  email: string;
  phone: string;
  comment?: string;
}

interface Booking extends NewBooking {
  id: number;
  status: "active" | "cancelled";
  created: number;
}

// ===== Константы (совпадают с фронтом) =====

const EQ: Equipment = {
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
};

const rooms: Room[] = [
  { id: 1, name: "Нейрон", kind: "Кабинет", floor: 1, cap: 4, price: 600, eq: ["tv", "ac"] },
  { id: 2, name: "Монолит", kind: "Переговорная", floor: 1, cap: 8, price: 1100, eq: ["proj", "tv", "ac", "flip"] },
  { id: 3, name: "Стек", kind: "Переговорная", floor: 2, cap: 6, price: 900, eq: ["tv", "vc", "ac"] },
  { id: 4, name: "Коммит", kind: "Кабинет", floor: 2, cap: 4, price: 700, eq: ["flip", "ac"] },
  { id: 5, name: "Ядро", kind: "Переговорная", floor: 3, cap: 12, price: 1800, eq: ["proj", "tv", "vc", "ac", "flip"] },
  { id: 6, name: "Билд", kind: "Кабинет", floor: 3, cap: 2, price: 450, eq: ["tv"] },
  { id: 7, name: "Деплой", kind: "Переговорная", floor: 4, cap: 10, price: 1500, eq: ["proj", "vc", "ac"] },
  { id: 8, name: "Репозиторий", kind: "Малый офис", floor: 4, cap: 20, price: 2800, eq: ["proj", "tv", "vc", "ac", "flip"] },
  { id: 9, name: "Спринт", kind: "Кабинет", floor: 5, cap: 6, price: 1000, eq: ["tv", "flip", "ac"] },
  { id: 10, name: "Хост", kind: "Кабинет", floor: 5, cap: 3, price: 550, eq: ["vc"] },
  { id: 11, name: "Кластер", kind: "Малый офис", floor: 6, cap: 14, price: 2100, eq: ["proj", "tv", "vc", "ac"] },
  { id: 12, name: "Панорама", kind: "Малый офис", floor: 6, cap: 30, price: 3800, eq: ["proj", "tv", "vc", "ac", "flip"] },
];

const bookings: Booking[] = [];
let nextId = 1;

// ===== Вспомогательные функции =====

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function send(res: ServerResponse, status: number, data?: unknown): void {
  if (data === undefined) {
    res.writeHead(status, CORS_HEADERS);
    res.end();
    return;
  }
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function validate(data: unknown): { error: string } | { value: NewBooking } {
  if (typeof data !== "object" || data === null) {
    return { error: "Тело запроса должно быть объектом" };
  }
  const d = data as Record<string, unknown>;
  const roomId = d.roomId;
  const date = d.date;
  const start = d.start;
  const end = d.end;
  const name = d.name;
  const email = d.email;
  const phone = d.phone;
  const comment = d.comment;

  if (typeof roomId !== "number") return { error: "roomId должен быть числом" };
  if (typeof name !== "string" || name.trim() === "") return { error: "Укажите имя" };
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    return { error: "Введите корректный email" };
  }
  if (typeof phone !== "string" || phone.replace(/\D/g, "").length < 10) {
    return { error: "Введите корректный телефон" };
  }
  if (typeof date !== "string" || !DATE_RE.test(date)) return { error: "date: формат ГГГГ-ММ-ДД" };
  if (typeof start !== "string" || !TIME_RE.test(start)) return { error: "start: формат ЧЧ:ММ" };
  if (typeof end !== "string" || !TIME_RE.test(end)) return { error: "end: формат ЧЧ:ММ" };
  if (end <= start) return { error: "Конец должен быть позже начала" };

  return {
    value: {
      roomId,
      date,
      start,
      end,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      comment: typeof comment === "string" ? comment.trim() : undefined,
    },
  };
}

function isBusy(b: NewBooking, excludeId?: number): boolean {
  return bookings.some(
    (x) =>
      x.id !== excludeId &&
      x.status === "active" &&
      x.roomId === b.roomId &&
      x.date === b.date &&
      b.start < x.end &&
      b.end > x.start
  );
}

// ===== Сервер =====

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (method === "OPTIONS") return send(res, 204);

    // Эндпоинт оборудования (для фронта)
    if (method === "GET" && path === "/api/equipment") {
      return send(res, 200, EQ);
    }

    // Список кабинетов
    if (method === "GET" && path === "/api/rooms") {
      return send(res, 200, rooms);
    }

    // Список броней (можно отфильтровать: /api/bookings?date=2026-11-03&roomId=1)
    if (method === "GET" && path === "/api/bookings") {
      const date = url.searchParams.get("date");
      const roomId = url.searchParams.get("roomId");
      const list = bookings
        .filter(
          (b) =>
            b.status === "active" &&
            (date === null || b.date === date) &&
            (roomId === null || b.roomId === Number(roomId))
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
      return send(res, 200, list);
    }

    // Создать бронь
    if (method === "POST" && path === "/api/bookings") {
      let data: unknown;
      try {
        data = await readJson(req);
      } catch {
        return send(res, 400, { error: "Некорректный JSON" });
      }

      const result = validate(data);
      if ("error" in result) return send(res, 422, result);

      const nb = result.value;
      if (!rooms.some((r) => r.id === nb.roomId)) {
        return send(res, 404, { error: "Кабинет не найден" });
      }
      if (isBusy(nb)) {
        return send(res, 409, { error: "Кабинет в это время уже занят" });
      }

      const booking: Booking = {
        id: nextId++,
        ...nb,
        status: "active",
        created: Date.now(),
      };
      bookings.push(booking);
      return send(res, 201, booking);
    }

    // Отменить бронь
    const match = path.match(/^\/api\/bookings\/(\d+)$/);
    if (method === "DELETE" && match) {
      const id = Number(match[1]);
      const booking = bookings.find((b) => b.id === id);
      if (!booking) return send(res, 404, { error: "Бронь не найдена" });
      booking.status = "cancelled";
      return send(res, 200, { id, status: "cancelled" });
    }

    send(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "Внутренняя ошибка сервера" });
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
  console.log("Эндпоинты:");
  console.log("  GET  /api/rooms        — список кабинетов");
  console.log("  GET  /api/equipment    — список оборудования");
  console.log("  GET  /api/bookings     — список броней (?date=ГГГГ-ММ-ДД&roomId=N)");
  console.log("  POST /api/bookings     — создать бронь");
  console.log("  DELETE /api/bookings/N — отменить бронь");
});
