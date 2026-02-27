const express = require('express');
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
require('dotenv').config();

const pool = require('./config/db');
const { connectMongo, PatientHistory } = require('./config/mongo');

const app = express();
app.use(express.json());

// Conectar a MongoDB
connectMongo();

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

// --- RUTAS ---

app.get('/', (req, res) => res.send("API SaludPlus Funcionando 🚀"));

// RUTA DE MIGRACIÓN CORREGIDA
app.post('/api/migrate', upload.single('archivoExcel'), async (req, res) => {
    if (!req.file) return res.status(400).send('No se subió ningún archivo');

    try {
        const workbook = xlsx.readFile(req.file.path, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`Iniciando migración de ${data.length} filas...`);

        for (const row of data) {
            // --- 1. CORRECCIÓN DE FECHA ---
            let fechaFormateada = row.appointment_date;
            if (typeof fechaFormateada === 'number') {
                fechaFormateada = new Date((fechaFormateada - 25569) * 86400 * 1000);
            }
            if (fechaFormateada instanceof Date) {
                fechaFormateada = fechaFormateada.toISOString().split('T')[0];
            }

            // --- 2. MYSQL: SEGUROS ---
            let insuranceId = null;
            if (row.insurance_provider && row.insurance_provider !== 'SinSeguro') {
                const [ins] = await pool.query('SELECT id_insurance FROM Insurances WHERE name = ?', [row.insurance_provider]);
                if (ins.length > 0) {
                    insuranceId = ins[0].id_insurance;
                } else {
                    const [resIns] = await pool.query('INSERT INTO Insurances (name, coverage_percentage) VALUES (?, ?)',
                        [row.insurance_provider, row.coverage_percentage]);
                    insuranceId = resIns.insertId;
                }
            }

            // --- 3. MYSQL: MÉDICOS ---
            let doctorId;
            const [doc] = await pool.query('SELECT id_doctor FROM Doctors WHERE email = ?', [row.doctor_email]);
            if (doc.length > 0) {
                doctorId = doc[0].id_doctor;
            } else {
                const [resDoc] = await pool.query('INSERT INTO Doctors (name, email, specialty) VALUES (?, ?, ?)',
                    [row.doctor_name, row.doctor_email, row.specialty]);
                doctorId = resDoc.insertId;
            }

            // --- 4. MYSQL: PACIENTES ---
            let patientId;
            const [pat] = await pool.query('SELECT id_patient FROM Patients WHERE email = ?', [row.patient_email]);
            if (pat.length > 0) {
                patientId = pat[0].id_patient;
            } else {
                const [resPat] = await pool.query('INSERT INTO Patients (name, email, phone, address) VALUES (?, ?, ?, ?)',
                    [row.patient_name, row.patient_email, row.patient_phone, row.patient_address]);
                patientId = resPat.insertId;
            }

            // --- 5. MYSQL: CITAS ---
            const [appo] = await pool.query('SELECT id FROM Appointments WHERE appointment_id = ?', [row.appointment_id]);
            if (appo.length === 0) {
                await pool.query(
                    `INSERT INTO Appointments (appointment_id, appointment_date, id_patient, id_doctor, id_insurance, 
                    treatment_code, treatment_description, treatment_cost, amount_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [row.appointment_id, fechaFormateada, patientId, doctorId, insuranceId,
                    row.treatment_code, row.treatment_description, row.treatment_cost, row.amount_paid]
                );
            }

            // --- 6. MONGODB: HISTORIAL ---
            const appointmentData = {
                appointmentId: row.appointment_id,
                date: fechaFormateada,
                doctorName: row.doctor_name,
                specialty: row.specialty,
                treatmentDescription: row.treatment_description,
                amountPaid: row.amount_paid
            };

            await PatientHistory.findOneAndUpdate(
                { patientEmail: row.patient_email },
                {
                    $setOnInsert: { patientName: row.patient_name },
                    $addToSet: { appointments: appointmentData }
                },
                { upsert: true }
            );
        }
        res.json({ mensaje: "Migración completada exitosamente" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en la migración: " + error.message });
    }
});

// GET Médicos
app.get('/api/doctors', async (req, res) => {
    try {
        const { specialty } = req.query;
        let sql = 'SELECT * FROM Doctors';
        if (specialty) sql += ' WHERE specialty = ?';
        const [rows] = await pool.query(sql, specialty ? [specialty] : []);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET Reportes
app.get('/api/reports/revenue', async (req, res) => {
    try {
        const [totalRes] = await pool.query('SELECT SUM(amount_paid) as totalRevenue FROM Appointments');
        const [insuranceRes] = await pool.query(`
            SELECT IFNULL(i.name, 'Sin Seguro') as insurance, SUM(a.amount_paid) as total 
            FROM Appointments a LEFT JOIN Insurances i ON a.id_insurance = i.id_insurance GROUP BY i.id_insurance
        `);
        res.json({ totalGeneral: totalRes[0].totalRevenue, porAseguradora: insuranceRes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/patients/:email/history
app.get('/api/patients/:email/history', async (req, res) => {
    try {
        const history = await PatientHistory.findOne({ patientEmail: req.params.email });
        if (!history) return res.status(404).json({ mensaje: "Paciente no encontrado" });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));