import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MedicationSchema } from '../models/MedicationModel';
import { EventSchema } from '../models/eventModel';


const Schema = mongoose.Schema;

const Event = mongoose.model('Event', EventSchema);

export const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    hashPassword: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    created_date: {
        type: Date,
        default: Date.now
    },
    medications: {
        type: [MedicationSchema],
        default: []
    },
    currentEvents: {
        type: [EventSchema],
        default: []
    }
});

UserSchema.methods.comparePassword = (password, hashPassword) => {
    return bcrypt.compareSync(password, hashPassword);
};