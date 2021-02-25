import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MedicationSchema } from '../models/MedicationModel';
import { EventSchema } from '../models/eventModel';


const Schema = mongoose.Schema;

const Event = mongoose.model('Event', EventSchema);

export const UserSchema = new Schema({
    email: {
        type: String,
        required: true
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

/* createEvents creates an event for every time the medication has to be admitted (currently just for the upcoming week)
   Params:
   User passed in
   Notes:
   -The function runs on all medications for the user passed in
   Future Implementation:
   -'days' intervalUnit value
   -Yearly updates instead of weekly
*/
UserSchema.methods.createEvents = () => {
    for (var medication in self.medications) {
        if (medication.frequency.intervalUnit == 'days') {
            /* Idea for implementation: implement 'days' by saving the previous week's data */
        } else if (medication.frequency.intervalUnit == 'weeks') {
            for (day in medication.frequency.weekdays.keys()) {
                if (medication.frequency.weekdays.day) {
                    var newEvent = new Event({
                        medicationID : medication._id,
                        timestamp: Date.now(),
                        reminderTime: dosage.reminderTime,
                        reminderDay: day,
                        isTaken: false,
                    });
                    newEvent.save((err, event) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                    self.currentEvents.push(newEvent);
                    self.save((err, user) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                }
            }
        } else {
            console.log('Problem with self.frequency.intervalUnit');
        }
    }
}

/* Destorys ALL events associated with a certain medication
    Params:
    -Medication whose events need to be destroyed
    -User passed in
    Notes:
    -Removes the item from the user's currentEvents list and from the database
    Future Implementation:
    Check to make sure the medication is under the user?
*/
UserSchema.methods.destroyEventsByMedication = (medication) => {
    for (var event in self.currentEvents) {
        if (event.medicationID == medication._id) {
            self.currentEvents.slice(self.currentEvents.indexOf(event));
            Event.findOneAndRemove({ id: event._id }, (err) => {
                if (err) {
                    console.log(err);
                }
            });
        }
    }
    for (dosage in medication.dosages) {
        if (dosage.job != null) {
            dosage.job.destroy();
        }
    }
}

/* To be used in future implementation:
var isFirst = true;
var dayString = '';
for (var day in self.frequency.weekdays.keys()) {
    if (weekdays.day) {
        if (isFirst) {
            dayString.concat(day.slice(0, 3));
        } else {
            dayString.concat(',' + day.slice(0, 3));
        }
    }
} */