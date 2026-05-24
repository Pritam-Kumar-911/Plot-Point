const { Pool } = require("pg");

const pool = new Pool({
  host: "127.0.0.1",
  port: 5433, 
  user: "postgres",
  password: "postgres",
  database: "postgres",
//   ssl: false,
//   connectionTimeoutMillis: 5000,
});

module.exports = pool;

// const { Pool } = require("pg");

// const pool = new Pool({
//   connectionString: "postgresql://postgres@127.0.0.1:5432/postgres"
// });

// module.exports = pool;