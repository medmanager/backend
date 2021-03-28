import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { SettingsSchema, UserSchema } from "../models/User";

let User = mongoose.model("User", UserSchema);
let Settings = mongoose.model("Settings", SettingsSchema);

export const loginRequired = (req, res, next) => {
    if (req.user) {
        next();
    } else {
        return res.status(401).json({ message: "Unauthorized user" });
    }
};

export const register = (req, res) => {
    const newUser = new User(req.body);
    newUser.hashPassword = bcrypt.hashSync(req.body.password, 10);
    newUser.save((err, user) => {
        if (err) {
            return res.status(400).json({
                message: err,
            });
        } else {
            return res.status(200).json({ ok: true });
        }
    });
};

export const login = (req, res) => {
    User.findOne(
        {
            email: req.body.email,
        },
        (err, user) => {
            if (err) throw err;
            if (!user) {
                return res.status(401).json({
                    message:
                        "Authentication failed. Invalid email or password.",
                });
            } else if (user) {
                if (
                    !user.comparePassword(req.body.password, user.hashPassword)
                ) {
                    return res.status(401).json({
                        message:
                            "Authentication failed. Invalid email or password.",
                    });
                }

                return res.status(200).json({
                    token: jwt.sign(
                        {
                            email: user.email,
                            username: user.username,
                            _id: user.id,
                        },
                        "ATLBANANA"
                    ),
                });
            }
        }
    );
};

// export const logout = (req, res) => {
//     User.findOneAndUpdate({ _id: req.user }, );
// };

//verifies if the given token (as a param) is a valid token
export const verify = (req, res) => {
    let token = req.params.token;
    jwt.verify(token, "ATLBANANA", (err, verifiedJwt) => {
        if (err) {
            return res.send({ isValid: false });
        } else {
            //verifiedJwt contains the user's email and the user's id
            //that the given token is associated with
            res.send({ isValid: true, verifiedJwt: verifiedJwt });
        }
    });
};


// updates the settings schema located within the user based on the body data passed in
// (data passed in to the request body is the new settings schema for the given user)
export const updateUserSettings = async (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: no user found from token!"
        });
    }

    let user;
    try {
        user = await User.findById(req.user);
    } catch (err) {
        return res.status(404).json({message: "user cannot be found"});
    }

    let newSettings = new Settings(req.body);

    try {
        user.settings = newSettings;
        await user.save();
    } catch (err) {
        return res.status(500).json({
            message: "cannot save user settings!"
        });
    }

    return res.status(200).json(newSettings);
};


// updates the fields inside a user based on the request body's data passed in
// (the passed in request data is a user schema)
export const updateUser = async (req, res) => {
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: user not found from token!"
        });
    }

    let user;
    try {
        user = await User.findById(req.user);
    } catch (err) {
        return res.status(404).json({message: "user cannot be found!"});
    }

    let updatedUser = new User(req.body);
    updatedUser.hashPassword = bcrypt.hashSync(req.body.password, 10);

    try {
        User.findOneAndUpdate(
            { _id: user._id },
            req.body,
            function( error, result) {
                console.log(result);
                console.log(error);
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "cannot save the updated user!"
        });
    }

    return res.status(200).json(updatedUser);
}
