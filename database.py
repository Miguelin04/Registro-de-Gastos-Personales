"""
database.py - Capa de acceso a datos para el Registro de Gastos Personales
Maneja la conexión a MariaDB y todas las operaciones CRUD.
"""

import os
import mysql.connector
from mysql.connector import Error
from datetime import date, datetime
from decimal import Decimal


class Database:
    """Gestiona la conexión y operaciones con MariaDB."""

    def __init__(self, host=None, user=None, password=None, database=None):
        host = host or os.environ.get('DB_HOST', 'localhost')
        user = user or os.environ.get('DB_USER', 'gastos_user')
        password = password or os.environ.get('DB_PASSWORD', '')
        database = database or os.environ.get('DB_NAME', 'gastos_db')
        self.config = {
            'host': host,
            'user': user,
            'password': password,
            'database': database,
            'charset': 'utf8mb4',
            'collation': 'utf8mb4_unicode_ci'
        }

    def _get_connection(self):
        """Obtiene una conexión a la base de datos."""
        try:
            conn = mysql.connector.connect(**self.config)
            return conn
        except Error as e:
            print(f"Error al conectar con MariaDB: {e}")
            raise

    def _serialize(self, obj):
        """Convierte tipos especiales a tipos serializables JSON."""
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return obj

    def _row_to_dict(self, cursor, row):
        """Convierte una fila del cursor a un diccionario serializable."""
        if row is None:
            return None
        columns = [desc[0] for desc in cursor.description]
        return {col: self._serialize(val) for col, val in zip(columns, row)}

    # ========== CATEGORÍAS ==========

    def get_categorias(self):
        """Obtiene todas las categorías."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id, nombre, icono, color FROM categorias ORDER BY nombre")
            rows = cursor.fetchall()
            return [self._row_to_dict(cursor, row) for row in rows]
        finally:
            conn.close()

    # ========== TRANSACCIONES ==========

    def get_transacciones(self, tipo=None, categoria_id=None, fecha_inicio=None, fecha_fin=None, limit=50, offset=0):
        """Obtiene transacciones con filtros opcionales."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            query = """
                SELECT t.id, t.tipo, t.monto, t.descripcion, t.categoria_id, 
                       t.fecha, t.created_at,
                       c.nombre AS categoria_nombre, c.icono AS categoria_icono, 
                       c.color AS categoria_color
                FROM transacciones t
                JOIN categorias c ON t.categoria_id = c.id
                WHERE 1=1
            """
            params = []

            if tipo:
                query += " AND t.tipo = %s"
                params.append(tipo)
            if categoria_id:
                query += " AND t.categoria_id = %s"
                params.append(int(categoria_id))
            if fecha_inicio:
                query += " AND t.fecha >= %s"
                params.append(fecha_inicio)
            if fecha_fin:
                query += " AND t.fecha <= %s"
                params.append(fecha_fin)

            query += " ORDER BY t.fecha DESC, t.created_at DESC LIMIT %s OFFSET %s"
            params.extend([int(limit), int(offset)])

            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_dict(cursor, row) for row in rows]
        finally:
            conn.close()

    def get_transaccion(self, transaccion_id):
        """Obtiene una transacción por su ID."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT t.id, t.tipo, t.monto, t.descripcion, t.categoria_id, 
                       t.fecha, t.created_at,
                       c.nombre AS categoria_nombre, c.icono AS categoria_icono, 
                       c.color AS categoria_color
                FROM transacciones t
                JOIN categorias c ON t.categoria_id = c.id
                WHERE t.id = %s
            """, (transaccion_id,))
            row = cursor.fetchone()
            return self._row_to_dict(cursor, row)
        finally:
            conn.close()

    def crear_transaccion(self, tipo, monto, descripcion, categoria_id, fecha):
        """Crea una nueva transacción."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO transacciones (tipo, monto, descripcion, categoria_id, fecha)
                VALUES (%s, %s, %s, %s, %s)
            """, (tipo, monto, descripcion, int(categoria_id), fecha))
            conn.commit()
            return self.get_transaccion(cursor.lastrowid)
        finally:
            conn.close()

    def actualizar_transaccion(self, transaccion_id, tipo, monto, descripcion, categoria_id, fecha):
        """Actualiza una transacción existente."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE transacciones 
                SET tipo = %s, monto = %s, descripcion = %s, categoria_id = %s, fecha = %s
                WHERE id = %s
            """, (tipo, monto, descripcion, int(categoria_id), fecha, transaccion_id))
            conn.commit()
            if cursor.rowcount == 0:
                return None
            return self.get_transaccion(transaccion_id)
        finally:
            conn.close()

    def eliminar_transaccion(self, transaccion_id):
        """Elimina una transacción por su ID."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM transacciones WHERE id = %s", (transaccion_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # ========== DASHBOARD / ESTADÍSTICAS ==========

    def get_dashboard(self):
        """Obtiene datos para el dashboard: balance, totales, resumen mensual."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()

            # Totales generales
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS total_ingresos,
                    COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) AS total_gastos
                FROM transacciones
            """)
            row = cursor.fetchone()
            total_ingresos = float(row[0])
            total_gastos = float(row[1])

            # Totales del mes actual
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos_mes,
                    COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) AS gastos_mes,
                    COUNT(*) AS total_transacciones_mes
                FROM transacciones
                WHERE YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())
            """)
            row = cursor.fetchone()
            ingresos_mes = float(row[0])
            gastos_mes = float(row[1])
            transacciones_mes = int(row[2])

            # Gastos por categoría (mes actual)
            cursor.execute("""
                SELECT c.nombre, c.color, c.icono,
                       COALESCE(SUM(t.monto), 0) AS total
                FROM categorias c
                LEFT JOIN transacciones t ON c.id = t.categoria_id 
                    AND t.tipo = 'gasto'
                    AND YEAR(t.fecha) = YEAR(CURDATE()) 
                    AND MONTH(t.fecha) = MONTH(CURDATE())
                GROUP BY c.id, c.nombre, c.color, c.icono
                HAVING total > 0
                ORDER BY total DESC
            """)
            gastos_por_categoria = []
            for row in cursor.fetchall():
                gastos_por_categoria.append({
                    'nombre': row[0],
                    'color': row[1],
                    'icono': row[2],
                    'total': float(row[3])
                })

            # Ingresos vs Gastos por mes (últimos 6 meses)
            cursor.execute("""
                SELECT 
                    CONCAT(YEAR(fecha), '-', LPAD(MONTH(fecha), 2, '0')) AS mes,
                    COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
                    COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) AS gastos
                FROM transacciones
                WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                GROUP BY CONCAT(YEAR(fecha), '-', LPAD(MONTH(fecha), 2, '0'))
                ORDER BY mes ASC
            """)
            mensual = []
            for row in cursor.fetchall():
                mensual.append({
                    'mes': row[0],
                    'ingresos': float(row[1]),
                    'gastos': float(row[2])
                })

            # Últimas 5 transacciones
            cursor.execute("""
                SELECT t.id, t.tipo, t.monto, t.descripcion, t.fecha,
                       c.nombre AS categoria_nombre, c.icono AS categoria_icono, c.color AS categoria_color
                FROM transacciones t
                JOIN categorias c ON t.categoria_id = c.id
                ORDER BY t.fecha DESC, t.created_at DESC
                LIMIT 5
            """)
            ultimas = [self._row_to_dict(cursor, row) for row in cursor.fetchall()]

            return {
                'balance': total_ingresos - total_gastos,
                'total_ingresos': total_ingresos,
                'total_gastos': total_gastos,
                'ingresos_mes': ingresos_mes,
                'gastos_mes': gastos_mes,
                'balance_mes': ingresos_mes - gastos_mes,
                'transacciones_mes': transacciones_mes,
                'gastos_por_categoria': gastos_por_categoria,
                'mensual': mensual,
                'ultimas_transacciones': ultimas
            }
        finally:
            conn.close()

    # ========== REPORTES ==========

    def get_reporte_mensual(self, anio=None, mes=None):
        """Genera un reporte mensual detallado."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()

            if not anio or not mes:
                today = date.today()
                anio = today.year
                mes = today.month

            # Totales del mes
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
                    COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) AS gastos,
                    COUNT(*) AS total_transacciones
                FROM transacciones
                WHERE YEAR(fecha) = %s AND MONTH(fecha) = %s
            """, (anio, mes))
            row = cursor.fetchone()
            ingresos = float(row[0])
            gastos = float(row[1])
            total_transacciones = int(row[2])

            # Desglose por categoría
            cursor.execute("""
                SELECT c.nombre, c.color, c.icono, t.tipo,
                       SUM(t.monto) AS total,
                       COUNT(*) AS cantidad
                FROM transacciones t
                JOIN categorias c ON t.categoria_id = c.id
                WHERE YEAR(t.fecha) = %s AND MONTH(t.fecha) = %s
                GROUP BY c.id, c.nombre, c.color, c.icono, t.tipo
                ORDER BY total DESC
            """, (anio, mes))
            desglose = []
            for row in cursor.fetchall():
                desglose.append({
                    'categoria': row[0],
                    'color': row[1],
                    'icono': row[2],
                    'tipo': row[3],
                    'total': float(row[4]),
                    'cantidad': int(row[5])
                })

            # Gasto diario promedio
            cursor.execute("""
                SELECT COALESCE(AVG(daily_total), 0) FROM (
                    SELECT SUM(monto) AS daily_total
                    FROM transacciones
                    WHERE tipo = 'gasto' AND YEAR(fecha) = %s AND MONTH(fecha) = %s
                    GROUP BY fecha
                ) AS daily_totals
            """, (anio, mes))
            gasto_diario_promedio = float(cursor.fetchone()[0])

            return {
                'anio': anio,
                'mes': mes,
                'ingresos': ingresos,
                'gastos': gastos,
                'balance': ingresos - gastos,
                'total_transacciones': total_transacciones,
                'gasto_diario_promedio': gasto_diario_promedio,
                'desglose': desglose
            }
        finally:
            conn.close()
