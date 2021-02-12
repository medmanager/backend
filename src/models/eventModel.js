import mongoose from 'mongoose';

const Schema = mongoose.Schema;

export const EventSchema = new Schema({
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
        type: Boolean,
        default: false
    }
});