import https from "https";
import mongoose from "mongoose";
import schedule from "node-schedule";
import { DosageSchema } from "../models/Dosage";
import { OccurrenceSchema, OccurrenceGroupSchema } from "../models/Occurrence";
import { MedicationSchema } from "../models/Medication";
import { UserSchema } from "../models/User";
import { scheduleMedication } from "./cronController";

const User = mongoose.model("User", UserSchema);
const Medication = mongoose.model("Medication", MedicationSchema);
const Dosage = mongoose.model("Dosage", DosageSchema);
const Occurrence = mongoose.model("Occurrence", OccurrenceSchema);
const OccurrenceGroup = mongoose.model(
    "OccurrenceGroup",
    OccurrenceGroupSchema
);

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
        })
        .execPopulate();

    try {
        await scheduleMedication(newMedication, user._id);
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

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        Medication.find({ _id: { $in: user.medications } })
            .populate("dosages")
            .exec((err, medications) => {
                if (err)
                    return res.status(404).send({
                        message: "cannot find medications!",
                    });
                return res.status(200).json(medications);
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

        if (!medication) {
            return res.status(404).json({ message: "Medication not found" });
        }

        //ensure that the medication id matches the same user that sent the request
        if (!medication.user.equals(req.user))
            return res.status(401).json({
                message: "You are not authorized to view this medication",
            });
    } catch (err) {
        return res.send(err);
    }

    if (!medication) {
        return res.status(404).json({ message: "Medication not found!" });
    }

    await medication.populate("dosages").execPopulate();
    return res.json(medication);
};

export const updateMedicationFromID = async (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }
    const medId = req.params.medicationID;
    if (!medId) {
        return res.status(400).send({ message: "Medication id is required" });
    } else if (medId != req.body._id) {
        return res
            .status(404)
            .send({ message: "Medication IDs do not match!" });
    }
    let medication;
    try {
        medication = await Medication.findById(medId);
        if (!medication) {
            return res.status(404).json({ message: "Medication not found!" });
        }
        //ensure the medication to be updated exists
        if (!medication.user.equals(req.user)) {
            return res.status(401).json({
                message: "You are not authorized to edit this medication",
            });
        }
    } catch (err) {
        return res.send(err);
    }
    //we need to invalidate the previous dosages
    //if a dosage doesn't have an _id, we can assume it's a new dosage
    let existingDosages = [];
    let oldDosages = [];
    medication.dosages.forEach((dosage) => {
        let d = req.body.dosages.find((dose) => dose._id == dosage);
        if (d != undefined) {
            existingDosages.push(dosage);
        } else {
            oldDosages.push(dosage);
        }
    });
    let newDosages = req.body.dosages.filter((dosage) => dosage._id == null);
    //we have existingDosages, oldDosages, and newDosages

    try {
        //newDosages need to be added to the database and their occurrences need to be scheduled
        newDosages.map((d) => {
            d = new Dosage(d);
            d.medication = medId;
        });
        Dosage.insertMany(newDosages);

        let activeDosages = existingDosages.concat(
            newDosages.map((d) => d._id)
        );
        //existingDosages need to be updated because it's possible they've changed
        //oldDosages need to be invalidated and the occurrences need to be descheduled
        //in either case, we should deschedule all future occurrences
        descheduleAndDeleteFutureOccurrences(
            oldDosages.concat(existingDosages)
        );
        //mark all the dosages as inactive
        let now = new Date();
        oldDosages = await Dosage.findAndUpdate({
            query: { _id: { $in: oldDosages } },
            update: { $inc: { active: false, inactiveDate: now } },
        });

        //update the medication with inactive and active dosages
        medication.inactiveDosages = oldDosages;
        medication.dosages = activeDosages;
        await medication.save();

        //finally schedule the future active dosages for the rest of week
        await scheduleMedication(medication);
    } catch (err) {
        return res
            .status(404)
            .json({ message: "error updating medication information!" });
    }
    await medication.populate("dosages").execPopulate();
    return res.status(200).json(medication);
};

