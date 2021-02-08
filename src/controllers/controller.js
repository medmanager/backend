import mongoose from 'mongoose';
import { MedicationSchema } from '../models/MedicationModel';
import https from 'https';

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
                //I could just return respData.suggestionGroup.suggestionList...
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