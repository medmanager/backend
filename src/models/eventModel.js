import mongoose from 'mongoose';

const Schema = mongoose.Schema;

export const eventSchema = new Schema({
    medicationID: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        required: true
    },
    reminderTime: {
        type: Date,
        required: true
    },
    isTaken: {
        type: boolean,
        default: false
    }
});