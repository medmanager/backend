import mongoose from "mongoose";

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
        type: Schema.Types.ObjectId,
        ref: "Dosage",
    },
    group: {
        type: Schema.Types.ObjectId,
        ref: "OccurrenceGroup",
    },
});

export const OccurrenceGroupSchema = new Schema({
    occurrences: [
        {
            type: Schema.Types.ObjectId,
            ref: "Occurrence",
        },
    ],
    scheduledDate: {
        type: Date,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
});
