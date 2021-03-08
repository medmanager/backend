import https from "https";
import mongoose from "mongoose";
import schedule from "node-schedule";
import { DosageSchema, OccurrenceSchema } from "../models/Dosage";
import { MedicationSchema } from "../models/Medication";
import { UserSchema } from "../models/User";
import { scheduleNewMedication } from "./cronController";

const User = mongoose.model("User", UserSchema);
const Medication = mongoose.model("Medication", MedicationSchema);
const Dosage = mongoose.model("Dosage", DosageSchema);
const Occurrence = mongoose.model("Occurrence", OccurrenceSchema);

// add a new medication
export const addNewMedication = async (req, res) => {
    let user;
    try {
        user = await User.findById(req.user);
    } catch (err) {
        return res.status(404).json({ message: "cannot find user!" });
    }

    // construct medication
    const dosages = req.body.dosages;
    const medication = {
        ...req.body,
        dosages: [],
        user: user._id,
    };
    const newMedication = new Medication(medication);

    // save user, medication, and dosages
    try {
        // save each new dosage on the medication
        for (let dosage of dosages) {
            dosage = {
                ...dosage,
                medication: newMedication._id,
            };
            const newDosage = new Dosage(dosage);
            await newDosage.save();
            // mongoose knows to only add the object id to the dosages list on the medication schema
            newMedication.dosages.push(newDosage);
        }
        await newMedication.save();
        user.medications.push(newMedication);
        await user.save();
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "cannot save medication!",
        });
    }

    // populate all the nested data onto the new medication
    await newMedication
        .populate({
            path: "dosages",
            model: "Dosage",
            populate: { path: "occurrences", model: "Occurrence" },
        })
        .execPopulate();

    //we need to fully populate user for schedule code to work
    //this is expensive, but the only other option is rewrite schedule code
    await user
        .populate({
            path: "medications",
            populate: { path: "dosages", model: "Dosage" },
        })
        .execPopulate();

    try {
        await scheduleNewMedication(user, newMedication);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "error scheduling new medication!",
        });
    }

    return res.status(200).json(newMedication);
};

export const getMedications = (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }

    User.findById(req.user, (err, user) => {
        if (err) {
            return res.send(err);
        }

        Medication.find({ _id: { $in: user.medications } })
            .populate("dosages")
            .exec((err, medications) => {
                if (err)
                    return res.status(404).send({
                        message: "cannot find medications!",
                    });

                return res.status(200).send(medications);
            });
    });
};

export const getMedicationFromID = async (req, res) => {
    const medId = req.params.medicationID;
    if (!medId) {
        return res.status(400).send({ message: "Medication id is required" });
    }

    let medication;
    try {
        medication = await Medication.findById(medId);

        if (!medication.user.equals(req.user))
            return res.status(401).json({
                message: "You are not authorized to view this medication",
            });
    } catch (err) {
        return res.send(err);
    }

    if (!medication) {
        return res.status(404).json({ message: "Medication not found" });
    }

    await medication.populate("dosages").execPopulate();
    return res.json(medication);
};

export const updateMedicationFromID = (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }
    User.findOne({ _id: req.user }, (err, user) => {
        if (err) return res.send(err);

        let medId = req.params.medicationID;
        if (medId == null) {
            return res.status(404).json({
                message: "cannot find medication!",
            });
        } else if (medId != req.body._id) {
            return res.status(404).json({
                message: "medicationIds do not match!",
            });
        }
        const med = req.body;
        if (med == null)
            return res.status(404).json({
                message: "cannot find medication!",
            });
        let i = 0;
        let notFound = true;
        for (i = 0; i < user.medications.length && notFound; i++) {
            if (user.medications[i]._id == medId) {
                user.medications[i] = med;
                console.log(user.medications[i]);
                notFound = false;
            }
        }
        if (notFound)
            return res.status(404).json({
                message: "cannot find medication!",
            });

        let resp = scheduleNewMedication(user, med);
        if (resp.error) {
            return res.send(resp.message);
        }

        return res
            .status(200)
            .json(user.medications.find((medE) => medE._id == med._id));
    });
};

