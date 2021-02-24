import mongoose from 'mongoose';
import {DosageSchema} from './DosageModel'
import {FrequencySchema} from './FrequencyModel'

const Schema = mongoose.Schema;

export const MedicationSchema = new Schema({
    name: {
        type: String,
        required: 'enter a medication name',
    },
    notes: String,
    strength: {
        type: Number,
        required: true
    },
    strengthUnit: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    amountUnit: {
        type: String,
        required: true
    },
    frequency: {
        type: FrequencySchema,
        required: true
    },
    dosages: {
        type: [DosageSchema],
        required: true
    },
    dateAdded: {
        type: Date,
        default: Date.now,
    },
});

// Schedules a cron job to send notification 
MedicationSchema.methods.scheduleDosage = (dosage) => {
    if (dosage.sendReminder) {
        if (self.frequency.intervalUnit == 'days') {
            dosage.job = cron.schedule(`${dosage.reminderTime.getMinutes()} ${dosage.reminderTime.getHours()} */${medication.frequency.interval} * ?`);
        } else if (self.frequency.intervalUnit == 'weeks') {
            dosage.job = cron.schedule();
        }
    }
}