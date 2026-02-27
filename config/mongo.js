const mongoose = require('mongoose');
require('dotenv').config();

const connectMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Conectado');
    } catch (error) {
        console.error('❌ Error Mongo:', error);
    }
};

// Definimos el esquema de una vez aquí
const PatientHistorySchema = new mongoose.Schema({
    patientEmail: { type: String, required: true, unique: true },
    patientName: String,
    appointments: [{
        appointmentId: String,
        date: String,
        doctorName: String,
        specialty: String,
        treatmentDescription: String,
        amountPaid: Number
    }]
});

const PatientHistory = mongoose.model('PatientHistory', PatientHistorySchema);

module.exports = { connectMongo, PatientHistory };