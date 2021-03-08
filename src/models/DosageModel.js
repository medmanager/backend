import { ObjectId } from 'bson';
import mongoose from 'mongoose';

const Schema = mongoose.Schema;

export const OccurrenceSchema = new Schema({
    isTaken: {
        type: Boolean,
    },
    isComplete: {
        type: Boolean,
    },
    timeTaken: {
        type: Date,
    },
    scheduledDate: {
        type: Date,
    }, 
    dosage: {
        type: ObjectId,
        ref: 'Dosage'
    },
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
    occurrences: [{
        type: ObjectId,
        ref: 'Occurrence'
    }],
    medication: {
        type: ObjectId,
        ref: 'Medication'
    }
});