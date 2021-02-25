import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const OccurrenceSchema = new Schema({
    job: {
        type: Object,
    },
    isTaken: {
        type: Boolean,
    },
    isComplete: {
        type: Boolean,
    },
    timeTaken: {
        type: Date,
    }
});

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
    },
    occurrences: {
        type: [OccurrenceSchema]
    }
});