export const deleteMedicationFromID = (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }
    User.findOne({ _id: req.user }, (err, user) => {
        if (err) {
            return res.send(err);
        }

        let medId = req.params.medicationID;
        if (medId == null)
            return res.status(404).json({
                message: "cannot find medication!",
            });
        let i = 0;
        let notFound = true;
        let med = null;
        for (i = 0; i < user.medications.length && notFound; i++) {
            if (user.medications[i]._id == medId) {
                med = user.medications.splice(i, 1);
                notFound = false;
            }
        }
        if (notFound)
            return res.status(404).json({
                message: "cannot find medication!",
            });
        user.save((err) => {
            if (err)
                return res.status(500).json({
                    message: "cannot delete medication",
                });
            return res.status(200).json(med);
        });
    });
};

export const fuzzySearchWithString = (req, res) => {
    let searchStr = req.params.searchStr;
    console.log("REST/spellingsuggestions.json?name=" + searchStr);

    const req2 = https.request(
        {
            hostname: "rxnav.nlm.nih.gov",
            path: "/REST/spellingsuggestions.json?name=" + searchStr, //append searchStr to path
        },
        (res2) => {
            let data = "";
            res2.on("data", (d) => {
                data += d;
            });
            res2.on("end", () => {
                let respData = JSON.parse(data);
                let matches = [];
                let length =
                    respData.suggestionGroup.suggestionList.suggestion.length;
                //max length to return is 5
                length = length < 5 ? length : 5;
                let i;
                for (i = 0; i < length; i++) {
                    matches.push(
                        respData.suggestionGroup.suggestionList.suggestion[i]
                    );
                }
                //We could just return respData.suggestionGroup.suggestionList...
                //but if we want to do any further searching on the matches, it
                //is easier if they are in an accessible array
                return res.json(matches);
            });
        }
    );
    req2.on("error", (error) => {
        return res.send(error);
    });
    req2.end();
};

/**
 * returns an array of dosages independent of medications
 */
export const getDosages = (req, res) => {
    let userId = req.user;
    if (userId == null) {
        return res
            .status(404)
            .json({ message: "token invalid: cannot get user" });
    }

    return User.findById({ _id: userId }, (err, user) => {
        if (err) {
            return res.status(404).json({ message: "cannot find user!" });
        }
        let dosages = [];
        user.medications.forEach((med) => {
            med.dosages.forEach((dosage) => {
                dosages.push(dosage);
            });
        });
        return res.status(200).json({ dosages: dosages });
    });
};

/**
 * Function to get weekly occurrences of all medications
 * 2 parameters in body:
 * @param startDate : DateTime object containing start date to find occurrences for
 * @param endDate : DateTime object marking the end date in the range of the occurrences
 */
export const getOccurrences = async (req, res) => {
    const userId = req.user;

    if (userId == null) {
        return res
            .status(400)
            .send({ message: "token invalid: cannot get user" });
    }

    let user;
    try {
        user = await User.findById(userId);
    } catch (err) {
        return res.status(404).json({ message: "User not found." });
    }

    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }

    await user
        .populate({
            path: "medications",
            populate: {
                path: "dosages",
                populate: {
                    path: "occurrences",
                    model: "Occurrence",
                },
                model: "Dosage",
            },
        })
        .execPopulate();

    const orderedDays = getWeeklyOccurrences(user);
    return res.status(200).json(orderedDays);
};

