import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'splitwise_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true // Allowed for schema.sql initialization
};

let pool = null;
let isDbInitialized = false;

export async function getDbPool() {
  if (pool) return pool;

  try {
    // Attempt connecting directly with the database target
    pool = mysql.createPool(dbConfig);
    
    // Quick ping to check connectivity
    const connection = await pool.getConnection();
    console.log('\n=========================================');
    console.log('✅ DATABASE CONNECTED SUCCESSFULLY!');
    console.log(`Connected to MySQL at ${dbConfig.host}:${dbConfig.port}`);
    console.log('=========================================\n');
    connection.release();

    // Auto-run schema.sql to initialize tables if they don't exist
    await initializeDatabase();
    
    return pool;
  } catch (error) {
    console.error('\n❌ DATABASE CONNECTION FAILURE!');
    console.error(`Error details: ${error.message}`);
    console.log('\n=========================================');
    console.log('Oracle Cloud Ubuntu VM Connectivity Guide:');
    console.log('1. Verify host IP in "backend/.env": currently:', dbConfig.host);
    console.log('2. Ensure MySQL is running on your VM: "sudo systemctl status mysql"');
    console.log('3. Ensure MySQL listens on all interfaces (0.0.0.0) in "/etc/mysql/mysql.conf.d/mysqld.cnf"');
    console.log('4. Ensure Oracle VCN Security Lists have Ingress Rule: TCP Port 3306 from your current IP (or 0.0.0.0/0)');
    console.log('5. Ensure Ubuntu VM firewall allows MySQL: "sudo ufw allow 3306/tcp"');
    console.log('=========================================\n');
    
    pool = null;
    throw error;
  }
}

async function initializeDatabase() {
  if (isDbInitialized) return;
  
  try {
    const connection = await pool.getConnection();
    
    // Check if a sample table like 'users' exists
    const [rows] = await connection.query("SHOW TABLES LIKE 'users'");
    
    if (rows.length === 0) {
      console.log('📦 Database tables not found. Initializing schema.sql...');
      const schemaPath = path.join(__dirname, '../db/schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      await connection.query(schemaSql);
      console.log('✅ Database schema initialized successfully!');
    } else {
      console.log('✨ Database tables already exist. Skipping initialization.');
    }
    
    connection.release();
    isDbInitialized = true;
  } catch (error) {
    console.error('❌ Failed to auto-initialize database tables:', error.message);
  }
}

// Export a query helper to run SQL easily across components
export async function query(sql, params) {
  const activePool = await getDbPool();
  try {
    const [results] = await activePool.execute(sql, params);
    return results;
  } catch (err) {
    console.error(`Database query error: ${err.message}\nSQL: ${sql}`);
    throw err;
  }
}
