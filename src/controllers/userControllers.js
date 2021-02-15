import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {UserSchema} from '../models/userModel';

var User = mongoose.model('User', UserSchema);

export const loginRequired = (req, res, next) => {
    if (req.user) {
        next();
    } else {
        return res.status(401).json({message: 'Unauthorized user'});
    }
}

export const register = (req, res) => {
    const newUser = new User(req.body);
    newUser.hashPassword = bcrypt.hashSync(req.body.password, 10);
    newUser.save((err, user) => {
        if (err) {
            return res.status(400).send({
                message: err
            });
        } else {
            user.hashPassword = undefined;
            return res.json(user);
        }
    });
}

export const login = (req, res) => {
    User.findOne({
        email: req.body.email
    }, (err, user) => {
        if (err) throw err;
        if (!user) {
            res.status(401).json({message: 'Authentication failed. No user found.'});
        } else if (user) {
            if (!user.comparePassword(req.body.password, user.hashPassword)) {
                res.status(401).json({message: 'Authentication failed. Wrong password.'});
            } else {
                return res.json({token: jwt.sign({email: user.email, username: user.username, _id: user.id}, 'ATLBANANA')});
            }
        }
    })
}

//verifies if the given token (as a param) is a valid token
export const verify = (req, res) => {
    let token = req.params.token;
    jwt.verify(token, 'ATLBANANA', (err, verifiedJwt) => {
        if (err) {
            res.send({isValid: false})
        } else {
            //verifiedJwt contains the user's email and the user's id
            //that the given token is associated with
            res.send({isValid: true, verifiedJwt: verifiedJwt});
        }
    })
}