import mongoose from 'mongoose';

const Schema = mongoose.Schema;

export const DosageSchema = new Schema({
    dose: {
        type: Number,
        default: 1
    },
    sendReminder: {
        type: Boolean,
        default: true
    },
    reminderTime: {
        type: Date
    }
});