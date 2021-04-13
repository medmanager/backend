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

const Settings = mongoose.model("Settings", SettingsSchema);
export default Settings;
