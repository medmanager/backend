import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const DosageSchema = new Schema({
    dose: {
        type: Number,
        default: 1,
    },
    sendReminder: {
        type: Boolean,
        default: true,
    },
    reminderTime: {
        type: Date,
    },
    occurrences: [
        {
            type: Schema.Types.ObjectId,
            ref: "Occurrence",
        },
    ],
    medication: {
        type: Schema.Types.ObjectId,
        ref: "Medication",
    },
    active: {
        type: Boolean,
        default: true,
    },
    //date dosage is marked as inactive, can be used to clear out old dosages
    //if the inactive date is more than 2 weeks ago as an example
    inactiveDate: {
        type: Date,
    },
});

const Dosage = mongoose.model("Dosage", DosageSchema);
export default Dosage;
