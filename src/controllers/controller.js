import mongoose from 'mongoose';
import { UserSchema } from '../models/userModel';
import https from 'https';
import _ from 'lodash';
import { scheduleNewMedication } from './cronController';
import schedule from 'node-schedule';

const User = mongoose.model('User', UserSchema);

// add a new medication
export const addNewMedication = (req, res) => {
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
    let newMedication = req.body;
    User.findById(req.user, (err, user) => {
        if (err) {
            res.send(err);
        } else {
            user.medications.push(newMedication);

            //schedule new occurrences for this week
            //and save user
            let resp = scheduleNewMedication(user, newMedication);
            if (resp.error) res.send(resp.message);
            //newMedication doesn't contain occurrences so send updated version
            else res.json(user.medications[user.medications.length - 1]);
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
};


export const getMedicationFromID = (req, res) => {
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
    //req.params.medicationID
    User.findOne({ _id: req.user }, (err, user) => {
        if (err) {
            res.send(err);
        } else {
            const medId = req.params.medicationID
            if (medId == null) {
                res.send({error: true, message: "cannot find medication!"});
            }
            const med = user.medications.find(med => med._id == medId);
            if (med == null) {
                res.send({error: true, message: "cannot find medication!"});
            } else {
                res.send({error: false, medication: med});
            }
        }
    });
};

export const updateMedicationFromID = (req, res) => {
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
    User.findOne({ _id: req.user }, (err, user) => {
        if (err) {
            res.send(err);
        } else {
            let medId = req.params.medicationID
            if (medId == null) {
                res.send({error: true, message: "cannot find medication!"});
                return;
            } else if (medId != req.body._id) {
                res.send({error: true, message: "medicationIds do not match!"});
                return;
            }
            const med = req.body;
            if (med == null) res.send({error: true, message: "cannot find medication!"});
            let i = 0; 
            let notFound = true;
            for (i = 0; i < user.medications.length && notFound; i++) {
                if (user.medications[i]._id == medId) {
                    user.medications[i] = med;
                    console.log(user.medications[i]);
                    notFound = false;
                }
            }
            if (notFound) res.send({error: true, message: "cannot find medication!"});
            let resp = scheduleNewMedication(user, med);
            if (resp.error) res.send(resp.message);
            else res.send({error: false, medication: user.medications.find(medE => medE._id == med._id)});
        }
    });
};


export const deleteMedicationFromID = (req, res) => {
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
    User.findOne({ _id: req.user }, (err, user) => {
        if (err) {
            res.send(err);
        } else {
            let medId = req.params.medicationID;
            if (medId == null) res.send({error: true, message: "cannot find medication!"});
            let i = 0; 
            let notFound = true;
            let med = null;
            for (i = 0; i < user.medications.length && notFound; i++) {
                if (user.medications[i]._id == medId) {
                    med = user.medications.splice(i, 1);
                    notFound = false;
                }
            }
            if (notFound) res.send({error: true, message: "cannot find medication!"});
            user.save((err) => {
                if (err) res.send({error: true, message: "cannot delete medication"});
                else res.send({error: false, medication: med});
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
    startDate = null;
    endDate = null;

    if (userId == null) {
        res.send({error: true, message: "token invalid: cannot get user"});
        return;
    }
    let user = await getUser(userId);
    if (user.error) { 
        res.send(user);
        return;
    }

    let orderedDays = getWeeklyOccurrences(user, startDate, endDate);
    
    res.json(orderedDays);
}

/*function to post when a medication is taken */
export const addOccurrence = (req, res) => {
    if (req.user == null) {
        res.send({error: true, message: "token error: cannot find user from token!"});
    }
    let userId = req.user;
    let occurrence = req.body.occurrence;
    let medicationId = req.body.medicationId;
    let dosageId = req.body.dosageId;
    if (occurrence == null || medicationId == null || dosageId == null) {
        res.send({error: true, message: "missing occurrence data!"});
    }

    User.findOne({_id : userId}, (err, user) => {
        if (err) {
            res.json({error: true, message: "cannot find user!"});
        } else {
            //find the indexes of the med, dosage, and occurrence
            let medIndex = user.medications.findIndex(med => med._id == medicationId);
            if (medIndex  == -1) {
                res.send({error: true, message: "cannot find medication!"});
                return;
            }
            let dosageIndex = user.medications[medIndex].dosages.findIndex(dosage => dosage._id == dosageId);
            if (dosageIndex  == -1) {
                res.send({error: true, message: "cannot find dosage!"});
                return;
            }
            let occurrenceIndex = user.medications[medIndex].dosages[dosageIndex].occurrences.findIndex(occurrenceU => occurrenceU._id == occurrence._id);
            if (occurrenceIndex  == -1) {
                res.send({error: true, message: "cannot find occurrence!"});
                return;
            }
            user.medications[medIndex].dosages[dosageIndex].occurrences[occurrenceIndex].isTaken = occurrence.isTaken;
            user.medications[medIndex].dosages[dosageIndex].occurrences[occurrenceIndex].isTaken = occurrence.timeTaken;
            user.medications[medIndex].dosages[dosageIndex].occurrences[occurrenceIndex].isTaken = true;
            let occurrenceToUpdate = user.medications[medIndex].dosages[dosageIndex].occurrences[occurrenceIndex];
            user.save((err) => {
                if (err) res.json({error: true, message: "cannot save occurrence!"});
            });
            //CANCEL NOTIFICATION
            const key = occurrenceToUpdate._id.toString();
            //if job exists, then cancel it!
            if (key in schedule.scheduledJobs) {
                const job = schedule.scheduledJobs[key];
                if (job != null && job != undefined) {
                    job.cancel();
                }
            }
            res.send({error: false, occurrence: occurrenceToUpdate});
        }
    });
};

/**
 * Helper function for getOccurrences that uses the occurrences already stored
 * in the database to send. Formats them into an array of days containing an array of 
 * occurrences where each occurrence has a medicationId, dosageId, and occurrence (from DosageModel)
 * 
 * Right now the function is not dynamic and only gives occurrences for the current week
 * 
 * When we start tracking occurrences from previous weeks, we can easily change the startDate
 * and endDate to parameters so that this function can be used to generate easily parsable 
 * tracking data.
 */
const getWeeklyOccurrences = (user) => {
    let startDate = new Date();
    let dayS = startDate.getDay();
    //sunday is index 0 so subtract current day in millis
    startDate = new Date(startDate.getTime() - (dayS)*24*3600*1000);

    let endDate = new Date();
    let dayE = endDate.getDay();
    //add remaining days in the week in millis
    endDate = new Date(endDate.getTime() + ((6 - dayE)*24*3600*1000));
    
    //set to end of day
    startDate.setHours(23,59,59,999);
    endDate.setHours(23,59,59,999);

    //get number of milliseconds between start date and end date
    let days = endDate.getTime() - startDate.getTime();
    //divide by number of milliseconds in one day and ceil
    days = Math.ceil(days / (1000 * 3600 * 24));
    //create entries in scheduledDays array for each day inbetween
    let scheduledDays = [];
    for(let x = 0; x <= days; x++) {
        scheduledDays.push([]);
    }

    user.medications.forEach(med => {
        med.dosages.forEach(dose => {
            dose.occurrences.forEach(occurrence => {
                let dayIndex = 0;
                scheduledDays.forEach(day => {
                    //only add occurrence to day if the occurrence is in the timeframe and 
                    //between start and end date
                    if (occurrence.scheduledDate.getTime() > startDate.getTime() 
                        && occurrence.scheduledDate.getTime() < endDate.getTime()
                        && occurrence.scheduledDate.getDay() == dayIndex) {
                            day.push({medicationId: med._id, dosageId: dose._id, occurrence: occurrence});
                        }
                    dayIndex++;
                });
            });
        });
    });
    //sort each day by date
    scheduledDays.forEach(day => {
        day.sort((a, b) => b.occurrence.date - a.occurrence.date);
    });
    return scheduledDays;
}


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