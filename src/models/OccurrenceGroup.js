import mongoose from "mongoose";

const Schema = mongoose.Schema;

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
    emergencyJobId: {
        //should we be using Schema.Types.ObjectId???
        type: Schema.Types.ObjectId,
        default: null,
    },
});

const OccurrenceGroup = mongoose.model(
    "OccurrenceGroup",
    OccurrenceGroupSchema
);
export default OccurrenceGroup;
