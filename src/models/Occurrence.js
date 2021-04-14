import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const OccurrenceSchema = new Schema({
    isTaken: {
        type: Boolean,
        default: false,
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

const Occurrence = mongoose.model("Occurrence", OccurrenceSchema);

export default Occurrence;