export const deleteMedicationFromID = async (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }

    //ensure user has permission to delete this medication
    let medicationToRemove = await Medication.findById(
        req.params.medicationID,
        (err, medication) => {
            if (err) {
                return res.status(404).json({
                    message: "cannot find medication!",
                });
            } else if (!medication) {
                return res
                    .status(404)
                    .json({ message: "Medication not found" });
            } else if (!medication.user.equals(req.user)) {
                return res.status(404).json({
                    message: "user not authorized to delete this medication!",
                });
            }
        }
    );

    try {
        let dosagesToRemove = await Dosage.find({
            _id: {
                $in: medicationToRemove.dosages.concat(
                    medicationToRemove.inactiveDosages
                ),
            },
        });

        //for each dosage, delete occurrences and create occurrenceGroup array
        let occurrencesToRemove = [];
        let occurrenceGroupsToRemove = [];
        for (let dosage of dosagesToRemove) {
            let occurrences = await Occurrence.find({
                _id: { $in: dosage.occurrences },
            });
            for (let occurrence of occurrences) {
                if (occurrenceGroupsToRemove.indexOf(occurrence.group) == -1) {
                    occurrenceGroupsToRemove.push(occurrence.group);
                }
            }
            occurrencesToRemove.concat(occurrences);
        }

        //iterate over occurrenceGroups and delete groups that only have one occurrence
        for (let group of occurrenceGroupsToRemove) {
            if (group.occurrences.length == 1) {
                const key = group._id.toString();
                //if job exists, then cancel it!
                if (key in schedule.scheduledJobs) {
                    const job = schedule.scheduledJobs[key];
                    if (job != undefined) {
                        job.cancel();
                    }
                }
                await OccurrenceGroup.deleteOne({
                    _id: group._id,
                });
            } else {
                //TODO: FILTER OCCURRENCES TO BE REMOVED FROM GROUP AND DELETE GROUP IF NECESSARY
                let occurrenceToRemove = { _id: 0 };
                //if there are multiple occurrences,
                //remove index of posted occurrence
                let indexOfOccToRemove = group.occurrences.findIndex((occ) =>
                    occ.equals(occurrenceToRemove._id)
                );
                if (indexOfOccToRemove != -1) {
                    group.occurrences.splice(indexOfOccToRemove, 1);
                }
                await group.save();
            }
        }

        await Occurrence.deleteMany({ _id: { $in: occurrencesToRemove } });

        await Dosage.deleteMany({
            _id: {
                $in: medicationToRemove.dosages.concat(
                    medicationToRemove.inactiveDosages
                ),
            },
        });
        await Medication.deleteOne({ _id: medicationToRemove._id });
        //find the user and delete the medication reference
        let user = await User.findById(medicationToRemove.user);
        let index = user.medications.indexOf(medicationToRemove._id);
        if (index != -1) {
            user.medications.splice(index, 1);
        }
        user.save();
        return res
            .status(200)
            .json({ message: "Successfully deleted medication!" });
    } catch (err) {
        console.log(err);
        return res.status(404).json({ message: "Cannot delete medication!" });
    }
};

export const fuzzySearchWithString = (req, res) => {
    let searchStr = req.params.searchStr;
    //console.log("REST/spellingsuggestions.json?name=" + searchStr);

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
                let length;
                if (
                    respData.suggestionGroup.suggestionList != null &&
                    respData.suggestionGroup.suggestionList.suggestion != null
                ) {
                    length =
                        respData.suggestionGroup.suggestionList.suggestion
                            .length;
                } else {
                    length = 0;
                }
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
 * Gets a single occurrence
 */
export const getOccurrenceFromID = async (req, res) => {
    const { occurrenceId } = req.params;
    const userId = req.user;
    if (userId == null) {
        return res
            .status(404)
            .json({ message: "token invalid: cannot get user" });
    }

    let occurrence;
    try {
        occurrence = await Occurrence.findById(occurrenceId);
        if (!occurrence) {
            return res.status(404).json({ message: "Occurrence not found" });
        }
    } catch (err) {
        return res.send(err);
    }

    await occurrence.populate("dosage").execPopulate();
    return res.status(200).json(occurrence);
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

        if (!user) {
            return res.status(404).json({ message: "User not found" });
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
export const addOccurrence = async (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }
    let occurrenceP = req.body;
    if (occurrenceP == undefined) {
        return res.status(400).json({ message: "missing occurrence data!" });
    }
    let occurrence = null;
    try {
        occurrence = await Occurrence.findById(occurrenceP._id);
        //check that the occurrence belongs to the user posting it
        let dosage = await Dosage.findById(occurrence.dosage);
        let medication = await Medication.findById(dosage.medication);
        if (!medication.user.equals(req.user)) {
            return res.status(401).json({
                message: "You are not authorized to edit this occurrence",
            });
        }
    } catch (err) {
        return res.status(401).json({
            message:
                "Error finding dosage and medication that correspond with the occurrence",
        });
    }

    //update occurrence
    Occurrence.findOneAndUpdate(
        { _id: occurrence._id },
        {
            isTaken: true,
            timeTaken: new Date(),
        },
        { new: true },
        async (err, occurrenceToUpdate) => {
            if (err) {
                return res
                    .status(404)
                    .json({ message: "cannot update occurrence!" });
            } else if (!occurrenceToUpdate) {
                return res
                    .status(404)
                    .json({ message: "Occurrence not found" });
            } else {
                //CANCEL NOTIFICATION
                let occurrenceGroup = await OccurrenceGroup.find({
                    _id: occurrenceToUpdate.group,
                });
                //if occurrenceGroup exists then decide to unschedule/delete
                if (occurrenceGroup.length != 0 && occurrenceGroup[0] != null) {
                    occurrenceGroup = occurrenceGroup[0];
                    if (occurrenceGroup.occurrences.length <= 1) {
                        const key = occurrenceGroup._id.toString();
                        //if job exists, then cancel it!
                        if (key in schedule.scheduledJobs) {
                            const job = schedule.scheduledJobs[key];
                            if (job != undefined) {
                                job.cancel();
                            }
                        }
                        OccurrenceGroup.deleteOne({
                            _id: occurrenceGroup._id,
                        });
                    } else {
                        //if there are multiple occurrences,
                        //remove index of posted occurrence
                        let indexOfOccToRemove = occurrenceGroup.occurrences.findIndex(
                            (occ) => occ.equals(occurrenceToUpdate._id)
                        );
                        if (indexOfOccToRemove != -1) {
                            occurrenceGroup.occurrences.splice(
                                indexOfOccToRemove,
                                1
                            );
                        }
                        occurrenceGroup.save();
                    }
                }
                return res.status(200).json(occurrenceToUpdate);
            }
        }
    );
};

export const registerDeviceKey = async (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }
    let token = req.body.token;
    let os = req.body.os;
    if (token == undefined || os == undefined) {
        return res
            .status(400)
            .json({ message: "missing token/deviceType data!" });
    }
    await User.findOneAndUpdate(
        { _id: req.user },
        { deviceInfo: { token, os } }
    );
    return res.status(200).json({ ok: true });
};

export const getTrackingInfo = async (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }
    try {
        let user = await User.findById(req.user);
        await user
            .populate({
                path: "medications",
                model: "Medication",
                populate: {
                    path: "dosages",
                    model: "Dosage",
                    populate: { path: "occurrences", model: "Occurrence" },
                },
            })
            .execPopulate();

        let now = new Date();
        //make sure occurrences are in range of the start and end date
        let last12Hours = now.getTime() - 1000 * 3600 * 12;
        let last30Days = now.getTime() - 1000 * 3600 * 24 * 30;
        //array of medication objects that have an id, name, and compliance value
        //representing the amount of occurrences taken for that med within the
        let trackingArr = [];
        for (let med of user.medications) {
            let takenOccurrences = 0;
            let totalOccurrences = 0;
            for (let dosage of med.dosages) {
                for (let occurrence of dosage.occurrences) {
                    if (
                        occurrence.scheduledDate.getTime() > last30Days &&
                        occurrence.scheduledDate.getTime() < last12Hours
                    ) {
                        totalOccurrences++;
                        if (occurrence.isTaken) takenOccurrences++;
                    }
                }
            }
            //don't want to get a divide by zero exception
            //also it's not necessary to include medication in tracking
            //array if there aren't any occurrences in the time frame
            if (totalOccurrences > 0) {
                trackingArr.push({
                    medicationId: med._id,
                    name: med.name,
                    compliance: takenOccurrences / totalOccurrences,
                });
            }
        }
        return res.send(200).json(trackingArr);
    } catch (err) {
        return res.status(404).json({
            message: "cannot find tracking information from user!",
        });
    }
};

