import bcrypt from "bcrypt";
import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    hashPassword: {
        type: String,
        required: true,
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    medications: [
        {
            type: Schema.Types.ObjectId,
            ref: "Medication",
        },
    ],
});

UserSchema.methods.comparePassword = (password, hashPassword) => {
    return bcrypt.compareSync(password, hashPassword);
};
