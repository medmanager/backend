import mongoose from 'mongoose';

const Schema = mongoose.Schema;

export const TimeSchema = new Schema({
    medicationAmount: {
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