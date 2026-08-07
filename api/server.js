/**
 * server.js
 *
 * API Backend RESTful (Node.js + Express) que desacopla el scraper de
 * la persistencia en Supabase.
 *
 *   POST /api/items  -> recibe { items: [...] } del scraper, valida y
 *                        hace inserción masiva en la tabla scraped_items.
 *   GET  /api/items   -> retorna el listado completo ordenado por
 *                        created_at descendente, para el frontend.
 *
 * Variables de entorno requeridas (ver .env.example):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY   (service_role key, NUNCA la anon key aquí:
 *                            necesitamos bypass de RLS para insertar)
 *   PORT                   (opcional, default 3000)
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno. Revisa tu .env"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// ---------- helpers ----------

function validateItem(item) {
  if (!item || typeof item !== "object") return "item inválido";
  if (!item.title || typeof item.title !== "string") return "falta 'title'";
  return null;
}

// ---------- routes ----------

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "scraper-api", endpoints: ["POST /api/items", "GET /api/items"] });
});

// Recibe el payload del scraper y hace inserción masiva
app.post("/api/items", async (req, res) => {
  const items = req.body?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Se espera un body { items: [...] } no vacío" });
  }

  for (const item of items) {
    const error = validateItem(item);
    if (error) {
      return res.status(400).json({ error: `Item inválido: ${error}`, item });
    }
  }

  const rows = items.map((item) => ({
    title: item.title,
    link: item.link ?? null,
    category: item.category ?? null,
    price: item.price ?? null,
    brand: item.brand ?? null,
    image_url: item.image_url ?? null,
    metadata: item.metadata ?? {},
  }));

  const { data, error } = await supabase.from("scraped_items").insert(rows).select();

  if (error) {
    console.error("Error insertando en Supabase:", error);
    return res.status(500).json({ error: "Error al insertar en la base de datos", details: error.message });
  }

  return res.status(201).json({ inserted: data.length, items: data });
});

// Retorna el listado completo, ordenado cronológicamente
app.get("/api/items", async (_req, res) => {
  const { data, error } = await supabase
    .from("scraped_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error consultando Supabase:", error);
    return res.status(500).json({ error: "Error al consultar la base de datos", details: error.message });
  }

  return res.json({ count: data.length, items: data });
});

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});