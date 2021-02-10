import mongoose from 'mongoose';
import { MedicationSchema } from '../models/MedicationModel';
import { UserSchema } from '../models/userModel';
import https from 'https';
import 'lodash';

const Medication = mongoose.model('Medication', MedicationSchema);
const User = mongoose.model('User', UserSchema);

// add a new medication
export const addNewMedication = (req, res) => {
    let newMedication = new Medication(req.body);
    let relevantUser = User.findById(req.params.userID, (err, user) => {
        if (err) res.send(err);
        res.json(user);
    });
    relevantUser.medications.push(newMedication);

    newMedication.save((err, medication) => {
        if (err) res.send(err);
        res.json(medication);
    });
};

export const getMedications = (req, res) => {
    Medication.find({ userID: req.params.userID }, (err, medications) => {
        if (err) res.send(err);
        res.json(medications);
    });
};

// Potentially useful in the future? This method should work if implemented as is, just not sure if it's necessary
//
// export const getMedicationFromID = (req, res) => {
//     Medication.findById(req.params.medicationID, (err, medication) => {
//         if (err) res.send(err);
//         res.json(medication);
//     });
// };

// Should still work as is
export const updateMedicationFromID = (req, res) => {
    Medication.findOneAndUpdate({_id: req.params.medicationID}, req.body, {new: true, useFindAndModify: false}, (err, medication) => {
        if (err) res.send(err);
        res.json(medication);
    });
};

// Should still work as is
export const deleteMedicationFromID = (req, res) => {
    let relevantUser = User.findById(req.params.userID, (err, user) => {
        if (err) res.send(err);
        res.json(user);
    });
    let relevantMedication = Medication.findById(req.params.medicationID, (err, user) => {
        if (err) res.send(err);
        res.json(medication);
    });
    relevantUser.medications = _.remove(relevantUser.medications, {
        dateAdded: relevantMedication.dateAdded
    });
    Medication.remove({_id: req.params.medicationID}, (err, medication) => {
        if (err) {
            res.send(err);
        }
        res.json({ message: 'successfully deleted medication'});
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