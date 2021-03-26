import mongoose from "mongoose";
import { FrequencySchema } from "./Frequency";

const Schema = mongoose.Schema;

export const MedicationSchema = new Schema({
    name: {
        type: String,
        required: "Medication name is required",
    },
    notes: String,
    strength: {
        type: Number,
        required: true,
    },
    strengthUnit: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    amountUnit: {
        type: String,
        required: true,
    },
    frequency: {
        type: FrequencySchema,
        required: true,
    },
    dosages: [
        {
            type: Schema.Types.ObjectId,
            ref: "Dosage",
        },
    ],
    inactiveDosages: [
        {
            type: Schema.Types.ObjectId,
            ref: "Dosage",
        },
    ],
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
        type: Schema.Types.ObjectId,
        ref: "User",
    },
});
