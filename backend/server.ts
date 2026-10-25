import { createServer, IncomingMessage, ServerResponse } from "node:http";

// ===== Типы данных =====

interface Room {
  id: number;
  name: string;
}

interface NewBooking {
  roomId: number;
  date: string;   // "2026-11-03"
  start: string;  // "10:00"
  end: string;    // "11:30"
  name: string;   // кто бронирует
}

interface Booking extends NewBooking {
  id: number;
}

// ===== Данные (хранятся в памяти, при перезапуске сбрасываются) =====

const rooms: Room[] = [
  { id: 1, name: "Кабинет 101" },
  { id: 2, name: "Кабинет 102" },
  { id: 3, name: "Лекционный зал" },
];

const bookings: Booking[] = [];
let nextId = 1;

// ===== Вспомогательные функции =====

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Заголовки CORS: без них браузер не покажет странице ответ сервера
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Отправляет ответ: статус и (необязательно) данные в формате JSON
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

// Читает тело запроса и превращает его из текста в объект
async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

// Проверяет данные брони. Возвращает либо ошибку, либо готовую бронь
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

  if (typeof roomId !== "number") return { error: "roomId должен быть числом" };
  if (typeof name !== "string" || name.trim() === "") return { error: "Укажите имя" };
  if (typeof date !== "string" || !DATE_RE.test(date)) return { error: "date: формат ГГГГ-ММ-ДД" };
  if (typeof start !== "string" || !TIME_RE.test(start)) return { error: "start: формат ЧЧ:ММ" };
  if (typeof end !== "string" || !TIME_RE.test(end)) return { error: "end: формат ЧЧ:ММ" };
  if (end <= start) return { error: "Конец должен быть позже начала" };

  return { value: { roomId, date, start, end, name: name.trim() } };
}

// Занят ли кабинет в это время?
// Два промежутка пересекаются, если каждый начинается раньше, чем заканчивается другой
function isBusy(b: NewBooking): boolean {
  return bookings.some(
    (x) => x.roomId === b.roomId && x.date === b.date && b.start < x.end && b.end > x.start
  );
}

// ===== Сервер: здесь разбираем, какой запрос пришёл =====

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method ?? "GET";

    // Браузер перед POST и DELETE сначала присылает "разведывательный" запрос OPTIONS
    if (method === "OPTIONS") return send(res, 204);

    // ЭТАП 1. Список кабинетов
    if (method === "GET" && path === "/api/rooms") {
      return send(res, 200, rooms);
    }

    // ЭТАП 1. Список броней (можно отфильтровать: /api/bookings?date=2026-11-03)
    if (method === "GET" && path === "/api/bookings") {
      const date = url.searchParams.get("date");
      const list = bookings
        .filter((b) => date === null || b.date === date)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
      return send(res, 200, list);
    }

    // ЭТАП 2. Создать бронь
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

      const booking: Booking = { id: nextId++, ...nb };
      bookings.push(booking);
      return send(res, 201, booking);
    }

    // ЭТАП 3. Отменить бронь
    const match = path.match(/^\/api\/bookings\/(\d+)$/);
    if (method === "DELETE" && match) {
      const id = Number(match[1]);
      const index = bookings.findIndex((b) => b.id === id);
      if (index === -1) return send(res, 404, { error: "Бронь не найдена" });
      bookings.splice(index, 1);
      return send(res, 204);
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
});
