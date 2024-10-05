import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "15m"})
    const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {expiresIn: "7d"})

    return { accessToken, refreshToken };
};

const storeRefreshToken = async(userId,refreshToken) => {
    await redis.set(`refresh_token:${userId}`,refreshToken,"EX",7*24*60*60) //7d
}

const setCookies = (res,accessToken,refreshToken) => {
    res.cookie("accessToken",accessToken,{
        httpOnly: true, // to prevent XSS attacks , cross site scripting attack
        maxAge: 15*60*1000, // 15m
        sameSite: "strict", // to prevent CSRF attacks , cross site request forgery attack
        secure: process.env.NODE_ENV === "production"
    })
    res.cookie("refreshToken",refreshToken,{
        httpOnly: true, // to prevent XSS attacks , cross site scripting attack
        maxAge: 7*24*60*60*1000, // 7d
        sameSite: "strict", // to prevent CSRF attacks , cross site request forgery attack
        secure: process.env.NODE_ENV === "production"
    })
}

export async function signup(req, res) {
    const { name, email, password } = req.body;
    // if(!name || !email || !password){
    //     return res.status(400).json({success: false, message: "All Fields Required"});
    // }

    // const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    // if(!emailRegex.test(email)){
    //     return res.status(400).json({success: false, message: "Email Invalid"});
    // }

    try {
        const existingUserByEmail = await User.findOne({email});
        if(existingUserByEmail){
            res.status(400).json({success: false, message: "Email already exists"});
        }

        const user = await User.create({name,email,password})

        // authenticate
        const { accessToken, refreshToken } = generateTokens(user._id);
        await storeRefreshToken(user._id, refreshToken);

        setCookies(res,accessToken,refreshToken);

        res.status(201).json({user:{
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }, message: "User created successfully"});

    } catch (error) {
        res.status(500).json({success: false, message: "Internal server error"});
        console.log("Error in signup controller", error.message);
    }
};
export async function login(req, res) {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({email});
        if(user && (await user.comparePassword(password))){
            const { accessToken, refreshToken } = generateTokens(user._id)
            await storeRefreshToken(user._id, refreshToken);
            setCookies(res,accessToken,refreshToken);

            res.status(200).json({success: true, user:{
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }})
        } else {
            res.status(400).json({message: "Invalud Email or Password"})
        }
    } catch (error) {
        res.status(500).json({success: false, message: "Internal server error"});
        console.log("Error in login controller", error.message);
    }
};
export async function logout(req, res) {
    try {
        const refreshToken = req.cookies.refreshToken;
        if(refreshToken){
            const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            await redis.del(`refresh_token:${decoded.userId}`)
        }
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        res.status(200).json({success: true, message: "User Logged out successfully"});
    } catch (error) {
        res.status(500).json({success: false, message: "Internal server error"});
        console.log("Error in logout controller", error.message);
    }
};

// to refresh the access token, to re-create an access token
export async function refreshToken(req, res) {
    try {
        const refreshToken = req.cookies.refreshToken;
        if(!refreshToken){
            return res.status(401).json({message: "No refresh token provided"})
        }
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

        if(storedToken !== refreshToken){
            return res.status(401).json({message: "Invalid refresh token"})
        }
        const accessToken = jwt.sign({ userId: decoded.userId}, process.env.ACCESS_TOKEN_SECRET, 
            {expiresIn: "15m"});
        res.cookie("accessToken",accessToken,{
            httpOnly: true,
            maxAge: 15*60*1000,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict"
        });
        res.json({message: "Token refreshed successfully"});
    } catch (error) {
        res.status(500).json({success: false, message: "Internal server error"});
        console.log("Error in refreshToken controller", error.message);
    }
}
// TODO implement get profile later
export async function getProfile(req, res) {
    try {
        res.json(req.user);
    } catch (error) {
        res.status(500).json({success: false, message: "Internal server error"});
        console.log("Error in getProfile controller", error.message);
    };
};
