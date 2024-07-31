const pool = require('./db');

async function testConnection() {
  try {
    const [rows, fields] = await pool.query('SELECT 1 + 1 AS solution');
    console.log('The solution is: ', rows[0].solution);
  } catch (err) {
    console.error('Error connecting to the database:', err);
  }
}

testConnection();
