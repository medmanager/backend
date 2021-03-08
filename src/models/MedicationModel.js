import { ObjectId } from 'bson';
import mongoose from 'mongoose';
import {FrequencySchema} from './FrequencyModel'
import {DosageSchema} from './DosageModel';

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
    dosages: [{
        type: ObjectId,
        ref: 'Dosage'
    }],
    dateAdded: {
        type: Date,
        default: Date.now,
    },
    color: {
        type: Number,
    },
    active: {
        type: Boolean,
        default: true,
    },
    user: {
        type: ObjectId,
        ref: 'User'
    },
});