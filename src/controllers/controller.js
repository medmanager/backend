import mongoose from 'mongoose';
import { MedicationSchema } from '../models/MedicationModel';
import { UserSchema } from '../models/userModel';
import { EventSchema } from '../models/eventModel';
import { sendNotification } from '../controllers/cronController';
import https from 'https';
import _ from 'lodash';
import * as cron from 'node-cron';

const Medication = mongoose.model('Medication', MedicationSchema);
const User = mongoose.model('User', UserSchema);
const Event = mongoose.model('Event', EventSchema);

// add a new medication
export const addNewMedication = (req, res) => {
    let newMedication = new Medication(req.body);
    newMedication.updateEvents();
    let relevantUser = User.findById(req.params.userID, (err, user) => {
        if (err) {
            res.send(err);
        } else {
            user.medications.push(newMedication);
            
            let arr = [];
            for (var day in newMedication.frequency.weekdays) {
                // console.log(newMedication.frequency.weekdays[day]);
                let i;
                for (i = 0; i < newMedication.frequency.interval; i++) {
                    arr.push(`* ${9 + i * 8 / newMedication.frequency.interval} * * ${day}`);
                }
                arr.forEach((time, index) => {
                    cron.schedule(time, sendNotification);
                });
            }

            user.save((err, user) => {
                newMedication.save((err, medication) => {
                    if (err) {
                        res.send(err);
                    } else {
                        res.json(medication);
                    }
                });
            });
        }
    });
};

export const getMedications = (req, res) => {
    User.findOne({ _id: req.params.userID }, (err, user) => {
        if (err) {
            res.send(err);
        } else {
            res.send(user.medications);
        }
    });
    // User.findById(req.params.userID, (err, user) => {
    //     if (err) {
    //         res.send(err);
    //     } else {
    //         res.json(user);
    //     }
        
    // });
};

//Potentially useful in the future? This method should work if implemented as is, just not sure if it's necessary

export const getMedicationFromID = (req, res) => {
    Medication.findById(req.params.medicationID, (err, medication) => {
        if (err) {
            res.send(err);
        } else {
            res.send(medication);
        }
    });
};

// Should still work as is
export const updateMedicationFromID = (req, res) => {
    Medication.findOneAndUpdate({_id: req.params.medicationID}, req.body, {new: true, useFindAndModify: false}, (err, medication) => {
        if (err) {
            res.send(err);
        } else {
            res.json(medication);
        }
    });
};

// Should still work as is
export const deleteMedicationFromID = (req, res) => {
    // console.log("swag zone"); ultra helpful debugging string
    let relevantUser = User.findById(req.params.userID, (err, user) => {
        if (err) {
            res.send(err);
        } else {
            let relevantMedication = Medication.findById(req.params.medicationID, (err, user) => {
                if (err) {
                    res.send(err);
                }
            });
            user.medications.splice(user.medications.indexOf(relevantMedication));
            user.save((err, user) => {
                if (err) {
                    res.send(err);
                } else {
                    Medication.remove({_id: req.params.medicationID}, (err, medication) => {
                        if (err) {
                            res.send(err);
                        }
                        res.json({ message: 'successfully deleted medication'});
                    });
                }
            })
        }
    });
};

export const fuzzySearchWithString = (req, res) => {
    let searchStr = req.params.searchStr;
    console.log('REST/spellingsuggestions.json?name=' + searchStr);

    const req2 = https.request(
        {
            hostname: 'rxnav.nlm.nih.gov', 
            path: '/REST/spellingsuggestions.json?name=' + searchStr //append searchStr to path
        }, res2 => {
            let data = "";
            res2.on('data', d => {
                data += d;
            });
            res2.on('end', () => {
                let respData = JSON.parse(data);
                let matches = [];
                let length = respData.suggestionGroup.suggestionList.suggestion.length;
                //max length to return is 5
                length = length < 5 ? length : 5;
                let i;
                for (i = 0; i < length; i++) {
                    matches.push(respData.suggestionGroup.suggestionList.suggestion[i]);
                }
                //We could just return respData.suggestionGroup.suggestionList...
                //but if we want to do any further searching on the matches, it
                //is easier if they are in an accessible array
                res.json(matches);
            });
        });
    req2.on('error', error => {
        res.send(error);
    })
    req2.end();
};

//made for debugging purposes
export const deleteMedications = (req, res) => {
    Medication.remove({}, (err) => {
        if (err) {
            res.send(err);
        }
        res.json({ message: 'successfully deleted ALL medications'});
    });
};

export const confirmMedication = (req, res) => {
    let newEvent = new Event(req.body);
    let relevantUser = User.findById(req.params.userID, (err, user) => {
        if (err) {
            res.send(err);
        } else {
            user.currentEvents.push(newEvent);
            user.save((err, user) => {
                if (err) {
                    res.send(err);
                }
            });
        }
    });
}