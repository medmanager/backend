import bcrypt from "bcrypt";
import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const SettingsSchema = new Schema({
    notificationSettings: {
        silenceAll: {
            type: Boolean,
            default: false,
        },
        hideMedName: {
            type: Boolean,
            default: true,
        },
    },
    hasCaregiverContact: {
        type: Boolean,
        default: false,
    },
    caregiverContact: {
        name: {
            type: String,
        },
        // phone numbers must be formatted as "+1*insert 10-digit phone number here*" in order to work
        // with twilio's messaging service
        phoneNumber: {
            type: String,
        },
    },
});

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
    deviceInfo: {
        token: {
            type: String,
        },
        os: {
            type: String,
        },
    },
    lastScheduled: {
        type: Date,
        default: Date.now,
    },
    settings: {
        type: SettingsSchema,
    },
});

UserSchema.methods.comparePassword = (password, hashPassword) => {
    return bcrypt.compareSync(password, hashPassword);
};
