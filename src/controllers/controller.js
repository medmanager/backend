import mongoose from 'mongoose';
import { MedicationSchema } from '../models/MedicationModel';
import { UserSchema } from '../models/userModel';
import { DosageSchema } from '../models/DosageModel';
import https from 'https';
import _ from 'lodash';
import { scheduleNewMedication } from './cronController';

const Medication = mongoose.model('Medication', MedicationSchema);
const User = mongoose.model('User', UserSchema);
const Dosage = mongoose.model('Dosage', DosageSchema);

// add a new medication
export const addNewMedication = (req, res) => {
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
    let newMedication = new Medication(req.body);
    User.findById(req.user, (err, user) => {
        if (err) {
            res.send(err);
        } else {
            user.medications.push(newMedication);

            //schedule new occurrences for this week
            //and save user
            let resp = scheduleNewMedication(user, newMedication);
            if (resp.error) res.send(resp.message);
            else res.json(newMedication);
        }
    });
};

export const getMedications = (req, res) => {
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
    User.findOne({ _id: req.user }, (err, user) => {
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
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
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
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
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
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
    User.findById(req.user, (err, user) => {
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

/**
 * returns an array of dosages independent of medications
 */
export const getDosages = (req, res) => {
    let userId = req.user;
    if (userId == null) {
        res.send({error: true, message: "token invalid: cannot get user"});
        return;
    }
    return User.findById({_id: userId}, (err, user) => {
        if (err) {
            res.json({error: true, message: "cannot find user!"});
        } else {
            let dosages = [];
            user.medications.forEach(med => {
                med.dosages.forEach(dosage => {
                    dosages.push(dosage);
                });
            });
            res.json({error: false, dosages: dosages});
        }
    });
};

/**
 * Function to get weekly occurrences of all medications
 * 2 parameters in body:
 * @param startDate : DateTime object containing start date to find occurrences for
 * @param endDate : DateTime object marking the end date in the range of the occurrences
 */
export const getOccurrences = async (req, res) => {
    let startDate;
    let endDate;
    let userId;

    userId = req.user;
    startDate = req.body.startDate;
    endDate = req.body.endDate;

    if (userId == null) {
        res.send({error: true, message: "token invalid: cannot get user"});
        return;
    }
    let user = await getUser(userId);
    if (user.error) { 
        res.send(user);
        return;
    }

    let scheduledDays = getScheduledDays(user, startDate, endDate);

    let orderedDays = [];

    //order scheduled days by time instead of medication
    scheduledDays.forEach(day => {
        let orderMeds = [];
        day.forEach(med => {
            med.datesWTime.forEach(dose => {
                let i = 0;
                //find index in orderMeds to append new entry
                while (i < orderMeds.length && dose.date.getTime() > orderMeds[i].date.getTime())
                    i++;
                orderMeds.splice(i, 0, {medicationId: med.medicationId, dosageId: dose.dosageId, date: dose.date});
            });
        });
        //push ordered array to day index in orderedDays
        orderedDays.push(orderMeds);
    });
    
    res.json(orderedDays);
}

/*function to post when a medication is taken */
export const addOccurrence = (req, res) => {
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
    let userId = req.user;
    let occurrence = req.body.occurrence;
    let dosageId = req.body.occurrence.dosageId;
    let occurrenceToSave = {
        id: occurrenceId,
        timeTaken: occurrence.timeTaken,
        isTaken: occurrence.isTaken,
        isComplete: true,
    };

    Dosage.findById({_id: occurrence.id}, (err, dosage) => {
        if (err) {
            res.send({error: true, message: "cannot find dosage!"});
        } else {
            //find the occurrence we need to update
            let updated = false;
            dosage.occurrences.forEach(occurrence => {
                if (occurrence._id == occurrenceToSave._id) {
                    occurrence = occurrenceToSave;
                    updated = true;
                }
            });
            if (!update) res.send({error: true, message: "occurrence doesn't exist!"});
            dosage.save((err) => {
                if (err) res.send({error: true, message: "occurrence cannot be saved!"});
            });
            //TODO: CANCEL NOTIFICATION
            res.send({error: false});
        }
    });
};

/*
* Function returns an array of days indexed from 0 (startDay) to (endDay - 1)
* Inside each array, there are arrays of all the medications that are scheduled to be
* taken that day. Inside the each medication object within the array, there is an array
* that has the specific DateTime the medication needs to be taken. It also has the 
* dosageId.
*/
export const getScheduledDays = (user, startDate, endDate) => {
    //set end date to next saturday
    if (endDate == null) {
        endDate = new Date();
        let day = endDate.getDay();
        //add remaining days in the week in millis
        endDate = new Date(endDate.getTime() + ((6 - day)*24*3600*1000));
    }
    //set start date to last sunday (or today if today is sunday)
    if (startDate == null) {
        startDate = new Date();
        let day = startDate.getDay();
        //sunday is index 0 so subtract current day in millis
        startDate = new Date(startDate.getTime() - (day)*24*3600*1000);
    }
    let scheduledDays = [];

    //ceil both startDate and endDate to the endOfDay (avoids indexing issues later)
    startDate = new Date(startDate.getTime());
    startDate.setHours(23,59,59,999);
    endDate = new Date(endDate.getTime());
    endDate.setHours(23,59,59,999);

    //get number of milliseconds between start date and end date
    let days = endDate.getTime() - startDate.getTime();
    //divide by number of milliseconds in one day and ceil
    days = Math.ceil(days / (1000 * 3600 * 24));
    //create entries in scheduledDays array for each day inbetween
    for(let x = 0; x <= days; x++) {
        scheduledDays.push([]);
    }
    if (user.medications == null) return scheduledDays;
    user.medications.forEach(med => {
        let start = med.dateAdded;
        //get number of milliseconds between start date and end date
        let daysbetween = endDate.getTime() - start.getTime();
        //divide by number of milliseconds in one day and ceil
        daysbetween = Math.ceil(daysbetween / (1000 * 3600 * 24));
        //start may not be startDate so create an offset
        let offset = 0;
        offset = startDate.getTime() - start.getTime();
        offset = Math.floor(offset / (1000 * 3600 * 24));
        //loop over days from start and only include them if they are after startDate
        if (med.frequency.intervalUnit == "days") {
            for (let i = 0; i < daysbetween; i+=med.frequency.interval) {
                if ((daysbetween - i) > days + 1) {
                    //day is before start so just continue looping
                    continue;
                }
                let daysbetween_m = i * (1000*3600*24);
                //find actual date to take medication
                let dateToTake = new Date(start.getTime() + daysbetween_m);
                //round down to 12 am
                dateToTake.setHours(0,0,0,0);
                let datesWTime = [];
                med.dosages.forEach(dosage => {
                    //get amount of millis to add to current dateToTake
                    let millisToAdd = dosage.reminderTime.getHours() * 3600 * 1000;
                    let dateWTime = new Date(dateToTake.getTime() + millisToAdd);
                    datesWTime.push({date: dateWTime, dosageId: dosage._id});
                });
                if (datesWTime.length > 0) {
                    scheduledDays[i - offset].push({datesWTime, medicationId: med._id});
                }
            }
        } else {
            //if the start of each week isn't Sunday, make it Sunday
            let days_s = start.getDay();
            if (days_s != 0) {
                start = new Date(start.getTime() - days_s*(1000*3600*24));
            }

            //loop over weeks so multiply interval by 7
            for (let i = 0; i < daysbetween; i+=7*med.frequency.interval) {
                if ((daysbetween - i - 6) > days + 1) {
                    //day is before start so continue looping
                    continue;
                }
                //loop over each day of this week
                for (let j = i; j < i+7; j++) {
                    let daysbetween_m = (j - i) * (1000*3600*24);
                    let dateToTake = new Date(start.getTime() + daysbetween_m);
                    dateToTake.setHours(23,59,59,999);

                    //this kind of sucks but we need to check if the weekday matches the current day
                    //and the current weekday is set to true in the database for this med
                    //we also need to make sure the date is in the day range too
                    if ((med.frequency.weekdays.sunday && dateToTake.getDay() == 0)
                        || (med.frequency.weekdays.monday && dateToTake.getDay() == 1)
                        || (med.frequency.weekdays.tuesday && dateToTake.getDay() == 2)
                        || (med.frequency.weekdays.wednesday && dateToTake.getDay() == 3)
                        || (med.frequency.weekdays.thursday && dateToTake.getDay() == 4)
                        || (med.frequency.weekdays.friday && dateToTake.getDay() == 5)
                        || (med.frequency.weekdays.saturday && dateToTake.getDay() == 6)
                        && (daysbetween - j <= days)) {
                        dateToTake.setHours(0,0,0,0);
                        let datesWTime = [];
                        med.dosages.forEach(dosage => {
                            //get amount of millis to add to current dateToTake
                            let millisToAdd = dosage.reminderTime.getHours() * 3600 * 1000;
                            let dateWTime = new Date(dateToTake.getTime() + millisToAdd);
                            datesWTime.push({date: dateWTime, dosageId: dosage._id})
                        });
                        if (datesWTime.length > 0) {
                            scheduledDays[j - i].push({datesWTime, medicationId: med._id});
                        }
                    }
                }
            }
        }
    });
    //eaving prints for testing purposes
    // let i = 0;
    // scheduledDays.forEach(day => {
    //     console.log("day: " + i);
    //     day.forEach(date => {
    //         console.log(date.medicationId);
    //         date.datesWTime.forEach(dateWTime => {
    //             console.log(dateWTime.date.toString());
    //             console.log(dateWTime.dosageId);
    //         });
    //     });
    //     i++;
    // });
    return scheduledDays;
}

/*async helper function to find a user to be used in getOccurrences */
export const getUser = async (userId) => {
    return User.findById({_id: userId}, (err, user) => {
        if (err) {
            return {error: true, message: "cannot find user!"};
        } else {
            return {error: false, user};
        }
    });
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