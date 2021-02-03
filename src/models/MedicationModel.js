import mongoose from 'mongoose';
import {TimeSchema} from './TimeModel'
import {FrequencySchema} from './FrequencyModel'

const Schema = mongoose.Schema;

export const MedicationSchema = new Schema({
    name: {
        type: String,
        required: 'enter a medication name',
    },
    notes: String,
    dosage: {
        type: Number,
        required: true
    },
    dosageUnit: {
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
    times: {
        type: [TimeSchema],
        required: true
    },
    dateAdded: {
        type: Date,
        default: Date.now,
    },
});