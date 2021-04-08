import User from "../models/User";

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
