import mongoose from 'mongoose';
import * as cron from 'node-cron';

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
    },
    job: {
        type: Object,
        required: false
    }
});