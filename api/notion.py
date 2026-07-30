"""
Sincronización con Notion (disparo manual, chequeo y estado).
"""

from typing import Optional

from fastapi import APIRouter, HTTPException

import db
from api import comun
from api.comun import (
    MESES_ES, METODOS_VALIDOS, clamp_dia, hoy, marcar_y_sincronizar,
    validar_categoria, validar_cuenta, validar_fecha, validar_monto,
    validar_prestamo, validar_tarjeta, validar_visacuota,
)

import notion_sync

router = APIRouter()


@router.post("/api/notion/sync")
def sync_notion_manual():
    """Botón "Sincronizar con Notion": corre la sincronización y espera el resultado."""
    if not notion_sync.esta_configurado():
        raise HTTPException(400, "Notion no está configurado. Copiá .env.example como .env "
                                 "y llená NOTION_TOKEN y NOTION_PARENT_PAGE_ID (ver README).")
    conn = db.get_conn()
    try:
        db.config_set(conn, "sync_pendiente", "1")
        resultado = notion_sync.sincronizar(conn)
        bandeja = resultado["bandeja"]
        return {"ok": True, "alertas": resultado["alertas"],
                "bandeja_importados": bandeja["importados"],
                "bandeja_detalle": bandeja["detalle"],
                "bandeja_rechazados": bandeja["rechazados"],
                "ultima_sync": db.config_get(conn, "ultima_sync")}
    except Exception as e:
        raise HTTPException(502, f"Notion no respondió: {e}. Tus datos locales están bien; "
                                 "quedó pendiente para reintentar.")
    finally:
        conn.close()


@router.post("/api/notion/check")
def notion_check():
    """
    Botón "Probar conexión": valida el token y el acceso a la página padre
    SIN crear ni modificar nada en Notion. Útil para diagnosticar el .env
    antes de sincronizar de verdad.
    """
    if not notion_sync.esta_configurado():
        raise HTTPException(400, "Notion no está configurado. Copiá .env.example como .env "
                                 "y llená NOTION_TOKEN y NOTION_PARENT_PAGE_ID (ver README).")
    try:
        ok, mensaje = notion_sync.verificar_conexion()
    except Exception as e:
        raise HTTPException(502, f"No se pudo contactar a Notion: {e}")
    if not ok:
        raise HTTPException(400, mensaje)
    return {"ok": True, "mensaje": mensaje}


@router.get("/api/notion/estado")
def notion_estado():
    conn = db.get_conn()
    try:
        return {
            "configurado": notion_sync.esta_configurado(),
            "sync_pendiente": db.config_get(conn, "sync_pendiente") == "1",
            "ultima_sync": db.config_get(conn, "ultima_sync"),
        }
    finally:
        conn.close()