/*function to post when a medication is taken */
export const addOccurrence = (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }
    let userId = req.user;
    let occurrence = req.body.occurrence;
    let medicationId = req.body.medicationId;
    let dosageId = req.body.dosageId;
    if (occurrence == null || medicationId == null || dosageId == null) {
        return res.status(400).json({ message: "missing occurrence data!" });
    }

    User.findOne({ _id: userId }, (err, user) => {
        if (err) {
            return res.status(404).json({ message: "cannot find user!" });
        } else {
            //find the indexes of the med, dosage, and occurrence
            let medIndex = user.medications.findIndex(
                (med) => med._id == medicationId
            );
            if (medIndex == -1) {
                return res
                    .status(404)
                    .json({ message: "cannot find medication!" });
            }
            let dosageIndex = user.medications[medIndex].dosages.findIndex(
                (dosage) => dosage._id == dosageId
            );
            if (dosageIndex == -1) {
                return res.status(404).json({ message: "cannot find dosage!" });
            }
            let occurrenceIndex = user.medications[medIndex].dosages[
                dosageIndex
            ].occurrences.findIndex(
                (occurrenceU) => occurrenceU._id == occurrence._id
            );
            if (occurrenceIndex == -1) {
                return res
                    .status(404)
                    .json({ message: "cannot find occurrence!" });
            }
            user.medications[medIndex].dosages[dosageIndex].occurrences[
                occurrenceIndex
            ].isTaken = occurrence.isTaken;
            user.medications[medIndex].dosages[dosageIndex].occurrences[
                occurrenceIndex
            ].isTaken = occurrence.timeTaken;
            user.medications[medIndex].dosages[dosageIndex].occurrences[
                occurrenceIndex
            ].isTaken = true;
            let occurrenceToUpdate =
                user.medications[medIndex].dosages[dosageIndex].occurrences[
                    occurrenceIndex
                ];
            user.save((err) => {
                if (err)
                    return res.status(500).json({
                        message: "cannot save occurrence!",
                    });
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
            return res.status(200).json(occurrenceToUpdate);
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
    startDate = new Date(startDate.getTime() - dayS * 24 * 3600 * 1000);

    let endDate = new Date();
    let dayE = endDate.getDay();
    //add remaining days in the week in millis
    endDate = new Date(endDate.getTime() + (6 - dayE) * 24 * 3600 * 1000);

    //set to end of day
    startDate.setHours(23, 59, 59, 999);
    endDate.setHours(23, 59, 59, 999);

    //get number of milliseconds between start date and end date
    let days = endDate.getTime() - startDate.getTime();
    //divide by number of milliseconds in one day and ceil
    days = Math.ceil(days / (1000 * 3600 * 24));
    //create entries in scheduledDays array for each day inbetween
    let scheduledDays = [];
    for (let x = 0; x <= days; x++) {
        scheduledDays.push([]);
    }

    user.medications.forEach((med) => {
        med.dosages.forEach((dose) => {
            dose.occurrences.forEach((occurrence) => {
                let dayIndex = 0;
                scheduledDays.forEach((day) => {
                    //only add occurrence to day if the occurrence is in the timeframe and
                    //between start and end date
                    if (
                        occurrence.scheduledDate.getTime() >
                            startDate.getTime() &&
                        occurrence.scheduledDate.getTime() <
                            endDate.getTime() &&
                        occurrence.scheduledDate.getDay() == dayIndex
                    ) {
                        day.push({
                            medicationId: med._id,
                            dosageId: dose._id,
                            occurrence: occurrence,
                        });
                    }
                    dayIndex++;
                });
            });
        });
    });
    //sort each day by date
    scheduledDays.forEach((day) => {
        day.sort((a, b) => b.occurrence.date - a.occurrence.date);
    });
    return scheduledDays;
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
        endDate = new Date(endDate.getTime() + (6 - day) * 24 * 3600 * 1000);
    }
    //set start date to last sunday (or today if today is sunday)
    if (startDate == null) {
        startDate = new Date();
        let day = startDate.getDay();
        //sunday is index 0 so subtract current day in millis
        startDate = new Date(startDate.getTime() - day * 24 * 3600 * 1000);
    }
    let scheduledDays = [];

    //ceil both startDate and endDate to the endOfDay (avoids indexing issues later)
    startDate = new Date(startDate.getTime());
    startDate.setHours(23, 59, 59, 999);
    endDate = new Date(endDate.getTime());
    endDate.setHours(23, 59, 59, 999);

    //get number of milliseconds between start date and end date
    let days = endDate.getTime() - startDate.getTime();
    //divide by number of milliseconds in one day and ceil
    days = Math.ceil(days / (1000 * 3600 * 24));
    //create entries in scheduledDays array for each day inbetween
    for (let x = 0; x <= days; x++) {
        scheduledDays.push([]);
    }
    if (user.medications == null) return scheduledDays;
    user.medications.forEach((med) => {
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
            for (let i = 0; i < daysbetween; i += med.frequency.interval) {
                if (daysbetween - i > days + 1) {
                    //day is before start so just continue looping
                    continue;
                }
                let daysbetween_m = i * (1000 * 3600 * 24);
                //find actual date to take medication
                let dateToTake = new Date(start.getTime() + daysbetween_m);
                //round down to 12 am
                dateToTake.setHours(0, 0, 0, 0);
                let datesWTime = [];
                med.dosages.forEach((dosage) => {
                    //get amount of millis to add to current dateToTake
                    let millisToAdd =
                        dosage.reminderTime.getHours() * 3600 * 1000;
                    let dateWTime = new Date(
                        dateToTake.getTime() + millisToAdd
                    );
                    datesWTime.push({ date: dateWTime, dosageId: dosage._id });
                });
                if (datesWTime.length > 0) {
                    scheduledDays[i - offset].push({
                        datesWTime,
                        medicationId: med._id,
                    });
                }
            }
        } else {
            //if the start of each week isn't Sunday, make it Sunday
            let days_s = start.getDay();
            if (days_s != 0) {
                start = new Date(start.getTime() - days_s * (1000 * 3600 * 24));
            }

            //loop over weeks so multiply interval by 7
            for (let i = 0; i < daysbetween; i += 7 * med.frequency.interval) {
                if (daysbetween - i - 6 > days + 1) {
                    //day is before start so continue looping
                    continue;
                }
                //loop over each day of this week
                for (let j = i; j < i + 7; j++) {
                    let daysbetween_m = (j - i) * (1000 * 3600 * 24);
                    let dateToTake = new Date(start.getTime() + daysbetween_m);
                    dateToTake.setHours(23, 59, 59, 999);

                    //this kind of sucks but we need to check if the weekday matches the current day
                    //and the current weekday is set to true in the database for this med
                    //we also need to make sure the date is in the day range too
                    if (
                        (med.frequency.weekdays.sunday &&
                            dateToTake.getDay() == 0) ||
                        (med.frequency.weekdays.monday &&
                            dateToTake.getDay() == 1) ||
                        (med.frequency.weekdays.tuesday &&
                            dateToTake.getDay() == 2) ||
                        (med.frequency.weekdays.wednesday &&
                            dateToTake.getDay() == 3) ||
                        (med.frequency.weekdays.thursday &&
                            dateToTake.getDay() == 4) ||
                        (med.frequency.weekdays.friday &&
                            dateToTake.getDay() == 5) ||
                        (med.frequency.weekdays.saturday &&
                            dateToTake.getDay() == 6 &&
                            daysbetween - j <= days)
                    ) {
                        dateToTake.setHours(0, 0, 0, 0);
                        let datesWTime = [];
                        med.dosages.forEach((dosage) => {
                            //get amount of millis to add to current dateToTake
                            let millisToAdd =
                                dosage.reminderTime.getHours() * 3600 * 1000;
                            let dateWTime = new Date(
                                dateToTake.getTime() + millisToAdd
                            );
                            datesWTime.push({
                                date: dateWTime,
                                dosageId: dosage._id,
                            });
                        });
                        if (datesWTime.length > 0) {
                            scheduledDays[j - i].push({
                                datesWTime,
                                medicationId: med._id,
                            });
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
};
