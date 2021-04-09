import https from "https";
import mongoose from "mongoose";
import scheduler from "node-schedule";
import Dosage from "../models/Dosage";
import Medication from "../models/Medication";
import Occurrence from "../models/Occurrence";
import OccurrenceGroup from "../models/OccurrenceGroup";
import User from "../models/User";
import { deepEqual } from "../utils";
import {
    createAndScheduleMedicationDosageOccurrences,
    descheduleAndDeleteFutureDosageOccurrences
} from "./occurrence.controller";

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
        user: req.user,
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

    // // populate all the nested data onto the new medication
    // await newMedication
    //     .populate("dosages")
    //     .execPopulate();

    try {
        await createAndScheduleMedicationDosageOccurrences(newMedication);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "error scheduling new medication!",
        });
    }

    return res.status(201).json(newMedication);
};

/**
 * Gets a users medications
 */
export const getMedications = (req, res) => {
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

/**
 * Gets a single medication based on its identifier
 */
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

/**
 * Sets a medication to active
 */
export const activateMedication = async (req, res) => {
    const medId = req.params.medicationID;
    if (!medId) {
        return res.status(400).send({ message: "Medication id is required" });
    }
    let medication;
    try {
        medication = await Medication.findById(medId)
            .populate("dosages")
            .exec();

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
    if (medication.active) return res.status(200).json(medication);
    // reschedule occurrences for the week and mark as active
    await Medication.findOneAndUpdate(
        { _id: medication._id },
        { active: true }
    );
    await createAndScheduleMedicationDosageOccurrences(medication);
    return res.status(200).json(medication);
};

/**
 * Sets a medication to inactive
 */
export const deactivateMedication = async (req, res) => {
    const medId = req.params.medicationID;
    if (!medId) {
        return res.status(400).send({ message: "Medication id is required" });
    }
    let medication;
    try {
        medication = await Medication.findById(medId)
            .populate("dosages")
            .exec();

        if (!medication) {
            return res.status(404).json({ message: "Medication not found" });
        }

        // ensure that the medication id matches the same user that sent the request
        if (!medication.user.equals(req.user))
            return res.status(401).json({
                message: "You are not authorized to view this medication",
            });
    } catch (err) {
        return res.send(err);
    }
    // mark medication as inactive
    await descheduleAndDeleteFutureDosageOccurrences(medication);
    await Medication.findByIdAndUpdate(medId, {
        active: false,
    });
    return res.status(200).json(medication);
};

export const updateMedicationFromID = async (req, res) => {
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
        medication = await Medication.findById(medId)
            .populate("dosages")
            .exec();
        if (!medication) {
            return res.status(404).json({ message: "Medication not found!" });
        }
        // ensure the medication to be updated exists
        if (!medication.user.equals(req.user)) {
            return res.status(401).json({
                message: "You are not authorized to edit this medication",
            });
        }
    } catch (err) {
        return res.send(err);
    }

    let updatedMedication = req.body;
    
    // if either the dosages or frequency has changed then delete and reschedule all future occurrences

    const dosagesToCompare = medication.dosages.map(
        ({ _id, reminderTime, dose, sendReminder }) => ({
            _id,
            reminderTime,
            dose,
            sendReminder,
        })
    );

    const frequencyToCompare = {
        interval: medication.frequency.interval,
        intervalUnit: medication.frequency.intervalUnit,
        weekdays: {
            sunday: medication.frequency.weekdays.sunday,
            monday: medication.frequency.weekdays.monday,
            tuesday: medication.frequency.weekdays.tuesday,
            wednesday: medication.frequency.weekdays.wednesday,
            thursday: medication.frequency.weekdays.thursday,
            friday: medication.frequency.weekdays.friday,
            saturday: medication.frequency.weekdays.saturday,
        },
    };

    if (
        !deepEqual(updatedMedication.dosages, dosagesToCompare) ||
        !deepEqual(updatedMedication.frequency, frequencyToCompare)
    ) {
        console.log("Dosages or frequency has changed");
        // dosages or frequency have changed since last time, invalidate all previous dosages
        await descheduleAndDeleteFutureDosageOccurrences(medication);
        const inactiveDosages = medication.inactiveDosages.concat(
            medication.dosages
        );
        const dosageIdsToInvalidate = inactiveDosages.map(
            (dosage) => dosage._id
        );
        await Dosage.updateMany(
            { _id: { $in: dosageIdsToInvalidate } },
            { active: false, inactiveDate: new Date() }
        );

        // NOTE: assume all dosages on the updated medication are new dosages
        const newDosages = [];
        for (const dosage of updatedMedication.dosages) {
            const dosageObj = {
                dose: dosage.dose,
                sendReminder: dosage.sendReminder,
                reminderTime: dosage.reminderTime,
                active: true,
                medication: medId,
            };
            const newDosage = new Dosage(dosageObj);
            await newDosage.save();
            newDosages.push(newDosage);
        }

        medication.dosages = newDosages;
        medication.inactiveDosages = inactiveDosages;
        medication.frequency = updatedMedication.frequency;
        medication.name = updatedMedication.name;
        medication.strength = updatedMedication.strength;
        medication.strengthUnit = updatedMedication.strengthUnit;
        medication.amount = updatedMedication.amount;
        medication.amountUnit = updatedMedication.amountUnit;
        medication.color = updatedMedication.color;
        await medication.save();
        await medication.populate("dosages").execPopulate(); // is this line necessary?
        await createAndScheduleMedicationDosageOccurrences(medication);
    } else {
        medication.name = updatedMedication.name;
        medication.strength = updatedMedication.strength;
        medication.strengthUnit = updatedMedication.strengthUnit;
        medication.amount = updatedMedication.amount;
        medication.amountUnit = updatedMedication.amountUnit;
        medication.color = updatedMedication.color;
        await medication.save();
    }

    return res.status(200).json(medication);

    // for (let newDosage of updatedMed.dosages) {
    //     for (let dosage of medication.dosages) {
    //         if (deepEqual(dosage, newDosage)) {
    //             unchangedDosages.push(dosage);
    //         } else if (dosage._id.toString() == newDosage._id) {
    //             changedDosages.push(dosage);
    //         } else {
    //             newDosages.push(newDosage);
    //         }
    //     }
    //     // if (!added) {
    //     //     if ("_id" in newDosage) {
    //     //         delete newDosage._id;
    //     //     }
    //     //     newDosages.push(newDosage);
    //     // }
    // }

    // for (let dosage of medication.dosages) {
    //     let index1 = changedDosages.findIndex(
    //         (d) => d._id == dosage._id.toString()
    //     );
    //     let index2 = unchangedDosages.findIndex(
    //         (d) => d._id == dosage._id.toString()
    //     );
    //     if (index1 == -1 && index2 == -1) {
    //         oldDosages.push(dosage);
    //     }
    // }

    // for (let dosage of changedDosages) {
    //     await Dosage.findByIdAndUpdate(dosage._id, {
    //         dose: dosage.dose,
    //         sendReminder: dosage.sendReminder,
    //         reminderTime: dosage.reminderTime,
    //     });
    // }

    // let now = new Date();
    // for (let dosage of oldDosages) {
    //     await Dosage.findByIdAndUpdate(dosage._id, {
    //         active: false,
    //         inactiveDate: now,
    //     });
    // }

    // newDosages = newDosages.map((dosage) => {
    //     dosage = new Dosage(dosage);
    //     dosage.medication = medication._id;
    //     return dosage;
    // });
    // console.log({ newDosages });
    // console.log({ unchangedDosages });
    // console.log({ changedDosages });
    // console.log({ oldDosages });

    // if (newDosages.length > 0) {
    //     await Dosage.insertMany(newDosages);
    // }

    // let dosagesToInvalidate = changedDosages;
    // dosagesToInvalidate = dosagesToInvalidate.concat(oldDosages);

    // if (!deepEqual(medication.frequency, updatedMedication.frequency)) {
    //     dosagesToInvalidate = dosagesToInvalidate.concat(unchangedDosages);
    // }

    // const dosageIdsToInvalidate = dosagesToInvalidate.map(
    //     (dosage) => dosage._id
    // );
    // descheduleAndDeleteFutureOccurrences(dosageIdsToInvalidate);

    // let activeDosageIds = changedDosages;
    // activeDosageIds = activeDosageIds.concat(newDosages);
    // let dosagesToSchedule = activeDosageIds;
    // activeDosageIds = activeDosageIds.concat(unchangedDosages);

    // // if (medication.inactiveDosages == null) {
    // //     medication.inactiveDosages = oldDosages;
    // // } else {
    // //     medication.inactiveDosages = medication.inactiveDosages.concat(
    // //         oldDosages
    // //     );
    // // }
    // // console.log({ activeDosageIds });

    // medication.dosages = activeDosageIds;
    // medication.name = updatedMedication.name;
    // medication.strength = updatedMedication.strength;
    // medication.strengthUnit = updatedMedication.strengthUnit;
    // medication.amount = updatedMedication.amount;
    // medication.amountUnit = updatedMedication.amountUnit;
    // medication.frequency = updatedMedication.frequency;
    // medication.color = updatedMedication.color;
    // await Medication.updateOne({ _id: medication.id }, medication);

    // await medication.populate("dosages").execPopulate();
    // await scheduleDosages(medication, dosagesToSchedule, medication.user);
    // return res.status(200).json(medication);
};

/**
 * Delete a medication based on its identifier
 */
export const deleteMedicationFromID = async (req, res) => {
    const { medicationID } = req.params;

    let medication = await Medication.findById(medicationID)
        .populate({
            path: "dosages",
            model: "Dosage",
            populate: {
                path: "occurrences",
                model: "Occurrence",
            },
        })
        .exec();

    if (!medication.user.equals(req.user)) {
        return res.status(404).json({
            message: "user not authorized to delete this medication!",
        });
    }

    const dosageIdsToRemove = medication.dosages.map((dose) => dose._id);
    dosageIdsToRemove.concat(
        medication.inactiveDosages.map((dose) => dose._id)
    );

    const groupsToRemove = {}; // Maps the group id (string) to an array of occurrence object ids
    const occurrenceIdsToRemove = [];
    for (let dosage of medication.dosages) {
        for (let occurrence of dosage.occurrences) {
            if (!occurrence.group) {
                occurrenceIdsToRemove.push(occurrence._id); // these occurrences don't have a group for some reason
            } else if (occurrence.group in groupsToRemove) {
                groupsToRemove[occurrence.group.toString()].push(
                    occurrence._id
                );
            } else {
                groupsToRemove[occurrence.group.toString()] = [occurrence._id];
            }
        }
    }

    await Occurrence.deleteMany({ _id: { $in: occurrenceIdsToRemove } });

    try {
        for (let [groupId, occurrenceIds] of Object.entries(groupsToRemove)) {
            // two cases:
            // case one: The group has only these occurrence ids in it. In that case, delete and deschedule the group.
            // case two: The group has other occurrences from other medication in it. Update the groups occurrences by deleting them from the array

            const groupObjectId = mongoose.Types.ObjectId(groupId);
            const group = await OccurrenceGroup.findById(groupObjectId);

            // the case where group is null here is confusing
            // that means that some other routine deleted this group before we had a chance to delete it here

            if (
                group &&
                occurrenceIds.length === group.occurrences.length &&
                group.occurrences.every((occ, idx) =>
                    occ.equals(occurrenceIds[idx])
                )
            ) {
                // deschedule and delete the group
                if (groupId in scheduler.scheduledJobs) {
                    const job = scheduler.scheduledJobs[groupId];
                    if (job) {
                        job.cancel();
                    }
                }

                await OccurrenceGroup.deleteOne({
                    _id: mongoose.Types.ObjectId(groupId),
                });
            } else if (group) {
                // remove the groups occurrence ids from this medication
                for (let occurrenceId of occurrenceIds) {
                    let indexOfOccToRemove = group.occurrences.findIndex(
                        (occ) => occ.equals(occurrenceId)
                    );
                    if (indexOfOccToRemove != -1) {
                        group.occurrences.splice(indexOfOccToRemove, 1);
                    }
                }

                await group.save();
            }

            await Occurrence.deleteMany({ _id: { $in: occurrenceIds } }).exec();
        }

        await Dosage.deleteMany({
            _id: {
                $in: dosageIdsToRemove,
            },
        }).exec();
        await Medication.findByIdAndDelete(medicationID).exec();

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Could not delete medication" });
    }

    //ensure user has permission to delete this medication
    // let medicationToRemove = await Medication.findById(
    //     req.params.medicationID,
    //     (err, medication) => {
    //         if (err) {
    //             return res.status(404).json({
    //                 message: "cannot find medication!",
    //             });
    //         } else if (!medication) {
    //             return res
    //                 .status(404)
    //                 .json({ message: "Medication not found" });
    //         } else if (!medication.user.equals(req.user)) {
    //             return res.status(404).json({
    //                 message: "user not authorized to delete this medication!",
    //             });
    //         }
    //     }
    // );

    // try {
    //     let dosagesToRemove = await Dosage.find({
    //         _id: {
    //             $in: medicationToRemove.dosages.concat(
    //                 medicationToRemove.inactiveDosages
    //             ),
    //         },
    //     });

    //     //for each dosage, delete occurrences and create occurrenceGroup array
    //     let occurrencesToRemove = [];
    //     let occurrenceGroupsToRemove = [];
    //     for (let dosage of dosagesToRemove) {
    //         let occurrences = await Occurrence.find({
    //             _id: { $in: dosage.occurrences },
    //         });
    //         for (let occurrence of occurrences) {
    //             if (occurrenceGroupsToRemove.indexOf(occurrence.group) == -1) {
    //                 occurrenceGroupsToRemove.push(occurrence.group);
    //             }
    //         }
    //         occurrencesToRemove.concat(occurrences);
    //     }

    //     await occurrenceGroupsToRemove.populate("occurrences").execPopulate();
    //     //iterate over occurrenceGroups and delete groups that only have one occurrence
    //     for (let group of occurrenceGroupsToRemove) {
    //         if (group.occurrences.length == 1) {
    //             const key = group._id.toString();
    //             //if job exists, then cancel it!
    //             if (key in scheduler.scheduledJobs) {
    //                 const job = scheduler.scheduledJobs[key];
    //                 if (job != undefined) {
    //                     job.cancel();
    //                 }
    //             }
    //             await OccurrenceGroup.deleteOne({
    //                 _id: group._id,
    //             });
    //         } else {
    //             for (let occurrence of occurrencesToRemove) {
    //                 let indexOfOccToRemove = occurrenceGroup.occurrences.findIndex(
    //                     (occ) => occ.equals(occurrence._id)
    //                 );
    //                 if (indexOfOccToRemove != -1) {
    //                     occurrenceGroup.occurrences.splice(
    //                         indexOfOccToRemove,
    //                         1
    //                     );
    //                 }
    //             }
    //             //if the occurrence group no longer has any meds just delete it
    //             //otherwise save the new group
    //             if (group.occurrences.length > 0) {
    //                 await OccurrenceGroup.deleteOne({ _id: group._id });
    //             } else {
    //                 await group.save();
    //             }
    //         }
    //     }

    //     await Occurrence.deleteMany({ _id: { $in: occurrencesToRemove } });

    //     await Dosage.deleteMany({
    //         _id: {
    //             $in: medicationToRemove.dosages.concat(
    //                 medicationToRemove.inactiveDosages
    //             ),
    //         },
    //     });
    //     await Medication.deleteOne({ _id: medicationToRemove._id });
    //     //find the user and delete the medication reference
    //     let user = await User.findById(medicationToRemove.user);
    //     let index = user.medications.findIndex((med) =>
    //         med.equals(medicationToRemove._id)
    //     );
    //     if (index != -1) {
    //         user.medications.splice(index, 1);
    //     }
    //     user.save();
    //     return res
    //         .status(200)
    //         .json({ message: "Successfully deleted medication!" });
    // } catch (err) {
    //     console.log(err);
    //     return res.status(404).json({ message: "Cannot delete medication!" });
    // }
};

export const fuzzySearchMedicationName = (req, res) => {
    let searchStr = req.params.searchStr;
    //console.log("REST/spellingsuggestions.json?name=" + searchStr);

    const req2 = https.request(
        {
            hostname: "rxnav.nlm.nih.gov",
            path:
                "/REST/spellingsuggestions.json?name=" +
                encodeURIComponent(searchStr), //append searchStr to path
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

export const getMedicationTrackingInfo = async (req, res) => {
    try {
        let user = await User.findById(req.user);
        await user
            .populate({
                path: "medications",
                model: "Medication",
                populate: {
                    // not 100% percent sure if this syntax works
                    path: "dosages inactiveDosages",
                    model: "Dosage",
                    populate: { path: "occurrences", model: "Occurrence" },
                },
            })
            .execPopulate();

        let now = new Date();
        //make sure occurrences are in range of the start and end date
        //FOR TESTING PURPOSES USE CURRENT TIME INSTEAD OF LAST 12 HOURS
        let last12Hours = now;
        //let last12Hours = now.getTime() - 1000 * 3600 * 12;
        let last30Days = now.getTime() - 1000 * 3600 * 24 * 30;
        //array of medication objects that have an id, name, and compliance value
        //representing the amount of occurrences taken for that med within the
        let trackingArr = [];
        for (let med of user.medications) {
            let takenOccurrences = 0;
            let totalOccurrences = 0;
            for (let dosage of med.dosages.concat(med.inactiveDosages)) {
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
        return res.status(200).json(trackingArr);
    } catch (err) {
        return res.status(404).json({
            message: "cannot find tracking information from user!",
        });
    }
};
