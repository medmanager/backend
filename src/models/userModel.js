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

UserSchema.methods.updateEvents = (user, medication) => {
    if (medication.frequency.intervalUnit == 'days') {
        /* Implement by medication.frequency.interval as every * days with DosageSchema for times */
    } else if (medication.frequency.intervalUnit == 'weeks') {
        /* Use WeekdaySchema with DosageSchema times */
    } else {
        console.log('Issue with medication.frequency.intervalUnit');
    }
}