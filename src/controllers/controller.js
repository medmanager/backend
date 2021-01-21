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