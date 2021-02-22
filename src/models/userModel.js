import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MedicationSchema } from '../models/MedicationModel';
import { EventSchema } from '../models/eventModel';
import * as cron from 'node-cron';

const Schema = mongoose.Schema;

const Medication = mongoose.model('Medication', MedicationSchema);
const Event = mongoose.model('Event', EventSchema);

export const UserSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    hashPassword: {
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

UserSchema.methods.updateEvents = (medication) => {
    if (medication.frequency.intervalUnit == 'days') {
        /* Implement by medication.frequency.interval as every * days with DosageSchema for times */
        for (var dosage in medication.dosages) {
            var newEvent = new Event({
                medicationID : medication._id,
                timestamp: Date.now(),
                reminderTime: dosage.reminderTime,
                isTaken: false,
                job: cron.schedule(`${dosage.reminderTime.getMinutes()} ${dosage.reminderTime.getHours()} */${medication.frequency.interval} * ?`)
            });
            newEvent.save((err, event) => {
                if (err) {
                    console.log(err);
                }
            });
            self.currentEvents.push(newEvent);
        } 
    } else if (medication.frequency.intervalUnit == 'weeks') {
        /* Use WeekdaySchema with DosageSchema times */
        for (var dosage in medication.dosages) {
            let isFirst = true;
            for (var day in medication.frequency.weekdays.keys()) {
                // this will be implemented after refactoring the weekday schema
                // if ()
            }
            var newEvent = new Event({
                medicationID : medication._id,
                timestamp: Date.now(),
                reminderTime: dosage.reminderTime,
                isTaken: false,
                job: cron.schedule(`${dosage.reminderTime.getMinutes()} ${dosage.reminderTime.getHours()} */${medication.frequency.interval} * ?`)
            });
            newEvent.save((err, event) => {
                if (err) {
                    console.log(err);
                }
            });
            self.currentEvents.push(newEvent);
        }
    } else {
        console.log('Issue with medication.frequency.intervalUnit');
    }
}

UserSchema.methods.destroyEventsByMedication = (medication) => {
    for (var event in self.currentEvents) {
        if (event.medicationID == medication._id) {
            if (event.job != null) {
                event.job.destroy();
            }
        }
    }
}