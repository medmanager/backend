import mongoose from 'mongoose';
import {TimeSchema} from './TimeModel'

const Schema = mongoose.Schema;

export const MedicationSchema = new Schema({
    name: {
        type: String,
        required: 'enter a medication name',
    },
    description: String,
    times: [TimeSchema],
    dateAdded: {
        type: Date,
        default: Date.now,
    },
});