const dotenv = require('dotenv');
const connection = require('../Config/DBConfig');
dotenv.config({ path: './config.env' });
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const session  = require('express-session');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EmailForSendingOtp,
        pass: process.env.EmailPasswordForSendingOtp
    }
});




const AuthController = {
    Login: async (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.json({ status: 'failed', message: 'Please Provide Email and Password', statusCode: 400 });
        }

        const checkIfAccountExists = `SELECT * FROM users WHERE email = ?`;
        connection.query(checkIfAccountExists, [email], async (err, result) => {
            if (err) {
                console.error(err);
                return res.json({ status: 'failed', message: 'An error occurred', statusCode: 500 });
            } else if (result.length === 0) {
                return res.json({ status: 'failed', message: 'Account Does Not Exist', statusCode: 400 });
            } else {
                const hashedPassword = result[0].password;
                const passwordMatch = await bcrypt.compare(password, hashedPassword);
                if (!passwordMatch) {
                    return res.json({ status: 'failed', message: 'Invalid Password', statusCode: 400 });
                } else {
                    const token = jwt.sign({ email: email }, process.env.JWTSecret, { expiresIn: process.env.JWTExpire });
                    return res.json({ status: 'success', token: token, statusCode: 200 });
                }
            }
        });
    },

    SignUp: (req, res) => {
        const { email, password } = req.body;
        const gmailRegex = /^[a-zA-Z0-9._-]+@gmail.com$/;
        
        if (!email || !password) {
            console.log('Email or Password not provided');
            return res.json({ status: 'failed', message: 'Please Provide Email and Password', statusCode: 400 });
        } else if (!gmailRegex.test(email)) {
            console.log('Invalid Gmail Address');
            return res.json({ status: 'failed', message: 'Please Provide a Valid Gmail Address', statusCode: 400 });
        } else {
            const checkIfAccountExists = `SELECT * FROM users WHERE email = ?`;
            connection.query(checkIfAccountExists, [email], async (err, result) => {
                if (err) {
                    console.error('Database error: ', err);
                    return res.json({ status: 'failed', message: 'An error occurred', statusCode: 500 });
                } else if (result.length !== 0) {
                    console.log('Account already exists');
                    return res.json({ status: 'failed', message: 'Account Already Exists', statusCode: 400 });
                } else {
                    const otp = Math.floor(100000 + Math.random() * 900000);
                    const mailOptions = {
                        from: process.env.EmailForSendingOtp,
                        to: email,
                        subject: 'Complete Your Registration with Grrever',
                        html: `
                            <html>
                                <h2>Thank you for registering with Greever</h2>
                                <h3>Complete registration using below Otp</h3>
                                <h1>${otp}</h1>
                                <p>
                                    <span><strong>Grrever</strong></span> 
                                    is an online learning platform that offers Courses and Certifications in various fields.

                                </p>
                            </html>
                        `,
                        text: `Your OTP is ${otp}`
                    };
    
                    transporter.sendMail(mailOptions, (err, info) => {
                        if (err) {
                            console.error('Error sending OTP email: ', err);
                            return res.json({ status: 'failed', message: 'An error occurred while sending OTP', statusCode: 500 });
                        } else {
                            console.log('Email Sent: ' + info.response);
                            req.session.otp = otp;
                            req.session.email = email;
                            req.session.password = password;
                            return res.json({ status: 'success', message: 'OTP sent to your email', statusCode: 200 });
                        }
                    });
                }
            });
        }
    }
,    

    OTPVerification: async (req, res) => {
        const { otp } = req.body;
        
        if (!otp) {
            return res.json({ status: 'failed', message: 'Please provide the OTP', statusCode: 400 });
        }
    
        if (otp != req.session.otp) {
            return res.json({ status: 'failed', message: 'Invalid OTP', statusCode: 400 });
        }

    
        const email = req.session.email;
        const password = req.session.password;
    
        if (!email || !password) {
            return res.json({ status: 'failed', message: 'Invalid session data', statusCode: 500 });
        }
    
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertUserQuery = `INSERT INTO users (email, password) VALUES (?, ?)`;
    
        connection.query(insertUserQuery, [email, hashedPassword], (err, result) => {
            if (err) {
                console.error(err);
                return res.json({ status: 'failed', message: 'An error occurred while creating account', statusCode: 500 });
            } else {
                req.session.otp = null;
                req.session.email = null;
                req.session.password = null;
    
                const token = jwt.sign({ email: email }, process.env.JWTSecret, { expiresIn: process.env.JWTExpire });
                return res.json({ status: 'success', token: token, message: 'Account Created Successfully', statusCode: 200 });
            }
        });
    }
    
    
};

module.exports = AuthController;
