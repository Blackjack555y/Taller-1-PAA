import os
import time
import logging
from datetime import datetime, timezone
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("scraper")

EXITO_SEARCH_URL = "https://www.exito.com/api/catalog_system/pub/products/search"
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000")
ITEMS_ENDPOINT = f"{API_BASE_URL}/api/items"

QUERIES = [
    {"term": "arroz", "category": "arroz"},
    {"term": "atun", "category": "atun"},
]

PAGE_SIZE = 49
REQUEST_TIMEOUT = 15


def fetch_products(query: str, from_: int = 0, to: int = PAGE_SIZE) -> list:
    """GET a la API de Exito, devuelve la lista cruda de productos."""
    params = {"ft": query, "_from": from_, "_to": to}
    log.info(f"GET {EXITO_SEARCH_URL} params={params}")

    resp = requests.get(
        EXITO_SEARCH_URL,
        params=params,
        headers={"User-Agent": "Mozilla/5.0 (research script)"},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    log.info(f"  -> {len(data)} productos recibidos para '{query}'")
    return data


def extract(raw_products: list, category: str) -> list:
    """
    Parsea la respuesta de VTEX y extrae los elementos clave:
    título, enlace y metadata relevante (precio, marca, imagen, sku).
    """
    items = []
    scraped_at = datetime.now(timezone.utc).isoformat()

    for p in raw_products:
        title = p.get("productName")
        link = p.get("link")
        brand = p.get("brand")

        for sku in p.get("items", []):
            images = sku.get("images") or []
            image_url = images[0].get("imageUrl") if images else None

            for seller in sku.get("sellers", []):
                offer = seller.get("commertialOffer", {}) or {}

                items.append({
                    "title": title,
                    "link": link,
                    "category": category,
                    "price": offer.get("Price"),
                    "brand": brand,
                    "image_url": image_url,
                    "metadata": {
                        "product_id": p.get("productId"),
                        "sku_id": sku.get("itemId"),
                        "ean": sku.get("ean"),
                        "list_price": offer.get("ListPrice"),
                        "available_qty": offer.get("AvailableQuantity"),
                        "scraped_at": scraped_at,
                    },
                })
    return items


def post_to_backend(items: list) -> dict | None:
    """Empaqueta los resultados en JSON y hace POST hacia el backend."""
    if not items:
        log.warning("No hay items para enviar, se omite el POST.")
        return None

    log.info(f"POST {len(items)} items -> {ITEMS_ENDPOINT}")
    resp = requests.post(ITEMS_ENDPOINT, json={"items": items}, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def run():
    all_items = []

    for q in QUERIES:
        raw = fetch_products(q["term"])
        all_items += extract(raw, q["category"])
        time.sleep(1)  # respiro entre requests

    log.info(f"Total items extraídos: {len(all_items)}")

    try:
        result = post_to_backend(all_items)
        log.info(f"Respuesta del backend: {result}")
    except requests.RequestException as e:
        log.error(f"Fallo el POST al backend: {e}")
        log.info("Verifica que server.js esté corriendo en %s", API_BASE_URL)


if __name__ == "__main__":
    run()