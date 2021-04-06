import mongoose from "mongoose";

const Schema = mongoose.Schema;

const MetadataSchema = new Schema({
    name: String,
    lastScheduledAt: Date,
});

export const Metadata = mongoose.model("Metadata", MetadataSchema);
