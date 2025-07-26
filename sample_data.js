const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('bank_data.db');

db.serialize(() => {
  db.run("INSERT INTO customers (name) VALUES (?)", ['ellie']);
  db.run("INSERT INTO customers (name) VALUES (?)", ['dina']);

  db.run("INSERT INTO loans (customer_id, principal_amount, rate_of_interest, loan_period_years, total_amount, emi) VALUES (?, ?, ?, ?, ?, ?)",
    [1, 100000, 0.08, 2, 116000, 4833.33]);
  db.run("INSERT INTO loans (customer_id, principal_amount, rate_of_interest, loan_period_years, total_amount, emi) VALUES (?, ?, ?, ?, ?, ?)",
    [2, 50000, 0.1, 1, 55000, 4583.33]);

  db.run("INSERT INTO payments (loan_id, payment_type, amount_paid, payment_date) VALUES (?, ?, ?, ?)",
    [1, 'EMI', 4833.33, '2025-07-01']);
  db.run("INSERT INTO payments (loan_id, payment_type, amount_paid, payment_date) VALUES (?, ?, ?, ?)",
    [2, 'LUMP_SUM', 10000, '2025-07-15']);
  db.run("INSERT INTO payments (loan_id, payment_type, amount_paid, payment_date) VALUES (?, ?, ?, ?)",
    [2, 'EMI', 4583.33, '2025-07-01']);
});

db.close();
