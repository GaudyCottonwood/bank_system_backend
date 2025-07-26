const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('bank_data.db');

db.all("SELECT * FROM customers;", [], (err, rows) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log(rows);
  }
  db.close();
});
