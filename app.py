"""
app.py - Servidor Flask para el Registro de Gastos Personales
API REST que conecta el frontend con MariaDB.
"""

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, render_template, request, jsonify
from database import Database
from datetime import date

app = Flask(__name__)
db = Database()


# ========== PÁGINA PRINCIPAL ==========

@app.route('/')
def index():
    """Sirve la página principal (SPA)."""
    return render_template('index.html')


# ========== API: CATEGORÍAS ==========

@app.route('/api/categorias', methods=['GET'])
def api_categorias():
    """Obtiene todas las categorías disponibles."""
    try:
        categorias = db.get_categorias()
        return jsonify(categorias)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API: TRANSACCIONES ==========

@app.route('/api/transacciones', methods=['GET'])
def api_get_transacciones():
    """Obtiene transacciones con filtros opcionales."""
    try:
        tipo = request.args.get('tipo')
        categoria_id = request.args.get('categoria_id')
        fecha_inicio = request.args.get('fecha_inicio')
        fecha_fin = request.args.get('fecha_fin')
        limit = request.args.get('limit', 50)
        offset = request.args.get('offset', 0)

        transacciones = db.get_transacciones(
            tipo=tipo,
            categoria_id=categoria_id,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            limit=limit,
            offset=offset
        )
        return jsonify(transacciones)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/transacciones', methods=['POST'])
def api_crear_transaccion():
    """Crea una nueva transacción."""
    try:
        data = request.get_json()

        # Validaciones
        required = ['tipo', 'monto', 'categoria_id', 'fecha']
        for field in required:
            if field not in data or not data[field]:
                return jsonify({'error': f'El campo "{field}" es obligatorio'}), 400

        if data['tipo'] not in ('ingreso', 'gasto'):
            return jsonify({'error': 'El tipo debe ser "ingreso" o "gasto"'}), 400

        try:
            monto = float(data['monto'])
            if monto <= 0:
                return jsonify({'error': 'El monto debe ser mayor a 0'}), 400
        except ValueError:
            return jsonify({'error': 'Monto inválido'}), 400

        transaccion = db.crear_transaccion(
            tipo=data['tipo'],
            monto=monto,
            descripcion=data.get('descripcion', ''),
            categoria_id=data['categoria_id'],
            fecha=data['fecha']
        )
        return jsonify(transaccion), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/transacciones/<int:id>', methods=['PUT'])
def api_actualizar_transaccion(id):
    """Actualiza una transacción existente."""
    try:
        data = request.get_json()

        required = ['tipo', 'monto', 'categoria_id', 'fecha']
        for field in required:
            if field not in data or not data[field]:
                return jsonify({'error': f'El campo "{field}" es obligatorio'}), 400

        if data['tipo'] not in ('ingreso', 'gasto'):
            return jsonify({'error': 'El tipo debe ser "ingreso" o "gasto"'}), 400

        try:
            monto = float(data['monto'])
            if monto <= 0:
                return jsonify({'error': 'El monto debe ser mayor a 0'}), 400
        except ValueError:
            return jsonify({'error': 'Monto inválido'}), 400

        transaccion = db.actualizar_transaccion(
            transaccion_id=id,
            tipo=data['tipo'],
            monto=monto,
            descripcion=data.get('descripcion', ''),
            categoria_id=data['categoria_id'],
            fecha=data['fecha']
        )
        if transaccion is None:
            return jsonify({'error': 'Transacción no encontrada'}), 404
        return jsonify(transaccion)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/transacciones/<int:id>', methods=['DELETE'])
def api_eliminar_transaccion(id):
    """Elimina una transacción."""
    try:
        eliminado = db.eliminar_transaccion(id)
        if not eliminado:
            return jsonify({'error': 'Transacción no encontrada'}), 404
        return jsonify({'message': 'Transacción eliminada correctamente'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API: DASHBOARD ==========

@app.route('/api/dashboard', methods=['GET'])
def api_dashboard():
    """Obtiene los datos para el dashboard."""
    try:
        data = db.get_dashboard()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API: REPORTES ==========

@app.route('/api/reportes/mensual', methods=['GET'])
def api_reporte_mensual():
    """Obtiene el reporte mensual."""
    try:
        anio = request.args.get('anio', type=int)
        mes = request.args.get('mes', type=int)
        data = db.get_reporte_mensual(anio=anio, mes=mes)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== MAIN ==========

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
