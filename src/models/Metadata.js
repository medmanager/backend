import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const MetadataSchema = new Schema({
    name: String,
    lastScheduledAt: Date,
});

const Metadata = mongoose.model("Metadata", MetadataSchema);

export default Metadata;
