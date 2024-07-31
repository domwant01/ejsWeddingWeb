const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '654321',
  database: 'wedding_rental'
});

module.exports = pool;
