import mongoose from 'mongoose';
import { MedicationSchema } from '../models/MedicationModel';

const Medication = mongoose.model('Medication', MedicationSchema);

// add a new medication
export const addNewMedication = (req, res) => {
    let newMedication = new Medication(req.body);

    newMedication.save((err, medication) => {
        if (err) res.send(err);
        res.json(medication);
    });
};

export const getMedications = (req, res) => {
    Medication.find({}, (err, medications) => {
        if (err) res.send(err);
        res.json(medications);
    });
};

export const getMedicationFromID = (req, res) => {
    Medication.findById(req.params.medicationID, (err, medication) => {
        if (err) res.send(err);
        res.json(medication);
    });
};

export const updateMedicationFromID = (req, res) => {
    Medication.findOneAndUpdate({_id: req.params.medicationID}, req.body, {new: true, useFindAndModify: false}, (err, medication) => {
        if (err) res.send(err);
        res.json(medication);
    });
};

export const deleteMedicationFromID = (req, res) => {
    Medication.remove({_id: req.params.medicationID}, (err, medication) => {
        if (err) {
            res.send(err);
        }
        res.json({ message: 'successfully deleted medication'});
    });
};

export const getTimesFromMedicationID = (req, res) => {
    //{times: 1} ensures the function will only return the times for that medication
    Medication.findById({_id: req.params.medicationID}, {times: 1},(err, times) => {
        if (err) res.send(err);
        res.json(times);
    });
};

export const getTimeFromTimeID = (req, res) => {
    //{times: {elemMatch...}} ensures the function will only return one time with the matching _id
    Medication.find({"times._id":req.params.timeID}, {times : {$elemMatch: {"_id": req.params.timeID}}},(err, time) => {
        if (err) res.send(err);
        res.json(time);
    });
};