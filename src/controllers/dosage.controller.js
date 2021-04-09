import User from "../models/User";

/**
 * returns an array of dosages independent of medications
 */
export const getDosages = (req, res) => {
    return User.findById(req.user, (err, user) => {
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
        return res.status(200).json({ dosages });
    });
};
