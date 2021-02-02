import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const WeekdaySchema = new Schema({
    monday: {
        type: Boolean,
        default: false
    },
    tuesday: {
        type: Boolean,
        default: false
    },
    wednesday: {
        type: Boolean,
        default: false
    },
    thursday: {
        type: Boolean,
        default: false
    },
    friday: {
        type: Boolean,
        default: false
    },
    saturday: {
        type: Boolean,
        default: false
    },
    sunday: {
        type: Boolean,
        default: false
    },
});

export const FrequencySchema = new Schema({
    interval: {
        type: Number,
        default: 1
    },
    intervalUnit: {
        type: String,
        default: "days"
    },
    weekdays: {
        type: WeekdaySchema,
        required: true
    }
});