-- =============================================
-- Registro de Gastos Personales - Schema SQL
-- Base de datos: MariaDB
-- =============================================

CREATE DATABASE IF NOT EXISTS gastos_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gastos_db;

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    icono VARCHAR(30) NOT NULL,
    color VARCHAR(7) NOT NULL
) ENGINE=InnoDB;

-- Tabla de transacciones
CREATE TABLE IF NOT EXISTS transacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('ingreso', 'gasto') NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    descripcion VARCHAR(255),
    categoria_id INT NOT NULL,
    fecha DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Datos iniciales: Categorías predefinidas
INSERT IGNORE INTO categorias (id, nombre, icono, color) VALUES
    (1, 'Alimentación', 'utensils', '#FF6B6B'),
    (2, 'Transporte', 'car', '#4ECDC4'),
    (3, 'Entretenimiento', 'gamepad-2', '#45B7D1'),
    (4, 'Salud', 'heart-pulse', '#96CEB4'),
    (5, 'Educación', 'graduation-cap', '#FFEAA7'),
    (6, 'Servicios', 'zap', '#DDA0DD'),
    (7, 'Vivienda', 'home', '#F0A500'),
    (8, 'Ropa', 'shirt', '#E056A0'),
    (9, 'Salario', 'banknote', '#00D2FF'),
    (10, 'Freelance', 'laptop', '#7C3AED'),
    (11, 'Inversiones', 'trending-up', '#10B981'),
    (12, 'Otros', 'ellipsis', '#A0AEC0');

-- Datos de ejemplo (opcional, se pueden eliminar)
INSERT INTO transacciones (tipo, monto, descripcion, categoria_id, fecha) VALUES
    ('ingreso', 15000.00, 'Salario quincenal', 9, CURDATE()),
    ('gasto', 350.50, 'Despensa semanal', 1, CURDATE()),
    ('gasto', 200.00, 'Gasolina', 2, CURDATE()),
    ('gasto', 150.00, 'Netflix y Spotify', 3, CURDATE()),
    ('gasto', 500.00, 'Consulta médica', 4, CURDATE()),
    ('ingreso', 3000.00, 'Proyecto freelance', 10, DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
    ('gasto', 1200.00, 'Luz y agua', 6, DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
    ('gasto', 89.00, 'Café y lunch', 1, DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
    ('gasto', 250.00, 'Uber semanal', 2, DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
    ('ingreso', 500.00, 'Rendimiento inversión', 11, DATE_SUB(CURDATE(), INTERVAL 7 DAY));
