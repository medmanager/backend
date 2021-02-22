import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MedicationSchema } from '../models/MedicationModel';
import { EventSchema } from '../models/eventModel';

const Schema = mongoose.Schema;

export const UserSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    hashPassword: {
        type: String,
        required: true
    },
    created_date: {
        type: Date,
        default: Date.now
    },
    medications: {
        type: [MedicationSchema],
        default: []
    },
    currentEvents: {
        type: [EventSchema],
        default: []
    }
});

UserSchema.methods.comparePassword = (password, hashPassword) => {
    return bcrypt.compareSync(password, hashPassword);
};

UserSchema.methods.updateEvents = (medication) => {
    let relevantMedication = Medication.findByID({ _id: medication.medicationID })
}