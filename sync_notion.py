"""
sync_notion.py — Script para sincronizar con Notion desde la terminal.

Uso:
    python sync_notion.py           # sincroniza ahora
    python sync_notion.py --check   # valida el token y el acceso a la página,
                                    # SIN crear ni tocar nada en Notion
    python sync_notion.py --reset   # olvida las bases de Notion guardadas
                                    # (se recrean en la próxima sincronización)

Se puede programar con el Programador de tareas de Windows para que corra
cada cierto tiempo, o correrlo a mano cuando se quiera refrescar el celular.
"""

import sys

import db
import notion_sync

# La consola de Windows (cp1252) no sabe imprimir tildes ni símbolos como ✓/✗;
# con errors="replace" el script nunca se cae por eso, en el peor caso
# muestra un "?" en vez de crashear.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def main():
    db.init_db()
    conn = db.get_conn()
    try:
        if "--check" in sys.argv:
            if not notion_sync.esta_configurado():
                print("Notion no está configurado todavía.")
                print("Copiá .env.example como .env y llená NOTION_TOKEN y NOTION_PARENT_PAGE_ID.")
                sys.exit(1)
            ok, mensaje = notion_sync.verificar_conexion()
            print(("OK: " if ok else "FALLO: ") + mensaje)
            sys.exit(0 if ok else 1)

        if "--reset" in sys.argv:
            # Olvidar los IDs de las bases y el mapa de páginas
            for clave in ("notion_db_resumen", "notion_db_tarjetas", "notion_db_alertas"):
                conn.execute("DELETE FROM config WHERE clave = ?", (clave,))
            conn.execute("DELETE FROM notion_map")
            conn.commit()
            print("Listo: se olvidaron las bases de Notion guardadas.")
            print("En la próxima sincronización se crearán de nuevo.")
            return

        if not notion_sync.esta_configurado():
            print("Notion no está configurado.")
            print("Copiá .env.example como .env y llená NOTION_TOKEN y NOTION_PARENT_PAGE_ID.")
            sys.exit(1)

        print("Sincronizando con Notion...")
        resultado = notion_sync.sincronizar(conn)
        d = resultado["resumen"]
        print(f"OK — Ingresos: {notion_sync.fmt_q(d['ingresos'])} | "
              f"Gastos: {notion_sync.fmt_q(d['gastos'])} | "
              f"Balance: {notion_sync.fmt_q(d['balance'])} | "
              f"Deuda tarjetas: {notion_sync.fmt_q(d['deuda_total'])} | "
              f"Alertas: {resultado['alertas']}")
    except Exception as e:
        print(f"ERROR al sincronizar: {e}")
        print("Tus datos locales están intactos; se reintentará en la próxima sincronización.")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
