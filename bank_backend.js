const {open} = require('sqlite')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()
const express = require('express')
const { error } = require('console')
const app = express()
app.use(express.json())

const dataBasePath = path.join(__dirname, 'bank_data.db')

var db = null

const initializingDataBase = async() => {
    try{
        db = await open({
            filename: dataBasePath,
            driver: sqlite3.Database
        })

         await db.exec(`
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            );
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS loans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                principal_amount REAL,
                loan_period_years INTEGER,
                rate_of_interest REAL,
                total_interest REAL,
                total_amount REAL,
                emi REAL,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            );
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                loan_id INTEGER,
                payment_type TEXT CHECK(payment_type IN ('EMI', 'LUMP_SUM')),
                amount_paid REAL,
                payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (loan_id) REFERENCES loans(id)
            );
        `);

        app.listen(3000,()=>{
            console.log("server running");
        })

    } catch(e) {
        console.log(`DB ERROR : ${e.message}`)
        process.exit(1);
    }
}

initializingDataBase()

//create customer
app.post('/customer', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).send({ error: "Name is required" });

        const result = await db.run(`INSERT INTO customers (name) VALUES (?)`, [name]);
        res.status(201).json({ id: result.lastID, name });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

//lend
app.post('/lend', async (req, res) => {
    try {
        const { customer_id, principal_amount, loan_period_years, rate_of_interest } = req.body;

        const rate = rate_of_interest / 100;
        const total_interest = principal_amount * rate * loan_period_years;
        const total_amount = principal_amount + total_interest;
        const emi = total_amount / (loan_period_years * 12);

        await db.run(
            `INSERT INTO loans (customer_id, principal_amount, rate_of_interest, loan_period_years, total_interest, total_amount, emi)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [customer_id, principal_amount, rate_of_interest, loan_period_years, total_interest, total_amount, emi]
        );

        res.status(201).json({ message: "Loan added successfully." });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


//payment
app.post('/payment', async (req, res) => {
    try {
        const { loan_id, payment_type, amount_paid } = req.body;

        const loan = await db.get(`SELECT total_amount FROM loans WHERE id = ?`, [loan_id]);
        if (!loan) return res.status(404).send({ error: "Loan not found" });

        await db.run(`
            INSERT INTO payments (loan_id, payment_type, amount_paid)
            VALUES (?, ?, ?)
        `, [loan_id, payment_type, amount_paid]);

        const payments = await db.all(`SELECT SUM(amount_paid) AS total_paid FROM payments WHERE loan_id = ?`, [loan_id]);
        const total_paid = payments[0].total_paid || 0;
        const remaining = loan.total_amount - total_paid;

        res.send({ loan_id, payment_type, amount_paid, remaining });
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

//ledger
app.get('/ledger', async (req, res) => {
    try {
        const { customer_id, loan_id } = req.query;

        const loan = await db.get(`SELECT * FROM loans WHERE id = ? AND customer_id = ?`, [loan_id, customer_id]);

        if (!loan) {
            return res.status(404).send({ error: "Loan not found" });
        }

        const payments = await db.all(`SELECT * FROM payments WHERE loan_id = ?`, [loan_id]);
        const result = await db.get(`SELECT SUM(amount_paid) as total_paid FROM payments WHERE loan_id = ?`, [loan_id]);
        const totalPaid = result.total_paid || 0;

        const balance = loan.total_amount - totalPaid;
        const emisLeft = Math.ceil(balance / loan.emi);

        res.send({
            loan_id,
            customer_id,
            total_amount: loan.total_amount,
            emi: loan.emi,
            balance,
            emis_left: emisLeft,
            payments
        });

    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

// account-overview
app.get('/account-overview/:customer_id', async (req, res) => {
    try {
        const { customer_id } = req.params;

        const loans = await db.all(
            `SELECT * FROM loans WHERE customer_id = ?`, [customer_id]
        );

        const overview = [];

        for (const loan of loans) {
            const payments = await db.all(
                `SELECT amount_paid FROM payments WHERE loan_id = ?`,
                [loan.id]
            );

            const totalPaid = payments.reduce((sum, p) => sum + p.amount_paid, 0);
            const balanceAmount = loan.total_amount - totalPaid;
            const emiLeft = Math.ceil(balanceAmount / loan.emi);

            overview.push({
                loan_id: loan.id,
                principal_amount: loan.principal_amount,
                total_interest: loan.total_amount - loan.principal_amount,
                total_amount: loan.total_amount,
                emi: loan.emi,
                amount_paid_till_now: totalPaid,
                emi_remaining: emiLeft
            });
        }

        res.json(overview);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
