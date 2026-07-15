const { Pool } = require("pg");

const pool = new Pool({
  host: "postgres-cont",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "postgres",
});

module.exports = pool;

// const { Pool } = require("pg");

// const pool = new Pool({
//   connectionString: "postgresql://postgres@127.0.0.1:5432/postgres"
// });

// module.exports = pool;