export const getOccurrenceGroupFromID = async (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }
    try {
        let occurrenceGroup = await OccurrenceGroup.findById(
            req.params.occurrenceGroupId
        );
        if (occurrenceGroup.user != req.user) {
            return res.status(401).json({
                message: "You are not authorized to get this occurrence group",
            });
        }
        await occurrenceGroup
            .populate({
                path: "occurrences",
                model: "Occurrence",
                populate: {
                    path: "dosage",
                    model: "Dosage",
                    populate: { path: "medication", model: "Medication" },
                },
            })
            .execPopulate();
        return res.send(200).json(occurrenceGroup);
    } catch (err) {
        return res.status(404).json({
            message: "cannot find occurrence group!",
        });
    }
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
        day.sort(
            (a, b) =>
                a.occurrence.scheduledDate.getTime() -
                b.occurrence.scheduledDate.getTime()
        );
    });
    return scheduledDays;
};

/**
 * Given an array of dosageIds, deschedule all future occurrences that
 * correspond to the given dosageIds,
 */
const descheduleAndDeleteFutureOccurrences = (dosages) => {
    dosages.forEach(async (dosageId) => {
        //first get the dosage and populate the occurrences
        let dosage = await Dosage.findById(dosageId);
        await dosage.populate("occurrences").execPopulate();
        //we only want to remove occurrences that haven't happened yet
        let now = new Date();
        let occurrencesToRemove = dosage.occurrences.filter(
            (occ) => !occ.isTaken && occ.scheduledDate.getTime() > now.getTime()
        );
        //deschedule the occurrences
        //TODO: FIX
        // occurrencesToRemove.forEach((occurrence) => {
        //     let key = occurrence._id.toString();
        //     if (key in schedule.scheduledJobs) {
        //         const job = schedule.scheduledJobs[key];
        //         if (job != null && job != undefined) {
        //             job.cancel();
        //         }
        //     }
        // });
        //delete the occurrences
        await Occurrence.deleteMany(occurrencesToRemove, (err) => {
            if (err) console.log("error deleting occurrences");
        });
        //remove the deleted occurrences from the dosage
        dosage.occurrences = dosage.occurrences.filter((occ) => {
            !occurrencesToRemove.includes(occ);
        });
        await dosage.save();
    });
};
